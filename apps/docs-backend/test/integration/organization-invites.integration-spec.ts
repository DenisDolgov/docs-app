import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../src/auth/auth.service';
import { hashToken } from '../../src/auth/token';
import { UserRepository } from '../../src/auth/user.repository';
import { DATABASE, type Database } from '../../src/database/database.constants';
import { MailService } from '../../src/mail/mail.service';
import { OrganizationService } from '../../src/organization/organization.service';
import { OrganizationInviteService } from '../../src/organization/organization-invite.service';
import { createTestingModule, waitFor } from '../utils';

const PASSWORD = 'correct horse battery staple';
const nextEmail = () => `user-${randomUUID()}@example.com`;

// Контракт куска S15: секрет живёт только в письме, в БД — хеш; приглашение
// одноразовое, привязано к адресу и умирает при переотправке или по сроку.
describe('organization invites (integration)', () => {
  let auth: AuthService;
  let users: UserRepository;
  let organizations: OrganizationService;
  let invites: OrganizationInviteService;
  let mail: MailService;
  let db: Database;
  let close: () => Promise<void>;

  const register = async () => {
    const email = nextEmail();
    const user = await auth.register({ email, password: PASSWORD });

    await users.markEmailVerified(user.id);

    return { email, id: user.id };
  };

  const setupOrganization = async () => {
    const owner = await register();
    const organization = await organizations.create({
      userId: owner.id,
      name: 'Acme',
    });

    return { owner, organization };
  };

  // Токен известен только из письма — это и есть проверяемое свойство. Ждём
  // асинхронную отправку, не полагаясь на порядок внутри `issue`.
  const inviteAndReadToken = async ({
    organizationId,
    actorId,
    email,
    role,
  }: {
    organizationId: string;
    actorId: string;
    email: string;
    role: 'admin' | 'member';
  }) => {
    const send = vi
      .spyOn(mail, 'sendOrganizationInvite')
      .mockResolvedValue({ messageId: 'test-message' });

    try {
      await invites.invite({ organizationId, actorId, email, role });
      await waitFor(() => send.mock.calls.length > 0);

      return send.mock.calls[0][0].token;
    } finally {
      send.mockRestore();
    }
  };

  beforeAll(async () => {
    const moduleRef = await createTestingModule();

    auth = moduleRef.get(AuthService);
    users = moduleRef.get(UserRepository);
    organizations = moduleRef.get(OrganizationService);
    invites = moduleRef.get(OrganizationInviteService);
    mail = moduleRef.get(MailService);
    db = moduleRef.get(DATABASE);
    close = () => moduleRef.close();
  });

  afterAll(async () => {
    await close();
  });

  it('хранит в БД хеш, а не токен', async () => {
    const { owner, organization } = await setupOrganization();
    const invitee = await register();

    const token = await inviteAndReadToken({
      organizationId: organization.id,
      actorId: owner.id,
      email: invitee.email,
      role: 'member',
    });

    const result = await db.execute<{ token_hash: string }>(
      sql`select token_hash from organization.organization_invites
where organization_id = ${organization.id} and email = ${invitee.email}`,
    );

    expect(result.rows[0]?.token_hash).toBe(hashToken(token));
    expect(result.rows[0]?.token_hash).not.toBe(token);
  });

  it('повторное приглашение гасит прежний токен', async () => {
    const { owner, organization } = await setupOrganization();
    const invitee = await register();

    const firstToken = await inviteAndReadToken({
      organizationId: organization.id,
      actorId: owner.id,
      email: invitee.email,
      role: 'member',
    });
    const secondToken = await inviteAndReadToken({
      organizationId: organization.id,
      actorId: owner.id,
      email: invitee.email,
      role: 'member',
    });

    expect(secondToken).not.toBe(firstToken);

    const live = await db.execute<{ count: string }>(
      sql`select count(*)::text as count from organization.organization_invites
where organization_id = ${organization.id} and email = ${invitee.email}
  and revoked_at is null and accepted_at is null`,
    );

    expect(live.rows[0]?.count).toBe('1');

    await expect(
      invites.accept({ token: firstToken, userId: invitee.id }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      invites.accept({ token: secondToken, userId: invitee.id }),
    ).resolves.toMatchObject({ role: 'member' });
  });

  it('просроченное приглашение не принимается', async () => {
    const { owner, organization } = await setupOrganization();
    const invitee = await register();

    const token = await inviteAndReadToken({
      organizationId: organization.id,
      actorId: owner.id,
      email: invitee.email,
      role: 'member',
    });

    await db.execute(
      sql`update organization.organization_invites
set expires_at = now() - interval '1 second'
where organization_id = ${organization.id} and email = ${invitee.email}`,
    );

    await expect(
      invites.accept({ token, userId: invitee.id }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('принятие чужим email отклонено', async () => {
    const { owner, organization } = await setupOrganization();
    const invitee = await register();
    const stranger = await register();

    const token = await inviteAndReadToken({
      organizationId: organization.id,
      actorId: owner.id,
      email: invitee.email,
      role: 'member',
    });

    await expect(
      invites.accept({ token, userId: stranger.id }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('принятие добавляет участника с указанной ролью', async () => {
    const { owner, organization } = await setupOrganization();
    const invitee = await register();

    const token = await inviteAndReadToken({
      organizationId: organization.id,
      actorId: owner.id,
      email: invitee.email,
      role: 'admin',
    });

    await expect(
      invites.accept({ token, userId: invitee.id }),
    ).resolves.toMatchObject({
      organizationId: organization.id,
      role: 'admin',
    });

    await expect(
      organizations.getMemberRole(organization.id, invitee.id),
    ).resolves.toBe('admin');
  });

  it('повторное принятие отклонено', async () => {
    const { owner, organization } = await setupOrganization();
    const invitee = await register();

    const token = await inviteAndReadToken({
      organizationId: organization.id,
      actorId: owner.id,
      email: invitee.email,
      role: 'member',
    });

    await invites.accept({ token, userId: invitee.id });

    await expect(
      invites.accept({ token, userId: invitee.id }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('список отдаёт только живые приглашения', async () => {
    const { owner, organization } = await setupOrganization();
    const accepted = await register();
    const expired = await register();
    const live = await register();

    const acceptedToken = await inviteAndReadToken({
      organizationId: organization.id,
      actorId: owner.id,
      email: accepted.email,
      role: 'member',
    });
    await inviteAndReadToken({
      organizationId: organization.id,
      actorId: owner.id,
      email: expired.email,
      role: 'member',
    });
    await inviteAndReadToken({
      organizationId: organization.id,
      actorId: owner.id,
      email: live.email,
      role: 'member',
    });

    await invites.accept({ token: acceptedToken, userId: accepted.id });
    await db.execute(
      sql`update organization.organization_invites
set expires_at = now() - interval '1 second'
where organization_id = ${organization.id} and email = ${expired.email}`,
    );

    const list = await invites.list({
      organizationId: organization.id,
      actorId: owner.id,
    });

    expect(list.map((invite) => invite.email)).toEqual([live.email]);
  });

  it('принятие, когда участник уже добавлен напрямую, — конфликт, а не 500', async () => {
    const { owner, organization } = await setupOrganization();
    const invitee = await register();

    const token = await inviteAndReadToken({
      organizationId: organization.id,
      actorId: owner.id,
      email: invitee.email,
      role: 'admin',
    });

    await organizations.addMember({
      organizationId: organization.id,
      actorId: owner.id,
      email: invitee.email,
      role: 'member',
    });

    await expect(
      invites.accept({ token, userId: invitee.id }),
    ).rejects.toBeInstanceOf(ConflictException);

    // Роль из письма не применилась: остался уровень прямого добавления.
    await expect(
      organizations.getMemberRole(organization.id, invitee.id),
    ).resolves.toBe('member');
  });
});
