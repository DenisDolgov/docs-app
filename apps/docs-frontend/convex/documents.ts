import { paginationOptsValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';

import {
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from '@/convex/_generated/server';
import type { ClerkUserIdentity } from '@/convex/types';

const checkAuth = async (ctx: QueryCtx | MutationCtx) => {
  const user = await ctx.auth.getUserIdentity();

  if (!user) {
    throw new ConvexError({
      code: 'UNAUTHORIZED',
      message: 'Unauthorized',
    });
  }

  return user as ClerkUserIdentity;
};

export const get = query({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
  },
  handler: async (ctx, { paginationOpts, search }) => {
    const user = await checkAuth(ctx);

    const organizationId = user.o?.id;

    if (search && organizationId) {
      return ctx.db
        .query('documents')
        .withSearchIndex('search_title', (q) =>
          q.search('title', search).eq('organizationId', organizationId),
        )
        .paginate(paginationOpts);
    }

    if (search) {
      return ctx.db
        .query('documents')
        .withSearchIndex('search_title', (q) =>
          q.search('title', search).eq('ownerId', user.subject),
        )
        .paginate(paginationOpts);
    }

    if (organizationId) {
      return ctx.db
        .query('documents')
        .withIndex('by_organization_id', (q) =>
          q.eq('organizationId', organizationId),
        )
        .paginate(paginationOpts);
    }

    return ctx.db
      .query('documents')
      .withIndex('by_owner_id', (q) => q.eq('ownerId', user.subject))
      .paginate(paginationOpts);
  },
});

export const create = mutation({
  args: {
    title: v.optional(v.string()),
    initialContent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await checkAuth(ctx);

    const organizationId = user.o?.id;

    return ctx.db.insert('documents', {
      title: args.title ?? 'Новый документ',
      ownerId: user.subject,
      organizationId,
      initialContent: args.initialContent,
    });
  },
});

export const removeById = mutation({
  args: {
    id: v.id('documents'),
  },
  handler: async (ctx, args) => {
    const user = await checkAuth(ctx);
    const organizationId = user.o?.id;
    const document = await ctx.db.get(args.id);

    if (!document) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Document not found',
      });
    }

    const isOwner = document.ownerId === user.subject;
    const isOrganizationMember = document.organizationId === organizationId;

    if (!isOwner && !isOrganizationMember) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'Forbidden',
      });
    }

    return ctx.db.delete(args.id);
  },
});

export const updateById = mutation({
  args: {
    id: v.id('documents'),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await checkAuth(ctx);
    const organizationId = user.o?.id;
    const document = await ctx.db.get(args.id);

    if (!document) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Document not found',
      });
    }

    const isOwner = document.ownerId === user.subject;
    const isOrganizationMember = document.organizationId === organizationId;

    if (!isOwner && !isOrganizationMember) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'Forbidden',
      });
    }

    return ctx.db.patch(args.id, { title: args.title });
  },
});
