import { z } from 'zod';

// Форма awareness-состояния: контракт между клиентами (курсор/имя/цвет).
export const presenceDto = z.object({
  name: z.string(),
  color: z.string(),
});

export type Presence = z.infer<typeof presenceDto>;
