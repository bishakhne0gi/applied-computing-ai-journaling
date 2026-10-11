import { Badge } from '@/components/ui/Badge'
import { useLanguageFilter } from '@/features/languages/useLanguageFilter'
import { useLanguageName } from '@/features/languages/useLanguageName'

export function LanguageStatus() {
  const { language, state } = useLanguageFilter()
  const name = useLanguageName(language ?? '')
  // Waiting for the list, a shared ?language= link would flash "All languages" before its real name.
  if (state === 'pending') return null
  return <Badge className="hidden min-w-0 truncate whitespace-nowrap sm:block">{language ? name : 'All languages'}</Badge>
}
