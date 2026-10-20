import { Inject, Injectable } from '@nestjs/common';

import { DATABASE, type Database, type DbExecutor } from './database.constants';

// Тонкая обёртка над `db.transaction`: сервис описывает границу единицы
// работы, а репозитории получают уже открытый `tx`.
@Injectable()
export class UnitOfWork {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  run<T>(work: (tx: DbExecutor) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => work(tx));
  }
}
