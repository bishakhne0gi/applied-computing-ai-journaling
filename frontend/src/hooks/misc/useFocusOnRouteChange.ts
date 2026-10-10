import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'

// SPA navigation keeps focus on the clicked link; moving it to the new page's heading tells screen-reader users the page changed.
// Pathname only: a filter change on the same page must not pull focus away from the control being used.
export function useFocusOnRouteChange(): void {
  const { pathname } = useLocation()
  const previous = useRef(pathname)
  useEffect(() => {
    if (previous.current === pathname) return
    previous.current = pathname
    document.querySelector<HTMLElement>('main h1')?.focus()
  }, [pathname])
}
