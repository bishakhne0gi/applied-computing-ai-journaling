import { useId, useState } from 'react'
import type { TextareaSelection } from '@/features/editor/useTextareaSelection'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Sheet } from '@/components/ui/Sheet'
import { useMediaQuery } from '@/hooks/misc/useMediaQuery'
import { DESKTOP_QUERY } from '@/utils/constants'
import { RephraseCard } from './RephraseCard'
import { RephrasePill } from './RephrasePill'
import { RephrasePopover } from './RephrasePopover'
import type { ComposerRephraseState } from './useComposerRephrase'

function SelectionPill({ rephrase, selection }: { rephrase: ComposerRephraseState; selection: TextareaSelection }) {
  // Touch has its own selection menu where the pill would sit; jsdom has no pointer media, hence false.
  const finePointer = useMediaQuery('(pointer: fine)', false)
  const shown = finePointer && !rephrase.open && rephrase.target && selection.focused && selection.end > selection.start
  return shown ? <RephrasePill offset={selection.end} onOpen={rephrase.openCard} /> : null
}

export function ComposerRephrase({ rephrase, selection }: { rephrase: ComposerRephraseState; selection: TextareaSelection }) {
  const desktop = useMediaQuery(DESKTOP_QUERY, true)
  const headingId = useId()
  const { open, close, closeQuietly, notice, applyVersion, applyWord } = rephrase
  // The sheet stays mounted while it slides out, so it keeps rendering the last request.
  const [shown, setShown] = useState(open)
  if (open && open !== shown) setShown(open)
  const card = (current: NonNullable<typeof open>) => (
    <RephraseCard request={current.request} headingId={headingId} hideHeading={!desktop} mode="edit" notice={notice} onUseVersion={applyVersion} onUseWord={applyWord} />
  )
  return (
    <>
      <SelectionPill rephrase={rephrase} selection={selection} />
      {desktop ? (
        open && (
          <RephrasePopover headingId={headingId} onClose={close} onScrollAway={closeQuietly}>
            {card(open)}
          </RephrasePopover>
        )
      ) : (
        <Sheet open={!!open} side="bottom" title="Rephrase" onClose={closeQuietly}>
          {shown && card(shown)}
        </Sheet>
      )}
    </>
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
