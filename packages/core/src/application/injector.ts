import type { ServiceClass } from './interfaces'

export type ServiceParamResolver = (
  target: ServiceClass,
  serviceStack: ServiceClass[],
) => unknown[]

export class ServiceInjector {
  private instances = new Map<ServiceClass, object>()

  constructor(private services: ServiceClass[] = []) {}

  resolve(
    target: ServiceClass | undefined,
    resolveParams: ServiceParamResolver,
    serviceStack: ServiceClass[] = [],
  ): object | undefined {
    if (!target || !this.services.includes(target)) return undefined
    if (this.instances.has(target)) return this.instances.get(target)
    if (serviceStack.includes(target)) return undefined
    const nextStack = serviceStack.concat([target])
    const instance = new target(...resolveParams(target, nextStack)) as object
    this.instances.set(target, instance)
    return instance
  }
}
