export const metadataValue = <Value>(
  key: unknown,
  target: object,
  propertyKey?: string | symbol,
): Value | undefined => {
  const value: unknown =
    propertyKey === undefined
      ? Reflect.getMetadata(key, target)
      : Reflect.getMetadata(key, target, propertyKey)
  // Private metadata keys are written exclusively by func decorators.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return value as Value | undefined
}

export const ownMetadataValue = <Value>(
  key: unknown,
  target: object,
): Value | undefined => {
  const value: unknown = Reflect.getOwnMetadata(key, target)
  // Private metadata keys are written exclusively by func decorators.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return value as Value | undefined
}
