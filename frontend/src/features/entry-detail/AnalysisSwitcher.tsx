import { useId } from 'react'
import { Field } from '@/components/ui/Field'
import { Select } from '@/components/ui/Select'
import type { AnalysisOut } from '@/types/analysis'
import { formatDateTime, pluralize } from '@/utils/formatter'

export interface AnalysisSwitcherProps {
  analyses: readonly AnalysisOut[]
  value: string
  onChange: (id: string) => void
}

function optionLabel(analysis: AnalysisOut, latest: boolean): string {
  const errors = analysis.mistakes.filter((mistake) => mistake.kind === 'error').length
  const outcome = analysis.status === 'succeeded' ? pluralize(errors, 'error') : analysis.status === 'pending' ? 'interrupted' : 'failed'
  return `${formatDateTime(analysis.created_at)} · ${outcome}${latest ? ' (latest)' : ''}`
}

export function AnalysisSwitcher({ analyses, value, onChange }: AnalysisSwitcherProps) {
  const id = useId()
  return (
    <div className="max-w-md">
      <Field label="Analysis" htmlFor={id}>
        <Select id={id} value={value} onChange={onChange} options={analyses.map((analysis, index) => ({ value: analysis.id, label: optionLabel(analysis, index === 0) }))} />
      </Field>
    </div>
  )
}
