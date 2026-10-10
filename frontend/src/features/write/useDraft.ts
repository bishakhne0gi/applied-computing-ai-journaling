import { useLocalStorage } from '@/hooks/misc/useLocalStorage'
import { useLanguagesQuery } from '@/hooks/queries/useLanguagesQuery'
import { STORAGE_KEYS } from '@/utils/constants'

export function useDraft() {
  const [text, setText] = useLocalStorage(STORAGE_KEYS.draft)
  const [storedLanguage, setLanguage] = useLocalStorage(STORAGE_KEYS.language)
  const languages = useLanguagesQuery().data ?? []
  // Derived, not stored: a remembered code that is no longer offered falls back to the first language.
  const language = languages.some((l) => l.code === storedLanguage) ? storedLanguage : (languages[0]?.code ?? '')
  return { text, setText, language, setLanguage, clearText: () => setText('') }
}

export type Draft = ReturnType<typeof useDraft>
