import { useId, useState } from 'react'
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
  const { open, close, closeQuietly, notice, applyVersion, applyWord } = rephrase
  // The sheet stays mounted while it slides out, so it keeps rendering the last request.
  const [shown, setShown] = useState(open)
  if (open && open !== shown) setShown(open)
  const card = (current: NonNullable<typeof open>) => (
    <RephraseCard request={current.request} headingId={headingId} hideHeading={!desktop} mode="edit" notice={notice} onUseVersion={applyVersion} onUseWord={applyWord} />
  )
  if (desktop) {
    return open && (
      <RephrasePopover headingId={headingId} onClose={close} onScrollAway={closeQuietly}>
        {card(open)}
      </RephrasePopover>
    )
  }
  return (
    <Sheet open={!!open} side="bottom" title="Rephrase" onClose={closeQuietly}>
      {shown && card(shown)}
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
