import type { RatePointOut } from '@/types/insights'
import { formatDateTime } from '@/utils/formatter'
import { formatRate } from './format'

export interface RateTableProps {
  points: RatePointOut[]
}

// The chart's text alternative: hidden visually, read in full by screen readers.
export function RateTable({ points }: RateTableProps) {
  return (
    <table className="sr-only">
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
  )
}
