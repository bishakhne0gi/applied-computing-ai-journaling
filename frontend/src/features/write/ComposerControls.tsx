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
  return (
    <>
      <LiveHintsControls {...hints.controls} message={rephrase.announcement} beside={<Switch label="Autocomplete" checked={auto.on} onChange={auto.onToggle} />}>
        <RephraseButton rephrase={rephrase} />
      </LiveHintsControls>
      <AutocompleteAnnouncer text={auto.on ? auto.announcement : ''} />
    </>
  )
}
