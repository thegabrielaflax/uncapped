// One request to Claude at a time, recorded on disk.
//
// Every request that costs the customer's plan gets an id made from what it
// does, what it's about and a fingerprint of the exact text sent. Before a
// request starts, Uncapped reads the record fresh from the customer's folder
// and claims it there:
//   - the same request already running: no second request, show its progress;
//   - the same request already done: no second request, show the result;
//   - any other request running (panel, chat or another Claude window on the
//     same folder): no second request, say what's running;
//   - the same request failed, was stopped or interrupted: a new attempt.
// Claims within this Claude window are made one at a time, so double clicks,
// redraws and the chat can't race each other. Two windows on one folder share
// the file; a claim there could only race within the same few milliseconds.

export const OPS_PATH = 'my-work/.uncapped-requests.json'
export const STALE_MS = 5 * 60 * 1000 // longer than any request's own 4-minute limit

let chain = Promise.resolve()
function oneAtATime(fn) {
  const p = chain.then(fn, fn)
  chain = p.then(() => {}, () => {})
  return p
}

// A short, stable fingerprint of a text (two 32-bit FNV-1a passes).
export function fingerprint(text) {
  let a = 0x811c9dc5
  let b = 0x9747b28c
  const s = String(text)
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    a = Math.imul(a ^ c, 16777619) >>> 0
    b = Math.imul(b ^ c, 2246822519) >>> 0
  }
  return a.toString(36) + b.toString(36)
}

export function requestId(name, target, text, nonce) {
  return [name, target || '-', fingerprint(text), nonce || ''].filter(Boolean).join(':')
}

async function readOps($) {
  try {
    const j = JSON.parse(await $.fs.read(OPS_PATH))
    return Array.isArray(j.ops) ? j.ops : []
  } catch (e) {
    return []
  }
}

async function writeOps($, ops) {
  const body = {
    about: 'Uncapped records its requests to Claude here so the same request never runs twice. It holds no answers. Safe to delete while Uncapped is closed.',
    ops: ops.slice(0, 40),
  }
  await $.fs.write(OPS_PATH, JSON.stringify(body, null, 1))
}

export const BEAT_STALE_MS = 90 * 1000 // a request that beats (a Substack strategy) is stopped once it goes quiet this long

function settleStale(ops, t) {
  for (const o of ops) {
    const quiet = o.beatAt ? t - Math.max(Date.parse(o.startedAt), Date.parse(o.beatAt)) > BEAT_STALE_MS : t - Date.parse(o.startedAt) > STALE_MS
    if (o.status === 'running' && quiet) {
      o.status = 'interrupted'
      o.endedAt = new Date(t).toISOString()
      o.error = 'It stopped without finishing: Claude was closed, or it ran past five minutes.'
    }
  }
}

// req: { id, name, label, place, target, sessionId }
export function claimOp($, req, t) {
  return oneAtATime(async () => {
    const ops = await readOps($)
    settleStale(ops, t)
    const same = ops.find((o) => o.id === req.id)
    if (same && same.status === 'running') return { state: 'running', op: same }
    if (same && same.status === 'done') return { state: 'done', op: same }
    // A step of a longer request (req.parent: a Substack strategy) runs under it, never beside anything else.
    // Steps run one at a time, so a sibling still marked running was left by an attempt that stopped.
    if (req.parent) for (const o of ops) if (o.status === 'running' && o.parent === req.parent) Object.assign(o, { status: 'interrupted', endedAt: new Date(t).toISOString(), error: 'Its strategy stopped before this step finished.' })
    // A new attempt at a longer request settles the steps its last attempt left running.
    if (!(same && same.status === 'running')) for (const o of ops) if (o.status === 'running' && o.parent && o.parent === req.id) Object.assign(o, { status: 'interrupted', endedAt: new Date(t).toISOString(), error: 'Its strategy stopped before this step finished.' })
    const other = ops.find((o) => o.status === 'running' && !(req.parent && o.id === req.parent))
    if (other) return { state: 'busy', op: other }
    const op = {
      id: req.id, name: req.name, label: req.label, place: req.place, target: req.target || '',
      sessionId: req.sessionId || '', status: 'running', startedAt: new Date(t).toISOString(), ...(req.parent ? { parent: req.parent } : {}), ...(req.beats ? { beatAt: new Date(t).toISOString() } : {}),
      attempt: (same?.attempt || 0) + 1,
    }
    await writeOps($, [op, ...ops.filter((o) => o.id !== req.id)])
    return { state: 'started', op, previous: same || null }
  })
}

export function finishOp($, id, status, extra = {}, t) {
  return oneAtATime(async () => {
    const ops = await readOps($)
    const o = ops.find((x) => x.id === id)
    if (!o) return null
    Object.assign(o, extra, { status, endedAt: new Date(t).toISOString() })
    await writeOps($, ops)
    return o
  })
}

// A long request says it's still alive (every 20 seconds while it runs).
export function beatOp($, id, t) {
  return oneAtATime(async () => {
    const ops = await readOps($)
    const o = ops.find((x) => x.id === id)
    if (!o || o.status !== 'running') return null
    o.beatAt = new Date(t).toISOString()
    await writeOps($, ops)
    return o
  })
}

export function settleOps($, t) {
  return oneAtATime(async () => {
    const ops = await readOps($)
    const before = JSON.stringify(ops)
    settleStale(ops, t)
    if (JSON.stringify(ops) !== before) await writeOps($, ops)
    return ops
  })
}

export async function listOps($) {
  return readOps($)
}

export function clockTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  } catch (e) {
    return ''
  }
}

// What the person sees when a press doesn't start a new request.
export function refusalText(claim, label) {
  const at = clockTime(claim.op?.startedAt)
  if (claim.state === 'running') return `Already working on this (started ${at}). No second request was sent.`
  if (claim.state === 'busy') return `Uncapped is still ${String(claim.op?.label || 'working on something else').replace(/^./, (c) => c.toLowerCase())} (started ${at}). One thing at a time, so nothing new was sent. This will be free to use as soon as that finishes.`
  if (claim.state === 'done') return `Already done with exactly these answers (at ${clockTime(claim.op?.endedAt)}). Nothing new was sent.`
  return `${label || 'That'} didn't start.`
}
