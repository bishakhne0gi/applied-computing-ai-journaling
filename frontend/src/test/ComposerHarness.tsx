import { useState } from 'react'
import { ComposerEditor } from '@/features/write/ComposerEditor'

export function ComposerHarness({ initial, onValue, language = 'es', readOnly = false }: { initial: string; onValue?: (text: string) => void; language?: string; readOnly?: boolean }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <ComposerEditor
        language={language}
        value={value}
        onChange={(text) => {
          onValue?.(text)
          setValue(text)
        }}
        onSubmitShortcut={() => undefined}
        readOnly={readOnly}
        focusOnMount={false}
      />
    </>
  )
}
