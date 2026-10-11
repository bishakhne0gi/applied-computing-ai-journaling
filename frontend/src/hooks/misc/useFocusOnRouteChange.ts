import { useEffect, useRef } from 'react'
import { NavigationType, useLocation, useNavigationType } from 'react-router'

// SPA navigation keeps focus on the clicked link; moving it to the new page's heading tells screen-reader users the page changed.
// Pathname only: a filter change on the same page must not pull focus away from the control being used.
// A redirect (REPLACE) is not the user going anywhere: an old link landing in the workspace must not grab focus.
export function useFocusOnRouteChange(): void {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()
  const previous = useRef(pathname)
  useEffect(() => {
    if (previous.current === pathname) return
    previous.current = pathname
    if (navigationType !== NavigationType.Replace) document.querySelector<HTMLElement>('main h1')?.focus()
  }, [pathname, navigationType])
}
