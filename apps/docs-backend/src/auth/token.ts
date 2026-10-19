import { createHash, randomBytes } from 'node:crypto';

export const generateToken = () => {
  return randomBytes(32).toString('base64url');
};

export const hashToken = (token: string) => {
  return createHash('sha256').update(token).digest('hex');
};
