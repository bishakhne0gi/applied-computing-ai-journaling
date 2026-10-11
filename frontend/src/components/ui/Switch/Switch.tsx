import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/utils'

export interface SwitchProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function Switch({ label, checked, onChange }: SwitchProps) {
  return (
    <Button role="switch" aria-checked={checked} variant="ghost" className="px-2" onClick={() => onChange(!checked)}>
      <span
        aria-hidden="true"
        className={cn('relative inline-flex h-5 w-9 shrink-0 rounded-full border border-border-input bg-surface transition-colors motion-reduce:transition-none', checked && 'border-primary bg-primary')}
      >
        <span
          className={cn('absolute top-0.5 left-0.5 size-3.5 rounded-full bg-fg-secondary transition-transform motion-reduce:transition-none', checked && 'translate-x-4 bg-primary-contrast')}
        />
      </span>
      {label}
    </Button>
  )
}
