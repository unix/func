import { describe, expect, test } from 'vitest'
import {
  authoringCriteria,
  authoringEvaluation,
} from '../src/authoring-evaluation.js'
import { frameworks } from '../src/frameworks.js'

describe('authoring evaluation', () => {
  test.each(Object.entries(authoringCriteria))(
    '%s criteria use 100 total weight',
    (_, criteria) => {
      expect(
        criteria.reduce((total, criterion) => total + criterion.weight, 0),
      ).toBe(100)
    },
  )

  test.each(frameworks)('%s scores match their evidence', framework => {
    const evaluation = authoringEvaluation.frameworks[framework]

    for (const dimension of ['dx', 'maintainability'] as const) {
      const criteria = authoringCriteria[dimension]
      const expected = Math.round(
        criteria.reduce(
          (total, criterion) =>
            total +
            criterion.weight *
              (evaluation[dimension].evidence[criterion.id].level / 4),
          0,
        ),
      )

      expect(evaluation[dimension].score).toBe(expected)
    }
  })
})
