import { z } from 'zod';

import { assignableOrganizationRoles } from '../organization.constants';

export const addMemberDto = z.object({
  email: z.email(),
  role: z.enum(assignableOrganizationRoles),
});
