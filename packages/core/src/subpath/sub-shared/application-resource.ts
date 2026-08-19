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
  let registered = applicationResources.get(context)
  if (!registered) {
    registered = new Set<string>()
    applicationResources.set(context, registered)
  }
  if (registered.has(resource.key)) throw resource.duplicateError()
  registered.add(resource.key)
}
