import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { isForeignKeyViolation } from '../database/sql-errors';
import { UnitOfWork } from '../database/unit-of-work';
import { OrganizationService } from '../organization/organization.service';
import { AccessPolicyService } from '../permission/access-policy.service';
import {
  DOCUMENT_FOLDER_MISMATCH_ERROR,
  FOLDER_CYCLE_ERROR,
  FOLDER_NOT_EMPTY_ERROR,
  FOLDER_NOT_FOUND_ERROR,
} from './errors';
import type {
  CreateFolderParams,
  FolderChanges,
  FolderTreeNode,
  FolderView,
  ListFoldersParams,
  RemoveFolderParams,
  UpdateFolderParams,
} from './folder.models';
import { FolderRepository } from './folder.repository';

const byName = (left: FolderView, right: FolderView) =>
  left.name.localeCompare(right.name, 'ru');

@Injectable()
export class FolderService {
  constructor(
    private readonly folderRepository: FolderRepository,
    private readonly organizationService: OrganizationService,
    private readonly accessPolicy: AccessPolicyService,
    private readonly auditService: AuditService,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  public async listTree({
    organizationId,
    actorId,
  }: ListFoldersParams): Promise<FolderTreeNode[]> {
    await this.organizationService.requireMember(organizationId, actorId);

    const folders =
      await this.folderRepository.listByOrganization(organizationId);

    return buildTree(folders);
  }

  public async create({
    organizationId,
    actorId,
    name,
    parentId,
  }: CreateFolderParams): Promise<FolderView> {
    await this.organizationService.requireMember(organizationId, actorId);

    if (parentId) {
      const parent = await this.folderRepository.findByIdInOrganization(
        parentId,
        organizationId,
      );

      if (!parent) throw new NotFoundException(FOLDER_NOT_FOUND_ERROR);
    }

    return this.unitOfWork.run(async (tx) => {
      const folder = await this.folderRepository.create(
        {
          organizationId,
          parentId,
          name,
          createdBy: actorId,
        },
        tx,
      );

      await this.auditService.record(
        {
          actorId,
          action: 'folder.created',
          targetType: 'folder',
          targetId: folder.id,
          metadata: { name, parentId },
        },
        tx,
      );

      return folder;
    });
  }

  public async update({
    folderId,
    actorId,
    name,
    parentId,
  }: UpdateFolderParams): Promise<FolderView> {
    const folder = await this.folderRepository.findById(folderId);

    if (!folder) throw new NotFoundException(FOLDER_NOT_FOUND_ERROR);

    await this.accessPolicy.assertFolderAccess({
      folderId,
      principal: { userId: actorId },
      required: 'editor',
    });

    const changes: FolderChanges = {};

    if (name !== undefined) changes.name = name;
    if (parentId !== undefined) changes.parentId = parentId;

    if (Object.keys(changes).length === 0) return folder;

    const updated = await this.unitOfWork.run(async (tx) => {
      // Проверка цикла и запись — в одной транзакции, а перемещения в
      // организации сериализованы локом. Иначе два встречных перемещения
      // проходят проверку одновременно и создают цикл.
      if (changes.parentId !== undefined) {
        await this.folderRepository.lockMovesInOrganization(
          folder.organizationId,
          tx,
        );
      }

      const current = await this.folderRepository.findById(folderId, tx);

      if (!current) return null;

      if (changes.parentId !== undefined && changes.parentId !== null) {
        // Перемещение в самого себя и в собственного потомка ломает дерево:
        // self-FK такую запись пропустит, поэтому проверяем до записи.
        if (changes.parentId === folderId) {
          throw new ConflictException(FOLDER_CYCLE_ERROR);
        }

        const parent = await this.folderRepository.findByIdInOrganization(
          changes.parentId,
          current.organizationId,
          tx,
        );

        if (!parent) throw new NotFoundException(FOLDER_NOT_FOUND_ERROR);

        const inSubtree = await this.folderRepository.isInSubtree(
          folderId,
          changes.parentId,
          tx,
        );

        if (inSubtree) throw new ConflictException(FOLDER_CYCLE_ERROR);
      }

      const updated = await this.folderRepository.update(folderId, changes, tx);

      if (!updated) return null;

      if (changes.name !== undefined) {
        await this.auditService.record(
          {
            actorId,
            action: 'folder.renamed',
            targetType: 'folder',
            targetId: folderId,
            metadata: { from: current.name, to: changes.name },
          },
          tx,
        );
      }

      if (changes.parentId !== undefined) {
        await this.auditService.record(
          {
            actorId,
            action: 'folder.moved',
            targetType: 'folder',
            targetId: folderId,
            metadata: { from: current.parentId, to: changes.parentId },
          },
          tx,
        );
      }

      return updated;
    });

    if (!updated) throw new NotFoundException(FOLDER_NOT_FOUND_ERROR);

    // Переезд меняет путь, а значит и право всего поддерева.
    if (changes.parentId !== undefined) {
      await this.accessPolicy.invalidateFolder(folderId);
    }

    return updated;
  }

  public async remove({
    folderId,
    actorId,
  }: RemoveFolderParams): Promise<void> {
    const folder = await this.folderRepository.findById(folderId);

    if (!folder) throw new NotFoundException(FOLDER_NOT_FOUND_ERROR);

    await this.accessPolicy.assertFolderAccess({
      folderId,
      principal: { userId: actorId },
      required: 'editor',
    });

    try {
      const removed = await this.unitOfWork.run(async (tx) => {
        // Проверка и удаление — в одной транзакции: иначе документ может
        // переехать в папку между `count` и `delete`.
        const content = await this.folderRepository.countContent(folderId, tx);

        if (content.folders > 0 || content.documents > 0) {
          throw new ConflictException(FOLDER_NOT_EMPTY_ERROR);
        }

        const removed = await this.folderRepository.remove(folderId, tx);

        if (!removed) return false;

        await this.auditService.record(
          {
            actorId,
            action: 'folder.removed',
            targetType: 'folder',
            targetId: folderId,
            metadata: { name: folder.name, parentId: folder.parentId },
          },
          tx,
        );

        return true;
      });

      if (!removed) throw new NotFoundException(FOLDER_NOT_FOUND_ERROR);
    } catch (error) {
      // Гонка: содержимое появилось после проверки. FK внутри схемы её ловит.
      if (isForeignKeyViolation(error)) {
        throw new ConflictException(FOLDER_NOT_EMPTY_ERROR);
      }

      throw error;
    }
  }

  // Перенос документа проверяет, что папка из той же организации, что и
  // документ: иначе документ уехал бы в чужое дерево прав.
  public async assertFolderForDocument(
    folderId: string,
    organizationId: string | null,
  ): Promise<FolderView> {
    if (!organizationId) {
      throw new ConflictException(DOCUMENT_FOLDER_MISMATCH_ERROR);
    }

    const folder = await this.folderRepository.findByIdInOrganization(
      folderId,
      organizationId,
    );

    if (!folder) throw new NotFoundException(FOLDER_NOT_FOUND_ERROR);

    return folder;
  }
}

const buildTree = (folders: FolderView[]): FolderTreeNode[] => {
  const nodes = new Map<string, FolderTreeNode>(
    folders.map((folder) => [folder.id, { ...folder, children: [] }]),
  );
  const roots: FolderTreeNode[] = [];

  for (const folder of folders) {
    const node = nodes.get(folder.id);

    if (!node) continue;

    const parent = folder.parentId ? nodes.get(folder.parentId) : undefined;

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sort = (items: FolderTreeNode[]) => {
    items.sort(byName);
    for (const item of items) sort(item.children);
  };

  sort(roots);

  return roots;
};
