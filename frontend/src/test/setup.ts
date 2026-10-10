import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { resetMockDb } from '@/mocks/db'
import { clearMockMode } from './helpers'
import { server } from './server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  cleanup()
  resetMockDb()
  localStorage.clear()
  clearMockMode()
})
afterAll(() => server.close())
