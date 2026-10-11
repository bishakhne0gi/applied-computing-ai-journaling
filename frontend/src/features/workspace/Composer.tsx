import { PageHeading } from '@/components/ui/PageHeading'
import { WriteScreen } from '@/features/write/WriteScreen'

export function Composer({ focusEditor }: { focusEditor: boolean }) {
  return (
    <>
      <title>Write · Language Journal</title>
      <WriteScreen heading={<PageHeading>Write</PageHeading>} focusEditor={focusEditor} />
    </>
  )
}
