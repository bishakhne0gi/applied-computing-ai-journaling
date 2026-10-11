// Adapted from SmoothUI (MIT), https://smoothui.dev
import { AnimatePresence } from 'motion/react'
import { createPortal } from 'react-dom'
import { SheetPanel, type SheetPanelProps } from './SheetPanel'

export interface SheetProps extends SheetPanelProps {
  open: boolean
}

// Portalled to <body> so no ancestor's overflow or stacking context can clip it; AnimatePresence keeps the panel
// mounted until its exit slide ends.
export function Sheet({ open, ...panel }: SheetProps) {
  return createPortal(<AnimatePresence>{open && <SheetPanel key="sheet" {...panel} />}</AnimatePresence>, document.body)
}
