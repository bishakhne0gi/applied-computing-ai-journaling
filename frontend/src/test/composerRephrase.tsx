import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { renderWithProviders } from '@/test/renderWithProviders'
import { ComposerHarness } from './ComposerHarness'

export const PAIR_TEXT = 'Ayer fui al mercado. Hoy yo es feliz con mi familia.'
export const PAIR_SENTENCE = 'Hoy yo es feliz con mi familia.'
export const PAIR_FIXED = 'Hoy yo soy feliz con mi familia.'

export const composerField = () => screen.getByLabelText<HTMLTextAreaElement>('Your entry')
export const caretAt = (position: number, end = position) => {
  composerField().setSelectionRange(position, end)
  fireEvent.select(composerField())
}
export const tint = () => document.querySelector('mark[data-decoration-id="rephrase-target"]')

export function renderComposer(initial = PAIR_TEXT, options: { language?: string; readOnly?: boolean } = {}) {
  const onValue = vi.fn()
  renderWithProviders(<ComposerHarness initial={initial} onValue={onValue} {...options} />)
  return { onValue, user: userEvent.setup() }
}

export async function openCard(user: ReturnType<typeof userEvent.setup>) {
  caretAt(30)
  await user.click(screen.getByRole('button', { name: 'Rephrase' }))
  return screen.findByRole('dialog', { name: 'Rephrase' })
}
