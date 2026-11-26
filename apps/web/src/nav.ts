import {
  Activity,
  BookOpen,
  ChartLine,
  FolderKanban,
  GitBranch,
  KeyRound,
  LayoutGrid,
  Rocket,
  Server,
  Settings,
  Sparkles,
  Workflow,
  type LucideIcon,
} from 'lucide-react'

export type GroupId = 'workspace' | 'platform' | 'tools' | 'system'

export const groups: { id: GroupId; label: string }[] = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'platform', label: 'Plataforma' },
  { id: 'tools', label: 'Ferramentas' },
  { id: 'system', label: 'Sistema' },
]

export interface ModuleDef {
  path: string
  label: string
  icon: LucideIcon
  group: GroupId
  /** One line: the question this module answers. */
  purpose: string
  /** Roadmap phase from MASTER_PLAN §38. */
  phase: string
  inspector?: { title: string; empty: string }
}

export const modules: ModuleDef[] = [
  {
    path: '/',
    label: 'Visão geral',
    icon: LayoutGrid,
    group: 'workspace',
    purpose: 'O que está funcionando, o que está falhando e o que precisa de atenção.',
    phase: 'Fase 2 · MVP',
  },
  {
    path: '/projects',
    label: 'Projetos',
    icon: FolderKanban,
    group: 'workspace',
    purpose: 'Projetos, tecnologias, ambientes, repositórios e decisões técnicas.',
    phase: 'Fase 2 · MVP',
  },
  {
    path: '/git',
    label: 'Git Center',
    icon: GitBranch,
    group: 'workspace',
    purpose: 'Repositórios, branches, commits e pull requests do GitHub.',
    phase: 'Fase 2 · MVP (somente leitura)',
  },
  {
    path: '/deployments',
    label: 'Deployments',
    icon: Rocket,
    group: 'workspace',
    purpose: 'Builds, releases, ambientes e histórico de deploy.',
    phase: 'Fase 4',
  },
  {
    path: '/infrastructure',
    label: 'Infraestrutura',
    icon: Server,
    group: 'platform',
    purpose: 'Servidores, containers, bancos de dados e recursos.',
    phase: 'Fase 4',
  },
  {
    path: '/observability',
    label: 'Observabilidade',
    icon: Activity,
    group: 'platform',
    purpose: 'Health checks, uptime, latência, incidentes e alertas.',
    phase: 'Fase 2 · MVP (monitoramento HTTP)',
  },
  {
    path: '/ai',
    label: 'AI Center',
    icon: Sparkles,
    group: 'platform',
    purpose: 'Ferramentas de IA, sessões, skills, consumo e custos.',
    phase: 'Fase 6',
  },
  {
    path: '/knowledge',
    label: 'Knowledge Base',
    icon: BookOpen,
    group: 'tools',
    purpose: 'Documentação, ADRs, roadmaps e vaults do Obsidian.',
    phase: 'Fase 6',
  },
  {
    path: '/automations',
    label: 'Automações',
    icon: Workflow,
    group: 'tools',
    purpose: 'Gatilhos, condições, ações e histórico de execução.',
    phase: 'Fase 7',
  },
  {
    path: '/secrets',
    label: 'Secrets Vault',
    icon: KeyRound,
    group: 'tools',
    purpose: 'Credenciais das integrações, armazenadas com segurança.',
    phase: 'Fase 2 · parcial',
  },
  {
    path: '/analytics',
    label: 'Analytics',
    icon: ChartLine,
    group: 'tools',
    purpose: 'Atividade, releases, estabilidade e custos ao longo do tempo.',
    phase: 'Pós-MVP',
  },
  {
    path: '/settings',
    label: 'Configurações',
    icon: Settings,
    group: 'system',
    purpose: 'Perfil, aparência, notificações, integrações e segurança.',
    phase: 'Fase 2 · MVP',
  },
]
