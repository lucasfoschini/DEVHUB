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
