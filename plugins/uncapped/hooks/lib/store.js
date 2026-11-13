// Reading and writing the customer's saved work. Everything lives in their
// Uncapped folder (the folder their Claude Code session is open in):
//
//   .uncapped/workspace.json   marks the folder as an Uncapped workspace
//   my-work/uncapped.json      all their work, in one file
//   my-work/.uncapped.previous.json   the save before the last one
//   my-work/backups/<when>/    copies taken before any format change
//   my-work/kit/*.md           readable copies of every builder's results
//
// Plugin updates replace the plugin's own folder and never this one.

import { FILES, SCHEMA, freshWork, migrate, now } from './model.js'

export async function readJson($, path) {
  const text = await $.fs.read(path)
  return JSON.parse(text)
}

// Writes to a temporary file and renames it over the real one, so a crash
// mid-write never leaves a half-written file. Falls back to a plain write
// where the rename can't run.
export async function writeAtomic($, path, text) {
  const tmp = `${path}.saving`
  await $.fs.write(tmp, text)
  try {
    const cwd = await $.session.cwd()
    const abs = (p) => (p.startsWith('/') ? p : `${cwd}/${p}`)
    const r = await $.process.run(['/bin/mv', '-f', abs(tmp), abs(path)])
    if (r.exitCode === 0) return
  } catch (e) {
    // fall through
  }
  await $.fs.write(path, text)
}

export async function detectWorkspace($) {
  const hasMarker = await $.fs.exists(FILES.marker)
  const hasWork = await $.fs.exists(FILES.work)
  const cwd = await $.session.cwd()
  if (hasMarker || hasWork) return { state: 'ready', cwd }
  return { state: 'none', cwd }
}

export async function createWorkspace($, productVersion) {
  const t = now()
  await $.fs.write(FILES.marker, JSON.stringify({ createdAt: t, createdWith: productVersion, about: 'This folder holds your Uncapped work. Open it in Claude Desktop to carry on.' }, null, 2))
  if (!(await $.fs.exists(FILES.work))) {
    await writeAtomic($, FILES.work, JSON.stringify(freshWork(productVersion), null, 2))
  }
  return { state: 'ready', cwd: await $.session.cwd() }
}

function stamp() {
  return now().replace(/[:.]/g, '-').slice(0, 19)
}

// Loads saved work, upgrading an older format after taking a backup.
// Returns { work, status, message, readOnly }.
export async function loadWork($, productVersion, testMigrations) {
  let raw
  let recovered = false
  try {
    raw = await readJson($, FILES.work)
  } catch (e) {
    // The main file is missing or unreadable: try the previous save.
    if (await $.fs.exists(FILES.previous)) {
      try {
        raw = await readJson($, FILES.previous)
        recovered = true
      } catch (e2) {
        raw = null
      }
    }
    if (!raw) {
      if (await $.fs.exists(FILES.work)) {
        return { work: null, status: 'error', readOnly: true, message: "Uncapped couldn't read your saved work file. Nothing has been changed or deleted. Your files are in the my-work folder." }
      }
      const w = freshWork(productVersion)
      await writeAtomic($, FILES.work, JSON.stringify(w, null, 2))
      return { work: w, status: 'new', readOnly: false }
    }
  }

  let result
  try {
    result = testMigrations ? migrate(raw, testMigrations.steps, testMigrations.target) : migrate(raw)
  } catch (e) {
    return { work: raw, status: 'error', readOnly: true, message: `This version of Uncapped couldn't update your saved work to its new format (${String(e?.message || e)}). Your work is unchanged. Check for updates, or ask for help.` }
  }

  if (result.status === 'newer') {
    return { work: result.work, status: 'newer', readOnly: true, message: 'Your work was saved by a newer version of Uncapped. You can look but not change anything until this copy is updated too.' }
  }

  // Keep the damaged file in backups before anything replaces it.
  let damagedNote = ''
  if (recovered && (await $.fs.exists(FILES.work))) {
    const dir = `${FILES.backups}/${stamp()}-damaged-save`
    try {
      await $.fs.write(`${dir}/uncapped.json`, await $.fs.read(FILES.work))
      damagedNote = ` The damaged file is kept in ${dir}.`
    } catch (e) {}
  }
  const recoveredText = recovered ? `Your last save looked damaged, so Uncapped restored the save before it.${damagedNote}` : ''

  if (result.status === 'migrated') {
    const dir = `${FILES.backups}/${stamp()}-before-schema-${result.to}`
    await $.fs.write(`${dir}/uncapped.json`, JSON.stringify(raw, null, 2))
    result.work.updatedWith = productVersion
    result.work.events = [{ at: now(), text: `Updated your saved work from format ${result.from} to ${result.to}. A copy of the old file is in ${dir}.` }, ...(result.work.events || [])].slice(0, 50)
    await saveWork($, result.work)
    const updatedText = `Uncapped updated how your work is stored. A backup of the old file is in ${dir}.`
    if (recovered) return { work: result.work, status: 'recovered', readOnly: false, message: `${recoveredText} ${updatedText}` }
    return { work: result.work, status: 'migrated', readOnly: false, message: updatedText }
  }

  if (recovered) {
    await saveWork($, result.work)
    return { work: result.work, status: 'recovered', readOnly: false, message: recoveredText }
  }
  return { work: result.work, status: 'ok', readOnly: false }
}

export async function saveWork($, work) {
  work.updatedAt = now()
  const text = JSON.stringify(work, null, 2)
  if (await $.fs.exists(FILES.work)) {
    try {
      const current = await $.fs.read(FILES.work)
      JSON.parse(current)
      await $.fs.write(FILES.previous, current)
    } catch (e) {
      // the current file is unreadable: don't let it overwrite the good previous copy
    }
  }
  await writeAtomic($, FILES.work, text)
}

export async function backupNow($, reason) {
  const dir = `${FILES.backups}/${stamp()}-${reason}`
  if (await $.fs.exists(FILES.work)) {
    await $.fs.write(`${dir}/uncapped.json`, await $.fs.read(FILES.work))
  }
  return dir
}

export async function writeKitFile($, name, markdown) {
  await $.fs.write(`${FILES.kit}/${name}`, markdown)
}

export { SCHEMA }
