import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module';

export const waitFor = async (
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 3000,
) => {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    if (await predicate()) return;

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error('waitFor: условие не выполнено за отведённое время');
};

export const createTestApp = () => {
  return Test.createTestingModule({
    imports: [AppModule],
  }).compile();
};
