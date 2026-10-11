import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const updateDocumentDto = z.object({
  title: z.string().min(1),
});

export class UpdateDocumentDto extends createZodDto(updateDocumentDto) {}
