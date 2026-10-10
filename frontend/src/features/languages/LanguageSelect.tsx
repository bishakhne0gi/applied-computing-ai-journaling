import { ErrorState } from '@/components/ui/ErrorState'
import { Field } from '@/components/ui/Field'
import { Select } from '@/components/ui/Select'
import { useLanguagesQuery } from '@/hooks/queries/useLanguagesQuery'
import { toErrorMessage } from '@/utils/errorMessage'

export interface LanguageSelectProps {
  id: string
  label: string
  value: string
  onChange: (code: string) => void
  allLabel?: string
  disabled?: boolean
}

export function LanguageSelect({ id, label, value, onChange, allLabel, disabled = false }: LanguageSelectProps) {
  const languages = useLanguagesQuery()
  if (languages.isError) {
    return <ErrorState message={toErrorMessage(languages.error)} onRetry={() => void languages.refetch()} />
  }
  return (
    <Field label={label} htmlFor={id}>
      <Select id={id} value={value} disabled={disabled || languages.isPending} onChange={(event) => onChange(event.target.value)}>
        {languages.isPending ? (
          <option value={value}>Loading languages…</option>
        ) : (
          <>
            {allLabel !== undefined && <option value="">{allLabel}</option>}
            {languages.data.map((language) => (
              <option key={language.code} value={language.code}>
                {language.name}
              </option>
            ))}
          </>
        )}
      </Select>
    </Field>
  )
}
