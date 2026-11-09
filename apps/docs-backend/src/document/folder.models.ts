// Папка — узел дерева внутри организации. Личных папок в v1.0 нет.
export interface FolderView {
  id: string;
  organizationId: string;
  parentId: string | null;
  name: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Ответ `GET /organizations/:id/folders`: собранное на сервере дерево.
export interface FolderTreeNode extends FolderView {
  children: FolderTreeNode[];
}

export interface CreateFolderParams {
  organizationId: string;
  actorId: string;
  name: string;
  parentId: string | null;
}

export interface UpdateFolderParams {
  folderId: string;
  actorId: string;
  name?: string;
  // `null` — поднять в корень организации.
  parentId?: string | null;
}

export type RemoveFolderParams = {
  folderId: string;
  actorId: string;
};

export type ListFoldersParams = {
  organizationId: string;
  actorId: string;
};

// Изменение папки для репозитория: `undefined` — поле не трогаем,
// `null` — явное значение (для `parentId` это корень).
export interface FolderChanges {
  name?: string;
  parentId?: string | null;
}
