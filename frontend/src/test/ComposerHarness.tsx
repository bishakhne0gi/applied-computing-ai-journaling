import { useState } from 'react'
import { ComposerEditor } from '@/features/write/ComposerEditor'

export function ComposerHarness({ initial, onValue }: { initial: string; onValue?: (text: string) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <ComposerEditor
        language="es"
        value={value}
        onChange={(text) => {
          onValue?.(text)
          setValue(text)
        }}
        onSubmitShortcut={() => undefined}
        readOnly={false}
        focusOnMount={false}
      />
    </>
  )
}
