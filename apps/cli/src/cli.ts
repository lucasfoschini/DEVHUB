#!/usr/bin/env node
/** DevHub CLI (Phase 7, ADR 0009). Read-mostly commands over the same API the web app uses. */
import { createInterface } from 'node:readline'
import {
  api,
  ApiError,
  clearConfig,
  cookiePairs,
  loadConfig,
  saveConfig,
  type Config,
} from './client.js'
import { parseArgs, table, when } from './format.js'

const HELP = `Uso: devhub <comando> [--json]

  login [--url URL] [--email E] [--password-stdin]   entra e guarda a sessão em ~/.devhub
  logout                                             encerra a sessão
  status                                             resumo do Command Center
  projects list | projects register <nome> [--description D]
  repos list | repos sync                            repositórios importados; sync relê do GitHub
  monitor list                                       monitores e estado atual
  deploy status                                      últimos deploys (GitHub, Render, Vercel)
  agent status                                       computadores pareados (Local Agent)
  doctor                                             confere API, sessão e Node

URL padrão: $DEVHUB_URL ou http://localhost:5173`

const out = (s: string) => process.stdout.write(`${s}\n`)

function session(): Config {
  const config = loadConfig()
  if (!config) throw new ApiError(401, 'Sem sessão. Rode: devhub login')
  return config
}

/** Hidden prompt on a terminal; with --password-stdin the first line of stdin. */
async function ask(question: string, hidden: boolean): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  if (hidden) {
    const write = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput
    ;(rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s) =>
      write.call(rl, s.startsWith(question) ? s : '')
  }
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close()
      if (hidden) process.stdout.write('\n')
      resolve(answer.trim())
    }),
  )
}

async function stdinLine() {
  let data = ''
  for await (const chunk of process.stdin) data += chunk
  return data.split(/\r?\n/)[0] ?? ''
}

async function login(flags: Record<string, string | true>) {
  const url = String(flags.url ?? process.env.DEVHUB_URL ?? 'http://localhost:5173')
  const email = typeof flags.email === 'string' ? flags.email : await ask('E-mail: ', false)
  const password = flags['password-stdin'] ? await stdinLine() : await ask('Senha: ', true)
  const { headers } = await api({ url }, 'POST', '/auth/sign-in/email', { email, password }).catch(
    (e: ApiError) => {
      throw new ApiError(e.status, e.status === 401 ? 'E-mail ou senha incorretos' : e.message)
    },
  )
  const cookie = cookiePairs(headers.getSetCookie())
  if (!cookie) throw new ApiError(500, 'O servidor não devolveu uma sessão')
  saveConfig({ url, cookie })
  const { data: me } = await api<{ user: { email: string } }>({ url, cookie }, 'GET', '/me')
  out(`Conectado como ${me.user.email} em ${new URL(url).origin}`)
}

type Run = (c: Config, words: string[], flags: Record<string, string | true>) => Promise<unknown>

const commands: Record<string, Run> = {
  async status(c) {
    const { data } = await api<{
      projects: { byStatus: Record<string, number> }
      monitors: { total: number; up: number; down: number; unknown: number; paused: number }
      openIncidents: { monitor: { name: string }; startedAt: string }[]
      github: { status: string; externalLogin: string } | null
      unreadNotifications: number
    }>(c, 'GET', '/overview')
    return {
      data,
      text: [
        `Projetos: ${
          Object.entries(data.projects.byStatus)
            .map(([s, n]) => `${n} ${s}`)
            .join(', ') || 'nenhum'
        }`,
        `Monitores: ${data.monitors.up} no ar, ${data.monitors.down} fora, ${data.monitors.unknown} sem dados, ${data.monitors.paused} pausados`,
        `Incidentes abertos: ${data.openIncidents.length}${data.openIncidents.map((i) => `\n  ${i.monitor.name} desde ${when(i.startedAt)}`).join('')}`,
        `GitHub: ${data.github ? `${data.github.status} (@${data.github.externalLogin})` : 'não conectado'}`,
        `Notificações não lidas: ${data.unreadNotifications}`,
      ].join('\n'),
    }
  },

  async 'projects list'(c) {
    const { data } = await api<{ items: { name: string; status: string; updatedAt: string }[] }>(
      c,
      'GET',
      '/projects?limit=100',
    )
    return {
      data: data.items,
      text: table(
        ['Projeto', 'Status', 'Atualizado'],
        data.items.map((p) => [p.name, p.status, when(p.updatedAt)]),
      ),
    }
  },

  async 'projects register'(c, words, flags) {
    const name = words.slice(2).join(' ').trim()
    if (!name) throw new ApiError(400, 'Uso: devhub projects register <nome>')
    const body = {
      name,
      ...(typeof flags.description === 'string' && { description: flags.description }),
    }
    const { data } = await api<{ id: string; name: string }>(c, 'POST', '/projects', body)
    return { data, text: `Projeto criado: ${data.name} (${data.id})` }
  },

  async 'repos list'(c) {
    const { data } = await api<
      { fullName: string; defaultBranch: string | null; pushedAt: string | null }[]
    >(c, 'GET', '/repositories')
    return {
      data,
      text: table(
        ['Repositório', 'Branch', 'Último push'],
        data.map((r) => [r.fullName, r.defaultBranch, when(r.pushedAt)]),
      ),
    }
  },

  async 'repos sync'(c) {
    const { data: repos } = await api<{ id: string; fullName: string }[]>(c, 'GET', '/repositories')
    const results: { repo: string; ok: boolean; error?: string }[] = []
    for (const r of repos) {
      try {
        await api(c, 'POST', `/repositories/${r.id}/sync`)
        results.push({ repo: r.fullName, ok: true })
      } catch (e) {
        results.push({ repo: r.fullName, ok: false, error: (e as Error).message })
      }
    }
    return {
      data: results,
      text: results.length
        ? results
            .map((r) => `${r.ok ? 'ok   ' : 'falha'} ${r.repo}${r.error ? ` (${r.error})` : ''}`)
            .join('\n')
        : 'Nenhum repositório importado.',
    }
  },

  async 'monitor list'(c) {
    const { data } = await api<
      {
        name: string
        url: string
        state: string
        enabled: boolean
        last24h: { uptime: number | null }
      }[]
    >(c, 'GET', '/monitors')
    return {
      data,
      text: table(
        ['Monitor', 'Estado', 'Uptime 24h', 'URL'],
        data.map((m) => [
          m.name,
          m.enabled ? m.state : 'pausado',
          m.last24h.uptime === null ? null : `${(m.last24h.uptime * 100).toFixed(2)}%`,
          m.url,
        ]),
      ),
    }
  },

  async 'deploy status'(c) {
    const lines: string[] = []
    const data: Record<string, unknown> = {}
    const read = async <T>(key: string, path: string, render: (d: T) => string[]) => {
      try {
        const { data: d } = await api<T & { connected?: boolean }>(c, 'GET', path)
        data[key] = d
        if (d.connected === false) lines.push(`${key}: não conectado`)
        else lines.push(...render(d))
      } catch (e) {
        lines.push(`${key}: ${(e as Error).message}`)
      }
    }
    await read<{
      pipelines: {
        repository: { fullName: string }
        runs: { workflow: string; status: string; conclusion: string | null; createdAt: string }[]
        error: number | null
      }[]
    }>('GitHub', '/deployments', (d) => [
      'GitHub Actions:',
      ...d.pipelines.map((p) => {
        const r = p.runs[0]
        const state = p.error
          ? `HTTP ${p.error}`
          : r
            ? `${r.workflow} ${r.conclusion ?? r.status} ${when(r.createdAt)}`
            : 'sem execuções'
        return `  ${p.repository.fullName} ${state}`
      }),
    ])
    await read<{ services: { name: string; deploys: { status: string; createdAt: string }[] }[] }>(
      'Render',
      '/providers/render/resources',
      (d) => [
        'Render:',
        ...d.services.map(
          (s) =>
            `  ${s.name} ${s.deploys[0]?.status ?? 'sem deploy'} ${when(s.deploys[0]?.createdAt) ?? ''}`,
        ),
      ],
    )
    await read<{
      deployments: { project: string; state: string; target: string | null; createdAt: string }[]
    }>('Vercel', '/providers/vercel/resources', (d) => [
      'Vercel:',
      ...d.deployments
        .slice(0, 5)
        .map((x) => `  ${x.project} ${x.target ?? 'preview'} ${x.state} ${when(x.createdAt)}`),
    ])
    return { data, text: lines.join('\n') }
  },

  async 'agent status'(c) {
    const { data } = await api<
      {
        name: string
        platform: string
        online: boolean
        lastSeenAt: string | null
        capabilities: string[]
      }[]
    >(c, 'GET', '/devices')
    return {
      data,
      text: data.length
        ? table(
            ['Computador', 'Sistema', 'Estado', 'Ações'],
            data.map((d) => [
              d.name,
              d.platform,
              d.online ? 'online' : `visto ${when(d.lastSeenAt) ?? 'nunca'}`,
              d.capabilities.join(', '),
            ]),
          )
        : 'Nenhum computador pareado. Pareie em Configurações, no app desktop.',
    }
  },
}

async function doctor(json: boolean) {
  const checks: { check: string; ok: boolean; detail: string }[] = []
  const [major] = process.versions.node.split('.').map(Number)
  checks.push({ check: 'Node.js', ok: major! >= 22, detail: process.versions.node })
  const config = loadConfig()
  checks.push({
    check: 'Sessão salva',
    ok: !!config,
    detail: config ? new URL(config.url).origin : 'rode devhub login',
  })
  if (config) {
    try {
      const { data } = await api<{ status: string }>({ url: config.url }, 'GET', '/health')
      checks.push({ check: 'API', ok: true, detail: data.status })
    } catch (e) {
      checks.push({ check: 'API', ok: false, detail: (e as Error).message })
    }
    try {
      const { data } = await api<{ user: { email: string } }>(config, 'GET', '/me')
      checks.push({ check: 'Sessão válida', ok: true, detail: data.user.email })
    } catch (e) {
      checks.push({ check: 'Sessão válida', ok: false, detail: (e as Error).message })
    }
  }
  out(
    json
      ? JSON.stringify(checks, null, 2)
      : checks.map((c) => `${c.ok ? 'ok   ' : 'falha'} ${c.check}: ${c.detail}`).join('\n'),
  )
  return checks.every((c) => c.ok) ? 0 : 1
}

async function main(argv: string[]) {
  const { words, flags } = parseArgs(argv)
  const json = flags.json === true
  const [cmd, sub] = words
  if (!cmd || cmd === 'help' || flags.help) {
    out(HELP)
    return 0
  }
  if (cmd === 'login') {
    await login(flags)
    return 0
  }
  if (cmd === 'logout') {
    const config = loadConfig()
    if (config) await api(config, 'POST', '/auth/sign-out', {}).catch(() => undefined)
    clearConfig()
    out('Sessão encerrada.')
    return 0
  }
  if (cmd === 'doctor') return doctor(json)
  const run = commands[sub ? `${cmd} ${sub}` : cmd] ?? commands[cmd]
  if (!run) {
    out(`Comando desconhecido: ${words.join(' ')}\n\n${HELP}`)
    return 2
  }
  const result = (await run(session(), words, flags)) as { data: unknown; text: string }
  out(json ? JSON.stringify(result.data, null, 2) : result.text)
  return 0
}

main(process.argv.slice(2)).then(
  (code) => (process.exitCode = code),
  (e: unknown) => {
    const message =
      e instanceof ApiError && e.status === 401 && !e.message.startsWith('Sem')
        ? 'Sessão expirada ou revogada. Rode: devhub login'
        : (e as Error).message
    process.stderr.write(`devhub: ${message}\n`)
    process.exitCode = 1
  },
)
