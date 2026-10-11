import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { editor, inPopover, openByClick, popover } from '@/test/composerHints'

const accept = () => inPopover().getByRole('button', { name: 'Accept' })
const dismiss = () => inPopover().getByRole('button', { name: 'Dismiss' })

describe('ComposerEditor hint popover keyboard path', () => {
  it('keeps the popover open when Tab moves from the text to Accept', async () => {
    // Arrange
    const { user } = await openByClick()
    // Act
    await user.tab()
    // Assert
    expect(popover()).toBeInTheDocument()
    expect(accept()).toHaveFocus()
  })

  it('returns focus to the text when Escape is pressed inside the popover', async () => {
    // Arrange
    const { user } = await openByClick()
    await user.tab()
    // Act
    await user.keyboard('{Escape}')
    // Assert
    expect(popover()).not.toBeInTheDocument()
    expect(editor()).toHaveFocus()
    expect(screen.getByRole('button', { name: '1 hint' })).toBeInTheDocument()
  })

  it('closes the popover when Tab moves past Dismiss', async () => {
    // Arrange
    const { user } = await openByClick()
    await user.tab()
    await user.tab()
    expect(dismiss()).toHaveFocus()
    // Act
    await user.tab()
    // Assert
    expect(popover()).not.toBeInTheDocument()
  })

  it('dismisses with Enter on Dismiss and puts the caret back in the text', async () => {
    // Arrange
    const { user } = await openByClick()
    await user.tab()
    await user.tab()
    // Act
    await user.keyboard('{Enter}')
    // Assert
    expect(popover()).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '1 hint' })).not.toBeInTheDocument()
    expect(editor()).toHaveFocus()
  })
})
