import { Inject, Injectable } from '@nestjs/common';

import { DATABASE, type Database } from '../database/database.constants';
import * as schema from '../database/schema';
import { OneTimeTokenRepository } from './one-time-token.repository';

@Injectable()
export class PasswordResetTokenRepository extends OneTimeTokenRepository {
  constructor(@Inject(DATABASE) db: Database) {
    super(db, schema.passwordResetTokens);
  }
}
