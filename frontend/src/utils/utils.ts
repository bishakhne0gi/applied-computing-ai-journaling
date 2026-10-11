import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Teach tailwind-merge our custom tokens so `z-toast` overrides `z-overlay`, `max-w-full` overrides `max-w-main`.
const twMerge = extendTailwindMerge({
  extend: {
    theme: { container: ['sidebar', 'main', 'sheet'] },
    classGroups: { z: [{ z: ['dropdown', 'sticky', 'overlay', 'toast'] }] },
  },
})

/** Merge class names; later Tailwind classes win (lets primitives accept `className` overrides). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
