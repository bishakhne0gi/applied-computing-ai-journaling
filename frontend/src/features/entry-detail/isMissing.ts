import { isHTTPError } from 'ky'

// The backend answers 422 for an id that is not a UUID; for someone who typed or mangled a URL that is also "not found".
export function isMissing(error: unknown): boolean {
  return isHTTPError(error) && (error.response.status === 404 || error.response.status === 422)
}
