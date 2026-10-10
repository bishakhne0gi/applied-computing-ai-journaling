import { setupServer } from 'msw/node'
import { handlers } from '@/mocks/handlers'

/** Same handlers as dev; override per test with `server.use(...)`. */
export const server = setupServer(...handlers)
