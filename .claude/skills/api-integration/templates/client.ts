import ky from 'ky'
import { API_BASE } from './constants'

export const client = ky.create({ baseUrl: API_BASE, timeout: 10_000, retry: 0 })
