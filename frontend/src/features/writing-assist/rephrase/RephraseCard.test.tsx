import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { problem } from '@/mocks/responses'
import { apiUrl } from '@/test/helpers'
import { renderWithProviders } from '@/test/renderWithProviders'
import { server } from '@/test/server'
import { RephraseCard, type RephraseCardProps } from './RephraseCard'

const REQUEST = { language: 'es', text: 'Ayer fui al mercado. Hoy yo es feliz con mi familia.', start: 21, end: 52 }
const NATURAL = 'Hoy yo soy feliz con mi familia.'

function renderCard(props: Partial<RephraseCardProps> = {}) {
  return renderWithProviders(<RephraseCard request={REQUEST} headingId="h" mode="edit" onUseVersion={vi.fn()} {...props} />)
}

function first<T>(items: T[]): T {
  const [item] = items
  if (item === undefined) throw new Error('expected at least one match')
  return item
}

// A version's words are split across <span>/<ins> elements, so match the paragraph by its whole text.
const paragraph = (text: string) => screen.findByText((_content, element) => element?.tagName === 'P' && element.textContent === text)

describe('RephraseCard', () => {
  it('shows a loading state, then the sentence and three versions with the changed words marked', async () => {
    // Arrange
    renderCard()
    // Act / Assert
    expect(screen.getByRole('status')).toHaveTextContent('Finding better versions…')
    const natural = await screen.findByRole('button', { name: NATURAL })
    expect(natural.querySelector('ins')).toHaveTextContent('soy')
    expect(natural.querySelectorAll('ins')).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: /^(Hoy|Sinceramente)/ })).toHaveLength(3)
    expect(screen.getByText('Hoy yo es feliz con mi familia.', { selector: 'blockquote' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Rephrase' })).toHaveAttribute('id', 'h')
  })

  it('leaves the kept words unmarked', async () => {
    // Arrange
    renderCard()
    // Act
    const natural = await screen.findByRole('button', { name: NATURAL })
    // Assert
    expect(Array.from(natural.querySelectorAll('ins'), (ins) => ins.textContent)).toEqual(['soy'])
    expect(natural.querySelector('del')).toBeNull()
  })

  it('explains each version in a toggletip and describes the version button with its tone', async () => {
    // Arrange
    renderCard()
    const natural = await screen.findByRole('button', { name: NATURAL })
    // Act
    await userEvent.click(first(screen.getAllByRole('button', { name: 'Why this version' })))
    // Assert
    expect(natural).toHaveAccessibleDescription('More natural')
    expect(first(screen.getAllByRole('tooltip'))).toHaveTextContent(/More natural.*Demo mode/)
  })

  it('compares a version side by side, with deletions and insertions marked', async () => {
    // Arrange
    renderCard()
    const compare = first(await screen.findAllByRole('button', { name: 'Compare' }))
    // Act
    await userEvent.click(compare)
    // Assert
    expect(compare).toHaveAttribute('aria-expanded', 'true')
    const panel = screen.getByRole('region', { name: /Compare/ })
    expect(within(panel).getByText('es', { selector: 'del' })).toBeInTheDocument()
    expect(within(panel).getByText('soy', { selector: 'ins' })).toBeInTheDocument()
    await userEvent.click(compare)
    expect(screen.queryByRole('region', { name: /Compare/ })).not.toBeInTheDocument()
  })

  it('uses a version on click in edit mode', async () => {
    // Arrange
    const onUseVersion = vi.fn()
    renderCard({ onUseVersion })
    // Act
    await userEvent.click(await screen.findByRole('button', { name: NATURAL }))
    // Assert
    expect(onUseVersion).toHaveBeenCalledWith(expect.objectContaining({ tone: 'natural', text: NATURAL }))
  })

  it('offers Copy instead of replacing in read mode', async () => {
    // Arrange
    const onCopy = vi.fn()
    renderCard({ mode: 'read', onUseVersion: undefined, onCopy })
    // Act
    expect(await paragraph(NATURAL)).toBeInTheDocument()
    await userEvent.click(first(screen.getAllByRole('button', { name: /^Copy/ })))
    // Assert
    expect(screen.queryByRole('button', { name: NATURAL })).not.toBeInTheDocument()
    expect(onCopy).toHaveBeenCalledWith(NATURAL)
  })

  it('shows the unavailable state with a retry that asks again', async () => {
    // Arrange
    server.use(http.post(apiUrl('rephrase'), () => problem(503, 'Service Unavailable', 'x'), { once: true }))
    renderCard()
    // Act
    expect(await screen.findByRole('alert')).toHaveTextContent('Rephrasing is unavailable right now.')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    // Assert
    expect(await screen.findByRole('button', { name: NATURAL })).toBeInTheDocument()
  })

  it('shows a notice above the tabs when the caller passes one', async () => {
    // Arrange + Act
    renderCard({ notice: 'The sentence changed. Close this and rephrase again.' })
    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent('The sentence changed. Close this and rephrase again.')
    await screen.findByRole('button', { name: NATURAL })
  })

  it('switches to Better words, whose panel is labelled by its tab', async () => {
    // Arrange
    renderCard({ onUseWord: vi.fn() })
    await screen.findByRole('button', { name: NATURAL })
    // Act
    await userEvent.click(screen.getByRole('tab', { name: 'Better words' }))
    // Assert
    expect(screen.getByRole('tabpanel', { name: 'Better words' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use contento for feliz' })).toBeInTheDocument()
  })
})
