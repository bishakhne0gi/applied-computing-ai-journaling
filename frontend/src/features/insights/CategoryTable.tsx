import { Badge } from '@/components/ui/Badge'
import { Correction } from '@/features/feedback/Correction'
import { categoryLabel } from '@/features/feedback/labels'
import type { CategoryInsightOut } from '@/types/insights'
import { pluralize } from '@/utils/formatter'
import { cn } from '@/utils/utils'
import { RateChange, TrendBadge } from './TrendCells'

export interface CategoryTableProps {
  categories: CategoryInsightOut[]
  recurringWindow: number
}

const headClass = 'px-1.5 pb-2 text-left font-medium text-muted md:px-2'
const cellClass = 'border-t border-border px-1.5 py-3 align-top md:px-2'

function CategoryRow({ item, recurringWindow }: { item: CategoryInsightOut; recurringWindow: number }) {
  return (
    <tr>
      <th scope="row" className={cn(cellClass, 'text-left font-medium')}>
        <span className="flex flex-col items-start gap-1">
          {categoryLabel(item.category)}
          <span className="font-normal text-muted">{pluralize(item.occurrences, 'error')}</span>
          {item.recurring && (
            <Badge tone="warning">
              Recurring · {item.recent_entries} of last {recurringWindow}
            </Badge>
          )}
        </span>
      </th>
      <td className={cellClass}>
        <RateChange earlier={item.earlier_rate} recent={item.recent_rate} />
      </td>
      <td className={cellClass}>
        <TrendBadge trend={item.trend} />
      </td>
      <td className={cn(cellClass, 'wrap-anywhere')}>
        <Correction original={item.latest_example.original} correction={item.latest_example.correction} />
      </td>
    </tr>
  )
}

export function CategoryTable({ categories, recurringWindow }: CategoryTableProps) {
  return (
    <table className="w-full text-xs md:text-sm">
      <caption className="pb-2 text-left text-base font-medium">Errors by category</caption>
      <thead>
        <tr>
          <th scope="col" className={headClass}>Category</th>
          <th scope="col" className={headClass}>
            Earlier <span aria-hidden="true">→</span>
            <span className="sr-only">to</span> recent, per 100 words
          </th>
          <th scope="col" className={headClass}>Trend</th>
          <th scope="col" className={headClass}>Latest example</th>
        </tr>
      </thead>
      <tbody>
        {categories.map((item) => (
          <CategoryRow key={item.category} item={item} recurringWindow={recurringWindow} />
        ))}
      </tbody>
    </table>
  )
}
