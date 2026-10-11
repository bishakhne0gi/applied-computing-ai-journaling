export interface DiffPart {
  text: string
  change: 'same' | 'removed' | 'added'
}

// Words (letters, digits, marks, apostrophes, inner hyphens), runs of whitespace, or single other characters.
const TOKEN = /[\p{L}\p{N}\p{M}'’-]+|\s+|[^\s\p{L}\p{N}\p{M}]/gu
const isSpace = (token: string) => /^\s+$/u.test(token)
const tokenize = (text: string) => text.match(TOKEN) ?? []

interface Word {
  index: number
  text: string
}

const wordsOf = (tokens: string[]): Word[] => tokens.flatMap((text, index) => (isSpace(text) ? [] : [{ index, text }]))

// Rows past the end read as 0 so the walk below needs no bounds checks.
function lcsTable(a: Word[], b: Word[]): number[][] {
  const table = Array.from({ length: a.length + 2 }, () => new Array<number>(b.length + 2).fill(0))
  const at = (i: number, j: number) => table[i]?.[j] ?? 0
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      const row = table[i] ?? []
      row[j] = a[i]?.text === b[j]?.text ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1))
    }
  }
  return table
}

// Indices (into each token list) of the words both sides keep. Sentences are at most 500 code points, so the
// quadratic table is small.
function keptWords(a: string[], b: string[]): [Set<number>, Set<number>] {
  const wordsA = wordsOf(a)
  const wordsB = wordsOf(b)
  const table = lcsTable(wordsA, wordsB)
  const at = (i: number, j: number) => table[i]?.[j] ?? 0
  const keptA = new Set<number>()
  const keptB = new Set<number>()
  let i = 0
  let j = 0
  for (let wa = wordsA[i], wb = wordsB[j]; wa && wb; wa = wordsA[i], wb = wordsB[j]) {
    if (wa.text === wb.text) {
      keptA.add(wa.index)
      keptB.add(wb.index)
      i++
      j++
    } else if (at(i + 1, j) >= at(i, j + 1)) {
      i++
    } else {
      j++
    }
  }
  return [keptA, keptB]
}

// A space between two changed words joins the change, so one highlight covers "x y" instead of "x" and "y".
function toParts(tokens: string[], kept: Set<number>, change: 'removed' | 'added'): DiffPart[] {
  const changed = (i: number) => !isSpace(tokens[i] ?? '') && !kept.has(i)
  const parts: DiffPart[] = []
  tokens.forEach((text, i) => {
    const bridged = isSpace(text) && i > 0 && changed(i - 1) && i + 1 < tokens.length && changed(i + 1)
    const kind = changed(i) || bridged ? change : 'same'
    const last = parts.at(-1)
    if (last?.change === kind) last.text += text
    else parts.push({ text, change: kind })
  })
  return parts
}

export function wordDiff(before: string, after: string): { before: DiffPart[]; after: DiffPart[] } {
  const a = tokenize(before)
  const b = tokenize(after)
  const [keptA, keptB] = keptWords(a, b)
  return { before: toParts(a, keptA, 'removed'), after: toParts(b, keptB, 'added') }
}
