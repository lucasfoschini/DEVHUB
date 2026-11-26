import type { ReactNode } from 'react'
import { Dialog } from 'radix-ui'
import { useFocusReturn } from './useFocusReturn'

/** Edge-anchored modal panel (overlay sidebar, inspector on narrow windows). Radix handles
 *  focus trap, Esc and outside click. Enter/exit motion: index.css `--animate-sheet-*`. */
export function Sheet(props: {
  side: 'left' | 'right'
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
}) {
  const left = props.side === 'left'
  const { content, remember, onCloseAutoFocus } = useFocusReturn()
  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-(--dh-z-modal) bg-scrim data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <Dialog.Content
          ref={content}
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            remember()
            const active = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(
              '[aria-current="page"]',
            )
            if (active) {
              e.preventDefault()
              active.focus()
            }
          }}
          onCloseAutoFocus={onCloseAutoFocus}
          className={[
            'dh-material-elevated fixed inset-y-2 z-(--dh-z-modal) flex flex-col overflow-hidden rounded-popover outline-none',
            left
              ? 'left-2 w-[min(85vw,300px)] data-[state=closed]:animate-sheet-left-out data-[state=open]:animate-sheet-left-in'
              : 'right-2 w-[min(90vw,340px)] data-[state=closed]:animate-sheet-right-out data-[state=open]:animate-sheet-right-in',
          ].join(' ')}
        >
          <Dialog.Title className="sr-only">{props.title}</Dialog.Title>
          {props.children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
