import { describe, expect, it } from 'vitest'
import { CHIP_CLASS } from '@/components/ui/HighlightedTextarea'
import { liveUnderlineClasses } from '@/features/feedback/markClasses'
import { editorDecorations } from './editorDecorations'
import type { LiveHint } from './reanchor'

const liveHint = (start: number, end: number, kind: LiveHint['kind'] = 'error'): LiveHint => ({
  kind,
  category: 'other',
  original: 'x'.repeat(end - start),
  correction: 'y',
  explanation: 'why',
  key: `k${start}`,
  id: `k${start}@${start}`,
  start,
  end,
})

describe('editorDecorations', () => {
  it('draws chips on their own when there are no hints', () => {
    // Arrange + Act
    const decorations = editorDecorations([{ start: 6, end: 12 }], [])
    // Assert
    expect(decorations).toEqual([{ start: 6, end: 12, className: CHIP_CLASS }])
  })

  it('underlines a hint by its kind, with its id for the popover', () => {
    // Arrange + Act
    const decorations = editorDecorations([], [liveHint(4, 9, 'suggestion')])
    // Assert
    expect(decorations).toEqual([{ id: 'k4@4', start: 4, end: 9, className: liveUnderlineClasses.suggestion }])
  })

  it('combines a hint on a chip into one tinted, underlined decoration', () => {
    // Arrange + Act
    const decorations = editorDecorations([{ start: 6, end: 12 }], [liveHint(6, 12, 'vocab_help')])
    // Assert
    expect(decorations).toEqual([{ id: 'k6@6', start: 6, end: 12, className: `${CHIP_CLASS} ${liveUnderlineClasses.vocab_help}` }])
  })

  it('lets a hint win over a chip it only partly covers', () => {
    // Arrange + Act
    const decorations = editorDecorations([{ start: 6, end: 12 }], [liveHint(4, 8)])
    // Assert
    expect(decorations).toEqual([{ id: 'k4@4', start: 4, end: 8, className: liveUnderlineClasses.error }])
  })
})
