import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { resetMockDb } from '@/mocks/db'
import { clearMockMode } from './helpers'
import { server } from './server'

// jsdom has no layout, so it does not implement Range boxes; zeros let position code run (tests that care stub their own).
Range.prototype.getClientRects ??= () => [] as unknown as DOMRectList
Range.prototype.getBoundingClientRect ??= () => new DOMRect()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  cleanup()
  resetMockDb()
  localStorage.clear()
  clearMockMode()
})
afterAll(() => server.close())
