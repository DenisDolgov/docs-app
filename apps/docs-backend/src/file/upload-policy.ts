import path from 'node:path';
import { BadRequestException } from '@nestjs/common';

import { allowedUploadMimeTypes, maxUploadBytes } from './file.constants';
import type {
  PlannedUpload,
  StoredObjectFacts,
  UploadRequest,
  VerifiedObject,
} from './file.models';

export const planUpload = (request: UploadRequest): PlannedUpload => {
  if (
    !allowedUploadMimeTypes.includes(
      request.mime as (typeof allowedUploadMimeTypes)[number],
    )
  ) {
    throw new BadRequestException('Unsupported mime type');
  }

  if (request.size > maxUploadBytes) {
    throw new BadRequestException('File size is too large');
  }

  if (request.size === 0) {
    throw new BadRequestException('File size cannot be zero');
  }

  return {
    size: request.size,
    mime: request.mime,
    name: path.basename(request.filename),
  };
};

export const verifyStoredObject = (
  plan: PlannedUpload,
  facts: StoredObjectFacts,
): VerifiedObject => {
  if (plan.mime !== facts.mime) {
    throw new BadRequestException('Incorrect mime type');
  }

  if (plan.size !== facts.size) {
    throw new BadRequestException('Incorrect file size');
  }

  return {
    mime: facts.mime,
    size: facts.size,
  };
};
