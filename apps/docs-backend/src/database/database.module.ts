import { Module, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { DATABASE } from './database.constants';
import { relations } from './schema';
import { UnitOfWork } from './unit-of-work';

@Module({
  providers: [
    {
      provide: Pool,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new Pool({
          connectionString: configService.getOrThrow<string>('DATABASE_URL'),
        }),
    },
    {
      provide: DATABASE,
      inject: [Pool],
      useFactory: (pool: Pool) =>
        drizzle({
          client: pool,
          relations,
        }),
    },
    UnitOfWork,
  ],
  exports: [DATABASE, UnitOfWork],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(private readonly pool: Pool) {}

  async onModuleDestroy() {
    await this.pool.end();
  }
}
