import { createContext } from 'react'

export type ToastTone = 'success' | 'danger' | 'neutral'

export interface ToastInput {
  message: string
  tone?: ToastTone
}

export interface ToastApi {
  show: (toast: ToastInput) => void
}

// Without a provider (isolated component tests) a toast is simply not shown.
export const ToastContext = createContext<ToastApi>({ show: () => undefined })
