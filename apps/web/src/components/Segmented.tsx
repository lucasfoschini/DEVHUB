import { RadioGroup } from 'radix-ui'
import type { LucideIcon } from 'lucide-react'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: LucideIcon
}

/** Single-choice segmented control. Radio semantics: arrow keys move and select. */
export function Segmented<T extends string>(props: {
  label: string
  value: T
  options: SegmentedOption<T>[]
  onChange: (value: T) => void
  disabled?: boolean
  /** Visually hide the label (it stays available to assistive tech). */
  hideLabel?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={props.hideLabel ? 'sr-only' : 'text-footnote text-secondary'}>
        {props.label}
      </span>
      <RadioGroup.Root
        aria-label={props.label}
        value={props.value}
        onValueChange={(v) => props.onChange(v as T)}
        disabled={props.disabled}
        orientation="horizontal"
        loop
        className="flex gap-0.5 rounded-control border border-subtle bg-surface p-0.5 data-disabled:opacity-50"
      >
        {props.options.map((o) => {
          const Icon = o.icon
          return (
            <RadioGroup.Item
              key={o.value}
              value={o.value}
              className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[6px] px-2 py-1.5 text-footnote text-secondary transition-colors duration-(--dh-duration-fast) outline-offset-[-2px] hover:text-primary disabled:pointer-events-none data-[state=checked]:bg-selected data-[state=checked]:text-primary"
            >
              {Icon && <Icon size={14} strokeWidth={1.75} aria-hidden className="shrink-0" />}
              <span className="truncate">{o.label}</span>
            </RadioGroup.Item>
          )
        })}
      </RadioGroup.Root>
    </div>
  )
}
