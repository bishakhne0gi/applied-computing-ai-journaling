import type { RatePointOut } from '@/types/insights'
import { formatDateTime } from '@/utils/formatter'
import { formatRate } from './format'

export interface RateTableProps {
  points: RatePointOut[]
}

// The chart's text alternative: hidden visually, read in full by screen readers. A table ignores the 1px width of
// sr-only and would stretch the page sideways on a phone, so a sr-only wrapper clips it.
export function RateTable({ points }: RateTableProps) {
  return (
    <div className="sr-only">
      <table>
        <caption>Errors per 100 words for each entry</caption>
        <thead>
          <tr>
            <th scope="col">Written</th>
            <th scope="col">Words</th>
            <th scope="col">Errors</th>
            <th scope="col">Per 100 words</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.entry_id}>
              <td>{formatDateTime(point.created_at)}</td>
              <td>{point.word_count}</td>
              <td>{point.error_count}</td>
              <td>{formatRate(point.rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
