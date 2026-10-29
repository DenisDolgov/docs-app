import { randomUUID } from 'node:crypto';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthService } from '../../src/auth/auth.service';
import { UserRepository } from '../../src/auth/user.repository';
import { DATABASE, type Database } from '../../src/database/database.constants';
import { OrganizationService } from '../../src/organization/organization.service';
import { OrganizationInviteService } from '../../src/organization/organization-invite.service';
import { createTestingModule } from '../utils';

const PASSWORD = 'correct horse battery staple';
const nextEmail = () => `user-${randomUUID()}@example.com`;

describe('organizations (integration)', () => {
  let auth: AuthService;
  let users: UserRepository;
  let organizationService: OrganizationService;
  let invites: OrganizationInviteService;
  let db: Database;
  let close: () => Promise<void>;

  const register = async () => {
    const email = nextEmail();
    const user = await auth.register({ email, password: PASSWORD });

    // Организацию создаёт только подтверждённый пользователь.
    // Старые сценарии проверяют членство и роли, поэтому адрес подтверждён.
    await users.markEmailVerified(user.id);

    return { email, id: user.id };
  };

  beforeAll(async () => {
    const moduleRef = await createTestingModule();

    auth = moduleRef.get(AuthService);
    users = moduleRef.get(UserRepository);
    organizationService = moduleRef.get(OrganizationService);
    invites = moduleRef.get(OrganizationInviteService);
    db = moduleRef.get(DATABASE);
    close = () => moduleRef.close();
  });

  afterAll(async () => {
    await close();
  });

  it('создаёт организацию и делает создателя владельцем', async () => {
    const owner = await register();

    const organization = await organizationService.create({
      userId: owner.id,
      name: 'Acme',
    });

    const role = await organizationService.getMemberRole(
      organization.id,
      owner.id,
    );

    expect(organization).toMatchObject({ name: 'Acme' });
    expect(organization.id).toEqual(expect.any(String));
    expect(role).toBe('owner');
  });

  it('создаёт таблицу organization.organizations с нужными колонками', async () => {
    const result = await db.execute<{ column_name: string }>(
      sql`select column_name from information_schema.columns
where table_schema = 'organization' and table_name = 'organizations'
order by column_name`,
    );

    expect(result.rows.map((row) => row.column_name)).toEqual([
      'created_at',
      'id',
      'name',
    ]);
  });

  it('создаёт таблицу organization.organization_members с нужными колонками', async () => {
    const result = await db.execute<{ column_name: string }>(
      sql`select column_name from information_schema.columns
where table_schema = 'organization' and table_name = 'organization_members'
order by column_name`,
    );

    expect(result.rows.map((row) => row.column_name)).toEqual([
      'created_at',
      'id',
      'organization_id',
      'role',
      'user_id',
    ]);
  });

  it('не заводит cross-schema ссылок на auth.users', async () => {
    // FK внутри auth допустим (refresh_tokens → users), запрещены только
    // ссылки из чужих схем: удаление пользователя не должно каскадить данные
    // organization/document неявно.
    const result = await db.execute<{ count: string }>(
      sql`select count(*)::text as count
from information_schema.referential_constraints rc
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = rc.constraint_name
 and ccu.constraint_schema = rc.constraint_schema
join information_schema.constraint_table_usage ctu
  on ctu.constraint_name = rc.constraint_name
 and ctu.constraint_schema = rc.constraint_schema
where ccu.table_schema = 'auth'
  and ctu.table_schema <> 'auth'`,
    );

    expect(result.rows[0]?.count).toBe('0');
  });

  it('запрещает два членства одного пользователя в одной организации', async () => {
    const owner = await register();
    const organization = await organizationService.create({
      userId: owner.id,
      name: 'Acme',
    });

    await expect(
      db.execute(
        sql`insert into organization.organization_members
  (organization_id, user_id, role)
values (${organization.id}, ${owner.id}, 'member')`,
      ),
    ).rejects.toThrow();

    const result = await db.execute<{ count: string }>(
      sql`select count(*)::text as count from organization.organization_members
where organization_id = ${organization.id} and user_id = ${owner.id}`,
    );

    expect(result.rows[0]?.count).toBe('1');
  });

  it('отклоняет роль вне owner/admin/member на уровне БД', async () => {
    const owner = await register();
    const organization = await organizationService.create({
      userId: owner.id,
      name: 'Acme',
    });

    await expect(
      db.execute(
        sql`insert into organization.organization_members
(organization_id, user_id, role)
values (${organization.id}, ${randomUUID()}, 'superuser')`,
      ),
    ).rejects.toThrow();
  });

  it('на повторное добавление участника отвечает конфликтом', async () => {
    const owner = await register();
    const target = await register();
    const organization = await organizationService.create({
      userId: owner.id,
      name: 'Acme',
    });

    await organizationService.addMember({
      organizationId: organization.id,
      actorId: owner.id,
      email: target.email,
      role: 'member',
    });

    await expect(
      organizationService.addMember({
        organizationId: organization.id,
        actorId: owner.id,
        email: target.email,
        role: 'admin',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    const result = await db.execute<{ count: string }>(
      sql`select count(*)::text as count from organization.organization_members
where organization_id = ${organization.id} and user_id = ${target.id}`,
    );

    expect(result.rows[0]?.count).toBe('1');
  });

  it('возвращает организации только того пользователя, кому они принадлежат', async () => {
    const first = await register();
    const second = await register();

    const organization = await organizationService.create({
      userId: first.id,
      name: 'Acme',
    });

    const firstList = await organizationService.listForUser(first.id);
    const secondList = await organizationService.listForUser(second.id);

    expect(firstList.map((item) => item.id)).toContain(organization.id);
    expect(secondList.map((item) => item.id)).not.toContain(organization.id);
  });

  it('участник с ролью member не может приглашать', async () => {
    const owner = await register();
    const member = await register();
    const target = await register();
    const organization = await organizationService.create({
      userId: owner.id,
      name: 'Acme',
    });

    await organizationService.addMember({
      organizationId: organization.id,
      actorId: owner.id,
      email: member.email,
      role: 'member',
    });

    await expect(
      invites.invite({
        organizationId: organization.id,
        actorId: member.id,
        email: target.email,
        role: 'member',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('неподтверждённый владелец не может приглашать', async () => {
    const owner = await register();
    const target = await register();
    const organization = await organizationService.create({
      userId: owner.id,
      name: 'Acme',
    });

    // Создание организации проверило флаг, но приглашение проверяет его снова:
    // снять подтверждение можно и после создания.
    await db.execute(
      sql`update auth.users set email_verified_at = null where id = ${owner.id}`,
    );

    await expect(
      invites.invite({
        organizationId: organization.id,
        actorId: owner.id,
        email: target.email,
        role: 'member',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
