export const frameworks = [
  'func',
  'func-parser',
  'commander',
  'yargs',
  'oclif',
  'cac',
] as const

export type Framework = (typeof frameworks)[number]
