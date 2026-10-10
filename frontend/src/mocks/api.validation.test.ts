import { describe, expect, it } from 'vitest'
import type { EntryOut, EntryPageOut } from '@/types/entry'
import { client } from '@/utils/client'
import { ENDPOINTS } from '@/utils/endpoints'

const createEntry = (text: string) =>
  client.post(ENDPOINTS.entries, { json: { language: 'es', text } }).json<EntryOut>()
const page = (searchParams: Record<string, string | number>) =>
  client.get(ENDPOINTS.entries, { searchParams }).json<EntryPageOut>()

describe('in-memory API validation and previews', () => {
  it('collapses whitespace and truncates the preview by code points like the backend', async () => {
    // Arrange
    const long = `${'😀'.repeat(139)}  \n  ${'x'.repeat(50)}`
    const entry = await createEntry(`a\n\n  b\t${long}`)
    // Act
    const { items } = await page({ limit: 1 })
    // Assert
    expect(items[0]?.id).toBe(entry.id)
    expect(items[0]?.preview).toBe(`a b ${'😀'.repeat(136)}…`)
  })

  it('strips trailing whitespace before the ellipsis', async () => {
    // Arrange
    await createEntry(`${'a'.repeat(139)} ${'b'.repeat(20)}`)
    // Act
    const { items } = await page({ limit: 1 })
    // Assert
    expect(items[0]?.preview).toBe(`${'a'.repeat(139)}…`)
  })

  it('answers a bad or empty cursor with a 400 problem', async () => {
    // Arrange
    const bad = page({ cursor: 'nope' })
    const empty = page({ cursor: '' })
    // Act + Assert
    await expect(bad).rejects.toMatchObject({ response: { status: 400 } })
    await expect(empty).rejects.toMatchObject({ response: { status: 400 } })
  })

  it.each([['0'], ['51'], ['abc'], ['1.5'], ['']])('rejects limit=%s with a 422 problem', async (limit) => {
    // Arrange
    const request = page({ limit })
    // Act + Assert
    await expect(request).rejects.toMatchObject({ response: { status: 422 } })
  })

  it('rejects an unsupported list language with a 422 problem', async () => {
    // Arrange
    const request = page({ language: 'xx' })
    // Act + Assert
    await expect(request).rejects.toMatchObject({ response: { status: 422 } })
  })

  it('rejects a non-UUID entry id with a 422 problem on every entry route', async () => {
    // Arrange
    const requests = [
      client.get(ENDPOINTS.entry('nope')).json(),
      client.patch(ENDPOINTS.entry('nope'), { json: { text: 'hola' } }).json(),
      client.post(ENDPOINTS.analyses('nope')).json(),
      client.get(ENDPOINTS.analyses('nope')).json(),
    ]
    // Act + Assert
    for (const request of requests) await expect(request).rejects.toMatchObject({ response: { status: 422 } })
  })
})
