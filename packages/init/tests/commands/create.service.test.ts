import { SCAFFOLD, formatScaffoldErrorCode } from '@func/contracts/scaffold-errors'
import { withProjectFixture } from 'func/testing/fixtures'
import { mkdir } from 'node:fs/promises'
import { describe, expect, test } from 'vitest'
import {
  assertProjectName,
  copyTemplateDirectory,
  packageNameFromProjectName,
  promptProjectName,
} from '../../src/commands/create/create.service'
import { rewriteDownloadedTemplate } from '../../src/commands/create/rewrite'
import { PromptSession } from '../../src/commands/create/ui'

class AnswerPrompt extends PromptSession {
  messages: string[] = []
  calls = 0

  private answers: string[]

  constructor(answers: string[]) {
    super()
    this.answers = answers
  }

  async text(): Promise<string> {
    const answer = this.answers[this.calls] || ''
    this.calls += 1
    return answer
  }

  writeLine(text: string): void {
    this.messages.push(text)
  }
}

describe('promptProjectName', () => {
  test('keeps asking until project name is entered', async () => {
    const prompt = new AnswerPrompt(['', '   ', 'demo'])
    await expect(promptProjectName(prompt)).resolves.toBe('demo')
    expect(prompt.calls).toBe(3)
    expect(prompt.messages).toHaveLength(2)
  })
})

describe('assertProjectName', () => {
  test('rejects invalid project names', () => {
    for (const name of ['', '--help', '../app']) {
      expect(() => assertProjectName(name)).toThrow(
        expect.objectContaining({
          code: formatScaffoldErrorCode(SCAFFOLD.INVALID_PROJECT_NAME),
        }),
      )
    }
  })

  test('accepts plain project names', () => {
    expect(() => assertProjectName('demo')).not.toThrow()
  })
})

describe('packageNameFromProjectName', () => {
  test('normalizes directory names to package names', () => {
    expect(packageNameFromProjectName('Hello Func')).toBe('hello-func')
    expect(packageNameFromProjectName('My App')).toBe('my-app')
  })
})

describe('copyTemplateDirectory', () => {
  test('skips only the root dist directory', async () => {
    await withProjectFixture(
      {
        files: {
          'source/dist/bin.js': 'compiled',
          'source/examples/dist/fixture.js': 'fixture',
          'source/package.json': '{}',
        },
      },
      async project => {
        const destination = project.resolve('destination')
        await mkdir(destination)
        copyTemplateDirectory(project.resolve('source'), destination)
        await expect(project.exists('destination/dist')).resolves.toBe(false)
        await expect(project.read('destination/package.json')).resolves.toBe('{}')
        await expect(
          project.read('destination/examples/dist/fixture.js'),
        ).resolves.toBe('fixture')
      },
    )
  })
})

describe('rewriteDownloadedTemplate', () => {
  test('reports invalid package JSON with a scaffold error code', async () => {
    await withProjectFixture({ files: { 'package.json': '{' } }, async project => {
      expect(() => rewriteDownloadedTemplate(project.path, 'my-app')).toThrow(
        expect.objectContaining({
          code: formatScaffoldErrorCode(SCAFFOLD.INVALID_PACKAGE_METADATA),
        }),
      )
    })
  })

  test('rewrites template files for a user project', async () => {
    await withProjectFixture(
      {
        files: {
          '.npmignore': 'dist\n',
          'package.json': `${JSON.stringify(
            {
              name: 'func-template',
              version: '1.1.0',
              files: ['src', 'tests', 'README.md', 'tsconfig.json', '.gitignore'],
              bin: {
                template: './dist/bin.js',
              },
            },
            null,
            2,
          )}\n`,
        },
      },
      async project => {
        rewriteDownloadedTemplate(project.path, 'my-app')

        expect(JSON.parse(await project.read('package.json'))).toEqual({
          name: 'my-app',
          version: '0.0.0',
          files: ['dist', 'package.json', 'README.md', 'tsconfig.json'],
          bin: {
            'my-app': './dist/bin.js',
          },
        })
        await expect(project.exists('.npmignore')).resolves.toBe(false)
        await expect(project.read('.gitignore')).resolves.toBe('dist\n')
      },
    )
  })
})
