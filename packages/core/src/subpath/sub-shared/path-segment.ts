export const isSafePathSegment = (value: unknown): value is string =>
  typeof value === 'string' &&
  Boolean(value.trim()) &&
  value === value.trim() &&
  value !== '.' &&
  value !== '..' &&
  !value.includes('/') &&
  !value.includes('\\') &&
  !value.includes('\0')
