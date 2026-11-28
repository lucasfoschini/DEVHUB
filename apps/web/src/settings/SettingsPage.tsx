import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Switch } from 'radix-ui'
import { inputClass, primaryButton, secondaryButton } from '../components/formStyles'
import { DeviceSettings } from '../agent/Devices'
import { ProviderKeys } from '../providers/ProviderPanels'
import { request, useSession } from '../session'

interface SessionRow {
  id: string
  createdAt: string
  updatedAt: string
  ipAddress: string | null
  userAgent: string | null
  current: boolean
}

const KIND_LABEL: Record<string, { label: string; hint: string }> = {
  'monitor.down': { label: 'Monitor fora do ar', hint: 'Quando um incidente é aberto.' },
  'monitor.recovered': { label: 'Monitor recuperado', hint: 'Quando o incidente é resolvido.' },
  'integration.needs_reconnect': {
    label: 'Integração desconectada',
    hint: 'Quando GitHub, Render, Vercel ou Neon recusa a chave salva.',
  },
}

const timeFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

function Section(props: { title: string; description?: string; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="mt-8 first:mt-0">
      <h2 id={id} className="text-headline">
        {props.title}
      </h2>
      {props.description && (
        <p className="mt-0.5 text-footnote text-secondary">{props.description}</p>
      )}
      <div className="mt-3 rounded-surface border border-subtle bg-surface p-4">
        {props.children}
      </div>
    </section>
  )
}

function Field(props: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={props.id} className="text-footnote font-medium">
        {props.label}
      </label>
      {props.children}
    </div>
  )
}

/** Inline result of a form: an alert on error, a polite status on success. */
function Result({ value }: { value: { ok: boolean; text: string } | null }) {
  if (!value) return <span role="status" className="sr-only" />
  return value.ok ? (
    <span role="status" className="text-footnote text-success">
      {value.text}
    </span>
  ) : (
    <span role="alert" className="text-footnote text-error">
      {value.text}
    </span>
  )
}

/** Short browser/OS hint from a user agent, without guessing beyond what it says. */
function deviceLabel(ua: string | null) {
  if (!ua) return 'Dispositivo desconhecido'
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : null
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Mac OS X/.test(ua)
      ? 'macOS'
      : /Android/.test(ua)
        ? 'Android'
        : /iPhone|iPad/.test(ua)
          ? 'iOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : null
  return [browser, os].filter(Boolean).join(' · ') || ua.slice(0, 60)
}

function Profile() {
  const { user, reload } = useSession()
  const id = useId()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    const res = await request('PATCH', '/api/me', {
      name: String(new FormData(e.currentTarget).get('name')),
    })
    setBusy(false)
    setResult(res.ok ? { ok: true, text: 'Nome salvo.' } : { ok: false, text: 'Informe um nome.' })
    if (res.ok) reload()
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
      <Field id={`${id}-name`} label="Nome">
        <input
          id={`${id}-name`}
          name="name"
          required
          maxLength={80}
          defaultValue={user.name}
          autoComplete="name"
          className={`${inputClass} max-w-sm`}
        />
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-footnote font-medium">E-mail</span>
        <span className="text-body text-secondary">{user.email}</span>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className={primaryButton} disabled={busy}>
          Salvar
        </button>
        <Result value={result} />
      </div>
    </form>
  )
}

function Password() {
  const id = useId()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const newPassword = String(data.get('new'))
    if (newPassword !== String(data.get('confirm'))) {
      setResult({ ok: false, text: 'A confirmação não confere com a nova senha.' })
      return
    }
    setBusy(true)
    const res = await request('POST', '/api/me/password', {
      currentPassword: String(data.get('current')),
      newPassword,
    })
    setBusy(false)
    if (res.ok) {
      form.reset()
      setResult({ ok: true, text: 'Senha alterada. As outras sessões foram encerradas.' })
    } else {
      setResult({
        ok: false,
        text:
          res.status === 400 && res.message === 'Invalid password'
            ? 'Senha atual incorreta.'
            : 'Não foi possível alterar. A nova senha precisa de pelo menos 12 caracteres.',
      })
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
      <Field id={`${id}-current`} label="Senha atual">
        <input
          id={`${id}-current`}
          name="current"
          type="password"
          required
          autoComplete="current-password"
          className={`${inputClass} max-w-sm`}
        />
      </Field>
      <Field id={`${id}-new`} label="Nova senha (mínimo 12 caracteres)">
        <input
          id={`${id}-new`}
          name="new"
          type="password"
          required
          minLength={12}
          maxLength={256}
          autoComplete="new-password"
          className={`${inputClass} max-w-sm`}
        />
      </Field>
      <Field id={`${id}-confirm`} label="Confirmar nova senha">
        <input
          id={`${id}-confirm`}
          name="confirm"
          type="password"
          required
          minLength={12}
          maxLength={256}
          autoComplete="new-password"
          className={`${inputClass} max-w-sm`}
        />
      </Field>
      <div className="flex items-center gap-3">
        <button type="submit" className={primaryButton} disabled={busy}>
          Alterar senha
        </button>
        <Result value={result} />
      </div>
    </form>
  )
}

function Sessions() {
  const [rows, setRows] = useState<SessionRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    void request<SessionRow[]>('GET', '/api/me/sessions').then((res) => {
      if (!live) return
      setFailed(!res.ok)
      if (res.ok) setRows(res.data)
    })
    return () => {
      live = false
    }
  }, [attempt])

  async function revoke(id: string) {
    await request('DELETE', `/api/me/sessions/${id}`)
    setAttempt((n) => n + 1)
  }

  if (failed) return <p className="text-error">Não foi possível carregar as sessões.</p>
  if (!rows) return <p className="text-secondary">Carregando…</p>
  return (
    <ul className="-my-2">
      {rows.map((s) => (
        <li
          key={s.id}
          className="flex items-center gap-3 border-b border-subtle py-2.5 last:border-0"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body">
              {deviceLabel(s.userAgent)}
              {s.current && <span className="ml-2 text-footnote text-success">Esta sessão</span>}
            </span>
            <span className="block truncate text-caption text-secondary">
              {[s.ipAddress, `ativa em ${timeFormat.format(new Date(s.updatedAt))}`]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
          {!s.current && (
            <button type="button" className={secondaryButton} onClick={() => void revoke(s.id)}>
              Encerrar
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

function NotificationPrefs() {
  const [prefs, setPrefs] = useState<{ kinds: string[]; muted: string[] } | null>(null)
  const [failed, setFailed] = useState(false)
  const id = useId()

  useEffect(() => {
    void request<{ kinds: string[]; muted: string[] }>(
      'GET',
      '/api/notifications/preferences',
    ).then((res) => (res.ok ? setPrefs(res.data) : setFailed(true)))
  }, [])

  async function toggle(kind: string, on: boolean) {
    if (!prefs) return
    const muted = on ? prefs.muted.filter((k) => k !== kind) : [...prefs.muted, kind]
    const res = await request<{ kinds: string[]; muted: string[] }>(
      'PUT',
      '/api/notifications/preferences',
      { muted },
    )
    if (res.ok) setPrefs(res.data)
    else setFailed(true)
  }

  if (failed) return <p className="text-error">Não foi possível carregar as preferências.</p>
  if (!prefs) return <p className="text-secondary">Carregando…</p>
  return (
    <ul className="-my-2">
      {prefs.kinds.map((kind) => {
        const meta = KIND_LABEL[kind] ?? { label: kind, hint: '' }
        return (
          <li
            key={kind}
            className="flex items-center gap-3 border-b border-subtle py-2.5 last:border-0"
          >
            <span className="min-w-0 flex-1">
              <label htmlFor={`${id}-${kind}`} className="block text-body">
                {meta.label}
              </label>
              <span className="block text-caption text-secondary">{meta.hint}</span>
            </span>
            <Switch.Root
              id={`${id}-${kind}`}
              checked={!prefs.muted.includes(kind)}
              onCheckedChange={(on) => void toggle(kind, on)}
              className="relative h-5.5 w-9 shrink-0 rounded-full border border-control bg-surface transition-colors duration-(--dh-duration-fast) data-[state=checked]:border-action data-[state=checked]:bg-action"
            >
              <Switch.Thumb className="block size-4 translate-x-0.5 rounded-full bg-secondary transition-transform duration-(--dh-duration-fast) ease-standard data-[state=checked]:translate-x-[15px] data-[state=checked]:bg-action-fg" />
            </Switch.Root>
          </li>
        )
      })}
    </ul>
  )
}

function Integrations() {
  const [github, setGithub] = useState<{ status: string; externalLogin: string } | null | 'off'>(
    null,
  )

  useEffect(() => {
    void request<{ integration: { status: string; externalLogin: string } | null }>(
      'GET',
      '/api/integrations/github',
    ).then((res) => setGithub(res.ok ? (res.data.integration ?? 'off') : 'off'))
  }, [])

  return (
    <>
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 text-body">
          GitHub{' '}
          <span className="text-secondary">
            {github === null
              ? '…'
              : github === 'off'
                ? 'não conectado'
                : github.status === 'connected'
                  ? `conectado como @${github.externalLogin}`
                  : `precisa reconectar (@${github.externalLogin})`}
          </span>
        </span>
        <Link to="/git" className="text-footnote text-secondary underline hover:text-primary">
          Gerenciar no Git Center
        </Link>
      </div>
      <ProviderKeys />
    </>
  )
}

/** Settings (MASTER_PLAN §7.12), MVP subset: only settings that change real behavior. */
export function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8 md:py-10">
      <header className="mb-6">
        <h1 tabIndex={-1} data-page-title className="text-title1 outline-none">
          Configurações
        </h1>
        <p className="mt-1 text-callout text-secondary">
          Conta, segurança e notificações. Tema e transparência ficam na Central de controle, na
          barra superior.
        </p>
      </header>
      <Section title="Perfil">
        <Profile />
      </Section>
      <Section title="Senha" description="Alterar a senha encerra todas as outras sessões.">
        <Password />
      </Section>
      <Section title="Sessões ativas" description="Dispositivos com acesso à sua conta.">
        <Sessions />
      </Section>
      <Section
        title="Notificações"
        description="Tipos desativados deixam de gerar avisos no app. Os já recebidos continuam na lista."
      >
        <NotificationPrefs />
      </Section>
      <Section title="Integrações">
        <Integrations />
      </Section>
      <Section
        title="Computadores (Local Agent)"
        description="Um computador pareado responde, de qualquer navegador, às ações marcadas enquanto o app desktop estiver aberto."
      >
        <DeviceSettings />
      </Section>
    </div>
  )
}
