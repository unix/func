import { describe, expect, test } from 'vitest'
import {
  assertProjectName,
  packageNameFromProjectName,
  promptProjectName,
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
