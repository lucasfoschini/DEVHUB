import { useRef, type ReactNode } from 'react'
import { Dialog } from 'radix-ui'

/** Edge-anchored modal panel (overlay sidebar, inspector on narrow windows). Radix handles
 *  focus trap, Esc and outside click. Enter/exit motion lands in P7. */
export function Sheet(props: {
  side: 'left' | 'right'
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
}) {
  const left = props.side === 'left'
  // Opened programmatically (no Dialog.Trigger), so remember who had focus.
  const returnTo = useRef<HTMLElement | null>(null)
  const content = useRef<HTMLDivElement>(null)
  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-(--dh-z-modal) bg-scrim" />
        <Dialog.Content
          ref={content}
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            returnTo.current = document.activeElement as HTMLElement | null
            const current = e.currentTarget as HTMLElement
            const active = current.querySelector<HTMLElement>('[aria-current="page"]')
            if (active) {
              e.preventDefault()
              active.focus()
            }
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault()
            // After navigation the shell already focused the new page title; keep it there.
            const focused = document.activeElement
            if (focused && focused !== document.body && !content.current?.contains(focused)) return
            returnTo.current?.focus()
          }}
          className={[
            'dh-material-elevated fixed inset-y-2 z-(--dh-z-modal) flex flex-col overflow-hidden rounded-popover outline-none',
            left ? 'left-2 w-[min(85vw,300px)]' : 'right-2 w-[min(90vw,340px)]',
          ].join(' ')}
        >
          <Dialog.Title className="sr-only">{props.title}</Dialog.Title>
          {props.children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
