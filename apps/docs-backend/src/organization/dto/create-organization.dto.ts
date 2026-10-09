import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createOrganizationDto = z.object({
  name: z.string().min(1),
});

export class CreateOrganizationDto extends createZodDto(
  createOrganizationDto,
) {}
