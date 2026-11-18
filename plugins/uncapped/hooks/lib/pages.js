// Uncapped's pages: a small website, grown from the customer's own work,
// written into their own folder and opened in their own browser.
//
// There is no server and no Node. Claude Code ships as one executable and does
// not install a runtime, so a customer may have neither. The pages are files;
// the browser opens files. Everything they need travels inside them, fonts
// included, because a plugin can write text and not bytes.

import { V, VD, C, LIVE_STEPS } from './brand.js'
import { buildSite } from '../../pages/site.mjs'
import { openUrl } from './platform.js'

const FONT_FILES = [
  'fraunces-800i-latin.woff2',
  'cormorant-600-latin.woff2',
  'cormorant-500i-v2.woff2',
  'caveat-500-latin.woff2',
]

const SITE_DIR = 'my-work/pages'

let fontCache = null
let actionCache = null

async function fonts($) {
  if (fontCache) return fontCache
  const out = {}
  for (const f of FONT_FILES) {
    try {
      out[f] = (await $.fs.read(`${$.plugin.root}/assets/fonts/${f}`, { as: 'bytes' })).base64
    } catch (e) {}
  }
  fontCache = out
  return out
}

async function actionList($) {
  if (actionCache) return actionCache
  try {
    actionCache = JSON.parse(await $.fs.read(`${$.plugin.root}/pages/actions.json`)).actions
  } catch (e) {
    actionCache = []
  }
  return actionCache
}

// Writes the whole site into the customer's folder. Returns where the first
// page is, or throws with something worth showing them.
export async function writePages($, work) {
  if (!work) throw new Error('There is no saved work to grow the pages from yet.')
  const { files } = buildSite({
    work,
    V,
    VD,
    C,
    LIVE_STEPS,
    actionList: await actionList($),
    fonts: await fonts($),
  })
  for (const [name, text] of Object.entries(files)) {
    await $.fs.write(`${SITE_DIR}/${name}`, text)
  }
  return `${SITE_DIR}/index.html`
}

// file:// wants an absolute path, with the separators and the spaces a URL
// expects. Windows paths come back with backslashes and a drive letter.
export function fileUrl(cwd, rel) {
  const base = String(cwd || '').replace(/[\\/]+$/, '')
  const whole = `${base}/${rel}`.replace(/\\/g, '/')
  const abs = whole.startsWith('/') ? whole : `/${whole}`   // Windows: /C:/Users/...
  return `file://${encodeURI(abs)}`                          // leaves : and / alone, escapes spaces
}

// Builds the pages, then opens them. Returns what to tell the customer.
export async function openPages($, work, cwd) {
  const rel = await writePages($, work)
  const url = fileUrl(cwd, rel)
  const opened = await openUrl($, url)
  return { url, opened, path: `${cwd}/${rel}` }
}
