// Adapted from SmoothUI (MIT), https://smoothui.dev
import { m, useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/Button'
import { Icon, type IconName } from '@/components/ui/Icon'
import { cn } from '@/utils/utils'
import type { ToastTone } from './ToastContext'
import { useAutoDismiss } from './useAutoDismiss'

export interface QueuedToast {
  id: number
  message: string
  tone: ToastTone
}

export interface ToastItemProps {
  toast: QueuedToast
  duration: number
  onDismiss: (id: number) => void
}

const SPRING = { type: 'spring', bounce: 0.1, duration: 0.25 } as const
const stripeClasses: Record<ToastTone, string> = { success: 'border-l-success', danger: 'border-l-danger', neutral: 'border-l-primary' }
const iconClasses: Record<ToastTone, string> = { success: 'text-success', danger: 'text-danger', neutral: 'text-primary' }
const icons: Record<ToastTone, IconName> = { success: 'check', danger: 'alert', neutral: 'check' }

export function ToastItem({ toast, duration, onDismiss }: ToastItemProps) {
  const reduce = useReducedMotion() ?? false
  const { hold, release } = useAutoDismiss(duration, () => onDismiss(toast.id))
  const hidden = reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }
  return (
    <m.div
      onMouseEnter={() => hold('hover')}
      onMouseLeave={() => release('hover')}
      onFocus={() => hold('focus')}
      onBlur={() => release('focus')}
      className={cn('pointer-events-auto flex items-start gap-3 rounded-lg border border-l-4 border-border bg-bg py-3 pl-4 text-sm text-fg shadow-lg', stripeClasses[toast.tone])}
      initial={hidden}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={hidden}
      transition={reduce ? { duration: 0 } : SPRING}
    >
      <Icon name={icons[toast.tone]} className={cn('mt-0.5', iconClasses[toast.tone])} />
      <p className="flex-1 py-0.5">{toast.message}</p>
      <Button variant="icon" aria-label="Dismiss notification" className="-my-2" onClick={() => onDismiss(toast.id)}>
        <Icon name="close" className="size-4" />
      </Button>
    </m.div>
  )
}
