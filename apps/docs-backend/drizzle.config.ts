import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema/index.ts',
  out: './drizzle',
  introspect: {
    casing: 'camel',
  },
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
