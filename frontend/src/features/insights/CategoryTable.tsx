import { Badge } from '@/components/ui/Badge'
import { Correction } from '@/features/feedback/Correction'
import { categoryLabel } from '@/features/feedback/labels'
import type { CategoryInsightOut } from '@/types/insights'
import { pluralize } from '@/utils/formatter'
import { cn } from '@/utils/utils'
import { CategoryIcon } from './CategoryIcon'
import { formatRate } from './format'
import { RateChange, TrendBadge, TrendPending } from './TrendCells'

export interface CategoryTableProps {
  categories: CategoryInsightOut[]
  recurringWindow: number
  // Words across the filtered entries, for each category's overall rate before trends exist.
  totalWords: number
  // 0 once trends exist; otherwise how many more analysed entries they need.
  entriesToTrends: number
}

const headClass = 'px-1.5 pb-2 text-left align-bottom font-medium whitespace-nowrap text-muted md:px-2'
const cellClass = 'border-t border-border px-1.5 py-3 align-top md:px-2'

// Before trends there are no windows to compare, but the category's rate across every entry is still real data.
function overallRate(item: CategoryInsightOut, totalWords: number): number | null {
  return totalWords > 0 ? Math.round((item.occurrences * 1000) / totalWords) / 10 : null
}

interface CategoryRowProps {
  item: CategoryInsightOut
  recurringWindow: number
  totalWords: number
  entriesToTrends: number
}

function CategoryRow({ item, recurringWindow, totalWords, entriesToTrends }: CategoryRowProps) {
  const trends = entriesToTrends === 0
  return (
    <tr>
      <th scope="row" className={cn(cellClass, 'text-left font-medium')}>
        <span className="flex items-start gap-3">
          <CategoryIcon category={item.category} />
          <span className="flex flex-col items-start gap-1">
            {categoryLabel(item.category)}
            <span className="font-normal text-muted">{pluralize(item.occurrences, 'error')}</span>
            {item.recurring && (
              <Badge tone="warning" className="whitespace-nowrap">
                Recurring · {item.recent_entries} of last {recurringWindow}
              </Badge>
            )}
          </span>
        </span>
      </th>
      <td className={cn(cellClass, 'tabular-nums')}>
        {trends ? <RateChange earlier={item.earlier_rate} recent={item.recent_rate} /> : formatRate(overallRate(item, totalWords))}
      </td>
      <td className={cellClass}>{trends ? <TrendBadge trend={item.trend} /> : <TrendPending entriesLeft={entriesToTrends} />}</td>
      <td className={cn(cellClass, 'whitespace-nowrap')}>
        <Correction compact original={item.latest_example.original} correction={item.latest_example.correction} />
      </td>
    </tr>
  )
}

export function CategoryTable({ categories, recurringWindow, totalWords, entriesToTrends }: CategoryTableProps) {
  return (
    <div role="region" aria-label="Errors by category" tabIndex={0} className="overflow-x-auto">
      <table className="w-full text-xs md:text-sm">
        <caption className="pb-2 text-left text-base font-medium">Errors by category</caption>
        <thead>
          <tr>
            <th scope="col" className={headClass}>Category</th>
            <th scope="col" className={headClass}>
              {entriesToTrends === 0 ? (
                <>
                  <span className="block whitespace-nowrap">Per 100 words<span className="sr-only">,</span></span>{' '}
                  <span className="block text-xs font-normal whitespace-nowrap">
                    earlier <span aria-hidden="true">→</span>
                    <span className="sr-only">to</span> recent
                  </span>
                </>
              ) : (
                'Per 100 words'
              )}
            </th>
            <th scope="col" className={headClass}>Trend</th>
            <th scope="col" className={headClass}>Latest example</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((item) => (
            <CategoryRow key={item.category} item={item} recurringWindow={recurringWindow} totalWords={totalWords} entriesToTrends={entriesToTrends} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
