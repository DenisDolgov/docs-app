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
