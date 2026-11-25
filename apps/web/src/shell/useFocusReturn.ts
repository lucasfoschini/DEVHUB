import { useRef } from 'react'

/** For Radix dialogs opened programmatically (no Dialog.Trigger): remember who had focus
 *  and give it back on close, unless something outside the dialog already took focus
 *  (after navigation the shell focuses the new page title). */
export function useFocusReturn() {
  const returnTo = useRef<HTMLElement | null>(null)
  const content = useRef<HTMLDivElement>(null)
  return {
    content,
    remember: () => {
      returnTo.current = document.activeElement as HTMLElement | null
    },
    onCloseAutoFocus: (e: Event) => {
      e.preventDefault()
      const focused = document.activeElement
      if (focused && focused !== document.body && !content.current?.contains(focused)) return
      returnTo.current?.focus()
    },
  }
}
