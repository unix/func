import { describe, expect, test } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  assertProjectName,
  packageNameFromProjectName,
  promptProjectName,
  updatePackageMetadata,
} from '../src/project'
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

describe('updatePackageMetadata', () => {
  test('uses the project package name as the bin command name', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'create-func-project-'))

    try {
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify(
          {
            name: 'func-template',
            bin: {
              template: './dist/bin.js',
            },
          },
          null,
          2,
        )}\n`,
      )

      updatePackageMetadata(tempDir, 'my-app')

      expect(
        JSON.parse(
          fs.readFileSync(path.join(tempDir, 'package.json'), 'utf-8'),
        ),
      ).toEqual({
        name: 'my-app',
        bin: {
          'my-app': './dist/bin.js',
        },
      })
    } finally {
      fs.rmSync(tempDir, { force: true, recursive: true })
    }
  })
})
