import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { ArrowClockwiseIcon } from '@phosphor-icons/react/dist/csr/ArrowClockwise'
import { ArrowDownIcon } from '@phosphor-icons/react/dist/csr/ArrowDown'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/csr/ArrowRight'
import { ArrowUpIcon } from '@phosphor-icons/react/dist/csr/ArrowUp'
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown'
import { ChartLineIcon } from '@phosphor-icons/react/dist/csr/ChartLine'
import { CheckIcon } from '@phosphor-icons/react/dist/csr/Check'
import { CopyIcon } from '@phosphor-icons/react/dist/csr/Copy'
import { InfoIcon } from '@phosphor-icons/react/dist/csr/Info'
import { ListIcon } from '@phosphor-icons/react/dist/csr/List'
import { MinusIcon } from '@phosphor-icons/react/dist/csr/Minus'
import { PlusIcon } from '@phosphor-icons/react/dist/csr/Plus'
import { SparkleIcon } from '@phosphor-icons/react/dist/csr/Sparkle'
import { WarningIcon } from '@phosphor-icons/react/dist/csr/Warning'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import { cn } from '@/utils/utils'

// Phosphor, one module per glyph (the package barrel would pull every icon into the bundle).
const ICONS = {
  close: XIcon, check: CheckIcon, alert: WarningIcon, menu: ListIcon, chart: ChartLineIcon, plus: PlusIcon,
  chevron: CaretDownIcon, info: InfoIcon, refresh: ArrowClockwiseIcon, sparkle: SparkleIcon,
  arrowUp: ArrowUpIcon, arrowDown: ArrowDownIcon, arrowRight: ArrowRightIcon, minus: MinusIcon, copy: CopyIcon,
} as const satisfies Record<string, PhosphorIcon>

export type IconName = keyof typeof ICONS

export interface IconProps {
  name: IconName
  weight?: 'regular' | 'bold'
  className?: string
}

export function Icon({ name, weight = 'regular', className }: IconProps) {
  const Glyph = ICONS[name]
  return <Glyph aria-hidden="true" weight={weight} className={cn('size-5 shrink-0', className)} />
}
