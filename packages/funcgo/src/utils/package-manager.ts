export const installCommand = (): string => {
  if (process.env.npm_config_user_agent?.startsWith('pnpm')) {
    return 'pnpm add'
  }

  if (process.env.npm_config_user_agent?.startsWith('yarn')) {
    return 'yarn add'
  }

  return 'npm i'
}
