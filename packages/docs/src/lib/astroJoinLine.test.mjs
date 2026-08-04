import assert from 'node:assert/strict'
import test from 'node:test'
import { joinHtmlTextLines, joinMarkdownTextLines } from './astroJoinLine.mjs'

test('joins MDX soft line breaks after CJK punctuation', () => {
  const tree = {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: '第一行；\n' },
          {
            type: 'strong',
            children: [{ type: 'text', value: '第二行' }],
          },
        ],
      },
    ],
  }

  joinMarkdownTextLines(tree)

  assert.equal(tree.children[0].children[0].value, '第一行；')
})

test('preserves other MDX line breaks and code', () => {
  const tree = {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', value: '第一行\n第二行' }],
      },
      {
        type: 'code',
        value: "console.log('第一行；\n第二行')",
      },
    ],
  }

  joinMarkdownTextLines(tree)

  assert.equal(tree.children[0].children[0].value, '第一行\n第二行')
  assert.equal(tree.children[1].value, "console.log('第一行；\n第二行')")
})

test('keeps the generated HTML fallback', () => {
  assert.equal(joinHtmlTextLines('<p>第一行；\n第二行</p>'), '<p>第一行；第二行</p>')
})
