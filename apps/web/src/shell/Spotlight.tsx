import { Command, useCommandState } from 'cmdk'
import { Dialog } from 'radix-ui'
import { ArrowUpDown, Check, CornerDownLeft, Search, type LucideIcon } from 'lucide-react'
import { usePersistentState } from '../usePersistentState'
import { useFocusReturn } from './useFocusReturn'

export type CommandGroup = 'Navegação' | 'Ações' | 'Aparência'
const GROUPS: CommandGroup[] = ['Navegação', 'Ações', 'Aparência']
const MAX_RECENT = 5

export interface SpotlightCommand {
  /** Stable id, stored in the recent history. */
  id: string
  /** Unique across all commands (cmdk uses it as the item value). */
  label: string
  group: CommandGroup
  icon: LucideIcon
  keywords?: string[]
  /** Right-aligned hint: shortcut or state ("Atual"). */
  hint?: string
  checked?: boolean
  perform: () => void
}

const itemClass =
  'flex h-10 cursor-default items-center gap-3 rounded-control px-3 text-body text-primary select-none data-[selected=true]:bg-selected'
const groupClass =
  'px-1.5 pb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-caption [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-secondary'

function Item({
  command: c,
  value,
  onRun,
}: {
  command: SpotlightCommand
  value: string
  onRun: (c: SpotlightCommand) => void
}) {
  const Icon = c.icon
  return (
    <Command.Item
      value={value}
      keywords={[c.label, ...(c.keywords ?? [])]}
      onSelect={() => onRun(c)}
      className={itemClass}
    >
      <Icon size={16} strokeWidth={1.75} className="shrink-0 text-secondary" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{c.label}</span>
      {c.checked && <Check size={16} className="shrink-0 text-accent" aria-label="ativo" />}
      {c.hint && <span className="shrink-0 text-caption text-secondary">{c.hint}</span>}
    </Command.Item>
  )
}

/** The query lives inside cmdk, so it starts empty on every open (content remounts). */
function Query() {
  return useCommandState((state) => state.search)
}

/** Empty query: Recentes + fixed groups. Typed query: one flat list, because cmdk ranks
 *  items inside a group but keeps groups in render order, so a weak match in an earlier
 *  group would outrank an exact match in a later one. */
function Results(props: {
  commands: SpotlightCommand[]
  recent: SpotlightCommand[]
  onRun: (c: SpotlightCommand) => void
}) {
  const search = useCommandState((state) => state.search)
  if (search !== '') {
    return (
      <Command.Group heading="Resultados" className={groupClass}>
        {props.commands.map((c) => (
          <Item key={c.id} command={c} value={c.label} onRun={props.onRun} />
        ))}
      </Command.Group>
    )
  }
  return (
    <>
      {props.recent.length > 0 && (
        <Command.Group heading="Recentes" className={groupClass}>
          {props.recent.map((c) => (
            <Item key={c.id} command={c} value={`recente ${c.id}`} onRun={props.onRun} />
          ))}
        </Command.Group>
      )}
      {GROUPS.map((g) => (
        <Command.Group key={g} heading={g} className={groupClass}>
          {props.commands
            .filter((c) => c.group === g)
            .map((c) => (
              <Item key={c.id} command={c} value={c.label} onRun={props.onRun} />
            ))}
        </Command.Group>
      ))}
    </>
  )
}

export function Spotlight(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  commands: SpotlightCommand[]
}) {
  const [recentRaw, setRecentRaw] = usePersistentState<string>('dh.spotlight.recent', '')
  const { content, remember, onCloseAutoFocus } = useFocusReturn()

  const recentIds = recentRaw ? recentRaw.split(',') : []
  const byId = new Map(props.commands.map((c) => [c.id, c]))
  // Ids of commands that no longer exist (e.g. inspector on another page) are skipped.
  const recent = recentIds.flatMap((id) => byId.get(id) ?? [])

  const run = (c: SpotlightCommand) => {
    setRecentRaw([c.id, ...recentIds.filter((id) => id !== c.id)].slice(0, MAX_RECENT).join(','))
    props.onOpenChange(false)
    c.perform()
  }

  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-(--dh-z-modal) bg-scrim" />
        <Dialog.Content
          ref={content}
          aria-describedby={undefined}
          onOpenAutoFocus={() => {
            remember()
          }}
          onCloseAutoFocus={onCloseAutoFocus}
          className="dh-material-elevated fixed top-[12vh] left-1/2 z-(--dh-z-modal) w-[min(640px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-floating outline-none"
        >
          <Dialog.Title className="sr-only">Buscar</Dialog.Title>
          <Command label="Buscar comandos e módulos" loop>
            <div className="flex items-center gap-3 border-b border-subtle px-4">
              <Search
                size={18}
                strokeWidth={1.75}
                className="shrink-0 text-secondary"
                aria-hidden
              />
              <Command.Input
                placeholder="Buscar módulos e comandos"
                className="h-13 min-w-0 flex-1 bg-transparent text-callout outline-none placeholder:text-secondary"
              />
            </div>
            <Command.List className="max-h-[min(420px,55vh)] overflow-y-auto overscroll-contain py-1.5">
              <Command.Empty className="px-4 py-8 text-center">
                <p className="text-body">
                  Nenhum resultado para “<Query />
                  ”.
                </p>
                <p className="mt-1 text-footnote text-secondary">
                  Projetos, repositórios e documentos entram na busca quando esses módulos
                  existirem.
                </p>
              </Command.Empty>
              <Results commands={props.commands} recent={recent} onRun={run} />
            </Command.List>
            <div
              className="hidden items-center gap-4 border-t border-subtle px-4 py-2 text-caption text-secondary md:flex"
              aria-hidden
            >
              <span className="flex items-center gap-1.5">
                <ArrowUpDown size={13} /> navegar
              </span>
              <span className="flex items-center gap-1.5">
                <CornerDownLeft size={13} /> abrir
              </span>
              <span>esc fechar</span>
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
