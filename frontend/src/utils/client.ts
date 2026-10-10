import ky from 'ky'
import { API_BASE } from './constants'

// Analysis is synchronous: a 30s model timeout plus one parse retry can approach a minute, so the client waits longer.
export const client = ky.create({ baseUrl: API_BASE, timeout: 90_000, retry: 0 })
