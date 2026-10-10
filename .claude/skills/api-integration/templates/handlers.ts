import { delay, http, HttpResponse } from 'msw'
import type { Item } from '@/types/item'
import { API_BASE } from '@/utils/constants'
import { ENDPOINTS } from '@/utils/endpoints'

const items: Item[] = [
  { id: '1', title: 'First item' },
  { id: '2', title: 'Second item' },
]

// `?mock=slow|error|empty` forces UI states in dev (manual checks, ui-qa).
const mockMode = () => (typeof location === 'undefined' ? '' : new URLSearchParams(location.search).get('mock') ?? '')

export const handlers = [
  http.get(`${API_BASE}${ENDPOINTS.items}`, async () => {
    const mode = mockMode()
    if (mode === 'slow') await delay(2000)
    if (mode === 'error') return HttpResponse.json({ message: 'Server error' }, { status: 500 })
    return HttpResponse.json(mode === 'empty' ? [] : items)
  }),
]
