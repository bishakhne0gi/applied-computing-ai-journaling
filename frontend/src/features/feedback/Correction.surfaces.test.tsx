import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HintList } from '@/features/live-hints/HintList'
import { HintPopover } from '@/features/live-hints/HintPopover'
import type { LiveHint } from '@/features/live-hints/reanchor'
import type { MistakeKind, MistakeOut } from '@/types/analysis'
import { MistakePanel } from './MistakePanel'
import { OtherNotes } from './OtherNotes'

const mistake = (kind: MistakeKind): MistakeOut => ({
  id: 'm1', kind, category: 'vocabulary', original: 'market', correction: 'mercado', explanation: 'Why.', start: 0, end: 6,
})
const hint = (kind: MistakeKind) => ({ id: 'h1', kind, original: 'market', correction: 'mercado', explanation: 'Why.' }) as LiveHint

const surfaces: [string, (kind: MistakeKind) => void][] = [
  ['MistakePanel', (kind) => render(<MistakePanel id="p" mistake={mistake(kind)} onClose={vi.fn()} />)],
  ['OtherNotes', (kind) => render(<OtherNotes mistakes={[mistake(kind)]} />)],
  ['HintList', (kind) => render(<HintList id="l" hints={[hint(kind)]} onAccept={vi.fn()} onDismiss={vi.fn()} />)],
  [
    'HintPopover',
    (kind) => render(<HintPopover hint={hint(kind)} onAccept={vi.fn()} onDismiss={vi.fn()} onClose={vi.fn()} onEscape={vi.fn()} />),
  ],
]

// Each surface must hand the item's kind to Correction, or a vocabulary word would be tinted as an error.
describe.each(surfaces)('%s', (_name, mount) => {
  it.each([
    ['vocab_help', 'bg-mark-vocab-bg'],
    ['suggestion', 'bg-warning-soft'],
    ['error', 'bg-danger-soft'],
  ] as const)('tints a %s original with %s', (kind, tint) => {
    // Arrange / Act
    mount(kind)
    // Assert
    expect(screen.getByTitle('market')).toHaveClass(tint)
  })
})
