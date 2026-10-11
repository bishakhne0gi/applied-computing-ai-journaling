// Adapted from shadcn/ui Chart (MIT), https://ui.shadcn.com/docs/components/chart
import type { ReactNode } from 'react'
import { ResponsiveContainer } from 'recharts'
import { cn } from '@/utils/utils'

// recharts draws its own SVG; arbitrary variants reach its parts with token utilities instead of inline colours.
const containerClass = cn(
  'h-48 w-full text-xs md:h-56',
  '[&_.recharts-cartesian-axis-tick_text]:fill-muted',
  '[&_.recharts-cartesian-grid_line]:stroke-border',
  '[&_.recharts-surface]:outline-hidden',
)

export interface ChartContainerProps {
  label: string
  className?: string
  children: ReactNode
}

// One labelled image for assistive tech; the numbers live in a sr-only table next to it.
export function ChartContainer({ label, className, children }: ChartContainerProps) {
  return (
    <div role="img" aria-label={label} className={cn(containerClass, className)}>
      <div aria-hidden="true" className="size-full">
        {/* initialDimension renders a first frame before ResizeObserver reports (and in jsdom, which has no layout). */}
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 520, height: 224 }}>
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function ChartTooltipCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-40 flex-col gap-1 rounded-md border border-border bg-bg px-3 py-2 text-xs shadow-md">
      <span className="font-medium text-fg">{title}</span>
      {children}
    </div>
  )
}
