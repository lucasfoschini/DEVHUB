// Token specimen at /dev/tokens: visual check for themes and materials (not in navigation).
import { useMaterialPref, useThemePref, type MaterialPref, type ThemePref } from '../appearance'

const swatches = [
  ['canvas', 'bg-canvas'],
  ['surface', 'bg-surface'],
  ['raised', 'bg-raised'],
  ['brand', 'bg-brand'],
  ['action', 'bg-action'],
] as const

const statuses = [
  ['Success', 'text-success'],
  ['Warning', 'text-warning'],
  ['Error', 'text-error'],
  ['Info', 'text-info'],
  ['Neutral', 'text-neutral'],
  ['Pending', 'text-pending'],
  ['Offline', 'text-offline'],
  ['Degraded', 'text-degraded'],
] as const

const type = [
  ['display', 'text-display'],
  ['title1', 'text-title1'],
  ['title2', 'text-title2'],
  ['title3', 'text-title3'],
  ['headline', 'text-headline'],
  ['callout', 'text-callout'],
  ['body', 'text-body'],
  ['footnote', 'text-footnote'],
  ['caption', 'text-caption'],
] as const

const materials = ['solid', 'subtle', 'regular', 'clear', 'tinted', 'elevated', 'opaque'] as const

function Segmented<T extends string>(props: {
  label: string
  value: T
  options: readonly T[]
  onChange: (v: T) => void
}) {
  return (
    <fieldset className="flex items-center gap-2">
      <legend className="sr-only">{props.label}</legend>
      <span className="text-footnote text-secondary">{props.label}</span>
      <div className="flex gap-0.5 rounded-control border border-subtle bg-surface p-0.5">
        {props.options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={props.value === o}
            onClick={() => props.onChange(o)}
            className="rounded-[6px] px-2.5 py-1 text-footnote text-secondary hover:bg-hover aria-pressed:bg-selected aria-pressed:text-primary"
          >
            {o}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function TokenSpecimen() {
  const [theme, setTheme] = useThemePref()
  const [material, setMaterial] = useMaterialPref()

  return (
    <main className="mx-auto max-w-5xl space-y-10 p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-title1">Graphite Lime tokens</h1>
          <p className="text-secondary">P1 specimen · replaced by the Application Shell in P2</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <Segmented<ThemePref>
            label="Theme"
            value={theme}
            options={['system', 'dark', 'light']}
            onChange={setTheme}
          />
          <Segmented<MaterialPref>
            label="Material"
            value={material}
            options={['system', 'clear', 'balanced', 'tinted', 'opaque']}
            onChange={setMaterial}
          />
        </div>
      </header>

      <section aria-labelledby="colors" className="space-y-3">
        <h2 id="colors" className="text-headline">
          Surfaces
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {swatches.map(([name, cls]) => (
            <div key={name} className="space-y-1.5">
              <div className={`h-16 rounded-surface border border-subtle ${cls}`} />
              <div className="font-mono text-caption text-secondary">{name}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            className="rounded-full bg-action px-4 py-2 font-semibold text-action-fg hover:bg-action-hover"
          >
            Primary action
          </button>
          <button
            type="button"
            className="rounded-control border border-control px-3 py-2 hover:bg-hover"
          >
            Secondary
          </button>
          <input
            aria-label="Sample input"
            placeholder="Input with control border"
            className="rounded-content border border-control bg-surface px-3 py-2 placeholder:text-secondary"
          />
          <span className="text-accent">Accent text</span>
        </div>
      </section>

      <section aria-labelledby="status" className="space-y-3">
        <h2 id="status" className="text-headline">
          Semantic status
        </h2>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 rounded-surface border border-subtle bg-surface p-4">
          {statuses.map(([name, cls]) => (
            <li key={name} className={`flex items-center gap-2 ${cls}`}>
              <span className="size-2 rounded-full bg-current" aria-hidden />
              {name}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="type" className="space-y-3">
        <h2 id="type" className="text-headline">
          Typography
        </h2>
        <div className="divide-y divide-subtle rounded-surface border border-subtle bg-surface px-4">
          {type.map(([name, cls]) => (
            <div key={name} className="flex items-baseline gap-4 py-2">
              <span className="w-20 shrink-0 font-mono text-caption text-tertiary">{name}</span>
              <span className={cls}>Everything you build.</span>
            </div>
          ))}
          <div className="flex items-baseline gap-4 py-2">
            <span className="w-20 shrink-0 font-mono text-caption text-tertiary">mono</span>
            <code className="tabular text-footnote">a3f9c21 · 142ms · 99.98%</code>
          </div>
        </div>
      </section>

      <section aria-labelledby="materials" className="space-y-3">
        <h2 id="materials" className="text-headline">
          Materials
        </h2>
        {/* Ambient backdrop only to show translucency; product content stays on solid surfaces. */}
        <div className="relative overflow-hidden rounded-surface border border-subtle bg-canvas p-6">
          <div
            aria-hidden
            className="absolute inset-0 opacity-60"
            style={{
              background:
                'radial-gradient(circle at 15% 20%, var(--dh-color-brand), transparent 35%), radial-gradient(circle at 85% 80%, var(--dh-color-info), transparent 40%)',
            }}
          />
          <div className="relative grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
            {materials.map((m) => (
              <div key={m} className={`dh-material-${m} rounded-popover p-3`}>
                <div className="text-footnote font-semibold">{m}</div>
                <div className="text-caption text-secondary">Material</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
