import type { Presence } from '@docs-app/contracts/collab';

export type { Presence };

const hashString = (value: string): number => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
};

export const presenceFromEmail = (email: string): Presence => {
  const color = (hashString(email) % 0xffffff).toString(16).padStart(6, '0');

  return { name: email, color: `#${color}` };
};
