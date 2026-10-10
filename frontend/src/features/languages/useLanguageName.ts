import { useLanguagesQuery } from '@/hooks/queries/useLanguagesQuery'

export function useLanguageName(code: string): string {
  const { data } = useLanguagesQuery()
  return data?.find((language) => language.code === code)?.name ?? code.toUpperCase()
}
