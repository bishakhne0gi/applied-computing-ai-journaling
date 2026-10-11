import { use } from 'react'
import { ToastContext, type ToastApi } from './ToastContext'

export function useToast(): ToastApi {
  return use(ToastContext)
}
