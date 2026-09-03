import { useEffect, useRef } from 'react'

// True while the document is visible; the render loop cancels rAF when hidden.
export function useDocumentVisibility() {
  const visibleRef = useRef<boolean>(typeof document === 'undefined' ? true : !document.hidden)

  useEffect(() => {
    const onVisibility = () => {
      visibleRef.current = !document.hidden
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  return visibleRef
}
