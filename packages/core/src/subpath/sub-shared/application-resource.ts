import type { Context } from '../../runtime/context'

export interface ApplicationResource {
  key: string
  duplicateError(): Error
}

const applicationResources = new WeakMap<Context, Set<string>>()

export const initializeApplicationResource = (
  context: Context,
  resource: ApplicationResource,
) => {
  const registered = applicationResources.get(context) ?? new Set<string>()
  if (registered.has(resource.key)) throw resource.duplicateError()
  registered.add(resource.key)
  applicationResources.set(context, registered)
}
