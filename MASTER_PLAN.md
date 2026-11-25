# DEVHUB — MASTER PLAN V2.0

## Developer Operating System
### Technical Minimalism × Apple 27 Design Language × Graphite Lime

---

# 01. IDENTIDADE E RESPONSABILIDADE DO AGENTE

Atue como um especialista sênior multidisciplinar nas áreas de:

- Software Architecture;
- Full Stack Engineering;
- Product Engineering;
- Product Design;
- UI/UX Design;
- Creative Direction;
- Design Systems;
- Motion Design;
- Developer Experience;
- DevOps;
- Site Reliability Engineering;
- Cybersecurity;
- Database Engineering;
- AI Engineering;
- Quality Assurance.

Sua missão é planejar, projetar, desenvolver, documentar, testar e evoluir o DevHub como um produto digital profissional.

Não trate o projeto como um exercício acadêmico, CRUD genérico, dashboard administrativo ou simples demonstração de portfólio.

O DevHub deverá ser uma ferramenta utilizada diariamente por desenvolvedores, com potencial de evolução para um produto comercial.

Priorize:

- Qualidade de engenharia;
- Experiência do usuário;
- Segurança;
- Performance;
- Escalabilidade;
- Identidade visual;
- Manutenibilidade;
- Modularidade;
- Developer Experience;
- Eficiência operacional;
- Simplicidade arquitetural.

Tenha autonomia para tomar decisões técnicas e criativas dentro dos limites definidos neste documento.

Não solicite aprovação para cada decisão trivial.

Não confunda sofisticação com complexidade desnecessária.

---

# 02. VISÃO DO PRODUTO

## Nome

DevHub.

## Posicionamento

Developer Operating System — DevOS.

## Conceito

O DevHub é uma plataforma centralizada de gerenciamento do ecossistema de desenvolvimento de software.

Seu objetivo é conectar e organizar:

- Projetos;
- Repositórios;
- Infraestrutura;
- Servidores;
- Containers;
- Bancos de dados;
- Deployments;
- APIs;
- Monitoramento;
- Agentes de inteligência artificial;
- Skills;
- Documentação;
- Ferramentas locais;
- Automações;
- Credenciais;
- Custos;
- Atividade de desenvolvimento.

O produto deverá acompanhar o ciclo de vida completo de um projeto:

Planejamento → Desenvolvimento → Versionamento → Testes → Deploy → Monitoramento → Manutenção → Evolução.

O DevHub não precisa substituir integralmente GitHub, Vercel, Grafana, Obsidian, Claude Code ou outras ferramentas.

Sua função é integrar, organizar e centralizar as operações mais relevantes.

## Proposta de valor

Um único workspace para gerenciar todo o ecossistema de desenvolvimento.

## Mensagens conceituais

Build. Manage. Evolve.

Build with precision.

Everything you build. Beautifully connected.

One developer. One workspace. One ecosystem.

Essas mensagens representam possibilidades de branding, não textos obrigatórios em todas as telas.

## Público inicial

- Desenvolvedores independentes;
- Desenvolvedores Full Stack;
- Estudantes de tecnologia;
- Freelancers;
- Criadores de SaaS;
- Desenvolvedores que utilizam agentes de IA;
- Profissionais responsáveis por múltiplos projetos.

## Público futuro

- Pequenas equipes;
- Startups;
- Software houses;
- Agências;
- Equipes de engenharia;
- Profissionais de DevOps.

## Estratégia de produto

Adotar Dogfooding.

O próprio criador será o primeiro usuário real do DevHub.

Priorize problemas concretos observados durante o gerenciamento de projetos reais.

Não implemente funcionalidades apenas para aumentar o escopo do produto.

---

# 03. DECISÕES CENTRAIS DO PROJETO

Considere as seguintes decisões como baseline arquitetural.

| Categoria | Decisão |
|---|---|
| Repositório | Monorepo |
| Gerenciamento | pnpm Workspaces |
| Orquestração | Turborepo |
| Backend | Monolito Modular |
| Web | React + Vite |
| Desktop | Tauri 2 + Rust |
| Mobile | React Native + Expo |
| CLI | TypeScript, em fase posterior |
| API | NestJS |
| Banco principal | PostgreSQL |
| ORM | Prisma |
| Banco local | SQLite, quando necessário |
| Cache | Redis, sob demanda |
| Filas | BullMQ, sob demanda |
| Comunicação | REST + WebSockets/SSE quando necessário |
| Linguagem principal | TypeScript |
| Design | Native Technical Design |
| Estilo estrutural | Technical Minimalism |
| Inspiração visual | iOS 27, iPadOS 27 e macOS 27 |
| Materiais | Liquid Glass Inspired |
| Paleta | Graphite Lime |
| Tipografia | Geist Sans + JetBrains Mono |
| Iconografia | Lucide |
| Infraestrutura local | Docker Compose |
| CI/CD | GitHub Actions |

Não altere decisões centrais silenciosamente.

Quando houver uma incompatibilidade relevante, documente o problema, apresente alternativas e justifique a solução proposta.

---

# 04. ARQUITETURA MONOREPO

Utilizar um único repositório com aplicações e packages compartilhados.

Estrutura evolutiva:

```text
devhub/
├── apps/
│   ├── web/
│   ├── desktop/
│   ├── mobile/
│   ├── api/
│   ├── agent/
│   ├── worker/
│   └── cli/
│
├── packages/
│   ├── app-shell/
│   ├── ui/
│   ├── ui-native/
│   ├── design-tokens/
│   ├── motion/
│   ├── core/
│   ├── contracts/
│   ├── sdk/
│   ├── database/
│   ├── validation/
│   ├── integrations/
│   ├── observability/
│   ├── config/
│   ├── eslint-config/
│   └── typescript-config/
│
├── infra/
│   ├── docker/
│   ├── monitoring/
│   ├── deployment/
│   └── scripts/
│
├── docs/
│   ├── product/
│   ├── architecture/
│   ├── design/
│   ├── decisions/
│   ├── security/
│   ├── integrations/
│   ├── operations/
│   └── roadmap/
│
├── .github/workflows/
├── .env.example
├── .gitignore
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── turbo.json
├── docker-compose.yml
├── AGENTS.md
├── CLAUDE.md
├── MASTER_PLAN.md
├── ROADMAP.md
└── README.md
```

Essa estrutura representa o destino evolutivo, não uma obrigação de criar todos os diretórios imediatamente.

Crie apenas aplicações e packages com responsabilidades concretas.

Não crie abstrações vazias ou estruturas redundantes.

## Regras arquiteturais

- Web e Desktop deverão compartilhar a maior parte da interface React.
- Mobile deverá compartilhar contratos, SDK, regras de domínio e tokens visuais.
- Componentes DOM não devem ser considerados automaticamente compatíveis com React Native.
- O backend deverá começar como Monolito Modular.
- Clientes não deverão acessar diretamente PostgreSQL ou Redis.
- Credenciais privilegiadas nunca deverão ser incluídas em packages enviados aos clientes.
- Microserviços somente deverão ser introduzidos mediante necessidade comprovada.
- Regras de negócio não deverão ficar acopladas à camada visual.

---

# 05. EXPERIÊNCIA MULTIPLATAFORMA

## Web

Tecnologias:

- React;
- Vite;
- TypeScript.

Responsabilidades:

- Acesso pelo navegador;
- Gerenciamento de projetos;
- Repositórios;
- Dashboard;
- Monitoramento;
- Integrações;
- Documentação;
- Operações remotas autorizadas.

## Desktop

Tecnologias:

- Tauri 2;
- Rust;
- React;
- Vite.

Plataformas:

- Windows;
- macOS;
- Linux.

Priorizar Windows inicialmente, sem impedir expansão para as demais plataformas.

Funcionalidades exclusivas ou ampliadas:

- Acesso autorizado a diretórios locais;
- Git local;
- Docker;
- VS Code;
- Cursor;
- Claude Code;
- Codex;
- Obsidian;
- Terminal controlado;
- Recursos do sistema;
- Notificações nativas;
- System tray;
- Atalhos globais;
- Gerenciamento de dispositivos;
- Local Agent.

A experiência deverá transmitir a qualidade de um aplicativo desktop premium.

Entretanto, respeite as convenções de cada sistema operacional.

Não reproduza botões de janela do macOS no Windows apenas por estética. Utilize controles nativos ou implemente equivalentes adequados.

## Mobile

Tecnologias:

- React Native;
- Expo;
- TypeScript.

Plataformas:

- Android;
- iOS.

Prioridades:

- Monitoramento;
- Alertas;
- Projetos;
- Deployments;
- Atividades em andamento;
- Agentes de IA;
- Notificações;
- Aprovação de operações autorizadas;
- Consulta rápida de informações.

Não replique diretamente a interface desktop.

Projete uma experiência mobile própria, inspirada no iOS 27 e adaptada às convenções de cada plataforma.

## Tablet

Utilize:

- Split views;
- Sidebars adaptáveis;
- Painéis contextuais;
- Navegação multidimensional;
- Layouts redimensionáveis;
- Suporte a toque e teclado.

Inspire-se na experiência de produtividade do iPadOS 27.

## CLI

Implementar futuramente comandos como:

```bash
devhub login
devhub status
devhub projects list
devhub projects register
devhub repos sync
devhub deploy status
devhub monitor list
devhub agent status
devhub doctor
```

Os comandos são propostas de interface.

A CLI deverá utilizar SDK e contratos compartilhados.

---

# 06. STACK COMPLEMENTAR

Considere as seguintes tecnologias conforme a necessidade.

| Finalidade | Tecnologia candidata |
|---|---|
| Estado remoto | TanStack Query |
| Estado local | Zustand |
| Roteamento | React Router |
| Formulários | React Hook Form |
| Validação | Zod |
| Estilização | Tailwind CSS |
| Componentes acessíveis | shadcn/ui + Radix UI |
| Motion | Motion |
| Iconografia | Lucide |
| Gráficos | Recharts |
| Workflows | React Flow |
| Editor de código | Monaco ou CodeMirror |
| Terminal visual | xterm.js |
| Documentação de API | OpenAPI |
| Testes unitários | Vitest ou ferramenta adequada |
| Testes de interface | Testing Library |
| Testes E2E | Playwright |
| Observabilidade | OpenTelemetry |
| Métricas | Prometheus |
| Lint | ESLint |
| Formatting | Prettier |

Não instalar todas as dependências imediatamente.

Antes de selecionar uma biblioteca:

1. Verifique documentação oficial.
2. Verifique compatibilidade.
3. Verifique versão estável.
4. Verifique licença.
5. Avalie segurança.
6. Avalie performance.
7. Identifique sobreposição com dependências existentes.

Prefira a solução mais simples capaz de atender ao requisito.

---

# 07. MÓDULOS DO DEVHUB

O produto deverá evoluir para doze módulos principais.

## 7.1 Command Center

Dashboard central.

Deverá apresentar:

- Visão geral dos projetos;
- Projetos recentes;
- Serviços operacionais;
- Incidentes;
- Deployments recentes;
- Atividade Git;
- Agentes ativos;
- Consumo de IA;
- Alertas;
- Status do Local Agent;
- Operações em andamento;
- Ações rápidas.

O dashboard deve responder:

- O que está funcionando?
- O que está falhando?
- O que mudou?
- Qual projeto precisa de atenção?
- Quais operações estão acontecendo?

Não criar métricas sem finalidade prática.

## 7.2 Project Manager

Funcionalidades:

- Criar, editar e arquivar projetos;
- Organizar tecnologias;
- Definir status;
- Vincular múltiplos repositórios;
- Vincular ambientes;
- Vincular diretórios locais;
- Vincular documentação;
- Vincular servidores;
- Organizar tarefas;
- Milestones;
- Roadmaps;
- Tags;
- Links;
- Decisões técnicas;
- Histórico;
- Pesquisa;
- Filtros.

Estados possíveis:

Planning, Development, Testing, Production, Maintenance e Archived.

Cada projeto deverá possuir visão própria, com abas contextuais para seus recursos e atividades.

## 7.3 Git Center

Integração inicial com GitHub.

Funcionalidades:

- Importação de repositórios;
- Branches;
- Commits;
- Pull requests;
- Issues;
- Releases;
- Colaboradores;
- Pipelines;
- Atividade;
- Sincronização;
- Estado local do Git;
- Visualização autorizada de alterações;
- Abertura de projetos no editor.

Utilize APIs oficiais, permissões granulares, sincronização incremental e webhooks quando disponíveis.

Avalie GitHub App para acesso a repositórios.

Não executar automaticamente force push, hard reset, exclusão de branches ou operações destrutivas.

## 7.4 Deploy Center

Integrações candidatas:

- Vercel;
- Render;
- Railway;
- GitHub Actions;
- Cloudflare;
- Netlify;
- Coolify;
- Oracle Cloud;
- VPS próprias.

Funcionalidades:

- Deployments;
- Histórico;
- Builds;
- Logs autorizados;
- URLs;
- Ambientes;
- Releases;
- Falhas;
- Redeploy;
- Rollback autorizado;
- Acionamento de pipelines.

Normalize estados dos provedores sem eliminar informações relevantes.

Implemente capabilities específicas por integração.

Operações em produção exigem controles, confirmação quando necessária e auditoria.

## 7.5 Infrastructure

Gerenciamento de:

- Servidores;
- VPS;
- Docker;
- Containers;
- Bancos de dados;
- Serviços;
- Recursos;
- CPU;
- RAM;
- Armazenamento;
- Rede;
- Sistema operacional;
- Uptime.

Operações futuras:

- Start;
- Stop;
- Restart;
- Logs;
- Inspeção;
- Acesso remoto controlado.

Nunca exponha Docker daemon ou sockets privilegiados diretamente à internet.

Não disponibilize terminal remoto irrestrito.

## 7.6 Observability

Funcionalidades:

- HTTP health checks;
- Uptime;
- Latência;
- P50, P95 e P99, quando mensuráveis;
- Error rate;
- Histórico;
- Incidentes;
- Alertas;
- Logs;
- Tracing;
- Certificados TLS;
- Monitoramento de endpoints.

Diferencie dados observados, estimados, desatualizados e indisponíveis.

Não invente métricas.

Implemente retenção, limites de concorrência, proteção contra SSRF e controle de redirecionamentos.

## 7.7 AI Center

Integrações candidatas:

- Claude Code;
- Codex;
- OpenAI;
- Anthropic;
- Gemini;
- OpenRouter;
- Ollama.

Funcionalidades:

- Inventário de ferramentas;
- Sessões;
- Agentes;
- Tarefas;
- Modelos;
- Histórico disponível;
- Tokens;
- Custos;
- Budgets;
- Prompts;
- Skills;
- MCPs;
- Configurações;
- Contexto por projeto.

Não presumir que todos os provedores disponibilizam APIs para sessões, quotas, custos ou consumo.

Utilize apenas mecanismos autorizados e tecnicamente suportados.

Diferencie custos de API, planos de assinatura, estimativas e limites reais de uso.

### Skills Manager

Permitir futuramente:

- Inventário;
- Classificação;
- Skills globais;
- Skills por projeto;
- Detecção de duplicidades;
- Versionamento;
- Importação;
- Exportação;
- Backups;
- Habilitação e desabilitação, quando suportadas.

Considere:

- Caveman;
- Graphify;
- RTK;
- Headroom;
- Context Mode;
- Code Review Graph;
- OmniRoute;
- Task Observer.

São referências de integração, não dependências obrigatórias.

### AI Gateway futuro

Avaliar roteamento, fallback, cache, budgets, limites, auditoria e políticas por projeto.

Não incluir um gateway completo no MVP.

## 7.8 Knowledge Base

Integrações:

- Obsidian;
- Markdown;
- Git;
- Diretórios locais autorizados.

Funcionalidades:

- Vaults;
- Documentação;
- Pesquisa;
- Visualização Markdown;
- Edição autorizada;
- ADRs;
- Roadmaps;
- Histórico;
- Backlinks;
- Contexto para agentes.

Arquivos relevantes:

- README.md;
- AGENTS.md;
- CLAUDE.md;
- MASTER_PLAN.md;
- PLANO.md;
- DECISOES.md;
- ARCHITECTURE.md;
- ROADMAP.md;
- CHANGELOG.md.

Preserve arquivos e detecte conflitos.

Utilize escrita atômica e backups quando apropriado.

Comece com busca textual. Avalie embeddings, pgvector, busca híbrida e RAG apenas mediante necessidade.

## 7.9 Automation Center

Estrutura:

Trigger → Conditions → Actions → Result.

Triggers:

- Schedule;
- Webhook;
- Push;
- Pull request;
- Deployment;
- Health check;
- Incidente;
- Evento local;
- Ação manual.

Actions:

- Notificar;
- Sincronizar;
- Executar health check;
- Atualizar informações;
- Gerar relatórios;
- Acionar operações autorizadas.

Implementar progressivamente:

- Editor visual;
- Condições;
- Variáveis;
- Histórico;
- Logs;
- Retry;
- Timeout;
- Cancelamento;
- Idempotência;
- Controle de concorrência;
- Prevenção de loops;
- Auditoria.

## 7.10 Secrets Vault

Gerenciamento protegido de:

- Tokens;
- API keys;
- Variáveis de ambiente;
- Credenciais;
- Configurações sensíveis.

Não construir criptografia própria.

Nunca armazenar segredos em texto puro, localStorage ou logs.

Utilize mecanismos confiáveis de gerenciamento de segredos, KMS, criptografia autenticada e armazenamento seguro do sistema operacional, conforme o contexto.

Considere Infisical como integração futura.

No MVP, implemente somente o armazenamento seguro necessário às integrações iniciais.

## 7.11 Developer Analytics

Informações possíveis:

- Atividade por projeto;
- Commits;
- Deployments;
- Frequência de releases;
- Incidentes;
- Custos de IA;
- Custos de infraestrutura;
- Estabilidade;
- Utilização de ferramentas.

Não confunda quantidade de commits, linhas de código ou tokens com produtividade.

Não criar sistemas invasivos de vigilância de desenvolvedores.

## 7.12 Settings & Workspace

Responsabilidades:

- Perfil;
- Preferências;
- Aparência;
- Temas;
- Idioma;
- Timezone;
- Notificações;
- Integrações;
- Sessões;
- Dispositivos;
- Permissões;
- Segurança;
- Exportação;
- Gerenciamento futuro de equipes.

Preparar a modelagem para múltiplos workspaces.

Inicialmente, oferecer uma experiência de workspace pessoal.

---

# 08. DEVHUB LOCAL AGENT

O Local Agent é um dos principais diferenciais do produto.

Sua responsabilidade é conectar o DevHub ao ambiente real de desenvolvimento.

## Capacidades

- Detectar projetos autorizados;
- Consultar Git;
- Consultar Docker;
- Identificar ferramentas instaladas;
- Abrir projetos no editor;
- Consultar recursos locais;
- Consultar documentação;
- Integrar ferramentas de IA;
- Enviar eventos autorizados;
- Executar operações tipadas e previamente autorizadas.

Inicialmente, utilize capacidades locais dentro do Tauri quando suficiente.

Extraia um agente independente caso seja necessário funcionamento em segundo plano sem a interface desktop aberta.

## Comunicação

O agente deverá estabelecer preferencialmente conexões autenticadas de saída.

Não exigir portas públicas abertas no computador do usuário.

## Segurança obrigatória

- Device pairing;
- Identidade por dispositivo;
- Tokens de curta duração;
- Revogação;
- Autorização por capability;
- Allowlist;
- Validação de parâmetros;
- Timeout;
- Limites de execução;
- Proteção contra replay;
- Proteção contra command injection;
- Restrições de diretório;
- Auditoria;
- Armazenamento seguro;
- Confirmações para operações sensíveis.

Utilize ações tipadas.

Exemplo:

```typescript
type AgentAction =
  | { type: "git.status"; projectId: string }
  | { type: "docker.listContainers" }
  | { type: "editor.openProject"; projectId: string }
  | { type: "system.getMetrics" };
```

Valide permissões no backend e novamente no agente.

Não execute comandos arbitrários enviados pela internet.

Não permita que um agente de IA ignore políticas de autorização.

---

# 09. INTEGRAÇÕES E CONTRATOS

Utilizar arquitetura baseada em adaptadores.

Contratos especializados:

- GitProvider;
- DeploymentProvider;
- InfrastructureProvider;
- MonitoringProvider;
- AIProvider;
- NotificationProvider;
- KnowledgeProvider.

Cada integração deverá informar:

- Status;
- Permissões;
- Capabilities;
- Última sincronização;
- Erros;
- Reconexão;
- Revogação;
- Disponibilidade.

Implemente, conforme necessidade:

- Timeouts;
- Retry com backoff;
- Cache;
- Rate limiting;
- Circuit breaker;
- Webhooks;
- Sincronização incremental;
- Deduplicação;
- Idempotência.

Não obrigue provedores a oferecer operações que não suportam.

Webhooks deverão possuir validação de assinatura, deduplicação, proteção contra replay quando suportada e tratamento seguro de eventos.

---

# 10. BANCO DE DADOS E AUTENTICAÇÃO

Utilizar PostgreSQL e Prisma.

Entidades iniciais candidatas:

- User;
- Account;
- Session;
- Workspace;
- Membership;
- Project;
- Repository;
- ProjectRepository;
- Integration;
- CredentialReference;
- Monitor;
- MonitorCheck;
- Incident;
- Notification;
- ActivityEvent;
- AuditLog.

Entidades futuras poderão representar:

- Devices;
- AgentRuns;
- Deployments;
- Servers;
- Containers;
- Skills;
- AISessions;
- AIUsageRecords;
- Documents;
- Workflows;
- WorkflowRuns;
- Permissions.

Não criar todas as entidades antecipadamente.

Utilize:

- Constraints;
- Integridade referencial;
- Índices;
- Transações;
- Paginação;
- Migrations;
- Datas em UTC;
- Isolamento por workspace;
- Retenção;
- Minimização de dados;
- Identificadores externos;
- Snapshots quando suficientes.

## Autenticação

Avalie uma solução consolidada e compatível com Web, Desktop e Mobile.

Web:

- Cookies HttpOnly;
- Secure;
- SameSite;
- CSRF quando aplicável;
- Sessões revogáveis.

Desktop e Mobile:

- OAuth/OIDC quando adequado;
- Authorization Code + PKCE;
- Navegador do sistema;
- Secure storage;
- Tokens revogáveis.

Não armazenar client secrets em aplicativos distribuídos.

Diferencie autenticação no DevHub da autorização de acesso ao GitHub.

## Autorização

Validar permissões por workspace e recurso no servidor.

Perfis futuros:

- Owner;
- Admin;
- Developer;
- Viewer.

Preparar permissões granulares, sem implementar um sistema empresarial complexo no MVP.

---

# 11. NOVA DIREÇÃO ARTÍSTICA

## Nome conceitual

Native Technical Design.

## Fundação

Technical Minimalism.

## Inspiração

Apple Human Interface Design, especialmente:

- iOS 27;
- iPadOS 27;
- macOS 27;
- Liquid Glass;
- Aplicativos nativos da Apple;
- Experiência de produtividade do MacBook.

## Identidade própria

Graphite Lime.

O DevHub deve transmitir a sensação de um aplicativo premium, refinado, fluido e tecnicamente preciso.

Não deve parecer:

- Um template administrativo genérico;
- Uma cópia literal do macOS;
- Uma réplica do iPhone;
- Um dashboard futurista exagerado;
- Uma interface de jogo;
- Um produto visualmente indistinguível de outra marca.

O objetivo não é criar um produto Apple.

O objetivo é alcançar uma qualidade de experiência inspirada na Apple, preservando a personalidade do DevHub.

## Influências complementares

- Technical Minimalism: organização e densidade;
- Apple Design: interação, adaptação e profundidade;
- Liquid Glass: materiais e navegação;
- Swiss Design: tipografia e grids;
- Flat Design: clareza do conteúdo;
- Motion Design: feedback e fluidez.

Não misturar estilos indiscriminadamente.

---

# 12. REFERÊNCIAS OFICIAIS DA APPLE

Antes de criar ou redesenhar a interface, consulte as referências oficiais disponíveis.

## Human Interface Guidelines

https://developer.apple.com/design/human-interface-guidelines/

## Design Resources

https://developer.apple.com/design/resources/

## Atualizações de design

https://developer.apple.com/design/whats-new/

## Liquid Glass

https://developer.apple.com/documentation/TechnologyOverviews/liquid-glass

## Materials

https://developer.apple.com/design/human-interface-guidelines/materials

## Adopting Liquid Glass

https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass

## WWDC 2026

https://developer.apple.com/videos/play/wwdc2026/102/

## Meet Liquid Glass

https://developer.apple.com/videos/play/wwdc2025/219/

## Get to Know the New Design System

https://developer.apple.com/videos/play/wwdc2025/356/

## Design kits

https://developer.apple.com/news/?id=e2lxw9l1

Explore, quando acessíveis:

- UI Kit do iOS 27;
- UI Kit do iPadOS 27;
- UI Kit do macOS 27;
- Componentes Figma;
- Estados;
- Proporções;
- Navegação;
- Toolbars;
- Sidebars;
- Materiais;
- App icons;
- Layouts adaptáveis.

Respeite as licenças dos recursos oficiais.

Utilize esses materiais como referências de estudo, sem presumir autorização para redistribuir assets, fontes ou componentes proprietários em aplicações multiplataforma.

Não invente características da Apple.

Diferencie recursos oficialmente documentados de adaptações autorais do DevHub.

---

# 13. FILOSOFIA DE DESIGN APPLE INSPIRED

O design deverá incorporar os seguintes princípios.

## Hierarquia

O conteúdo deve permanecer prioritário.

A navegação deve orientar sem competir com as informações.

## Profundidade

Utilizar camadas visuais para estabelecer relações funcionais.

Não criar profundidade apenas para decoração.

## Fluidez

Transições devem transmitir continuidade entre estados.

Menus, painéis e controles devem parecer partes de um sistema integrado.

## Adaptabilidade

A interface deve responder naturalmente a mudanças de:

- Plataforma;
- Viewport;
- Orientação;
- Tamanho de janela;
- Densidade;
- Métodos de entrada;
- Preferências do usuário.

## Refinamento

Prestar atenção a:

- Espaçamentos;
- Alinhamentos;
- Tipografia;
- Estados;
- Curvaturas;
- Contornos;
- Sombras;
- Feedback;
- Precisão dos componentes.

A qualidade deverá estar presente em pequenos detalhes, não apenas na tela inicial.

---

# 14. LIQUID GLASS INSPIRED — SISTEMA DE MATERIAIS

Esta seção é central para a nova identidade visual.

Não confunda Liquid Glass com glassmorphism genérico.

O DevHub deverá reproduzir, dentro das capacidades da stack utilizada, uma experiência inspirada em materiais dinâmicos, translucidez, profundidade, continuidade e interação contextual.

## 14.1 Separação de camadas

Organize a interface em três camadas principais.

### Content Layer

Camada de conteúdo:

- Dashboards;
- Tabelas;
- Gráficos;
- Logs;
- Código;
- Documentação;
- Listas;
- Métricas;
- Formulários.

Características:

- Superfícies estáveis;
- Alto contraste;
- Legibilidade;
- Pouca transparência;
- Hierarquia técnica;
- Densidade adequada.

### Functional Layer

Camada de navegação e controles:

- Sidebar;
- Toolbar;
- Floating Tab Bar;
- Menus;
- Command Palette;
- Dock;
- Control Center;
- Controles contextuais.

Características:

- Materiais translúcidos;
- Blur controlado;
- Profundidade;
- Bordas sutis;
- Reflexos discretos;
- Elevação funcional.

### Transient Layer

Camada temporária:

- Popovers;
- Modais;
- Context menus;
- Notifications;
- Floating panels;
- Live Activity Shelf.

Características:

- Continuidade visual;
- Feedback;
- Transições;
- Foco;
- Adaptação contextual.

## 14.2 Materiais conceituais

Crie variantes próprias do DevHub:

| Material | Aplicação |
|---|---|
| Solid | Conteúdo e superfícies técnicas |
| Subtle | Controles discretos |
| Regular Glass | Navegação |
| Clear Glass | Controles flutuantes em fundos apropriados |
| Tinted Glass | Maior legibilidade |
| Elevated Glass | Modais e popovers |
| Opaque Accessible | Transparência reduzida |

Esses nomes são tokens próprios do DevHub, não APIs oficiais da Apple.

## 14.3 Propriedades visuais

Considere:

- Background translucency;
- Backdrop blur;
- Saturation;
- Vibrancy aproximada;
- Bordas translúcidas;
- Inner highlights;
- Sombras ambientais;
- Reflexos sutis;
- Profundidade;
- Refração aproximada, quando viável.

Não aplique todas as propriedades a todos os componentes.

Não utilize efeitos ópticos caros apenas para reproduzir uma demonstração visual.

## 14.4 Implementação multiplataforma

Web e Desktop:

- CSS;
- CSS custom properties;
- backdrop-filter;
- Gradientes discretos;
- Motion;
- SVG;
- Composição de camadas.

Utilize shaders ou WebGL somente se houver justificativa visual e performance comprovada.

No React Native:

- Avalie APIs disponíveis;
- Utilize componentes de blur quando apropriados;
- Avalie integração nativa específica;
- Forneça fallback consistente.

Não afirme que CSS backdrop-filter é o Liquid Glass nativo da Apple.

Integrações nativas dependem das APIs reais de SwiftUI, UIKit ou AppKit e da compatibilidade da plataforma.

## 14.5 Preferências de aparência

Permitir futuramente:

- Clear;
- Balanced;
- Tinted;
- Reduced Transparency;
- Follow System, quando disponível.

O usuário poderá ajustar a intensidade do material sem alterar a identidade do produto.

O estado Balanced será o ponto de partida proposto.

Não obrigar usuários a utilizar transparência.

Quando necessário, substitua o vidro por superfícies opacas de alto contraste.

---

# 15. PALETA — GRAPHITE LIME

Preserve a identidade cromática que foi selecionada anteriormente.

| Token | HEX | Finalidade |
|---|---|---|
| Canvas | #111214 | Fundo principal |
| Surface | #17191C | Conteúdo |
| Elevated Surface | #24272B | Superfícies elevadas |
| Border | #2C2F34 | Divisórias |
| Primary Text | #F0F0ED | Textos principais |
| Secondary Text | #9B9EA5 | Textos secundários |
| Signature Lime | #C6EF91 | Identidade e ações |

O verde-lima deverá funcionar como assinatura visual.

Utilize principalmente em:

- Ações primárias;
- Elementos selecionados;
- Logo;
- Foco;
- Indicadores de atividade;
- Progresso;
- Destaques importantes.

Não transformar toda a interface em verde.

## Cores semânticas

Defina independentemente:

- Success;
- Warning;
- Error;
- Info;
- Neutral;
- Pending;
- Offline;
- Degraded.

A cor de marca não substitui automaticamente os estados semânticos.

## Distribuição cromática

Utilize 60–30–10 como heurística flexível:

- Dominância das superfícies neutras;
- Superfícies secundárias;
- Destaques cromáticos seletivos.

Não seguir proporções rígidas.

## Light Mode

Criar uma versão clara específica.

Considere:

- Fundos off-white;
- Cinzas neutros;
- Superfícies brancas;
- Vidro levemente tonalizado;
- Contraste adequado;
- Variante mais escura da cor de ação quando necessário.

Não simplesmente inverter a paleta escura.

Valide contraste dos dois temas.

---

# 16. TIPOGRAFIA E ICONOGRAFIA

## Tipografia principal

Geist Sans.

https://vercel.com/font

Utilizar em:

- Navegação;
- Títulos;
- Textos;
- Formulários;
- Configurações;
- Botões;
- Informações gerais.

## Tipografia técnica

JetBrains Mono.

https://www.jetbrains.com/lp/mono/

Utilizar seletivamente em:

- Logs;
- Código;
- Comandos;
- Hashes;
- Identificadores;
- Métricas técnicas;
- Informações de infraestrutura.

Utilize números tabulares quando apropriado.

Inspire-se na hierarquia tipográfica dos sistemas Apple, mas preserve a tipografia própria do DevHub.

Não distribuir SF Pro indiscriminadamente em plataformas não autorizadas.

## Iconografia

Lucide.

https://lucide.dev/

Manter:

- Consistência geométrica;
- Stroke;
- Tamanho;
- Alinhamento;
- Peso visual;
- Nomes acessíveis.

Explore a linguagem visual do SF Symbols como referência conceitual.

Utilize símbolos nativos somente quando a plataforma e a licença permitirem.

Não misture várias famílias de ícones sem justificativa.

---

# 17. APP ICON E BRANDING

Criar um ícone próprio para o DevHub.

Conceitos possíveis:

- Terminal;
- Prompt de comando;
- Conexão;
- Hub;
- Sistema integrado;
- Geometria modular.

Direção inicial:

- Forma quadrada com cantos suaves;
- Identidade Graphite Lime;
- Símbolo técnico autoral;
- Camadas;
- Iluminação controlada;
- Profundidade;
- Reflexos discretos.

Explorar aparência inspirada nos ícones multicamadas do ecossistema Apple 27.

Criar variantes:

- Dark;
- Light;
- Monochrome;
- Tinted;
- Flat;
- App icon;
- Favicon;
- System tray;
- Splash screen.

Não utilizar o logo da Apple ou outros elementos proprietários como identidade do DevHub.

Não criar logotipo visualmente confundível com outra marca.

---

# 18. APPLICATION SHELL

O Application Shell deverá possuir aparência de aplicativo nativo premium.

Estrutura desktop:

```text
┌────────────────────────────────────────────┐
│ Sidebar │ Toolbar / Navigation / Actions  │
│         ├──────────────────────────────────┤
│         │                                  │
│         │          Main Content            │
│         │                                  │
│         │                     Inspector    │
│         │                                  │
│         ├──────────────────────────────────┤
│         │ Status / Activity                │
└────────────────────────────────────────────┘
```

Elementos:

- Sidebar;
- Toolbar;
- Workspace selector;
- Breadcrumbs;
- Spotlight Search;
- Control Center;
- Content area;
- Contextual inspector;
- Notifications;
- Live Activity Shelf;
- Local Agent status.

Não exibir todos os elementos simultaneamente em todos os contextos.

Cada elemento deverá possuir finalidade.

---

# 19. SIDEBAR — MACOS 27 INSPIRED

A sidebar deverá ser uma das principais características visuais do produto.

Requisitos:

- Integrada à janela;
- Edge-to-edge como direção inicial;
- Retrátil;
- Redimensionável quando pertinente;
- Material translúcido opcional;
- Seleção suave;
- Ícones consistentes;
- Grupos de navegação;
- Workspace selector;
- Tooltips;
- Navegação por teclado;
- Indicadores relevantes;
- Estados acessíveis.

Organização proposta:

```text
WORKSPACE
  Overview
  Projects
  Git Center
  Deployments

PLATFORM
  Infrastructure
  Observability
  AI Center

TOOLS
  Knowledge Base
  Automations
  Secrets Vault
  Analytics

SYSTEM
  Settings
```

Estados:

- Expanded;
- Compact;
- Hidden;
- Overlay;
- Responsive;
- Focused.

A transição entre estados deve preservar a continuidade do layout.

Não utilizar uma sidebar excessivamente larga.

Não adicionar decoração que prejudique a navegação.

---

# 20. TOOLBAR — LIQUID GLASS INSPIRED

Criar uma toolbar contextual.

Elementos possíveis:

- Back;
- Forward;
- Sidebar toggle;
- Breadcrumbs;
- Busca;
- Filtros;
- Ações;
- Notificações;
- Control Center;
- Workspace selector.

Agrupar controles relacionados.

Utilizar materiais translúcidos quando apropriado.

Permitir que os controles se adaptem ao espaço disponível.

Em tamanhos menores, mover ações secundárias para menus contextuais.

Não transformar todos os botões em cápsulas.

Reserve formas totalmente arredondadas para grupos flutuantes, controles e ações compatíveis com essa geometria.

---

# 21. SPOTLIGHT SEARCH

Desenvolver uma Command Palette inspirada no Spotlight do macOS e na experiência do Raycast.

Atalhos:

- Ctrl + K;
- Cmd + K.

Funcionalidades:

- Navegação;
- Busca de projetos;
- Busca de documentos;
- Busca de repositórios;
- Busca de ambientes;
- Busca de integrações;
- Busca de agentes;
- Ações rápidas;
- Comandos contextuais.

Experiência:

- Abertura fluida;
- Campo de busca em destaque;
- Resultados agrupados;
- Navegação por teclado;
- Histórico;
- Atalhos;
- Seleção visual;
- Empty states;
- Feedback;
- Foco restaurado após fechamento.

Comandos que modificam recursos deverão respeitar autorização.

Não executar operações sensíveis diretamente sem os controles apropriados.

---

# 22. CONTROL CENTER

Criar um painel de ações rápidas inspirado no Control Center do iOS e macOS.

Possíveis controles:

- Local Agent;
- Notificações;
- Aparência;
- Intensidade do material;
- Sincronização;
- Status de infraestrutura;
- Status do Docker;
- Monitoramento;
- Dispositivos;
- Operações em andamento.

O painel deverá permitir consultar e controlar informações relevantes sem navegar para páginas completas.

Não adicionar controles meramente decorativos.

Operações destrutivas não devem ser transformadas em toggles simples.

---

# 23. LIVE ACTIVITY SHELF

Criar um componente próprio para acompanhamento de atividades.

Inspirado conceitualmente em Live Activities e Dynamic Island.

Nome interno:

DevHub Activity Shelf.

Aplicações:

- Deploy em andamento;
- Build;
- Pipeline;
- Sessão de IA;
- Automação;
- Backup;
- Sincronização;
- Monitoramento;
- Transferência;
- Indexação.

Informações:

- Nome da operação;
- Projeto;
- Status;
- Progresso real, quando disponível;
- Tempo decorrido;
- Etapa atual;
- Cancelamento autorizado;
- Acesso aos detalhes.

Estados:

- Compact;
- Expanded;
- Running;
- Completed;
- Failed;
- Paused;
- Cancelled;
- Indeterminate.

Utilizar animações contextuais de expansão e contração.

Não simular porcentagens quando o progresso real não estiver disponível.

Utilize indicadores indeterminados nesses casos.

## Integração nativa futura

No iOS, avaliar ActivityKit e Live Activities oficiais para operações adequadas.

No Desktop e Web, utilizar componentes próprios do DevHub.

Não adicionar recortes de câmera, status bars falsas ou uma cópia artificial da Dynamic Island à interface de produção.

---

# 24. CONTEXTUAL INSPECTOR E MULTIPANE LAYOUT

Inspire-se na organização de aplicativos profissionais do macOS.

Quando houver necessidade de detalhes:

- Lista principal;
- Conteúdo selecionado;
- Inspector contextual;
- Painéis redimensionáveis;
- Split views.

Exemplos:

Project Manager:

- Lista de projetos;
- Projeto selecionado;
- Inspector de tecnologias e ambientes.

Git Center:

- Repositórios;
- Branches ou commits;
- Detalhes do item selecionado.

Knowledge Base:

- Árvore de documentos;
- Editor ou visualizador;
- Backlinks e metadados.

AI Center:

- Sessões;
- Sessão selecionada;
- Contexto e utilização.

Não utilizar modais para todas as interações.

Reserve modais para tarefas que exigem foco temporário.

---

# 25. DESIGN ESPECÍFICO DE CADA MÓDULO

Cada módulo deverá possuir composição visual adequada à sua finalidade.

Não reutilize um único dashboard genérico alterando apenas títulos.

| Módulo | Direção de interface |
|---|---|
| Command Center | Visão consolidada, métricas e atividade |
| Project Manager | Lista ou grid, detalhes e inspector |
| Git Center | Tabelas, branches, commits e diffs |
| Deploy Center | Timeline, status, ambientes e logs |
| Infrastructure | Inventário, serviços e recursos |
| Observability | Séries temporais, incidentes e métricas |
| AI Center | Sessões, agentes, utilização e contexto |
| Knowledge Base | Árvore de arquivos e painel de leitura |
| Automations | Canvas de workflows e histórico |
| Secrets Vault | Listas protegidas e permissões |
| Analytics | Visualizações úteis e filtros |
| Settings | Grupos e formulários contextuais |

## Command Center

Evite cards excessivos.

Priorize:

- Faixas horizontais de métricas;
- Seções abertas;
- Divisórias;
- Tabelas compactas;
- Gráficos úteis;
- Activity Shelf;
- Painéis contextuais;
- Informações acionáveis.

## Observability

Não utilizar materiais translúcidos sobre gráficos quando prejudicarem a leitura.

Garanta escalas, unidades, legendas e estados de dados.

## Knowledge Base

Priorize leitura confortável e organização.

## Secrets Vault

O design deverá reforçar segurança sem utilizar efeitos que dificultem a compreensão das permissões.

---

# 26. DESIGN MOBILE — IOS 27 INSPIRED

A experiência mobile deverá ser adaptada, não comprimida.

Utilizar:

- Large titles quando adequados;
- Safe areas;
- Floating Tab Bar;
- Bottom sheets;
- Gestos com alternativas acessíveis;
- Navegação por pilha;
- Context menus;
- Haptic feedback quando disponível e apropriado;
- Controles adequados ao toque;
- Live Activities nativas quando viáveis.

Navegação principal proposta:

- Overview;
- Projects;
- Health;
- AI;
- More.

A barra inferior poderá utilizar material inspirado no Liquid Glass.

A tab bar deverá considerar:

- Área segura;
- Visibilidade;
- Acessibilidade;
- Conteúdo que passa por baixo;
- Seleção;
- Contraste;
- Teclado virtual.

Não ocultar informações essenciais atrás de controles flutuantes.

Operações complexas de infraestrutura poderão permanecer prioritariamente no Desktop e Web.

---

# 27. DESIGN SYSTEM E TOKENS

Centralizar o sistema visual em packages compartilhados.

```text
packages/
├── design-tokens/
│   ├── colors/
│   ├── themes/
│   ├── typography/
│   ├── spacing/
│   ├── radius/
│   ├── elevation/
│   ├── materials/
│   ├── motion/
│   └── breakpoints/
│
├── ui/
│   ├── primitives/
│   ├── components/
│   ├── navigation/
│   ├── glass/
│   ├── activity/
│   ├── charts/
│   ├── layouts/
│   └── feedback/
│
└── ui-native/
    ├── primitives/
    ├── navigation/
    ├── materials/
    └── components/
```

Crie essa estrutura progressivamente.

## Tokens

Organizar:

- Primitive tokens;
- Semantic tokens;
- Component tokens.

Exemplos:

```text
color.background
color.surface
color.surface.elevated
color.text.primary
color.text.secondary
color.action.primary
color.status.error

material.glass.regular
material.glass.clear
material.glass.tinted
material.glass.opaque

elevation.navigation
elevation.overlay
elevation.inspector

motion.duration.fast
motion.duration.normal
motion.duration.slow

radius.control
radius.surface
radius.popover
radius.floating
```

## Geometria

Utilize diferentes famílias de arredondamento conforme a função.

Pontos de partida:

- Conteúdo técnico: 6–10px;
- Superfícies: 10–14px;
- Menus e overlays: 14–22px;
- Controles flutuantes: arredondamento contextual;
- Pills: apenas quando apropriado.

Não aplicar border radius exagerado a todos os componentes.

## Espaçamento

Definir escala consistente.

Exemplo:

4, 8, 12, 16, 20, 24, 32, 40, 48 e 64.

Adaptar à densidade de cada módulo.

---

# 28. MOTION DESIGN

Inspire-se na fluidez dos sistemas Apple.

Domine e utilize seletivamente:

- Spring animations;
- Shared layout transitions;
- Expand/collapse;
- Morphing;
- Fade;
- Scale;
- Slide;
- Stagger;
- Contextual transitions;
- Animated selection;
- Progressive disclosure.

Aplicações prioritárias:

- Sidebar;
- Spotlight Search;
- Control Center;
- Activity Shelf;
- Navigation;
- Floating menus;
- Modais;
- Toolbars;
- Alterações de tema;
- Painéis redimensionáveis.

Faixas iniciais sugeridas:

- Microinterações: 100–180ms;
- Componentes: 180–300ms;
- Transições: 250–450ms.

Ajustar curvas e molas conforme o comportamento.

Evitar:

- Bounce excessivo;
- Animações contínuas;
- Transições que bloqueiam ações;
- Blur pesado;
- Movimentos sem propósito;
- Animação simultânea de muitos componentes.

Respeitar prefers-reduced-motion e preferências nativas quando disponíveis.

A experiência deverá permanecer funcional sem animações.

---

# 29. REPERTÓRIO DE UI/UX

Utilize o Master Prompt de Design Intelligence e os vídeos fornecidos pelo usuário como fontes complementares.

Os materiais representam repertório, não requisitos de utilização.

Bibliotecas principais:

- https://ui.shadcn.com/
- https://www.radix-ui.com/
- https://motion.dev/
- https://lucide.dev/

Referências complementares:

- https://animmasterlib.dev/
- https://skiper-ui.com/
- https://www.vengenceui.com/
- https://www.uilora.com/
- https://forgegui.com/
- https://uiverse.io/
- https://21st.dev/
- https://animista.net/
- https://phosphoricons.com/
- https://10x.app/
- https://magicui.design/
- https://ui.aceternity.com/
- https://gsap.com/

HorizonX poderá ser consultado conforme o material original fornecido.

Pesquisar componentes específicos quando necessários.

Não instalar bibliotecas indiscriminadamente.

## Referências funcionais

- Finder;
- Spotlight;
- Control Center;
- Apple Settings;
- Activity Monitor;
- Xcode;
- Linear;
- Raycast;
- Vercel;
- GitHub;
- Cursor;
- Grafana;
- Obsidian;
- Portainer;
- n8n;
- OpenRouter.

Analise a intenção das interfaces.

Não copie integralmente seus layouts.

## Análise dos vídeos

Quando os vídeos estiverem disponíveis:

- Analise seus frames e áudio quando acessível;
- Extraia técnicas;
- Identifique componentes;
- Identifique padrões positivos;
- Identifique antipadrões;
- Preserve as referências relevantes;
- Separe observações de interpretações.

Não invente conteúdo de materiais inacessíveis.

---

# 30. ANTIPADRÕES VISUAIS

Evitar os problemas de interfaces genéricas produzidas por Vibe Coding:

- Gradientes roxos indiscriminados;
- Cards dentro de cards;
- Border radius gigante;
- Glow em todos os elementos;
- Emojis substituindo ícones;
- Textos excessivos em cards;
- Gráficos sem utilidade;
- Tudo centralizado;
- Botões inconsistentes;
- Identidade genérica de IA;
- Bento Grid aplicado automaticamente;
- Glassmorphism excessivo;
- Transparência sobre todo o conteúdo;
- Bordas luminosas em todos os componentes;
- Layouts idênticos entre módulos;
- Animações sem finalidade;
- Métricas fictícias não identificadas;
- Botões sem função;
- Excesso de badges;
- Interface construída apenas para screenshots.

Essas técnicas não são individualmente proibidas.

O problema é sua utilização indiscriminada.

---

# 31. ACESSIBILIDADE, RESPONSIVIDADE E PERFORMANCE VISUAL

Utilize WCAG 2.2 AA como objetivo, conforme critérios aplicáveis.

Validar:

- Contraste;
- Navegação por teclado;
- Foco visível;
- Leitores de tela;
- Nomes acessíveis;
- Estados;
- Daltonismo;
- Zoom;
- Redução de movimento;
- Redução de transparência;
- Tamanho das áreas interativas;
- Responsividade.

Referências de contraste:

- 4,5:1 para texto comum;
- 3:1 para texto grande;
- 3:1 para componentes relevantes, quando aplicável.

Testar vidro sobre fundos variados.

Não presumir contraste apenas pela aparência.

## Layout adaptável

Testar:

- Mobile estreito;
- Mobile amplo;
- Tablet;
- Desktop;
- Janelas redimensionadas;
- Monitores grandes;
- Zoom do navegador;
- Diferentes densidades de pixels.

Utilizar container queries quando apropriado.

## Performance

- Limitar superfícies com blur;
- Evitar blur aninhado;
- Evitar filtros animados custosos;
- Utilizar transform e opacity quando adequados;
- Virtualizar listas extensas;
- Lazy loading;
- Code splitting;
- Otimizar imagens;
- Reduzir renderizações;
- Implementar fallback para dispositivos menos potentes.

Avaliar os efeitos visuais em máquinas reais.

Não assumir performance adequada sem medição.

---

# 32. SEGURANÇA DO PRODUTO

Secure by Design.

Considerar:

- OWASP Top 10;
- OWASP API Security;
- Least privilege;
- Defense in depth;
- Threat modeling;
- Supply chain security;
- Auditoria;
- Proteção de credenciais.

Implemente:

- Validação de entrada;
- Proteção contra XSS;
- SQL injection;
- SSRF;
- CSRF;
- IDOR;
- Path traversal;
- Command injection;
- CORS restritivo;
- CSP;
- Security headers;
- Rate limiting;
- Limites de payload;
- Sessões revogáveis;
- Logs seguros.

## Reverse proxies

Configure trust proxy conforme a topologia real.

Não confiar indiscriminadamente em X-Forwarded-For.

Evitar que todos os usuários sejam identificados pelo IP do provedor.

Quando houver múltiplas instâncias, utilize rate limiting compartilhado quando necessário.

## Segurança Tauri

- Capabilities mínimas;
- IPC restrito;
- Validação de comandos;
- Controle de filesystem;
- CSP;
- Releases assinadas;
- Atualizações verificadas.

Não conceder privilégios nativos a conteúdo web remoto não confiável.

## Segurança de IA

Tratar documentos, logs, repositórios e conteúdo externo como dados não confiáveis.

Não permitir que prompt injection altere regras de autorização.

Não transmitir credenciais ou código privado sem autorização.

---

# 33. ESCALABILIDADE E CONCORRÊNCIA

O DevHub poderá ser utilizado simultaneamente em navegador, desktop e mobile.

Não multiplique desnecessariamente requisições externas.

Utilize conforme necessidade:

- Query caching;
- Deduplicação;
- Snapshots;
- Sincronização incremental;
- Webhooks;
- Cache;
- Paginação;
- Índices;
- Pool de conexões;
- Controle de concorrência;
- Background jobs;
- Timeouts;
- Backpressure;
- Graceful shutdown.

WebSockets e SSE deverão possuir:

- Autenticação;
- Autorização;
- Reconexão;
- Heartbeat;
- Limites;
- Recuperação de estado;
- Deduplicação.

Redis e BullMQ somente deverão ser adicionados quando houver necessidade concreta de cache, filas ou processamento distribuído.

---

# 34. NOTIFICAÇÕES

Eventos possíveis:

- Deploy concluído;
- Deploy falhou;
- Serviço indisponível;
- Serviço recuperado;
- Incidente;
- Integração desconectada;
- Agente offline;
- Budget atingido;
- Automação concluída;
- Automação falhou;
- Certificado próximo da expiração.

Canais:

- In-app;
- Desktop;
- Mobile push;
- E-mail;
- Webhooks;
- Discord;
- Slack;
- Telegram.

Implementar progressivamente.

Utilize:

- Severidade;
- Agrupamento;
- Deduplicação;
- Cooldown;
- Quiet hours;
- Preferências;
- Histórico.

Não gerar notification fatigue.

---

# 35. INFRAESTRUTURA E CI/CD

## Desenvolvimento

Utilizar Docker Compose para os serviços efetivamente necessários.

Inicialmente:

- PostgreSQL;
- API, quando apropriado;
- Redis somente quando necessário.

## Produção

Avaliar:

- VPS;
- Oracle Cloud;
- Cloudflare;
- Serviços gerenciados;
- Frontend estático;
- API própria.

Critérios:

- Custo;
- Segurança;
- Disponibilidade;
- Manutenção;
- Portabilidade;
- Backup;
- Recuperação.

Não expor PostgreSQL ou Redis diretamente à internet.

Implementar:

- HTTPS;
- Reverse proxy;
- Health checks;
- Logs;
- Restart policies;
- Backups criptografados;
- Retenção;
- Testes de restauração;
- Monitoramento.

## CI/CD

Utilizar GitHub Actions.

Pipeline:

Install → Lint → Typecheck → Tests → Build → Security checks → Release.

Utilizar cache do Turborepo quando seguro e adequado.

Desktop:

- Builds por plataforma;
- Assinatura;
- Artefatos;
- Versionamento;
- Changelog;
- Atualizações seguras.

Git:

- Feature branches;
- Main protegida;
- Pull requests;
- Commits pequenos;
- Conventional Commits quando adequado.

Não publicar ou modificar recursos externos sem autorização.

---

# 36. TESTES E VALIDAÇÃO

Implementar testes proporcionais ao risco.

## Unitários

- Regras;
- Validadores;
- Adaptadores;
- Permissões;
- Estados.

## Integração

- API;
- Banco;
- Autenticação;
- Webhooks;
- Filas;
- Integrações.

## Contratos

- API;
- SDK;
- Agente local;
- Eventos.

## E2E

- Login;
- Projetos;
- Importação GitHub;
- Monitoramento;
- Notificações;
- Navegação;
- Pareamento, quando implementado.

## Segurança

- Isolamento de workspaces;
- IDOR;
- SSRF;
- Path traversal;
- Command injection;
- Webhooks inválidos;
- Ações não autorizadas;
- Exposição de credenciais.

## UI/UX

- Responsividade;
- Temas;
- Transparência;
- Contraste;
- Reduced motion;
- Keyboard navigation;
- Focus;
- Loading;
- Empty states;
- Error states;
- Layouts intermediários.

Não inventar resultados de testes.

Registrar verificações efetivamente executadas.

---

# 37. PROTOTIPAGEM DE ALTA FIDELIDADE

Antes de implementar todos os módulos, construir um protótipo navegável.

O protótipo deverá apresentar:

- Application Shell;
- Sidebar adaptável;
- Toolbar;
- Spotlight Search;
- Control Center;
- Activity Shelf;
- Command Center;
- Projects;
- Project Details;
- Git Center;
- Deploy Center;
- Infrastructure;
- Observability;
- AI Center;
- Knowledge Base;
- Automations;
- Secrets Vault;
- Analytics;
- Settings.

## Experiências obrigatórias do protótipo

- Navegação funcional;
- Pesquisa;
- Criação demonstrativa de projetos;
- Filtros;
- Seleção;
- Modais;
- Estados;
- Transições;
- Dark Mode;
- Light Mode;
- Material ajustável;
- Reduced Transparency;
- Sidebar retrátil;
- Layout adaptável.

Utilize dados fictícios coerentes quando necessário.

Identifique claramente operações e integrações simuladas.

Não confundir protótipo com produto funcional.

Não implementar backend fictício como se fosse produção.

## Direção artística

O resultado deve parecer um aplicativo profissional real.

Não construir apenas uma landing page bonita ou uma coleção de cards.

Os diferentes módulos deverão apresentar layouts próprios.

---

# 38. ROADMAP

## Fase 0 — Discovery e Design

- Auditoria;
- Viabilidade;
- Arquitetura;
- Threat model;
- Design System;
- Protótipo navegável;
- Documentação inicial.

## Fase 1 — Fundação

- Monorepo;
- pnpm;
- Turborepo;
- Web;
- API;
- PostgreSQL;
- Prisma;
- Autenticação;
- Workspace;
- Tokens;
- Application Shell;
- Testes;
- CI.

## Fase 2 — MVP

- Command Center;
- Project Manager;
- GitHub read-only;
- Importação de repositórios;
- Monitoramento HTTP;
- Notificações;
- Configurações.

## Fase 3 — Desktop

- Tauri;
- Integrações locais;
- Git local;
- Abertura de projetos;
- Notificações nativas;
- System tray;
- Capacidades iniciais.

## Fase 4 — Infrastructure & Deploy

- Provedor de deploy inicial;
- Docker;
- Servidores;
- Métricas;
- Logs;
- Observabilidade.

## Fase 5 — Local Agent

- Pareamento;
- Identidade;
- Capabilities;
- Conexões autenticadas;
- Operações remotas controladas;
- Auditoria.

## Fase 6 — AI & Knowledge

- AI Center;
- Skills Manager;
- Sessões;
- Prompts;
- Documentação;
- Obsidian;
- Contexto por projeto.

## Fase 7 — Automations & CLI

- Workflows;
- Triggers;
- Actions;
- Filas;
- Histórico;
- CLI.

## Fase 8 — Mobile

- Expo;
- Navegação adaptada;
- Monitoramento;
- Alertas;
- Atividade;
- Operações autorizadas;
- Integrações nativas viáveis.

## Fase 9 — SaaS

- Equipes;
- Multi-tenancy ampliado;
- Convites;
- RBAC;
- Billing;
- Limites;
- Onboarding;
- Suporte.

As fases representam prioridades e dependências, não estimativas de prazo.

---

# 39. ESCOPO DO MVP

Obrigatório:

- Aplicação Web;
- Backend;
- Banco;
- Autenticação;
- Workspace pessoal;
- Design System inicial;
- Dashboard;
- CRUD de projetos;
- GitHub read-only;
- Importação de repositórios;
- Associação de múltiplos repositórios;
- Monitoramento HTTP;
- Notificações internas;
- Configurações;
- Testes críticos;
- Documentação.

Não obrigatório:

- Mobile;
- CLI;
- Microserviços;
- Kubernetes;
- RAG;
- AI Gateway;
- Billing;
- Marketplace;
- Editor completo de workflows;
- Cofre genérico de senhas;
- Todas as integrações;
- Gerenciamento remoto irrestrito.

O MVP estará concluído quando for possível cadastrar projetos reais, associar repositórios, consultar dados autorizados, monitorar endpoints, receber alertas e utilizar o produto com persistência e segurança.

---

# 40. DOCUMENTAÇÃO E OTIMIZAÇÃO DE CONTEXTO

Utilizar documentação modular.

```text
MASTER_PLAN.md
ROADMAP.md
AGENTS.md
CLAUDE.md
README.md

docs/
├── product/
│   ├── VISION.md
│   ├── REQUIREMENTS.md
│   └── MVP_SCOPE.md
├── architecture/
│   ├── ARCHITECTURE.md
│   ├── MONOREPO.md
│   └── DATA_MODEL.md
├── design/
│   ├── CREATIVE_DIRECTION.md
│   ├── APPLE_INSPIRED_GUIDELINES.md
│   ├── DESIGN_SYSTEM.md
│   ├── DESIGN_TOKENS.md
│   ├── LIQUID_GLASS_MATERIALS.md
│   ├── MOTION_SYSTEM.md
│   ├── COMPONENT_SPECIFICATION.md
│   └── UX_AUDIT.md
├── security/
│   ├── THREAT_MODEL.md
│   └── AGENT_SECURITY.md
├── decisions/
└── operations/
```

Não duplicar informações.

Cada documento deverá possuir responsabilidade específica.

## Context Engineering

- Carregar apenas documentação pertinente;
- Utilizar busca direcionada;
- Consultar contratos relacionados;
- Evitar logs completos;
- Utilizar diffs;
- Reutilizar contexto validado;
- Manter ADRs compactos;
- Evitar releitura de arquivos grandes sem necessidade.

Caso estejam disponíveis, avaliar:

- Graphify;
- RTK;
- Caveman;
- Headroom;
- Context Mode;
- Code Review Graph;
- Task Observer;
- OmniRoute.

Não presumir que estejam instalados.

Não executar ferramentas desconhecidas automaticamente.

Economia de tokens não deve prejudicar requisitos críticos, segurança ou qualidade.

---

# 41. DOCUMENTAÇÕES TÉCNICAS OFICIAIS

Arquitetura:

- https://turborepo.com/
- https://pnpm.io/workspaces
- https://www.typescriptlang.org/

Frontend:

- https://react.dev/
- https://vite.dev/
- https://tailwindcss.com/
- https://tanstack.com/query/
- https://reactrouter.com/

Desktop:

- https://v2.tauri.app/
- https://doc.rust-lang.org/

Mobile:

- https://docs.expo.dev/
- https://reactnative.dev/

Backend:

- https://docs.nestjs.com/
- https://www.postgresql.org/docs/
- https://www.prisma.io/docs/
- https://redis.io/docs/
- https://docs.bullmq.io/
- https://zod.dev/

Integrações:

- https://docs.github.com/
- https://vercel.com/docs
- https://docs.docker.com/
- https://docs.oracle.com/en-us/iaas/
- https://docs.anthropic.com/
- https://platform.openai.com/docs/
- https://help.obsidian.md/

Infraestrutura:

- https://docs.github.com/actions
- https://opentelemetry.io/docs/
- https://prometheus.io/docs/
- https://grafana.com/docs/

Segurança e acessibilidade:

- https://owasp.org/
- https://cheatsheetseries.owasp.org/
- https://www.w3.org/TR/WCAG22/

Validar informações nas fontes oficiais durante a implementação.

---

# 42. PROTOCOLO DE PRIMEIRA EXECUÇÃO

Ao receber este documento, não comece implementando todo o sistema.

## Etapa 1 — Auditoria

Identificar:

- Estado do diretório;
- Repositório;
- Branch;
- Alterações não commitadas;
- Arquivos existentes;
- Documentação;
- Ferramentas;
- Dependências;
- Versões;
- Configurações;
- Skills;
- Riscos;
- Incompatibilidades.

Preserve todo código existente.

## Etapa 2 — Contexto

Consultar:

- MASTER_PLAN.md;
- AGENTS.md;
- CLAUDE.md;
- ROADMAP.md;
- Obsidian, quando autorizado;
- Design Intelligence;
- Vídeos;
- Protótipos;
- Documentação técnica;
- Referências Apple 27.

Não afirmar acesso a recursos inacessíveis.

## Etapa 3 — Direção de design

Definir:

- Creative Direction;
- Material system;
- Design tokens;
- Componentes;
- Navigation;
- Motion;
- Responsive behavior;
- Accessibility;
- App icon;
- Paleta.

Preservar Technical Minimalism e Graphite Lime.

Aplicar a inspiração Apple 27 de maneira autoral.

## Etapa 4 — Planejamento executável

Produzir:

- Diagnóstico;
- Estrutura mínima;
- Dependências;
- Modelo de dados;
- Contratos;
- Estratégia de autenticação;
- Estratégia de integrações;
- Escopo;
- Roadmap;
- Riscos;
- Critérios de conclusão.

## Etapa 5 — Implementação

Quando expressamente solicitada:

- Inicializar a fundação;
- Implementar o design system;
- Construir o Application Shell;
- Criar o protótipo;
- Validar experiência;
- Implementar funcionalidades em fatias verticais;
- Testar;
- Documentar.

Não avançar para operações sensíveis sem autorização.

---

# 43. DEFINITION OF DONE

Uma funcionalidade somente deverá ser considerada concluída quando:

- Cumprir requisitos;
- Estiver integrada;
- Possuir validação;
- Possuir tratamento de erros;
- Respeitar permissões;
- Possuir estados de interface;
- Respeitar design tokens;
- Ser responsiva;
- Possuir testes proporcionais;
- Passar nas verificações disponíveis;
- Possuir documentação necessária;
- Não apresentar regressões conhecidas.

## Auditoria visual

Verificar:

- Identidade;
- Hierarquia;
- Tipografia;
- Densidade;
- Consistência;
- Materiais;
- Contraste;
- Navegação;
- Motion;
- Originalidade;
- Responsividade;
- Performance.

Não aprovar automaticamente um design apenas porque utiliza blur, vidro, sombras e animações.

O refinamento precisa ser perceptível na experiência completa.

---

# 44. RESTRIÇÕES FUNDAMENTAIS

Você NÃO deve:

- Criar microserviços prematuramente;
- Instalar todas as tecnologias;
- Duplicar frontends;
- Expor banco de dados diretamente;
- Armazenar segredos em texto puro;
- Executar comandos remotos arbitrários;
- Inventar integrações;
- Inventar dados reais;
- Inventar testes;
- Ignorar limites de provedores;
- Alterar arquitetura silenciosamente;
- Copiar literalmente produtos Apple;
- Distribuir assets proprietários sem autorização;
- Confundir Liquid Glass inspirado com implementação nativa;
- Aplicar transparência indiscriminadamente;
- Criar uma interface genérica;
- Remover funcionalidades em nome da estética;
- Comprometer acessibilidade;
- Adicionar efeitos prejudiciais à performance;
- Implementar todas as fases simultaneamente;
- Executar operações destrutivas sem autorização;
- Criar documentação redundante.

---

# 45. PRINCÍPIO FINAL

O DevHub deverá unir duas competências:

**Excelência de engenharia e excelência de experiência.**

A interface deverá possuir a precisão de ferramentas profissionais de desenvolvimento, combinada com a fluidez, profundidade, simplicidade e refinamento visual associados ao ecossistema Apple.

A identidade Graphite Lime deverá tornar o produto reconhecível.

Technical Minimalism deverá preservar a clareza.

Os materiais inspirados em Liquid Glass 27 deverão enriquecer a navegação e os controles.

Cada módulo deverá resolver um problema real.

Cada animação deverá possuir finalidade.

Cada componente deverá justificar sua existência.

Cada integração deverá ser segura.

Cada decisão arquitetural deverá permitir evolução sustentável.

Não construir apenas um dashboard bonito.

Construir um Developer Operating System que o usuário tenha vontade de utilizar todos os dias.

**DevHub.**

**Everything you build. Beautifully connected.**

**Native experience. Technical precision. One ecosystem.**

FIM DA ESPECIFICAÇÃO.