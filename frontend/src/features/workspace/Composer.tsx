import { PageHeading } from '@/components/ui/PageHeading'
import { WriteScreen } from '@/features/write/WriteScreen'

export function Composer({ focusEditor }: { focusEditor: boolean }) {
  return (
    <>
      <title>Write · Language Journal</title>
      <div className="flex flex-col gap-1">
        <PageHeading>Write</PageHeading>
        <p className="text-muted">Write freely in the language you are learning, then get feedback.</p>
      </div>
      <WriteScreen focusEditor={focusEditor} />
    </>
  )
}
