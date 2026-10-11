import { type ExecutionContext } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { currentUserFactory } from '../../src/auth/current-user.decorator';

const contextFor = (user: unknown) => {
  const request = { user };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
};

describe('currentUserFactory (unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('возвращает payload пользователя из request.user', () => {
    const user = { sub: 'user-1', email: 'user@example.com' };

    expect(currentUserFactory(undefined, contextFor(user))).toEqual(user);
  });

  it('возвращает undefined, если гуард не положил пользователя', () => {
    expect(
      currentUserFactory(undefined, contextFor(undefined)),
    ).toBeUndefined();
  });

  it('не мутирует и не подменяет payload', () => {
    const user = { sub: 'user-1', email: 'user@example.com' };

    const result = currentUserFactory(undefined, contextFor(user));

    expect(result).toBe(user);
  });
});
