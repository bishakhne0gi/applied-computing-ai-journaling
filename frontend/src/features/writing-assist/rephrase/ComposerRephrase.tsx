import { useId } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Sheet } from '@/components/ui/Sheet'
import { useMediaQuery } from '@/hooks/misc/useMediaQuery'
import { DESKTOP_QUERY } from '@/utils/constants'
import { RephraseCard } from './RephraseCard'
import { RephrasePopover } from './RephrasePopover'
import type { ComposerRephraseState } from './useComposerRephrase'

export function ComposerRephrase({ rephrase }: { rephrase: ComposerRephraseState }) {
  const desktop = useMediaQuery(DESKTOP_QUERY, true)
  const headingId = useId()
  const { open, close, closeToOpener, notice, applyVersion, applyWord } = rephrase
  if (!open) return null
  const card = <RephraseCard request={open.request} headingId={headingId} hideHeading={!desktop} mode="edit" notice={notice} onUseVersion={applyVersion} onUseWord={applyWord} />
  if (desktop) {
    return (
      <RephrasePopover headingId={headingId} onClose={close}>
        {card}
      </RephrasePopover>
    )
  }
  return (
    <Sheet open side="bottom" title="Rephrase" onClose={closeToOpener}>
      {card}
    </Sheet>
  )
}

export function RephraseButton({ rephrase }: { rephrase: ComposerRephraseState }) {
  return (
    <Button variant="ghost" className="gap-1 px-3" disabled={!rephrase.target} aria-keyshortcuts="Alt+R" onClick={rephrase.openCard}>
      <Icon name="sparkle" className="size-4 text-primary" />
      Rephrase
    </Button>
  )
}
