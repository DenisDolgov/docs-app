import { userResponseDto } from '@docs-app/contracts/auth';
import { documentResponseDto } from '@docs-app/contracts/document';
import { describe, expect, it } from 'vitest';

const documentBody = {
  id: '11111111-1111-7111-8111-111111111111',
  organizationId: '22222222-2222-7222-8222-222222222222',
  createdBy: '33333333-3333-7333-8333-333333333333',
  title: 'Заметки',
  createdAt: '2026-01-02T03:04:05.000Z',
  updatedAt: '2026-01-02T03:04:05.000Z',
};

describe('documentResponseDto (unit)', () => {
  it('принимает валидное тело ответа', () => {
    expect(() => documentResponseDto.parse(documentBody)).not.toThrow();
  });

  it('принимает личный документ без организации', () => {
    const parsed = documentResponseDto.parse({
      ...documentBody,
      organizationId: null,
    });

    expect(parsed.organizationId).toBeNull();
  });

  it('отсекает лишние поля, которые не входят в контракт', () => {
    const parsed = documentResponseDto.parse({
      ...documentBody,
      passwordHash: 'секрет',
      organization: { id: 'чужая' },
    });

    expect(parsed).not.toHaveProperty('passwordHash');
    expect(parsed).not.toHaveProperty('organization');
    expect(parsed).toMatchObject({ id: documentBody.id, title: 'Заметки' });
  });

  it('отклоняет тело без обязательного заголовка', () => {
    const { title, ...withoutTitle } = documentBody;

    expect(() => documentResponseDto.parse(withoutTitle)).toThrow();
  });

  it('требует дату в формате ISO-строки', () => {
    expect(() =>
      documentResponseDto.parse({ ...documentBody, createdAt: new Date() }),
    ).toThrow();
  });

  it('представима в JSON Schema как date-time', () => {
    const jsonSchema = documentResponseDto['~standard'].jsonSchema?.output();

    expect(jsonSchema).toBeDefined();
    expect(JSON.stringify(jsonSchema)).toContain('"date-time"');
  });
});

describe('userResponseDto (unit)', () => {
  it('пропускает только id и email, отсекая хеш пароля', () => {
    const parsed = userResponseDto.parse({
      id: '44444444-4444-7444-8444-444444444444',
      email: 'user@example.com',
      passwordHash: 'секрет',
    });

    expect(parsed).not.toHaveProperty('passwordHash');
    expect(Object.keys(parsed).sort()).toEqual(['email', 'id']);
  });

  it('требует корректный email', () => {
    expect(() =>
      userResponseDto.parse({
        id: '44444444-4444-7444-8444-444444444444',
        email: 'не-почта',
      }),
    ).toThrow();
  });
});
