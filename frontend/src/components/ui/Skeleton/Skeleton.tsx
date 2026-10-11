// Adapted from SmoothUI (MIT), https://smoothui.dev
import { cn } from '@/utils/utils'

export interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return <span aria-hidden="true" className={cn('block animate-pulse rounded-md bg-border', className)} />
}
