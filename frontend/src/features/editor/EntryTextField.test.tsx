import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/renderWithProviders'
import { EntryTextField } from './EntryTextField'

function Harness() {
  const [value, setValue] = useState('')
  return <EntryTextField id="entry" label="Your entry" value={value} onChange={setValue} onSubmitShortcut={() => undefined} />
}

describe('EntryTextField', () => {
  it('draws a chip only once a bracket closes', async () => {
    // Arrange
    const user = userEvent.setup()
    const { container } = renderWithProviders(<Harness />)
    const editor = screen.getByLabelText('Your entry')
    // Act
    await user.type(editor, 'al [[park')
    // Assert
    expect(container.querySelectorAll('mark')).toHaveLength(0)
    await user.type(editor, ']')
    const marks = container.querySelectorAll('mark')
    expect(marks).toHaveLength(1)
    expect(marks[0]).toHaveTextContent('[park]')
  })
})
