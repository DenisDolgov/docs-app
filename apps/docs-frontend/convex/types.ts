import type { UserIdentity } from 'convex/server';

export interface ClerkUserIdentity extends UserIdentity {
  o?: {
    id: string;
    slg: string;
    rol: 'admin' | 'member';
  };
}
