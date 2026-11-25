export const isApple = /Mac|iPhone|iPad/.test(navigator.userAgent)

/** Display label for a Ctrl/⌘ shortcut, e.g. shortcut('K') → "⌘K" or "Ctrl K". */
export const shortcut = (key: string) => (isApple ? `⌘${key}` : `Ctrl ${key}`)
