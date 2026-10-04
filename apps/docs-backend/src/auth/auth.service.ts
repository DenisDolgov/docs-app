import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as argon2 from 'argon2';

import { isUniqueViolation } from '../database/sql-errors';
import { RegisterDto } from './dto/register.dto';
import { USER_EMAIL_ALREADY_EXISTS } from './errors';
import { UserRepository } from './user.repository';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(private readonly userRepository: UserRepository) {}

  public async register({ email, password }: RegisterDto) {
    const existing = await this.userRepository.findByEmail(email);

    if (existing) {
      throw new ConflictException(USER_EMAIL_ALREADY_EXISTS);
    }

    const passwordHash = await argon2.hash(password);

    try {
      return await this.userRepository.create({ email, passwordHash });
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(USER_EMAIL_ALREADY_EXISTS);
      }

      this.logger.error(error);
      throw new InternalServerErrorException();
    }
  }
}
