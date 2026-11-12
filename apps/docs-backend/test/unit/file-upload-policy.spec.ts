import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { maxUploadBytes } from '../../src/file/file.constants';
import { planUpload, verifyStoredObject } from '../../src/file/upload-policy';

const png = {
  filename: 'photo.png',
  mime: 'image/png',
  size: 1024,
};

describe('planUpload', () => {
  it('принимает разрешённый тип в пределах лимита', () => {
    expect(planUpload(png)).toEqual({
      name: 'photo.png',
      mime: 'image/png',
      size: 1024,
    });
  });

  it('оставляет от имени файла только базовое имя', () => {
    expect(planUpload({ ...png, filename: '../../secret.png' }).name).toBe(
      'secret.png',
    );
  });

  it('отклоняет тип вне allowlist', () => {
    expect(() =>
      planUpload({ filename: 'icon.svg', mime: 'image/svg+xml', size: 512 }),
    ).toThrow(BadRequestException);
  });

  it('отклоняет файл больше лимита', () => {
    expect(() => planUpload({ ...png, size: maxUploadBytes + 1 })).toThrow(
      BadRequestException,
    );
  });

  it('отклоняет пустой файл', () => {
    expect(() => planUpload({ ...png, size: 0 })).toThrow(BadRequestException);
  });
});

describe('verifyStoredObject', () => {
  const plan = { name: 'photo.png', mime: 'image/png', size: 1024 };

  it('возвращает факты хранилища, когда они совпадают с заявкой', () => {
    expect(verifyStoredObject(plan, { size: 1024, mime: 'image/png' })).toEqual(
      { size: 1024, mime: 'image/png' },
    );
  });

  it('отклоняет отсутствующий объект', () => {
    expect(() =>
      verifyStoredObject(plan, { size: undefined, mime: undefined }),
    ).toThrow(BadRequestException);
  });

  it('отклоняет объект другого размера', () => {
    expect(() =>
      verifyStoredObject(plan, { size: 2048, mime: 'image/png' }),
    ).toThrow(BadRequestException);
  });

  it('отклоняет объект другого типа', () => {
    expect(() =>
      verifyStoredObject(plan, { size: 1024, mime: 'text/html' }),
    ).toThrow(BadRequestException);
  });
});
