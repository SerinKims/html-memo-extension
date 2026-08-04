export type IdFactory = () => string;

export const createId: IdFactory = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const random = Math.random().toString(36).slice(2);
  return `annotation-${Date.now().toString(36)}-${random}`;
};
