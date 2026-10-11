import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { waitForLanguages } from '@/test/helpers'
import { renderWithProviders } from '@/test/renderWithProviders'
import { STORAGE_KEYS } from '@/utils/constants'
import { WriteScreen } from '@/features/write/WriteScreen'

export const TEXT = 'Hoy yo es feliz y tranquilo.'
export const FIXED = 'Hoy yo soy feliz y tranquilo.'

// A stored draft is checked at once (the debounce starts at the current text) and avoids typing `[`.
export async function renderWithDraft(text = TEXT) {
  localStorage.setItem(STORAGE_KEYS.draft, text)
  const utils = renderWithProviders(<WriteScreen />)
  await waitForLanguages()
  return { user: userEvent.setup(), ...utils }
}

export const editor = () => screen.getByLabelText<HTMLTextAreaElement>('Your entry')
export const hintsButton = () => screen.findByRole('button', { name: '1 hint' })
export const popover = () => screen.queryByRole('group', { name: 'Hint: yo es should be yo soy' })
export const inPopover = () => within(screen.getByRole('group', { name: 'Hint: yo es should be yo soy' }))

// Caret between «yo» and « es»: strictly inside the underlined words.
export async function openByClick() {
  const utils = await renderWithDraft()
  await hintsButton()
  await utils.user.pointer({ keys: '[MouseLeft]', target: editor(), offset: 6 })
  return utils
}

