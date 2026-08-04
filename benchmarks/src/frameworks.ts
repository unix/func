export const frameworks = ['func', 'commander', 'yargs', 'oclif', 'cac'] as const

export type Framework = (typeof frameworks)[number]
