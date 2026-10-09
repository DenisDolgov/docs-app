import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { assignableOrganizationRoles } from '../organization.constants';

export const addMemberDto = z.object({
  email: z.email(),
  role: z.enum(assignableOrganizationRoles),
});

export class AddMemberDto extends createZodDto(addMemberDto) {}
