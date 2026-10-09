import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthService } from '../../src/auth/auth.service';
import { DATABASE, type Database } from '../../src/database/database.constants';
import { OrganizationService } from '../../src/organization/organization.service';
import { OrganizationMemberRepository } from '../../src/organization/organization-member.repository';
import { createTestApp } from '../utils';

const PASSWORD = 'correct horse battery staple';
const nextEmail = () => `user-${randomUUID()}@example.com`;

describe('organizations (integration)', () => {
  let auth: AuthService;
  let organizationService: OrganizationService;
  let memberService: OrganizationMemberRepository;
  let db: Database;
  let close: () => Promise<void>;

  const register = async () => {
    const email = nextEmail();
    const user = await auth.register({ email, password: PASSWORD });

    return { email, id: user.id };
  };

  beforeAll(async () => {
    const moduleRef = await createTestApp();

    auth = moduleRef.get(AuthService);
    organizationService = moduleRef.get(OrganizationService);
    memberService = moduleRef.get(OrganizationMemberRepository);
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

    const membership = await memberService.findByOrgAndUser(
      organization.id,
      owner.id,
    );

    expect(organization).toMatchObject({ name: 'Acme' });
    expect(organization.id).toEqual(expect.any(String));
    expect(membership?.role).toBe('owner');
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
    const result = await db.execute<{ count: string }>(
      sql`select count(*)::text as count
from information_schema.referential_constraints rc
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = rc.constraint_name
where ccu.table_schema = 'auth'`,
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
      memberService.create({
        organizationId: organization.id,
        userId: owner.id,
        role: 'member',
      }),
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
});
