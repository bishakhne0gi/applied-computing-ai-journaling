import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HintPopover } from './HintPopover'
import type { LiveHint } from './reanchor'

const hint = (kind: LiveHint['kind']) =>
  ({ id: 'h1', kind, original: 'market', correction: 'mercado', explanation: 'Why.' }) as LiveHint

function mount(kind: LiveHint['kind']) {
  render(<HintPopover hint={hint(kind)} onAccept={vi.fn()} onDismiss={vi.fn()} onClose={vi.fn()} onEscape={vi.fn()} />)
}

describe('HintPopover', () => {
  it('labels a vocab_help hint as word help above the buttons', () => {
    // Arrange + Act
    mount('vocab_help')
    // Assert
    expect(screen.getByText('Word help')).toBeInTheDocument()
  })

  it('shows no such label on an error hint', () => {
    // Arrange + Act
    mount('error')
    // Assert
    expect(screen.queryByText('Word help')).not.toBeInTheDocument()
  })
})
