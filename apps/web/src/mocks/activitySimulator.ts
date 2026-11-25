// Prototype-only simulations to exercise the Activity Shelf. Every item is flagged
// `simulated: true` and labelled in the UI. Nothing here touches a real service.
import { activity } from '../activity/store'

const TICK_MS = 500

/** Determinate run with steps, pause/resume and cancel. */
export function simulateDeploy() {
  const steps = [
    'Instalando dependências',
    'Executando build',
    'Enviando artefatos',
    'Ativando versão',
  ]
  let progress = 0
  let paused = false

  const id = activity.start({
    kind: 'deploy',
    title: 'Deploy do protótipo',
    project: 'DevHub',
    progress: 0,
    step: steps[0],
    simulated: true,
    detailsHref: '/deployments',
    controls: {
      pause: () => {
        paused = true
        activity.update(id, { status: 'paused' })
      },
      resume: () => {
        paused = false
        activity.update(id, { status: 'running' })
      },
      cancel: () => {
        clearInterval(timer)
        activity.update(id, { status: 'cancelled', step: undefined })
      },
    },
  })

  // Referenced by cancel() above; only called after this line runs.
  const timer = setInterval(() => {
    if (paused) return
    progress = Math.min(1, progress + 0.04)
    if (progress >= 1) {
      clearInterval(timer)
      activity.update(id, { status: 'completed', progress: 1, step: undefined })
      return
    }
    activity.update(id, { progress, step: steps[Math.floor(progress * steps.length)] })
  }, TICK_MS)
}

/** No progress information: the shelf must show an indeterminate indicator. */
export function simulateIndexing() {
  const id = activity.start({
    kind: 'index',
    title: 'Indexação da documentação',
    project: 'DevHub',
    step: 'Lendo arquivos Markdown',
    simulated: true,
    detailsHref: '/knowledge',
  })
  setTimeout(() => activity.update(id, { step: 'Gerando índice de busca' }), 4000)
  setTimeout(() => activity.update(id, { status: 'completed' }), 9000)
}

/** Fails part-way, so the failed state and its persistence can be checked. */
export function simulateFailedBuild() {
  let progress = 0
  const id = activity.start({
    kind: 'build',
    title: 'Build com falha',
    project: 'DevHub',
    progress: 0,
    step: 'Executando testes',
    simulated: true,
  })
  const timer = setInterval(() => {
    progress += 0.1
    if (progress >= 0.4) {
      clearInterval(timer)
      activity.update(id, {
        status: 'failed',
        error: 'Falha simulada na etapa de testes.',
      })
      return
    }
    activity.update(id, { progress })
  }, TICK_MS)
}
