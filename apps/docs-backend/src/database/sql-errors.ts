const UNIQUE_VIOLATION_CODE = '23505';
const FOREIGN_KEY_VIOLATION_CODE = '23503';

export const isUniqueViolation = (error: unknown) => {
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === UNIQUE_VIOLATION_CODE
  );
};

export const isForeignKeyViolation = (error: unknown) => {
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === FOREIGN_KEY_VIOLATION_CODE
  );
};
