import type { ReactNode } from 'react'
import { Popover, Switch } from 'radix-ui'
import { Monitor, Moon, SlidersHorizontal, Sun, Unplug } from 'lucide-react'
import { Segmented } from '../components/Segmented'
import { useOsPrefersOpaque, type MaterialPref, type ThemePref } from '../appearance'

type Intensity = 'clear' | 'balanced' | 'tinted'

function Tile({ title, children }: { title: string; children: ReactNode }) {
  // Solid fill inside the elevated popover: no glass on glass.
  return (
    <section className="rounded-surface bg-hover p-3">
      <h3 className="mb-2.5 text-footnote font-semibold">{title}</h3>
      {children}
    </section>
  )
}

/** Quick settings popover (MASTER_PLAN §22). Only controls that do something real today. */
export function ControlCenter(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  theme: ThemePref
  onThemeChange: (t: ThemePref) => void
  material: MaterialPref
  onMaterialChange: (m: MaterialPref) => void
}) {
  const osOpaque = useOsPrefersOpaque()
  const { material } = props
  const opaque = material === 'opaque' || (material === 'system' && osOpaque)
  const intensity: Intensity = material === 'clear' || material === 'tinted' ? material : 'balanced'

  return (
    <Popover.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Central de controle"
          title="Central de controle"
          className="grid size-8 place-items-center rounded-full text-secondary transition-colors duration-(--dh-duration-fast) hover:bg-hover hover:text-primary data-[state=open]:bg-selected data-[state=open]:text-primary"
        >
          <SlidersHorizontal size={18} strokeWidth={1.75} aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={8}
          aria-label="Central de controle"
          className="dh-material-elevated z-(--dh-z-popover) flex w-[min(340px,calc(100vw-16px))] flex-col gap-2 rounded-floating p-2 outline-none"
        >
          <Tile title="Aparência">
            <Segmented<ThemePref>
              label="Tema"
              hideLabel
              value={props.theme}
              onChange={props.onThemeChange}
              options={[
                { value: 'system', label: 'Sistema', icon: Monitor },
                { value: 'dark', label: 'Escuro', icon: Moon },
                { value: 'light', label: 'Claro', icon: Sun },
              ]}
            />
          </Tile>

          <Tile title="Material">
            <Segmented<Intensity>
              label="Intensidade do vidro"
              value={intensity}
              disabled={opaque}
              onChange={props.onMaterialChange}
              options={[
                { value: 'clear', label: 'Translúcido' },
                { value: 'balanced', label: 'Equilibrado' },
                { value: 'tinted', label: 'Tonalizado' },
              ]}
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <label htmlFor="cc-opaque" className="text-body">
                Reduzir transparência
              </label>
              <Switch.Root
                id="cc-opaque"
                checked={opaque}
                onCheckedChange={(on) => props.onMaterialChange(on ? 'opaque' : intensity)}
                className="relative h-5.5 w-9 shrink-0 rounded-full border border-control bg-surface transition-colors duration-(--dh-duration-fast) data-[state=checked]:border-action data-[state=checked]:bg-action"
              >
                <Switch.Thumb className="block size-4 translate-x-0.5 rounded-full bg-secondary transition-transform duration-(--dh-duration-fast) ease-standard data-[state=checked]:translate-x-[15px] data-[state=checked]:bg-action-fg" />
              </Switch.Root>
            </div>
            <p className="mt-2 text-caption text-secondary">
              {material === 'system'
                ? osOpaque
                  ? 'Seguindo o sistema, que pede menos transparência.'
                  : 'Seguindo o sistema.'
                : 'Escolha manual. '}
              {material !== 'system' && (
                <button
                  type="button"
                  onClick={() => props.onMaterialChange('system')}
                  className="text-accent underline-offset-2 hover:underline"
                >
                  Seguir o sistema
                </button>
              )}
            </p>
          </Tile>

          <Tile title="Local Agent">
            <div className="flex items-start gap-2.5">
              <Unplug
                size={16}
                strokeWidth={1.75}
                className="mt-0.5 shrink-0 text-offline"
                aria-hidden
              />
              <div>
                <p className="text-body">Indisponível na Web</p>
                <p className="text-caption text-secondary">
                  Git local, Docker e editores chegam com o app Desktop (Fase 3).
                </p>
              </div>
            </div>
          </Tile>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
