import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/renderWithProviders'
import { SavedRephrase } from './SavedRephrase'

const TEXT = 'Ayer fui al mercado. Hoy yo es feliz con mi familia.'
const SECOND = 'Hoy yo es feliz con mi familia.'

afterEach(() => vi.restoreAllMocks())

// After render(): userEvent.setup() installs its own clipboard stub, which this replaces.
function clipboard(writeText: () => Promise<void>) {
  const spy = vi.fn(writeText)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: spy }, configurable: true })
  return spy
}

const render = (initialOffset: number | null, text = TEXT) => {
  const onClose = vi.fn()
  renderWithProviders(<SavedRephrase language="es" text={text} initialOffset={initialOffset} onClose={onClose} />)
  return { onClose, user: userEvent.setup() }
}

describe('SavedRephrase', () => {
  it('picks the sentence that holds the selection, lists only rephrasable sentences, and copies a version', async () => {
    // Arrange
    const { user } = render(30)
    const writeText = clipboard(() => Promise.resolve())
    const picker = screen.getByRole('combobox', { name: 'Sentence' })
    // Assert
    expect(picker).toHaveTextContent(SECOND)
    await user.click(picker)
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Ayer fui al mercado.', SECOND])
    await user.keyboard('{Escape}')
    // Act
    await user.click((await screen.findAllByRole('button', { name: /^Copy/ }))[0] as HTMLElement)
    // Assert
    expect(writeText).toHaveBeenCalledWith('Hoy yo soy feliz con mi familia.')
    expect(await screen.findByText('Copied')).toBeInTheDocument()
  })

  it('says so when the clipboard refuses', async () => {
    // Arrange
    const { user } = render(30)
    clipboard(() => Promise.reject(new Error('denied')))
    // Act
    await user.click((await screen.findAllByRole('button', { name: /^Copy/ }))[0] as HTMLElement)
    // Assert
    expect(await screen.findByText('Couldn’t copy')).toBeInTheDocument()
  })

  it('falls back to the first rephrasable sentence without a selection', () => {
    // Arrange + Act
    render(null)
    // Assert
    expect(screen.getByRole('combobox', { name: 'Sentence' })).toHaveTextContent('Ayer fui al mercado.')
  })

  it('truncates long sentences in the picker to 60 characters with an ellipsis', () => {
    // Arrange
    const long = 'Hoy fui al mercado con mi madre y mi hermano para comprar frutas verduras y pan fresco.'
    // Act
    render(null, long)
    // Assert
    expect(screen.getByRole('combobox', { name: 'Sentence' })).toHaveTextContent(`${long.slice(0, 59)}…`)
  })

  it('says when no sentence is long enough', () => {
    // Arrange + Act
    render(null, 'Hola. Adiós.')
    // Assert
    expect(screen.getByText(/long enough to rephrase/)).toBeInTheDocument()
  })

  it('is a labelled section that closes', async () => {
    // Arrange
    const { user, onClose } = render(null)
    // Act
    await user.click(screen.getByRole('button', { name: 'Close' }))
    // Assert
    expect(screen.getByRole('region', { name: 'Rephrase' })).toBeInTheDocument()
    expect(onClose).toHaveBeenCalledOnce()
  })
})
