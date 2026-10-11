import { screen, waitFor } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { expect } from 'vitest'
import { delay, http, HttpResponse } from 'msw'
import { API_BASE } from '@/utils/constants'
import { server } from './server'

type Method = 'get' | 'post' | 'patch'

export const apiUrl = (path: string) => `${API_BASE}${path}`

// The in-memory API reads `?mock=` from the window location; MemoryRouter never touches it.
export function setMockMode(mode: string): void {
  window.history.replaceState(null, '', `/?mock=${mode}`)
}

export function clearMockMode(): void {
  window.history.replaceState(null, '', '/')
}

// Language selects show a disabled "Loading languages…" placeholder until the list arrives.
export async function waitForLanguages(): Promise<void> {
  await screen.findAllByRole('combobox')
  await waitFor(() => expect(screen.queryByText('Loading languages…')).not.toBeInTheDocument())
}

// The Select primitive is a custom combobox: open it, then click the option, as a learner would.
export async function pickOption(user: UserEvent, combobox: HTMLElement, name: string | RegExp): Promise<void> {
  await user.click(combobox)
  await user.click(await screen.findByRole('option', { name }))
}

// Returning nothing falls through to the in-memory handler, so this only adds latency to assert pending states.
export function slowDown(method: Method, path: string, ms = 100): void {
  server.use(
    http[method](apiUrl(path), async () => {
      await delay(ms)
    }),
  )
}

export function failWith(method: Method, path: string, status = 500): void {
  server.use(
    http[method](apiUrl(path), () =>
      HttpResponse.json(
        { type: 'about:blank', title: 'Error', status, detail: 'Failed', request_id: 'test-request' },
        { status, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    ),
  )
}
