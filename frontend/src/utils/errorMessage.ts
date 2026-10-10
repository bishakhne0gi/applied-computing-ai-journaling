import { isHTTPError, isNetworkError, isTimeoutError } from 'ky'
import type { ProblemDetails } from '@/types/problem'

const FALLBACK = 'Something went wrong. Please try again.'

export function toErrorMessage(error: unknown): string {
  if (isTimeoutError(error)) return 'The server took too long to respond. Please try again.'
  // A raw TypeError is what fetch throws when the network drops before ky can wrap it.
  if (isNetworkError(error) || error instanceof TypeError) {
    return "We couldn't reach the server. Check your connection and try again."
  }
  if (isHTTPError(error)) return fromProblem(error.response.status, asProblem(error.data))
  return FALLBACK
}

function fromProblem(status: number, problem: ProblemDetails | null): string {
  if (status === 404) return "We couldn't find that entry. It may have been removed."
  if (status === 422) return validationMessage(problem)
  if (status >= 500) return withReference('Something went wrong on our side. Please try again.', problem)
  return problem?.detail ?? FALLBACK
}

function validationMessage(problem: ProblemDetails | null): string {
  const first = problem?.errors?.[0]?.msg
  return first ? `Please check your entry: ${first}.` : 'Please check your entry and try again.'
}

// The request id lets a bug report be matched to the backend log line without exposing anything else.
function withReference(message: string, problem: ProblemDetails | null): string {
  return problem?.request_id ? `${message} (Reference: ${problem.request_id})` : message
}

function asProblem(data: unknown): ProblemDetails | null {
  return typeof data === 'object' && data !== null && 'status' in data ? (data as ProblemDetails) : null
}
