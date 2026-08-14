export const createDictionary = <Value>(): Record<string, Value> =>
  Object.create(null) as Record<string, Value>
