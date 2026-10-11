import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createDocumentDto = z.object({
  title: z.string().min(1),
});

export class CreateDocumentDto extends createZodDto(createDocumentDto) {}
