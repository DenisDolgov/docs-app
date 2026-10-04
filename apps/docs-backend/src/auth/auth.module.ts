import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserRepository } from './user.repository';

@Module({
  imports: [DatabaseModule],
  providers: [UserRepository, AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
