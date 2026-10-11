import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

import { AccessTokenPayload } from './auth.models';

export const currentUserFactory = (
  data: keyof AccessTokenPayload | undefined,
  context: ExecutionContext,
) => {
  const request = context.switchToHttp().getRequest<Request>();
  return data ? request.user?.[data] : request.user;
};

export const CurrentUser = createParamDecorator(currentUserFactory);
