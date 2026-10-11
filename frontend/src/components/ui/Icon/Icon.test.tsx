import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Icon, type IconName } from '.'

const ICON_NAMES = [
  'close', 'check', 'alert', 'menu', 'chart', 'plus', 'chevron', 'info', 'refresh', 'sparkle', 'arrowUp', 'arrowDown', 'arrowRight', 'minus', 'copy',
] as const satisfies readonly IconName[]

describe('Icon', () => {
  it.each(ICON_NAMES)('renders %s as a decorative Phosphor svg', (name) => {
    // Arrange / Act
    const { container } = render(<Icon name={name} />)
    // Assert
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('data-icon', name)
    expect(svg?.getAttribute('viewBox')).toBe('0 0 256 256')
  })
})
