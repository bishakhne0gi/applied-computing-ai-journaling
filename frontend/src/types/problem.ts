// RFC 7807 body every backend error uses (backend/app/core/errors.py).
export interface ProblemDetails {
  type: string
  title: string
  status: number
  detail: string
  instance?: string
  request_id?: string | null
  errors?: { loc: (string | number)[]; msg: string; type: string }[]
}
