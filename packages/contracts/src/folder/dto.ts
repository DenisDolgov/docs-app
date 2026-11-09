import { z } from 'zod';

import { documentAccessLevels } from '../document/access';

const folderName = z.string().min(1).max(255);

export const createFolderDto = z.object({
  name: folderName,
  // `null` и отсутствие поля означают корень организации.
  parentId: z.uuidv7().nullish(),
});

// PATCH — частичное обновление: можно переименовать, переместить или то и
// другое сразу. Пустой запрос отвергаем, иначе он выглядит как успешная
// операция, которая ничего не сделала.
export const updateFolderDto = z
  .object({
    name: folderName.optional(),
    parentId: z.uuidv7().nullable().optional(),
  })
  .refine((value) => value.name !== undefined || value.parentId !== undefined, {
    message: 'Нужно передать name или parentId',
  });

export const folderIdSchema = z.uuidv7();

export const folderResponseDto = z.object({
  id: z.uuidv7(),
  organizationId: z.uuidv7(),
  parentId: z.uuidv7().nullable(),
  name: z.string(),
  createdBy: z.uuidv7(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export interface FolderTreeNodeDto extends FolderDto {
  children: FolderTreeNodeDto[];
}

// Дерево строится на сервере: клиенту не нужно повторять алгоритм сборки
// потомков из плоского списка. `z.lazy` — единственный способ описать
// рекурсивную форму в zod.
export const folderTreeResponseDto: z.ZodType<FolderTreeNodeDto> = z.object({
  ...folderResponseDto.shape,
  get children() {
    return z.array(folderTreeResponseDto);
  },
});

export const grantFolderShareDto = z.object({
  email: z.email(),
  role: z.enum(documentAccessLevels),
});

export const folderShareResponseDto = z.object({
  id: z.uuidv7(),
  folderId: z.uuidv7(),
  userId: z.uuidv7(),
  email: z.email(),
  role: z.enum(documentAccessLevels),
  createdAt: z.iso.datetime(),
});

export const folderShareUserIdSchema = z.uuidv7();

export type CreateFolderDto = z.infer<typeof createFolderDto>;
export type UpdateFolderDto = z.infer<typeof updateFolderDto>;
export type FolderDto = z.infer<typeof folderResponseDto>;
export type GrantFolderShareDto = z.infer<typeof grantFolderShareDto>;
export type FolderShareDto = z.infer<typeof folderShareResponseDto>;
