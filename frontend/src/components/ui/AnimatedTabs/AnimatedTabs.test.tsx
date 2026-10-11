import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { AnimatedTabs } from '.'

const TABS = [
  { id: 'original', label: 'Your text' },
  { id: 'corrected', label: 'Corrected' },
  { id: 'notes', label: 'Notes' },
]

function Harness() {
  const [value, setValue] = useState('original')
  return <AnimatedTabs label="Text version" idPrefix="tv" tabs={TABS} value={value} onChange={setValue} />
}

const tab = (name: string) => screen.getByRole('tab', { name })

describe('AnimatedTabs', () => {
  it('is a named tablist with only the selected tab in the tab order', () => {
    // Arrange + Act
    render(<Harness />)
    // Assert
    expect(screen.getByRole('tablist', { name: 'Text version' })).toBeInTheDocument()
    expect(tab('Your text')).toHaveAttribute('aria-selected', 'true')
    expect(tab('Your text')).toHaveAttribute('tabindex', '0')
    expect(tab('Corrected')).toHaveAttribute('tabindex', '-1')
  })

  it('selects a tab on click', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<Harness />)
    // Act
    await user.click(tab('Corrected'))
    // Assert
    expect(tab('Corrected')).toHaveAttribute('aria-selected', 'true')
    expect(tab('Your text')).toHaveAttribute('aria-selected', 'false')
  })

  it('moves selection and focus with the arrow keys, wrapping at the ends', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(tab('Your text'))
    // Act + Assert
    await user.keyboard('{ArrowLeft}')
    expect(tab('Notes')).toHaveFocus()
    expect(tab('Notes')).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{ArrowRight}')
    expect(tab('Your text')).toHaveFocus()
  })

  it('jumps to the first and last tab with Home and End', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(tab('Corrected'))
    // Act + Assert
    await user.keyboard('{End}')
    expect(tab('Notes')).toHaveFocus()
    await user.keyboard('{Home}')
    expect(tab('Your text')).toHaveFocus()
  })

  it('points only the selected tab at its panel', () => {
    // Arrange + Act
    render(<Harness />)
    // Assert
    expect(tab('Your text')).toHaveAttribute('aria-controls', 'tv-panel-original')
    expect(tab('Corrected')).not.toHaveAttribute('aria-controls')
  })

  it('treats the first tab as selected when the value matches none', () => {
    // Arrange + Act
    render(<AnimatedTabs label="Text version" idPrefix="tv" tabs={TABS} value="gone" onChange={() => undefined} />)
    // Assert
    expect(tab('Your text')).toHaveAttribute('aria-selected', 'true')
    expect(tab('Your text')).toHaveAttribute('tabindex', '0')
    expect(tab('Your text')).toHaveAttribute('aria-controls', 'tv-panel-original')
    expect(tab('Corrected')).toHaveAttribute('aria-selected', 'false')
  })
})
