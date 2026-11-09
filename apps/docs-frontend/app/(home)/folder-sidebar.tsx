'use client';

import {
  ChevronDownIcon,
  ChevronRightIcon,
  FolderIcon,
  FolderPlusIcon,
  LoaderIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from 'lucide-react';
import {
  type DragEvent as ReactDragEvent,
  useCallback,
  useEffect,
  useState,
} from 'react';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { moveDocumentToFolder } from '@/lib/documents';
import {
  createFolder,
  DOCUMENT_DRAG_TYPE,
  FOLDER_DRAG_TYPE,
  type FolderTreeNodeDto,
  listFolderTree,
  removeFolder,
  updateFolder,
} from '@/lib/folders';

import { FolderDialog } from './folder-dialog';

interface FolderSidebarProps {
  organizationId: string;
  onDocumentsChanged: () => void;
}

interface FolderNodeProps {
  node: FolderTreeNodeDto;
  depth: number;
  onReload: () => void;
  onDocumentsChanged: () => void;
  onCreateChild: (parentId: string) => void;
  onRename: (folder: FolderTreeNodeDto) => void;
}

const dropFolder = async (
  targetFolderId: string | null,
  event: ReactDragEvent,
): Promise<boolean> => {
  const documentId = event.dataTransfer.getData(DOCUMENT_DRAG_TYPE);
  const movingFolderId = event.dataTransfer.getData(FOLDER_DRAG_TYPE);

  if (documentId) {
    await moveDocumentToFolder(documentId, targetFolderId);
    return true;
  }

  if (movingFolderId && movingFolderId !== targetFolderId) {
    await updateFolder(movingFolderId, { parentId: targetFolderId });
    return true;
  }

  return false;
};

const FolderNode = ({
  node,
  depth,
  onReload,
  onDocumentsChanged,
  onCreateChild,
  onRename,
}: FolderNodeProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  const handleDrop = (event: ReactDragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    void dropFolder(node.id, event)
      .then((moved) => {
        if (!moved) return;
        onReload();
        onDocumentsChanged();
      })
      .catch(() =>
        toast.add({ type: 'error', title: 'Не удалось переместить' }),
      );
  };

  const handleRemove = () => {
    if (!window.confirm(`Удалить папку «${node.name}»?`)) return;

    void removeFolder(node.id)
      .then(onReload)
      .catch(() =>
        toast.add({
          type: 'error',
          title: 'Папка не пустая или нет прав',
        }),
      );
  };

  return (
    <div>
      <div
        role="treeitem"
        aria-level={depth + 1}
        tabIndex={-1}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData(FOLDER_DRAG_TYPE, node.id);
          event.dataTransfer.effectAllowed = 'move';
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        }}
        onDrop={handleDrop}
        className="group flex items-center gap-1 rounded-md px-1 py-1 text-sm hover:bg-muted"
        style={{ paddingLeft: depth * 14 + 4 }}
      >
        <button
          type="button"
          className="flex size-4 shrink-0 items-center justify-center text-muted-foreground"
          onClick={() => setIsExpanded((value) => !value)}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDownIcon className="size-3.5" />
            ) : (
              <ChevronRightIcon className="size-3.5" />
            )
          ) : null}
        </button>
        <FolderIcon className="size-4 shrink-0 text-amber-500" />
        <span className="truncate">{node.name}</span>
        <div className="ml-auto hidden items-center group-hover:flex">
          <button
            type="button"
            title="Создать подпапку"
            className="p-1 text-muted-foreground hover:text-foreground"
            onClick={() => onCreateChild(node.id)}
          >
            <PlusIcon className="size-3.5" />
          </button>
          <button
            type="button"
            title="Переименовать"
            className="p-1 text-muted-foreground hover:text-foreground"
            onClick={() => onRename(node)}
          >
            <PencilIcon className="size-3.5" />
          </button>
          <button
            type="button"
            title="Удалить"
            className="p-1 text-muted-foreground hover:text-destructive"
            onClick={handleRemove}
          >
            <TrashIcon className="size-3.5" />
          </button>
        </div>
      </div>
      {hasChildren && isExpanded
        ? node.children.map((child) => (
            <FolderNode
              key={child.id}
              node={child}
              depth={depth + 1}
              onReload={onReload}
              onDocumentsChanged={onDocumentsChanged}
              onCreateChild={onCreateChild}
              onRename={onRename}
            />
          ))
        : null}
    </div>
  );
};

// Дерево папок организации в сайдбаре. Перемещение — минимальный HTML5
// drag-and-drop: документ тянется из таблицы, папка — из этого же дерева.
export const FolderSidebar = ({
  organizationId,
  onDocumentsChanged,
}: FolderSidebarProps) => {
  const [tree, setTree] = useState<FolderTreeNodeDto[] | null>(null);
  const [hasError, setHasError] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>();
  const [renaming, setRenaming] = useState<FolderTreeNodeDto | null>(null);

  const load = useCallback(async () => {
    try {
      setTree(await listFolderTree(organizationId));
      setHasError(false);
    } catch {
      setHasError(true);
    }
  }, [organizationId]);

  useEffect(() => {
    setTree(null);
    void load();
  }, [load]);

  const handleCreate = async (name: string) => {
    await createFolder(organizationId, {
      name,
      parentId: createParentId ?? null,
    });
    await load();
  };

  const handleRename = async (name: string) => {
    if (!renaming) return;

    await updateFolder(renaming.id, { name });
    await load();
  };

  const handleRootDrop = (event: ReactDragEvent) => {
    event.preventDefault();

    void dropFolder(null, event)
      .then((moved) => {
        if (!moved) return;
        load();
        onDocumentsChanged();
      })
      .catch(() =>
        toast.add({ type: 'error', title: 'Не удалось переместить' }),
      );
  };

  return (
    <aside className="w-64 shrink-0 border-r pr-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-medium">Папки</h4>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1"
          onClick={() => setCreateParentId(null)}
        >
          <FolderPlusIcon className="size-4" />
          Создать
        </Button>
      </div>

      {tree === null ? (
        <div className="flex justify-center py-4">
          <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : hasError ? (
        <p className="text-xs text-muted-foreground">
          Не удалось загрузить папки
        </p>
      ) : (
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            className="rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleRootDrop}
          >
            Без папки
          </button>
          {tree.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">
              Папок пока нет
            </p>
          ) : (
            <div role="tree">
              {tree.map((node) => (
                <FolderNode
                  key={node.id}
                  node={node}
                  depth={0}
                  onReload={load}
                  onDocumentsChanged={onDocumentsChanged}
                  onCreateChild={setCreateParentId}
                  onRename={setRenaming}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <FolderDialog
        open={createParentId !== undefined}
        onOpenChange={(open) => {
          if (!open) setCreateParentId(undefined);
        }}
        title="Новая папка"
        description="Название папки"
        submitLabel="Создать"
        onSubmit={handleCreate}
      />
      <FolderDialog
        open={renaming !== null}
        onOpenChange={(open) => {
          if (!open) setRenaming(null);
        }}
        title="Переименование папки"
        description="Введите новое название"
        initialName={renaming?.name ?? ''}
        submitLabel="Сохранить"
        onSubmit={handleRename}
      />
    </aside>
  );
};
