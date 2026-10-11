import { Badge } from '@/components/ui/Badge'
import { useLanguageFilter } from '@/features/languages/useLanguageFilter'
import { useLanguageName } from '@/features/languages/useLanguageName'

export function LanguageStatus() {
  const { language } = useLanguageFilter()
  const name = useLanguageName(language ?? '')
  return <Badge>{language ? name : 'All languages'}</Badge>
}
