import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';

const DEFAULT_DATABASE_URL = 'postgres://user:pass@localhost:5432/docs';
const MIGRATIONS_FOLDER = fileURLToPath(new URL('../drizzle', import.meta.url));

const probe = (host: string, port: number, timeout = 1000) =>
  new Promise<boolean>((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeout);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });

const withoutDb = (url: URL, database: string) => {
  const admin = new URL(url.toString());
  admin.pathname = `/${database}`;
  return admin.toString();
};

export default async function setup() {
  const source = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  const url = new URL(source);
  const host = url.hostname;
  const port = Number(url.port || 5432);

  if (!(await probe(host, port))) {
    throw new Error(
      `Инфра не поднята: Postgres ${host}:${port} недоступен. Запусти pnpm infra:up`,
    );
  }

  const testDatabase = `${url.pathname.slice(1)}_test`;

  const admin = new Client({ connectionString: withoutDb(url, 'postgres') });
  await admin.connect();

  const existing = await admin.query(
    'select 1 from pg_database where datname = $1',
    [testDatabase],
  );
  if (existing.rowCount === 0) {
    await admin.query(`create database "${testDatabase}"`);
  }
  await admin.end();

  url.pathname = `/${testDatabase}`;
  const testUrl = url.toString();
  process.env.DATABASE_URL = testUrl;

  const client = new Client({ connectionString: testUrl });
  await client.connect();
  await migrate(drizzle({ client }), { migrationsFolder: MIGRATIONS_FOLDER });
  await client.query(
    'truncate auth.users, auth.refresh_tokens, documents.documents cascade',
  );
  await client.end();

  return async () => {};
}
