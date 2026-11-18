// The prototype's way in: read the work, build the pages, write them out.
//
//   node build-site.mjs <plugin dir> <out dir> [work file]
//
// All the work happens in site.mjs, which has no Node in it at all, so the
// plugin can run exactly the same builder on a machine with no Node.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { buildSite } from './site.mjs'

const PLUGIN = process.argv[2]
const OUT = process.argv[3]
const WORK_ARG = process.argv[4]
mkdirSync(OUT, { recursive: true })

const { V, VD, C, LIVE_STEPS } = await import(join(PLUGIN, 'hooks/lib/brand.js'))
const actionList = JSON.parse(readFileSync(new URL('./actions.json', import.meta.url), 'utf8')).actions

const WORK_FILE = WORK_ARG || join(OUT, 'work.json')
let work
if (existsSync(WORK_FILE)) {
  work = JSON.parse(readFileSync(WORK_FILE, 'utf8'))
} else if (WORK_ARG) {
  console.error(`No work file at ${WORK_FILE}`)
  process.exit(1)
} else {
  ;({ CATHERINE_WORK: work } = await import(join(PLUGIN, 'tests/fixtures-catherine-work.js')))
  writeFileSync(WORK_FILE, JSON.stringify(work, null, 1))
}

const FONT_FILES = ['fraunces-800i-latin.woff2', 'cormorant-600-latin.woff2',
  'cormorant-500i-v2.woff2', 'caveat-500-latin.woff2']
const fonts = {}
for (const f of FONT_FILES) {
  fonts[f] = readFileSync(join(PLUGIN, 'assets/fonts', f)).toString('base64')
}

const { files, unknown } = buildSite({ work, V, VD, C, LIVE_STEPS, actionList, fonts })
for (const [name, text] of Object.entries(files)) writeFileSync(join(OUT, name), text)

if (unknown.length) {
  console.error('\nThese buttons send something no action covers. Add them to actions.json:')
  for (const t of unknown) console.error('  ' + t)
  process.exitCode = 1
}
console.log('wrote', Object.keys(files).length - 2, 'pages +styles to', OUT)
for (const [f, h] of Object.entries(files)) console.log('  ' + f.padEnd(18), (h.length / 1024).toFixed(0) + ' KB')
