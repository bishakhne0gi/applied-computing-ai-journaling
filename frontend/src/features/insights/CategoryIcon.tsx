import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { ArrowsDownUpIcon } from '@phosphor-icons/react/dist/csr/ArrowsDownUp'
import { ArticleIcon } from '@phosphor-icons/react/dist/csr/Article'
import { ClockIcon } from '@phosphor-icons/react/dist/csr/Clock'
import { DotsThreeIcon } from '@phosphor-icons/react/dist/csr/DotsThree'
import { GenderIntersexIcon } from '@phosphor-icons/react/dist/csr/GenderIntersex'
import { HashIcon } from '@phosphor-icons/react/dist/csr/Hash'
import { PencilSimpleIcon } from '@phosphor-icons/react/dist/csr/PencilSimple'
import { QuotesIcon } from '@phosphor-icons/react/dist/csr/Quotes'
import { SignpostIcon } from '@phosphor-icons/react/dist/csr/Signpost'
import { TextAaIcon } from '@phosphor-icons/react/dist/csr/TextAa'
import { TranslateIcon } from '@phosphor-icons/react/dist/csr/Translate'
import type { Category } from '@/types/analysis'
import { cn } from '@/utils/utils'

const CATEGORY_ICONS = {
  verb_conjugation: TextAaIcon, verb_tense: ClockIcon, gender_agreement: GenderIntersexIcon, number_agreement: HashIcon,
  article: ArticleIcon, preposition: SignpostIcon, word_order: ArrowsDownUpIcon, spelling: PencilSimpleIcon,
  vocabulary: TranslateIcon, punctuation: QuotesIcon, other: DotsThreeIcon,
} as const satisfies Record<Category, PhosphorIcon>

// Lives in the insights feature so the glyphs ship with the lazy chunk.
export function CategoryIcon({ category, className }: { category: Category; className?: string }) {
  const Glyph = CATEGORY_ICONS[category]
  return (
    <span aria-hidden="true" className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary', className)}>
      <Glyph weight="bold" className="size-4" />
    </span>
  )
}
