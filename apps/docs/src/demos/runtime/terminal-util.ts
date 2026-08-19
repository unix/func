const ansiSequencePattern = new RegExp(
  String.raw`\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))`,
  'g',
)

export const stripVTControlCharacters = (value: string): string =>
  value.replace(ansiSequencePattern, '')
