import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Correction } from './Correction'

describe('Correction', () => {
  it('reads as "original should be correction" and draws two tinted pills with no line-through', () => {
    // Arrange / Act
    render(
      <p>
        <Correction original="la problema" correction="el problema" />
      </p>,
    )
    // Assert
    expect(screen.getByRole('paragraph')).toHaveTextContent('la problema should be el problema')
    const original = screen.getByText('la problema')
    expect(original).toHaveClass('bg-danger-soft', 'whitespace-nowrap', 'truncate')
    expect(original).not.toHaveClass('line-through')
    expect(original).toHaveAttribute('title', 'la problema')
    expect(screen.getByText('el problema')).toHaveClass('bg-success-soft', 'text-success')
  })

  it.each([
    ['suggestion', 'bg-warning-soft'],
    ['vocab_help', 'bg-mark-vocab-bg'],
  ] as const)('tints a %s original with %s, not the error red', (kind, tint) => {
    // Arrange / Act
    render(<Correction kind={kind} original="market" correction="mercado" />)
    // Assert
    expect(screen.getByText('market')).toHaveClass(tint)
  })
})
