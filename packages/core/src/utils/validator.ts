export const requireKey = (value: any, key: string) => {
  if (!value) {
    throw new Error(`Param \`${key}\` is required.`)
  }
}

export const mustBeArray = (value: any, key: string) => {
  if (!Array.isArray(value)) {
    throw new Error(`Param \`${key}\` must be \`Array\`.`)
  }
}
