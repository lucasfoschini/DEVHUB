/** Typed access to the DevHub desktop commands (apps/desktop/src-tauri/src/lib.rs). In a browser
 *  `desktop` is null and callers show the web-only experience. Uses the global Tauri injects
 *  (`withGlobalTauri`), so the web app needs no Tauri package. */

export interface Folder {
  path: string
  name: string
}

export interface GitStatus {
  isRepo: boolean
  branch: string | null
  upstream: string | null
  ahead: number
  behind: number
  changed: number
  untracked: number
  conflicts: number
  lastCommit: { sha: string; subject: string; date: string } | null
}

export interface Tool {
  id: string
  label: string
  version: string | null
}

export interface Container {
  id: string
  name: string
  image: string
  state: string
  status: string
  ports: string
}

export interface AgentStatus {
  paired: boolean
  deviceId: string | null
  running: boolean
}

export interface DocFile {
  /** Relative to the folder, with / separators. */
  rel: string
  size: number
  /** Unix milliseconds. */
  modified: number
}

export interface AiInventory {
  skills: {
    name: string
    description: string
    scope: 'global' | 'plugin' | 'project'
    source: string
    path: string
  }[]
  sessions: { project: string; sessions: number; bytes: number; lastActivity: number }[]
}

export type OpenTarget = 'explorer' | 'vscode' | 'cursor' | 'terminal'

interface Commands {
  folders_list: [Record<string, never>, Folder[]]
  folders_add: [Record<string, never>, Folder[]]
  folders_remove: [{ path: string }, Folder[]]
  git_status: [{ path: string }, GitStatus]
  open_in: [{ path: string; target: OpenTarget }, null]
  tools: [Record<string, never>, Tool[]]
  notify: [{ title: string; body: string }, null]
  set_unread: [{ count: number }, null]
  docker_containers: [Record<string, never>, Container[]]
  agent_status: [Record<string, never>, AgentStatus]
  agent_pair: [{ code: string }, null]
  agent_unpair: [Record<string, never>, null]
  docs_list: [{ path: string }, DocFile[]]
  docs_read: [{ path: string; rel: string }, string]
  ai_inventory: [Record<string, never>, AiInventory]
}

type RawInvoke = (cmd: string, args?: object) => Promise<unknown>
const raw = (globalThis as { __TAURI__?: { core?: { invoke?: RawInvoke } } }).__TAURI__?.core
  ?.invoke

export const desktop = raw
  ? {
      invoke: <K extends keyof Commands>(cmd: K, args: Commands[K][0]) =>
        raw(cmd, args) as Promise<Commands[K][1]>,
    }
  : null
