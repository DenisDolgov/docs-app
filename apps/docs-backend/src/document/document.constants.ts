import { OrganizationRole } from '../database/schema/organizations';

// Роли, которым разрешено редактировать любые документы
const updateDocumentRoles = [
  'admin',
  'owner',
] as const satisfies readonly OrganizationRole[];

export const canUpdateDocument = (role: OrganizationRole): boolean =>
  (updateDocumentRoles as readonly OrganizationRole[]).includes(role);
