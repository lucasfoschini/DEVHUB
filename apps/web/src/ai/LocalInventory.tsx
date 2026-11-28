import { useEffect, useId, useMemo, useState } from 'react'
import { Boxes } from 'lucide-react'
import { inputClass } from '../components/formStyles'
import { Panel } from '../components/page'
import { desktop, type AiInventory, type Tool } from '../desktop/bridge'

const AI_TOOLS = ['claude', 'codex', 'ollama']
const SCOPE_LABEL = { global: 'Global', plugin: 'Plugin', project: 'Projeto' } as const
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

/** What is installed on this machine (Phase 6): AI CLIs, Claude Code skills and session history.
 *  Read from disk by the desktop app; sessions are counted, their content is never read. */
export function LocalInventory() {
  const [tools, setTools] = useState<Tool[]>([])
  const [inventory, setInventory] = useState<AiInventory | string | null>(null)
  const [filter, setFilter] = useState('')
  const filterId = useId()

  useEffect(() => {
    if (!desktop) return
    void desktop.invoke('tools', {}).then(setTools)
    desktop.invoke('ai_inventory', {}).then(setInventory, (e: unknown) => setInventory(String(e)))
  }, [])

  const skills = useMemo(() => {
    if (!inventory || typeof inventory === 'string') return []
    const count = new Map<string, number>()
    for (const s of inventory.skills) count.set(s.name, (count.get(s.name) ?? 0) + 1)
    const q = filter.trim().toLowerCase()
    return inventory.skills
      .filter((s) => !q || `${s.name} ${s.description} ${s.source}`.toLowerCase().includes(q))
      .map((s) => ({ ...s, copies: count.get(s.name) ?? 1 }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [inventory, filter])

  if (!desktop) {
    return (
      <Panel label="Inventário local" className="mt-6 p-5">
        <h2 className="flex items-center gap-2 text-headline">
          <Boxes size={18} aria-hidden /> Inventário local
        </h2>
        <p className="mt-1 text-secondary">
          Skills, sessões e ferramentas de IA desta máquina aparecem no app desktop do DevHub.
        </p>
      </Panel>
    )
  }

  const duplicates = new Set(skills.filter((s) => s.copies > 1).map((s) => s.name)).size

  return (
    <Panel label="Inventário local" className="mt-6">
      <div className="border-b border-subtle px-4 py-3">
        <h2 className="flex items-center gap-2 text-headline">
          <Boxes size={18} aria-hidden /> Inventário local
        </h2>
        <p className="mt-0.5 text-footnote text-secondary">
          Lido do disco desta máquina. Somente leitura.
        </p>
      </div>

      <section aria-labelledby="ai-tools" className="border-b border-subtle px-4 py-3">
        <h3 id="ai-tools" className="text-footnote font-semibold">
          Ferramentas
        </h3>
        <ul className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-footnote">
          {AI_TOOLS.map((id) => {
            const t = tools.find((x) => x.id === id)
            return (
              <li key={id}>
                {t?.label ?? id}{' '}
                <span className="font-mono text-secondary">{t?.version ?? 'não encontrado'}</span>
              </li>
            )
          })}
        </ul>
      </section>

      {typeof inventory === 'string' ? (
        <p role="alert" className="px-4 py-3 text-footnote text-error">
          {inventory}
        </p>
      ) : !inventory ? (
        <p className="px-4 py-3 text-footnote text-secondary">Lendo…</p>
      ) : (
        <>
          <section aria-labelledby="ai-skills" className="border-b border-subtle">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
              <h3 id="ai-skills" className="text-footnote font-semibold">
                Skills ({inventory.skills.length}
                {duplicates > 0 && `, ${duplicates} com cópias repetidas`})
              </h3>
              <label htmlFor={filterId} className="sr-only">
                Filtrar skills
              </label>
              <input
                id={filterId}
                type="search"
                placeholder="Filtrar"
                className={`${inputClass} max-w-xs`}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            <ul tabIndex={0} aria-label="Skills" className="mt-2 max-h-96 overflow-auto">
              {skills.map((s) => (
                <li key={s.path} className="border-t border-subtle px-4 py-2" title={s.path}>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-mono text-footnote font-medium">{s.name}</span>
                    <span className="text-caption text-secondary">
                      {SCOPE_LABEL[s.scope]} · {s.source}
                    </span>
                    {s.copies > 1 && (
                      <span className="text-caption text-warning">{s.copies} cópias</span>
                    )}
                  </div>
                  {s.description && (
                    <p className="line-clamp-2 text-caption text-secondary">{s.description}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="ai-sessions" className="px-4 py-3">
            <h3 id="ai-sessions" className="text-footnote font-semibold">
              Sessões do Claude Code por projeto
            </h3>
            {inventory.sessions.length === 0 ? (
              <p className="mt-1 text-footnote text-secondary">Nenhuma sessão encontrada.</p>
            ) : (
              <table className="mt-1 w-full text-footnote">
                <thead className="text-left text-caption text-secondary">
                  <tr>
                    <th className="py-1 font-medium">Projeto</th>
                    <th className="py-1 font-medium">Sessões</th>
                    <th className="py-1 font-medium">Tamanho</th>
                    <th className="py-1 font-medium">Última atividade</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.sessions.map((g) => (
                    <tr key={g.project} className="border-t border-subtle">
                      <td className="max-w-0 truncate py-1 pr-2 font-mono">{g.project}</td>
                      <td className="py-1">{g.sessions}</td>
                      <td className="py-1">{mb(g.bytes)}</td>
                      <td className="py-1">{dateTime.format(g.lastActivity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </Panel>
  )
}
