import { ErrorState } from '@/components/ui/ErrorState'
import { Field } from '@/components/ui/Field'
import { Select, type SelectOption } from '@/components/ui/Select'
import { useLanguagesQuery } from '@/hooks/queries/useLanguagesQuery'
import type { LanguageOut } from '@/types/language'
import { toErrorMessage } from '@/utils/errorMessage'

export interface LanguageSelectProps {
  id: string
  label: string
  value: string
  onChange: (code: string) => void
  allLabel?: string
  disabled?: boolean
  hideLabel?: boolean
}

function optionsOf(languages: readonly LanguageOut[] | undefined, value: string, allLabel?: string): SelectOption[] {
  if (!languages) return [{ value, label: 'Loading languages…' }]
  const all = allLabel === undefined ? [] : [{ value: '', label: allLabel }]
  return [...all, ...languages.map((language) => ({ value: language.code, label: language.name }))]
}

export function LanguageSelect({ id, label, value, onChange, allLabel, disabled = false, hideLabel }: LanguageSelectProps) {
  const languages = useLanguagesQuery()
  if (languages.isError) {
    return <ErrorState message={toErrorMessage(languages.error)} onRetry={() => void languages.refetch()} />
  }
  return (
    <Field label={label} htmlFor={id} hideLabel={hideLabel}>
      <Select id={id} value={value} disabled={disabled || languages.isPending} onChange={onChange} options={optionsOf(languages.data, value, allLabel)} />
    </Field>
  )
}
