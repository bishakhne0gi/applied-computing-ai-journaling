import { expect } from 'vitest'
import { act, fireEvent, waitFor } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { composerField as editor, renderComposer } from '@/test/composerRephrase'
import { apiUrl } from '@/test/helpers'
import { server } from '@/test/server'
import { AUTOCOMPLETE } from '@/utils/constants'

export const TEXT = 'Hoy fui al mercado con mi madre'
export const GHOST = ' y fue un buen día.'
export const SPOKEN = 'Suggestion: y fue un buen día. Press Tab to accept.'
export const WAIT = { timeout: 3000 }

// Records each /complete body, then falls through to the in-memory handler.
export function spyCompletions() {
  const bodies: { text: string }[] = []
  server.use(
    http.post(apiUrl('complete'), async ({ request }) => {
      bodies.push((await request.clone().json()) as { text: string })
    }),
  )
  return bodies
}

export const ghost = () => document.querySelector('[data-ghost]')
export const findGhost = () => waitFor(() => expect(ghost()).toBeInTheDocument(), WAIT)
export const pause = (ms = AUTOCOMPLETE.debounceMs + 300) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)))

export async function writeAtEnd(user: ReturnType<typeof userEvent.setup>, text = TEXT, options: { language?: string; readOnly?: boolean } = {}) {
  const utils = renderComposer(text, options)
  await user.click(editor())
  fireEvent.select(editor())
  return utils
}
