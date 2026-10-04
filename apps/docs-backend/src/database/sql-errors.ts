const UNIQUE_VIOLATION_CODE = '23505';

export const isUniqueViolation = (error: unknown) => {
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === UNIQUE_VIOLATION_CODE
  );
};
