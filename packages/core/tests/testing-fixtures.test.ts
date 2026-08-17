import { access } from 'node:fs/promises'
import {
  createProjectFixture,
  withProjectFixture,
} from '../src/subpath/testing/fixtures'
import { expect, test } from './_test'

test('should create, update, and clean up a structured project fixture', async () => {
  const fixture = await createProjectFixture({
    files: {
      'package.json': '{"name":"fixture"}',
      'src/index.ts': 'export const value = 1',
    },
  })
  const fixturePath = fixture.path
  expect(await fixture.read('package.json')).toBe('{"name":"fixture"}')
  expect(await fixture.exists('src/index.ts')).toBe(true)
  expect(await fixture.exists('missing.ts')).toBe(false)
  await fixture.write('src/nested/value.ts', 'export const value = 2')
  expect(await fixture.read('src/nested/value.ts')).toContain('value = 2')
  expect(() => fixture.resolve('../outside')).toThrow(/escapes its root/)
  await fixture.cleanup()
  await fixture.cleanup()
  await expect(access(fixturePath)).rejects.toMatchObject({ code: 'ENOENT' })
})

test('should clean up a project fixture after its callback fails', async () => {
  let fixturePath = ''

  await expect(
    withProjectFixture({}, fixture => {
      fixturePath = fixture.path
      throw new Error('fixture failure')
    }),
  ).rejects.toThrow('fixture failure')
  await expect(access(fixturePath)).rejects.toMatchObject({ code: 'ENOENT' })
})
