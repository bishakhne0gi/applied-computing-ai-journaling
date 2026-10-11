import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyzeText } from './analyzer'

// fixtures/word-help-demo.json is shared with the Python demo provider's tests, so the mock analyser and the demo
// provider cannot drift apart: both must produce the file's word help and corrected text for the same entry.
interface Golden {
  language: string
  text: string
  corrected: string
  help: { original: string; correction: string; start: number; end: number }[]
}
const { cases } = JSON.parse(readFileSync(resolve(process.cwd(), '../fixtures/word-help-demo.json'), 'utf8')) as { cases: Golden[] }

describe('mock analyser word help against the shared demo fixture', () => {
  it.each(cases)('$text ($language)', ({ language, text, corrected, help }) => {
    // Act
    const analysis = analyzeText('entry-1', text, undefined, language)
    // Assert
    const items = analysis.mistakes.filter((m) => m.kind === 'vocab_help').map(({ original, correction, start, end }) => ({ original, correction, start, end }))
    expect(items).toEqual(help)
    expect(analysis.corrected_text).toBe(corrected)
  })
})
