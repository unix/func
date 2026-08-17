export interface ApplicationConfiguration {
  readonly appName?: string
}

export const collectApplicationConfiguration = (
  input: ApplicationConfiguration,
): Readonly<ApplicationConfiguration> => Object.freeze({ ...input })
