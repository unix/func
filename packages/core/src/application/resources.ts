import type { ModuleInput } from './definition'
import type { CompiledGraph } from '../di/module-compiler'

export interface ApplicationResource {
  key: string
  duplicateError(): Error
}

const applicationResources = new WeakMap<ModuleInput, ApplicationResource[]>()

export const defineApplicationResources = <Input extends ModuleInput>(
  input: Input,
  resources: ApplicationResource[],
): Input => {
  applicationResources.set(input, resources.slice())
  return input
}

export const validateApplicationResources = (graph: CompiledGraph) => {
  const registered = new Set<string>()
  graph.modules.forEach(module => {
    const resources = applicationResources.get(module.input) ?? []
    resources.forEach(resource => {
      if (registered.has(resource.key)) throw resource.duplicateError()
      registered.add(resource.key)
    })
  })
}
