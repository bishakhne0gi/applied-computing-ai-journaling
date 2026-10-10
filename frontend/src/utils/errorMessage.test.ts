import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { apiUrl } from '@/test/helpers'
import { server } from '@/test/server'
import { client } from './client'
import { toErrorMessage } from './errorMessage'

const problemJson = (status: number, body: object) =>
  HttpResponse.json(
    { type: 'about:blank', title: 'Error', status, detail: 'Failed', ...body },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  )

async function errorFrom(resolver: () => Response): Promise<unknown> {
  server.use(http.get(apiUrl('probe'), resolver))
  return client
    .get('probe')
    .json()
    .then(
      () => null,
      (error: unknown) => error,
    )
}

describe('toErrorMessage', () => {
  it('explains a missing entry', async () => {
    // Arrange
    const error = await errorFrom(() => problemJson(404, {}))
    // Act
    const message = toErrorMessage(error)
    // Assert
    expect(message).toBe("We couldn't find that entry. It may have been removed.")
  })

  it('passes on the first validation message', async () => {
    // Arrange
    const errors = [{ loc: ['body', 'text'], msg: 'String should have at most 5000 characters', type: 'string_too_long' }]
    const error = await errorFrom(() => problemJson(422, { errors }))
    // Act
    const message = toErrorMessage(error)
    // Assert
    expect(message).toBe('Please check your entry: String should have at most 5000 characters.')
  })

  it('adds the request id to server errors so a report can be traced', async () => {
    // Arrange
    const error = await errorFrom(() => problemJson(500, { request_id: 'req-123' }))
    // Act
    const message = toErrorMessage(error)
    // Assert
    expect(message).toBe('Something went wrong on our side. Please try again. (Reference: req-123)')
  })

  it('uses the problem detail for other client errors', async () => {
    // Arrange
    const error = await errorFrom(() => problemJson(400, { detail: 'Invalid cursor' }))
    // Act
    const message = toErrorMessage(error)
    // Assert
    expect(message).toBe('Invalid cursor')
  })

  it('explains a dropped connection', async () => {
    // Arrange
    const error = await errorFrom(() => HttpResponse.error())
    // Act
    const message = toErrorMessage(error)
    // Assert
    expect(message).toBe("We couldn't reach the server. Check your connection and try again.")
  })

  it('falls back to a generic message for anything else', () => {
    // Arrange
    const error = new Error('boom')
    // Act
    const message = toErrorMessage(error)
    // Assert
    expect(message).toBe('Something went wrong. Please try again.')
  })
})
