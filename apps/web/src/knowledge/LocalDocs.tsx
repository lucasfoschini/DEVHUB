import { useEffect, useId, useMemo, useState } from 'react'
import { FolderOpen } from 'lucide-react'
import { inputClass, secondaryButton } from '../components/formStyles'
import { Panel } from '../components/page'
import { desktop, type DocFile, type Folder } from '../desktop/bridge'
import { request } from '../session'
import { Markdown } from './KnowledgePage'

const MAX_NOTE = 100_000
const SHOWN = 200
const dateOnly = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })

/** Markdown files in authorized folders (an Obsidian vault is a folder), read only, with import
 *  into the Knowledge Base. Desktop app only: the browser cannot read local folders. */
export function LocalDocs(props: { onImported: (noteId: string) => void }) {
  const [folders, setFolders] = useState<Folder[]>([])
  const [folder, setFolder] = useState<string | null>(null)
  const [files, setFiles] = useState<DocFile[] | string | null>(null)
  const [filter, setFilter] = useState('')
  const [open, setOpen] = useState<{ rel: string; text: string } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const folderId = useId()
  const filterId = useId()

  useEffect(() => {
    void desktop?.invoke('folders_list', {}).then((list) => {
      setFolders(list)
      setFolder((f) => f ?? list[0]?.path ?? null)
    })
  }, [])

  useEffect(() => {
    if (!folder) return
    let live = true
    desktop!.invoke('docs_list', { path: folder }).then(
      (list) => live && setFiles(list),
      (e: unknown) => live && setFiles(String(e)),
    )
    return () => {
      live = false
    }
  }, [folder])

  const shown = useMemo(() => {
    if (!Array.isArray(files)) return []
    const q = filter.trim().toLowerCase()
    return (q ? files.filter((f) => f.rel.toLowerCase().includes(q)) : files).slice(0, SHOWN)
  }, [files, filter])

  if (!desktop) return null

  const read = (rel: string) => {
    setMessage(null)
    desktop!.invoke('docs_read', { path: folder!, rel }).then(
      (text) => setOpen({ rel, text }),
      (e: unknown) => setMessage(String(e)),
    )
  }

  const importNote = async () => {
    if (!open) return
    if (open.text.length > MAX_NOTE) {
      setMessage('Arquivo maior que o limite de uma nota (100 mil caracteres).')
      return
    }
    const title = (open.rel.split('/').pop() ?? open.rel).replace(/\.md$/i, '').slice(0, 160)
    const res = await request<{ id: string }>('POST', '/api/notes', { title, body: open.text })
    if (res.ok) props.onImported(res.data.id)
    else setMessage(`Não foi possível importar (HTTP ${res.status}).`)
  }

  return (
    <Panel label="Arquivos locais" className="mt-6">
      <div className="flex flex-wrap items-end gap-3 border-b border-subtle px-4 py-3">
        <h2 className="flex items-center gap-2 text-headline">
          <FolderOpen size={18} aria-hidden /> Arquivos locais
        </h2>
        {folders.length === 0 ? (
          <p className="text-footnote text-secondary">
            Autorize uma pasta (por exemplo, seu vault do Obsidian) em Git Center → Pastas locais.
          </p>
        ) : (
          <>
            <label htmlFor={folderId} className="sr-only">
              Pasta
            </label>
            <select
              id={folderId}
              className={`${inputClass} w-auto`}
              value={folder ?? ''}
              onChange={(e) => {
                setOpen(null)
                setFolder(e.target.value)
              }}
            >
              {folders.map((f) => (
                <option key={f.path} value={f.path}>
                  {f.name}
                </option>
              ))}
            </select>
            <label htmlFor={filterId} className="sr-only">
              Filtrar arquivos
            </label>
            <input
              id={filterId}
              type="search"
              placeholder="Filtrar por nome"
              className={`${inputClass} max-w-xs flex-1`}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </>
        )}
      </div>
      {typeof files === 'string' && (
        <p role="alert" className="px-4 py-3 text-footnote text-error">
          {files}
        </p>
      )}
      {Array.isArray(files) && (
        <div className="grid md:grid-cols-[minmax(0,18rem)_1fr]">
          <ul className="max-h-[28rem] overflow-auto border-b border-subtle md:border-r md:border-b-0">
            {shown.length === 0 && (
              <li className="px-4 py-3 text-footnote text-secondary">Nenhum arquivo .md.</li>
            )}
            {shown.map((f) => (
              <li key={f.rel}>
                <button
                  type="button"
                  aria-current={open?.rel === f.rel}
                  className="block w-full px-4 py-1.5 text-left hover:bg-hover aria-[current=true]:bg-selected"
                  onClick={() => read(f.rel)}
                >
                  <span className="block truncate font-mono text-footnote">{f.rel}</span>
                  <span className="block text-caption text-secondary">
                    {dateOnly.format(f.modified)}
                  </span>
                </button>
              </li>
            ))}
            {files.length > SHOWN && shown.length === SHOWN && (
              <li className="px-4 py-2 text-caption text-secondary">
                Mostrando {SHOWN} de {files.length}. Filtre para achar os demais.
              </li>
            )}
          </ul>
          <div className="min-w-0 p-4">
            {message && (
              <p role="alert" className="mb-2 text-footnote text-error">
                {message}
              </p>
            )}
            {open ? (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="truncate font-mono text-footnote text-secondary">
                    {open.rel}
                  </span>
                  <button type="button" className={secondaryButton} onClick={importNote}>
                    Importar como nota
                  </button>
                </div>
                <Markdown source={open.text} />
              </>
            ) : (
              <p className="text-footnote text-secondary">
                Escolha um arquivo. O DevHub só lê: nada é alterado na pasta.
              </p>
            )}
          </div>
        </div>
      )}
    </Panel>
  )
}
