import { createValueDecorator } from 'func'

export const Url = createValueDecorator(input => {
  if (!URL.canParse(input)) throw new Error('Expected a valid absolute URL.')

  const url = new URL(input)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Expected an HTTP or HTTPS URL.')
  }

  return url
})
