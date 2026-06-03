import { readdir, readFile, writeFile } from 'node:fs/promises'

const SKIP_TAGS = new Set(['script', 'style', 'pre', 'code', 'textarea'])
const CJK_PUNCTUATION_RE = /[\u3001\u3002\uff0c\uff0e\uff1a\uff1b\uff01\uff1f\u2014\u2026\u300c\u300d\u300e\u300f\u300a\u300b\u3008\u3009\u3010\u3011\uff08\uff09]/
const LINE_BREAK_RE = /[ \t]*\r?\n[ \t]*/g

export function joinLine() {
  return {
    name: 'astro-join-line',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({
          vite: {
            plugins: [joinLineHtml()],
          },
        })
      },
      'astro:build:generated': async ({ dir }) => {
        await joinGeneratedHtml(dir)
      },
    },
  }
}

function joinLineHtml() {
  return {
    name: 'vite-join-line-html',
    enforce: 'post',
    transformIndexHtml(html) {
      return joinHtmlTextLines(html)
    },
  }
}

export function joinHtmlTextLines(html) {
  const tokens = tokenizeHtml(html)

  return tokens
    .map((token, index) => {
      if (token.type === 'tag' || token.skip) {
        return token.value
      }

      return joinTextLines(token.value, tokens, index)
    })
    .join('')
}

async function joinGeneratedHtml(dir) {
  const entries = await readdir(dir, { withFileTypes: true })

  await Promise.all(
    entries.map(async (entry) => {
      const url = new URL(entry.name, dir)

      if (entry.isDirectory()) {
        url.pathname += '/'
        await joinGeneratedHtml(url)
        return
      }

      if (!entry.isFile() || !entry.name.endsWith('.html')) {
        return
      }

      const html = await readFile(url, 'utf8')
      const nextHtml = joinHtmlTextLines(html)

      if (nextHtml !== html) {
        await writeFile(url, nextHtml)
      }
    })
  )
}

function joinTextLines(text, tokens, tokenIndex) {
  return text.replace(LINE_BREAK_RE, (match, offset, source) => {
    const before =
      previousVisibleChar(source, offset) || previousVisibleTokenChar(tokens, tokenIndex)
    const after =
      nextVisibleChar(source, offset + match.length) ||
      nextVisibleTokenChar(tokens, tokenIndex)

    if (!before || !after) {
      return match
    }

    if (CJK_PUNCTUATION_RE.test(before)) {
      return ''
    }

    return match
  })
}

function tokenizeHtml(html) {
  const tokens = []
  let text = ''
  let skipTag = null

  for (let index = 0; index < html.length; index += 1) {
    const char = html[index]

    if (char !== '<') {
      text += char
      continue
    }

    if (text) {
      tokens.push({ type: 'text', value: text, skip: Boolean(skipTag) })
      text = ''
    }

    const tagEnd = findTagEnd(html, index)
    if (tagEnd === -1) {
      text = html.slice(index)
      break
    }

    const tag = html.slice(index, tagEnd + 1)
    tokens.push({ type: 'tag', value: tag, skip: false })
    skipTag = nextSkipTag(skipTag, tag)
    index = tagEnd
  }

  if (text) {
    tokens.push({ type: 'text', value: text, skip: Boolean(skipTag) })
  }

  return tokens
}

function previousVisibleChar(value, index) {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const char = value[cursor]

    if (!/\s/.test(char)) {
      return char
    }
  }

  return ''
}

function nextVisibleChar(value, index) {
  for (let cursor = index; cursor < value.length; cursor += 1) {
    const char = value[cursor]

    if (!/\s/.test(char)) {
      return char
    }
  }

  return ''
}

function previousVisibleTokenChar(tokens, index) {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const token = tokens[cursor]

    if (token.type === 'tag') {
      continue
    }

    const char = previousVisibleChar(token.value, token.value.length)

    if (char) {
      return char
    }
  }

  return ''
}

function nextVisibleTokenChar(tokens, index) {
  for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
    const token = tokens[cursor]

    if (token.type === 'tag') {
      continue
    }

    const char = nextVisibleChar(token.value, 0)

    if (char) {
      return char
    }
  }

  return ''
}

function findTagEnd(html, start) {
  let quote = ''

  for (let index = start + 1; index < html.length; index += 1) {
    const char = html[index]

    if (quote) {
      if (char === quote) {
        quote = ''
      }

      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (char === '>') {
      return index
    }
  }

  return -1
}

function nextSkipTag(current, tag) {
  const match = getTagInfo(tag)

  if (!match) {
    return current
  }

  if (match.closing) {
    return current === match.name ? null : current
  }

  if (current || !SKIP_TAGS.has(match.name) || /\/\s*>$/.test(tag)) {
    return current
  }

  return match.name
}

function getTagInfo(tag) {
  const match = /^<\s*(\/)?\s*([a-zA-Z0-9:-]+)/.exec(tag)

  if (!match) {
    return null
  }

  return {
    closing: Boolean(match[1]),
    name: match[2].toLowerCase(),
  }
}
