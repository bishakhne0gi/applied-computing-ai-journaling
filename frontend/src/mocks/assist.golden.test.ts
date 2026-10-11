import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { CompleteRequest, RephraseOut, RephraseRequest } from '@/types/assist'
import { completeText, rephraseText } from './assist'

// fixtures/assist-demo.json is shared with the Python demo provider's tests, so the mock API and the demo
// provider cannot drift apart: both must produce the file's `expected` for the same request.
const fixture = JSON.parse(readFileSync(resolve(process.cwd(), '../fixtures/assist-demo.json'), 'utf8')) as {
  rephrase: (RephraseRequest & { expected: RephraseOut })[]
  complete: (CompleteRequest & { expected: string })[]
}

describe('mock assist against the shared demo fixture', () => {
  it.each(fixture.rephrase)('rephrases $text [$start,$end]', ({ expected, ...request }) => {
    expect(rephraseText(request)).toEqual(expected)
  })

  it.each(fixture.complete)('completes "$text" ($language)', ({ expected, ...request }) => {
    expect(completeText(request)).toEqual({ completion: expected })
  })
})
