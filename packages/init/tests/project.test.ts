import { describe, expect, test } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  assertProjectName,
  packageNameFromProjectName,
  promptProjectName,
} from '../src/project'
import { rewriteDownloadedTemplate } from '../src/rewrite'
import { PromptSession } from '../src/ui'

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
    expect(() => assertProjectName('')).toThrow('required')
    expect(() => assertProjectName('--help')).toThrow('cannot start')
    expect(() => assertProjectName('../app')).toThrow('path separators')
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

describe('rewriteDownloadedTemplate', () => {
  test('rewrites template files for a user project', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'create-func-project-'))

    try {
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify(
          {
            name: 'func-template',
            version: '1.1.0',
            files: [
              'src',
              'tests',
              'README.md',
              'template-readme.md',
              'tsconfig.json',
              '.gitignore',
            ],
            bin: {
              template: './dist/bin.js',
            },
          },
          null,
          2,
        )}\n`,
      )
      fs.writeFileSync(path.join(tempDir, '.npmignore'), 'dist\n')

      rewriteDownloadedTemplate(tempDir, 'my-app')

      expect(
        JSON.parse(
          fs.readFileSync(path.join(tempDir, 'package.json'), 'utf-8'),
        ),
      ).toEqual({
        name: 'my-app',
        version: '0.0.0',
        files: ['dist', 'package.json', 'README.md', 'tsconfig.json'],
        bin: {
          'my-app': './dist/bin.js',
        },
      })
      expect(fs.existsSync(path.join(tempDir, '.npmignore'))).toBe(false)
      expect(fs.readFileSync(path.join(tempDir, '.gitignore'), 'utf-8')).toBe(
        'dist\n',
      )
    } finally {
      fs.rmSync(tempDir, { force: true, recursive: true })
    }
  })
})
