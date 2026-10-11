import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Switch } from '@/components/ui/Switch'
import { LiveHintsControls } from '@/features/live-hints/LiveHintsControls'
import type { useComposerHints } from '@/features/live-hints/useComposerHints'
import { AutocompleteAnnouncer } from '@/features/writing-assist/autocomplete/AutocompleteAnnouncer'
import type { useComposerAutocomplete } from '@/features/writing-assist/autocomplete/useComposerAutocomplete'
import { RephraseButton } from '@/features/writing-assist/rephrase/ComposerRephrase'
import type { ComposerRephraseState } from '@/features/writing-assist/rephrase/useComposerRephrase'

interface Props {
  hints: ReturnType<typeof useComposerHints>
  rephrase: ComposerRephraseState
  auto: ReturnType<typeof useComposerAutocomplete>
}

// The quiet row under the editor: switches and Rephrase first, so nothing in it moves when a hint or a ghost appears.
export function ComposerControls({ hints, rephrase, auto }: Props) {
  const accept = (
    // tabIndex -1 and a cancelled pointer-down: the text keeps focus, so the keyboard stays up and the edit is undoable.
    <Button variant="ghost" className="gap-1 px-3" tabIndex={-1} onPointerDown={(event) => event.preventDefault()} onClick={auto.accept}>
      <Icon name="arrowRight" className="size-4 text-primary" />
      Accept suggestion
    </Button>
  )
  return (
    <>
      <LiveHintsControls {...hints.controls} message={rephrase.announcement} beside={<Switch label="Autocomplete" checked={auto.on} onChange={auto.onToggle} />} after={auto.coarse && auto.ghost ? accept : null}>
        <RephraseButton rephrase={rephrase} />
      </LiveHintsControls>
      <AutocompleteAnnouncer text={auto.on ? auto.announcement : ''} />
    </>
  )
}
