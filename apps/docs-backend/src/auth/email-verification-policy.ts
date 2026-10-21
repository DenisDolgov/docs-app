import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { EMAIL_NOT_VERIFIED_ERROR, UNAUTHORIZED_ERROR } from './errors';
import { UserRepository } from './user.repository';

@Injectable()
export class EmailVerificationPolicy {
  constructor(private readonly userRepository: UserRepository) {}

  public async assertEmailVerified(userId: string): Promise<void> {
    const userRecord = await this.userRepository.findById(userId);

    if (!userRecord) throw new UnauthorizedException(UNAUTHORIZED_ERROR);

    if (!userRecord.emailVerifiedAt)
      throw new ForbiddenException(EMAIL_NOT_VERIFIED_ERROR);
  }
}
