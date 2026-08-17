import assert from 'node:assert/strict'
import test from 'node:test'

import { formatRelativeDate } from '../src/lib/relative-date.ts'

const now = new Date('2026-08-16T00:00:00Z')
const daysAgo = days => new Date(now.valueOf() - days * 86_400_000)

test('formats relative dates in English by age', () => {
  assert.equal(formatRelativeDate(daysAgo(7), 'en', now), 'Recently')
  assert.equal(formatRelativeDate(daysAgo(8), 'en', now), '1 week ago')
  assert.equal(formatRelativeDate(daysAgo(60), 'en', now), '9 weeks ago')
  assert.equal(formatRelativeDate(daysAgo(61), 'en', now), '2 months ago')
  assert.equal(formatRelativeDate(daysAgo(365), 'en', now), '12 months ago')
  assert.equal(formatRelativeDate(daysAgo(366), 'en', now), '1 year ago')
})

test('formats relative dates in Chinese by age', () => {
  assert.equal(formatRelativeDate(daysAgo(7), 'zh-cn', now), '最近')
  assert.equal(formatRelativeDate(daysAgo(8), 'zh-cn', now), '1周前')
  assert.equal(formatRelativeDate(daysAgo(61), 'zh-cn', now), '2个月前')
  assert.equal(formatRelativeDate(daysAgo(366), 'zh-cn', now), '1年前')
})

test('supports future and invalid dates', () => {
  assert.equal(formatRelativeDate(daysAgo(-14), 'en', now), 'in 2 weeks')
  assert.equal(formatRelativeDate(new Date('invalid'), 'en', now), null)
})
