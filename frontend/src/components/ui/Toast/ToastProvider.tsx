// Adapted from SmoothUI (MIT), https://smoothui.dev
import { AnimatePresence } from 'motion/react'
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type ToastApi } from './ToastContext'
import { ToastItem, type QueuedToast } from './ToastItem'

export interface ToastProviderProps {
  children: ReactNode
  duration?: number
}

const MAX_VISIBLE = 3

interface ToastListProps {
  toasts: QueuedToast[]
  duration: number
  onDismiss: (id: number) => void
}

function ToastList({ toasts, duration, onDismiss }: ToastListProps) {
  return (
    <AnimatePresence initial={false}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} duration={duration} onDismiss={onDismiss} />
      ))}
    </AnimatePresence>
  )
}

// Both live regions stay in the DOM from the first render (a region inserted together with its content is often not
// announced); danger goes to the assertive one. aria-live rather than role=status/alert, so the
// always-present regions don't collide with the screens' own status and alert roles. One fixed viewport instead of a portal per toast: toasts stack, and the newest never covers an older one.
export function ToastProvider({ children, duration = 5000 }: ToastProviderProps) {
  const [toasts, setToasts] = useState<QueuedToast[]>([])
  const nextId = useRef(0)
  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((toast) => toast.id !== id)), [])
  const api = useMemo<ToastApi>(
    () => ({
      show: ({ message, tone = 'neutral' }) => {
        nextId.current += 1
        const toast = { id: nextId.current, message, tone }
        setToasts((all) => [...all.slice(1 - MAX_VISIBLE), toast])
      },
    }),
    [],
  )
  return (
    <ToastContext value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-toast flex flex-col gap-2 md:left-auto md:w-96">
        <div aria-live="polite" className="flex flex-col gap-2">
          <ToastList toasts={toasts.filter((toast) => toast.tone !== 'danger')} duration={duration} onDismiss={dismiss} />
        </div>
        <div aria-live="assertive" aria-atomic="true" className="flex flex-col gap-2">
          <ToastList toasts={toasts.filter((toast) => toast.tone === 'danger')} duration={duration} onDismiss={dismiss} />
        </div>
      </div>
    </ToastContext>
  )
}
