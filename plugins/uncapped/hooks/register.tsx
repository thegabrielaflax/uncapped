// @ts-nocheck
// Uncapped: the panel beside the chat in Claude Desktop.
//
// The panel shows the ten builders, asks their questions, calls Claude on the
// customer's own session ($.model.complete bills to their plan), saves every
// answer and result to their my-work folder, tracks which saved assets depend
// on which shared facts, and checks for product updates.

import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { V, serifTitleSvg, barSvg, fontsLoaded } from './lib/brand.js'
import * as U2 from './lib/ui2.tsx'
import { F10Screen, PersonScreen, PeopleScreen, first10Next } from './lib/v2-first10.tsx'
import { SubstackScreen, PostScreen, StrategyProgress } from './lib/v2-substack.tsx'
import { C, S, LENS, LENS_ORDER, LIVE_STEPS, STEPS, PHASES, plantingSvg, pathSvg, dotsSvg, stepHeadSvg, lensLadderSvg, skillLadderSvg, portfolioLadderSvg, funnelSvg, promiseSvg, arcSvg, welcomeSvg, celebrateSvg, builderMapSvg2, routeMapSvg, offerCardSvg3, thinkingSvg, pxFor, headerSvg2, wordmarkSvg, pivotSvg, titleSvg, noteSvg, polaroidSvg2, builderMapSvg, gardenSvg, offerCardSvg2 } from './lib/brand.js'
import {
  FILES, freshWork, activeOffer, priceText, OFFER_FIELDS, flagReviews, changeMessage, reviewStatus,
  basedOnNow, pushHistory, builderStatus, changedPaths, getPath, setPath, now, ASSET_NAME, listNames, applyOfferChange,
  THEMES, STARTING_POINTS, discoverProgress, parseCurrency, parseHours, parseIncome, parseGoal, GOALS, money,
  OUTREACH, REPLY, TALK, SIGNALS, contactRecord, contactStage, contactCounts,
  spacesOf, spaceOf, offersIn, substackFor, activateSpace, placeOffers, newSpace,
} from './lib/model.js'
import { detectWorkspace, createWorkspace, loadWork, saveWork, backupNow, writeKitFile } from './lib/store.js'
import {
  DISCOVER_QUESTIONS, questionFor, BUILDERS, BY_ID, earlyReadPrompt, sharpenPrompt, builderPrompt, revisePrompt, numbersPrompt, directionPrompt, researchPrompt, researchSystem,
  feedbackPrompt, followUpPrompt, parseJson, checkShape, toMarkdown, demandText, callGuidePrompt, briefPrompt,
  substackChoosePrompt, postResearchSystem, postResearchPrompt, postCardPrompt, cardProblems, cleanCard, verifiedReading, isV3Strategy, cardWritten,
  fieldResearchPrompt, stubReviewPrompt, reviseStubsPrompt, refsReviewPrompt, keepReviewed,
} from './lib/builders.js'
import { siteHtml } from './lib/site.js'
import { UNCERTAINTIES, DECISIONS, LEVELS, EVIDENCE, experimentSource, planPrompt, organisePrompt, readingPrompt, experimentFrom, experimentLine, findExperiment } from './lib/experiments.js'
import { FEEDBACK_TO, KINDS, redact, whereText, guessGoal, subjectFor, reportText, mailtoUrl, looksLikeEmail } from './lib/feedback.js'
import { requestId, claimOp, finishOp, settleOps, refusalText, clockTime, fingerprint, beatOp } from './lib/ops.js'
import { REQUIRED, readWithRecovery } from './lib/replies.js'
import { copiedAnswers, needsReview, editFollowup } from './lib/repair.js'
import { MODELS, moneyFor, moneyLine, moneyRows, fitLines, fmtMoney, fmtRange } from './lib/money.js'

const PANE = 'uncapped'
const PLUGIN = 'uncapped'
// The research agent and its one tool, named from the plugin (a preview copy is renamed).
const RESEARCHER = `${PLUGIN}:researcher`
const SAVE_RESEARCH = `mcp__${PLUGIN}__save_research`

const INITIAL_UI = {
  ws: 'unknown', version: '', readOnly: false, notice: null, error: null, retry: null, busy: null, op: null, opNote: null,
  drafts: {}, editing: null, showExample: null, update: null, confirm: null, feedback: null, trail: [], lastAction: null, pendingFindings: null,
}

const navA = atom({ plugin: 'uncapped', key: 'nav' } as const, { view: 'home' }, { shape: 'nav-1' })
const uiA = atom({ plugin: 'uncapped', key: 'ui' } as const, INITIAL_UI, { shape: 'ui-1' })
const workA = atom({ plugin: 'uncapped', key: 'work' } as const, null, { shape: 'work-1' })

// Module-level caches: rebuilt by boot() after any reload.
let METHODS = null
let PHOTO = ''
let VERSION = '0.0.0'
let MODEL_BALANCED = 'sonnet'
let MODEL_DEEP = 'opus'
let controller = null
let stopped = false
let lastClaim = null
let currentOpId = null // the request being saved, so a result is saved once
// Research agents this panel started: agentId -> { opId, directionId, place, searches, fetches, saved }
const researchRuns = new Map()
let pendingResearch = null // a research run whose agent hasn't been named yet
const RESEARCH_LIMITS = { searches: 6, fetches: 4 }
// Substack v3 (11 Nov): research for the post cards, by its own agent type, capped per post.
const POST_RESEARCHER = `${PLUGIN}:post-researcher`
const POST_LIMITS = { searches: 4, fetches: 6 }
const postRuns = new Map()
const pendingPostRuns = []
let cardsRunning = false
let opResultCount = 1
let DRAW = null // the drawing context of the panel being drawn now, for helpers that aren't handed it
let FONTS = {}
// Preview builds only: Claude Code's theme setting, read at each draw (dark mode probe, 11 Nov).
let THEME_PROBE = ''
let PIVOT = ''

const HOURS = { '1 to 2': 1.5, '3 to 5': 4, '6 to 10': 8, '10 to 15': 12.5, '15 or more': 17 }
const CURRENCIES = ['$', '£', '€', 'CA$', 'A$']
const METHOD_IDS = ['_voice', 'testing', 'discover', 'opportunities', 'offerbank', 'offer', 'brand', 'linkedin', 'content', 'substack', 'substack-examples', 'website', 'sales', 'delivery', 'operations']

// ======================================================================
// boot, saving, navigation
// ======================================================================

async function boot($) {
  try {
    const manifest = JSON.parse(await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`))
    VERSION = manifest.version || VERSION
  } catch (e) {}
  METHODS = {}
  for (const id of METHOD_IDS) {
    try { METHODS[id] = await $.fs.read(`${$.plugin.root}/method/${id}.md`) } catch (e) { METHODS[id] = '' }
  }
  try { PHOTO = (await $.fs.read(`${$.plugin.root}/assets/gabriela-small.jpg`, { as: 'bytes' })).base64 } catch (e) { PHOTO = '' }
  try { PIVOT = (await $.fs.read(`${$.plugin.root}/assets/pivot-wordmark.png`, { as: 'bytes' })).base64 } catch (e) { PIVOT = '' }
  FONTS = {}
  for (const [k, f] of [['mark', 'fraunces-800i-wordmark'], ['corm600', 'cormorant-600-v2'], ['c5i', 'cormorant-500i-v2']]) {
    try { FONTS[k] = (await $.fs.read(`${$.plugin.root}/assets/fonts/${f}.woff2`, { as: 'bytes' })).base64 } catch (e) {}
  }
  fontsLoaded(FONTS)

  const ws = await detectWorkspace($)
  await update($, uiA, (u) => ({ ...INITIAL_UI, ...(u || {}), ws: ws.state, cwd: ws.cwd, version: VERSION, busy: null, op: null, opNote: null }))
  if (ws.state === 'ready') {
    try {
      const t = await $.clock.now()
      const ops = await settleOps($, t)
      // A reload (a new version installed, say) mustn't make a request that's still running look idle.
      const live = (Array.isArray(ops) ? ops : []).find((o) => o?.status === 'running')
      if (live) {
        const startedAt = Date.parse(live.startedAt) || t
        await update($, uiA, (u) => ({ ...u, op: { id: live.id, name: live.name, label: live.label || 'Working on it', explain: '', steps: [], place: live.place || 'chat', nav: null, target: live.target || '', builder: live.name === 'early' ? 'discover' : live.name === 'guide' ? 'sales' : live.target || '', status: 'running', startedAt, elapsed: Math.round((t - startedAt) / 1000), typical: TYPICAL_SECONDS[live.name === 'build' ? `build-${live.target}` : live.name] || 0, attempt: live.attempt || 1, restored: true } }))
      }
    } catch (e) {}
  }
  if (ws.state !== 'ready') {
    await update($, navA, () => ({ view: 'setup' }))
    return
  }
  await loadInto($)
}

async function loadInto($) {
  const r = await loadWork($, VERSION)
  // Every chosen offer has a space as soon as the work opens (saved with the next change).
  if (r.work && !r.readOnly) placeOffers(r.work)
  await update($, workA, () => r.work)
  await update($, uiA, (u) => ({ ...u, ws: 'ready', readOnly: !!r.readOnly, notice: r.message || null, error: r.status === 'error' ? r.message : null }))
  await update($, navA, () => ({ view: 'home' }))
}

async function getWork($) {
  return structuredClone(await read($, workA))
}

// Applies a change to the saved work, writes it to disk and refreshes the
// readable kit file for the builder that changed.
let mutateChain = Promise.resolve()
async function mutate($, fn, kitIds = []) {
  const p = mutateChain.then(() => mutateNow($, fn, kitIds), () => mutateNow($, fn, kitIds))
  mutateChain = p.then(() => {}, () => {})
  return p
}
async function mutateNow($, fn, kitIds = []) {
  const ui = await read($, uiA)
  if (ui.readOnly) {
    await update($, uiA, (u) => ({ ...u, error: "Your work is read-only in this version, so that change wasn't saved." }))
    return null
  }
  const w = await getWork($)
  const raw = await fn(w)
  const result = raw === undefined ? true : raw
  // Every chosen offer belongs to a space (a new one joins its garden idea's, or starts its own).
  placeOffers(w)
  w.updatedWith = VERSION
  await saveWork($, w)
  await update($, workA, () => w)
  for (const id of kitIds) {
    try { await writeKitFile($, `${BY_ID[id].num}-${id}.md`, toMarkdown(id, w)) } catch (e) {}
  }
  return result
}

async function go($, patch) {
  await update($, uiA, (u) => ({ ...u, editing: null, error: null, confirm: null, notice: null, trail: [...(u.trail || []), `screen: ${whereText(patch, LABELS_FOR_FEEDBACK)}`].slice(-8) }))
  await update($, navA, (n) => ({ ...patch }))
}

async function setUi($, patch) {
  await update($, uiA, (u) => ({ ...u, ...patch }))
}

async function setDraft($, key, value) {
  await update($, uiA, (u) => ({ ...u, drafts: { ...u.drafts, [key]: value } }))
}

// ======================================================================
// talking to Claude (on the customer's own session)
// ======================================================================

// Measured on 4 Nov 2026 with Sonnet (docs/04, section 6). Anything not
// measured says "a minute or two" rather than inventing a number.
const TYPICAL_SECONDS = { strategy: 720, followups: 8, plan: 91, organise: 27, reading: 17, early: 360, 'build-sales': 150, 'build-substack': 150, guide: 60, brief: 30, briefs: 120, cards: 300 }

// Every request to Claude goes through here. `name` and `target` say what it
// is; `place` is the card the person pressed it from, where progress, the
// result and any error are shown. The claim in lib/ops.js stops the same
// request (or any second request) running while one is in flight, across
// clicks, redraws, the chat and retries.
async function ask($, { system, prompt }, opts) {
  const { label, steps, builder, kind, deep, raw, explain, args } = opts
  const maxTokens = opts.maxTokens || 8000
  const name = opts.name || kind
  const place = opts.place || 'chat'
  const t0 = await $.clock.now()
  const id = requestId(name, opts.target, `${deep ? 'deep' : 'balanced'}\n${system}\n${prompt}`, opts.fresh ? `fresh${t0}` : '')
  const claim = await claimOp($, { id, name, label, place, target: opts.target, parent: opts.parent }, t0)
  lastClaim = claim
  if (claim.state !== 'started') {
    lastOpError = refusalText(claim, label)
    await setUi($, { opNote: { place, state: claim.state, text: refusalText(claim, label), name, target: opts.target || '', args: args || null } })
    return null
  }
  currentOpId = id
  // A fingerprint of the saved file, to confirm later that a failure left it alone.
  let savedBefore = null
  try { savedBefore = fingerprint(await $.fs.read(FILES.work)) } catch (e) {}
  controller = new AbortController()
  // A portfolio garden (8 to 12 ideas, each with its comparison parts) can take several minutes to write.
  // A v3 Substack's first step writes the publication, ten outlines and the rest: allow it as long as a garden.
  const waitMs = name === 'early' || (name === 'build' && opts.target === 'substack') ? 600000 : opts.target === 'substack' ? 420000 : 240000
  await mark($, label)
  const op = { id, name, label, explain: explain || '', steps: steps || [], place, nav: place === 'chat' ? null : await read($, navA), builder, target: opts.target || '', args: args || null, status: 'running', startedAt: t0, elapsed: 0, typical: TYPICAL_SECONDS[name === 'build' ? `build-${opts.target}` : name] || TYPICAL_SECONDS[name] || 0, attempt: claim.op.attempt }
  await setUi($, { op, opNote: null, error: null })
  void showPlace($, place)

  // Every call this request makes, with its usage, for the request record.
  const calls = []
  const files = []
  let result = null
  let failure = null // { what: plain sentence, why: technical detail }
  let readHow = '' // how the reply was read: clean, or which local repair
  const call = async (role, req) => {
    const r = await $.model.complete({ ...req, timeoutMs: waitMs, signal: controller.signal })
    calls.push({ role, model: req.model, maxTokens: req.maxTokens, effort: req.effort || 'default', answered: Boolean(r.isAnswered), usage: r.usage || null })
    return r
  }
  const keep = async (role, r, verdict) => {
    // Unreadable replies are kept in this folder (never sent anywhere) so a
    // failure can be inspected instead of guessed at.
    try {
      const file = `my-work/support/replies/${id.replace(/[^a-z0-9-]/gi, '-')}-${opResultCount++}.json`
      await $.fs.write(file, JSON.stringify({ request: id, role, at: new Date(await $.clock.now()).toISOString(), verdict, usage: r.usage || null, maxTokens, reply: r.text || '' }, null, 1))
      files.push(file)
    } catch (e) {}
  }
  const check = (v) => {
    if (REQUIRED[kind]) return REQUIRED[kind](v)
    try { checkShape(kind, v); return [] } catch (e) { return [e.message.replace(/^the reply was missing /, '')] }
  }
  try {
    const model = deep ? MODEL_DEEP : MODEL_BALANCED
    const first = await call('write', { model, system, prompt, maxTokens, effort: opts.effort })
    if (!first.isAnswered) {
      failure = { what: first.reason === 'aborted' ? (stopped ? 'You stopped it.' : `It took longer than ${Math.round(waitMs / 60000)} minutes, so Uncapped stopped waiting.`) : first.reason === 'api-error' ? `Claude couldn't answer just now${first.status === 429 || first.status === 529 ? ' (it was busy, or your plan is near its usage limit)' : ''}.` : 'Claude sent back an empty reply.', why: `${first.reason}${first.status ? ` ${first.status}` : ''}` }
    } else if (raw) {
      result = first.text
    } else {
      // One bounded recovery, never more, and only for a cause it can fix
      // (lib/replies.js, shared with the developer's live check).
      const got = await readWithRecovery({ first, model, system, prompt, maxTokens, call, keep, check, stopped: () => stopped })
      if (got.failure) failure = got.failure
      else { result = got.value; readHow = got.how }
    }
  } catch (e) {
    failure = { what: "Uncapped couldn't reach Claude.", why: String(e?.message || e).slice(0, 200) }
  }
  const wasStopped = stopped
  controller = null
  stopped = false
  const t1 = await $.clock.now()
  // Only say saved work is untouched when the file on disk confirms it.
  let unchanged = false
  if (!result) {
    try { unchanged = savedBefore != null && fingerprint(await $.fs.read(FILES.work)) === savedBefore } catch (e) { unchanged = false }
  }
  const status = result ? 'done' : wasStopped ? 'stopped' : 'failed'
  lastOpError = result ? '' : failure?.what || (wasStopped ? 'You stopped it.' : '')
  const record = { calls, replies: files, outcome: result ? `read and checked${readHow && readHow !== 'clean' ? ` (${readHow})` : ''}` : failure?.why || 'stopped' }
  await finishOp($, id, status, result ? record : { ...record, error: failure?.what || 'Stopped.' }, t1)
  await update($, uiA, (u) => (u.op?.id === id ? { ...u, op: { ...u.op, status, error: failure?.what || '', why: failure?.why || '', unchanged, calls, replies: files, endedAt: t1, elapsed: Math.round((t1 - t0) / 1000) } } : u))
  void showPlace($, place)
  return result
}

// Several requests of one kind as one job (10 Nov: a Substack's ten post
// briefs): one claim and one progress card; a few calls at a time; each reply
// checked like any other and saved as it arrives, one save at a time; one that
// fails is tried once more. Returns what was written and what wasn't.
async function askMany($, items, opts) {
  const { label, builder, kind, explain, place = 'chat', onEach, concurrency = 3 } = opts
  const name = opts.name || kind
  const maxTokens = opts.maxTokens || 8000
  const t0 = await $.clock.now()
  const id = requestId(name, opts.target, items.map((x) => x.prompt.prompt).join('\n'), `many${t0}`)
  const claim = await claimOp($, { id, name, label, place, target: opts.target, parent: opts.parent }, t0)
  lastClaim = claim
  if (claim.state !== 'started') {
    lastOpError = refusalText(claim, label)
    await setUi($, { opNote: { place, state: claim.state, text: refusalText(claim, label), name, target: opts.target || '' } })
    return null
  }
  currentOpId = id
  controller = new AbortController()
  await mark($, label)
  const total = items.length
  const op = { id, name, label, explain: explain || '', steps: [], place, nav: place === 'chat' ? null : await read($, navA), builder, target: opts.target || '', status: 'running', startedAt: t0, elapsed: 0, typical: TYPICAL_SECONDS[name] || 0, attempt: claim.op.attempt, progress: { done: 0, total } }
  await setUi($, { op, opNote: null, error: null })
  const calls = []
  const files = []
  const call = async (role, req) => {
    const r = await $.model.complete({ ...req, timeoutMs: opts.timeoutMs || 240000, signal: controller.signal })
    calls.push({ role, model: req.model, maxTokens: req.maxTokens, effort: req.effort || 'default', answered: Boolean(r.isAnswered), usage: r.usage || null })
    return r
  }
  const keep = async (role, r, verdict) => {
    try {
      const file = `my-work/support/replies/${id.replace(/[^a-z0-9-]/gi, '-')}-${opResultCount++}.json`
      await $.fs.write(file, JSON.stringify({ request: id, role, at: new Date(await $.clock.now()).toISOString(), verdict, usage: r.usage || null, maxTokens, reply: r.text || '' }, null, 1))
      files.push(file)
    } catch (e) {}
  }
  const check = (v) => (REQUIRED[kind] ? REQUIRED[kind](v) : [])
  const one = async ({ system, prompt }) => {
    const first = await call('write', { model: MODEL_BALANCED, system, prompt, maxTokens, effort: opts.effort })
    if (!first.isAnswered) return null
    const got = await readWithRecovery({ first, model: MODEL_BALANCED, system, prompt, maxTokens, call, keep, check, stopped: () => stopped })
    return got.failure ? null : got.value
  }
  const done = []
  const failed = []
  let saving = Promise.resolve()
  let next = 0
  const worker = async () => {
    while (next < items.length && !stopped) {
      const item = items[next++]
      let v = null
      try { v = await one(item.prompt) } catch (e) { v = null }
      if (!v && !stopped) { try { v = await one(item.prompt) } catch (e) { v = null } }
      // A reply that reads but falls short of the standard is rewritten once, told what failed (Substack v3 cards).
      const probs = v && opts.quality ? opts.quality(v) : []
      if (probs.length && !stopped) {
        let v2 = null
        try { v2 = await one({ system: item.prompt.system, prompt: `${item.prompt.prompt}\n\nYOUR FIRST VERSION, BELOW, FELL SHORT IN THESE WAYS. Return the whole card again in the same JSON shape, fixing each one and keeping everything that was already good:\n- ${probs.join('\n- ')}\n\nYOUR FIRST VERSION:\n${JSON.stringify(v)}` }) } catch (e) { v2 = null }
        if (v2 && opts.quality(v2).length <= probs.length) v = v2
      }
      if (v) {
        saving = saving.then(() => onEach(item, v)).catch(() => {})
        await saving
        done.push(item)
      } else failed.push(item)
      await update($, uiA, (u) => (u.op?.id === id ? { ...u, op: { ...u.op, progress: { done: done.length, total } } } : u))
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  const wasStopped = stopped
  controller = null
  stopped = false
  const t1 = await $.clock.now()
  const status = done.length ? 'done' : wasStopped ? 'stopped' : 'failed'
  const error = status === 'done' ? '' : wasStopped ? 'You stopped it.' : "Claude couldn't write them just now (it was busy, or your plan is near its usage limit)."
  lastOpError = error
  const record = { calls, replies: files, outcome: `${done.length} of ${total} written${failed.length ? `; ${failed.length} not written` : ''}` }
  await finishOp($, id, status, status === 'done' ? record : { ...record, error }, t1)
  await update($, uiA, (u) => (u.op?.id === id ? { ...u, op: { ...u.op, status, error, calls, replies: files, endedAt: t1, elapsed: Math.round((t1 - t0) / 1000) } } : u))
  return { done, failed, stopped: wasStopped }
}

// Fills in what the person sees where they pressed, once a result is saved.
// Why the last request didn't start, when it was refused rather than failed.
function notSent() {
  return lastClaim && lastClaim.state !== 'started' ? refusalText(lastClaim) : ''
}

async function opResult($, patch) {
  await update($, uiA, (u) => (u.op ? { ...u, op: { ...u.op, ...patch } } : u))
}

async function showPlace($, place) {
  try { await $.ui.scroll({ to: { key: `op-${place}` }, in: PANE, block: 'nearest' }) } catch (e) {}
}

async function stopAsking($) {
  if (controller) { stopped = true; controller.abort() }
}

// ======================================================================
// Discover: one set of saving functions for the panel and the chat
// ======================================================================

// Saves one theme in the person's own words. The chat's tools and the
// panel's forms both come through here, so they always agree.
async function saveTheme($, theme, text, how = 'replace', depth, source = 'panel') {
  const t = String(text ?? '').trim()
  if (!t) return { status: 'empty', message: 'Nothing to save yet.' }
  const ok = await mutate($, (w) => {
    const a = w.profile.answers
    a[theme] = how === 'add' && a[theme] ? `${a[theme]}\n\n${t}` : t
    if (depth) w.discover.depth[theme] = depth
    else if (how === 'replace' && w.discover.depth[theme] !== 'skipped') delete w.discover.depth[theme]
    if (w.discover.status === 'not_started') w.discover.status = 'in_progress'
    w.discover.lastSource = source
    w.discover.lastTheme = theme
    return true
  }, ['discover'])
  const label = THEMES.find((x) => x.id === theme)?.short || theme
  return ok ? { status: 'saved', message: `Saved: ${label}.` } : { status: 'not_saved', message: "Couldn't save: this copy of Uncapped is read-only." }
}

async function saveName($, name) {
  const n = String(name ?? '').trim()
  if (!n) return { status: 'empty' }
  const ok = await mutate($, (w) => { w.profile.name = n }, ['discover'])
  return ok ? { status: 'saved', message: `Saved: your name, ${n}.` } : { status: 'not_saved', message: "Couldn't save your name." }
}

async function saveStartingPoint($, kind, details, source = 'panel') {
  if (!STARTING_POINTS[kind]) return { status: 'needs_clarification', message: 'Ask which fits best: no idea yet, a few possibilities, already selling something, or exploring something new.' }
  const ok = await mutate($, (w) => {
    w.discover.startingPoint = kind
    if (String(details ?? '').trim()) w.profile.answers.start = String(details).trim()
    if (w.discover.status === 'not_started') w.discover.status = 'in_progress'
    w.discover.lastSource = source
  }, ['discover'])
  return ok ? { status: 'saved', message: `Saved: ${STARTING_POINTS[kind].replace(/^I /, 'you ').replace(/^I'/, "you'")}.` } : { status: 'not_saved', message: "Couldn't save that." }
}

// The practical week. Reads what people actually type ("GBP", "£3k",
// "about eight hours"), saves what is clear, and returns a natural question
// for anything that isn't. Never reports a save that didn't happen.
async function saveWeek($, input, source = 'panel') {
  const w0 = await read($, workA)
  const cur0 = w0?.profile?.limits?.currency || '$'
  const set = {}
  const said = []
  const asks = []
  if (input.currency != null && String(input.currency).trim()) {
    const c = parseCurrency(input.currency)
    if (c.ok) { set.currency = c.value; said.push(`your currency, ${c.value}`) } else asks.push(c.ask)
  }
  const cur = set.currency || cur0
  if (input.hours != null && String(input.hours).trim()) {
    const raw = String(input.hours)
    if (HOURS[raw]) { set.hours = raw; set.hoursExact = HOURS[raw]; said.push(`${raw} hours a week`) } else {
      const h = parseHours(raw)
      if (h.ok) { set.hours = h.band; set.hoursExact = h.value; said.push(`${h.approx ? 'about ' : ''}${h.value} hours a week`) } else asks.push(h.ask)
    }
  }
  if (input.income != null && String(input.income).trim()) {
    const m = parseIncome(String(input.income), cur)
    if (m.ok) {
      set.income = String(m.value)
      if (m.currency && !set.currency && m.currency !== cur0) set.currency = m.currency
      said.push(`${money(m.value, set.currency || m.currency || cur)}/month in additional income${m.converted ? ' (worked out from what you said)' : ''}`)
    } else asks.push(m.ask)
  }
  if (input.goal != null && String(input.goal).trim()) {
    const g = GOALS.includes(input.goal) ? { ok: true, value: input.goal } : parseGoal(input.goal)
    if (g.ok) { set.goal = g.value; said.push(g.value.toLowerCase().replace(/^adding/, 'adding')) } else asks.push(g.ask)
  }
  const energy = {}
  for (const k of ['more', 'less', 'never']) {
    if (input[k] != null) { energy[k] = String(input[k]).trim(); if (energy[k]) said.push(`${k === 'never' ? 'never again' : k + ' of'}: ${energy[k]}`) }
  }
  if (!Object.keys(set).length && !Object.keys(energy).length) {
    return { status: asks.length ? 'needs_clarification' : 'empty', message: asks.join(' ') || 'Nothing to save yet.', asks }
  }
  const ok = await mutate($, (w) => {
    w.profile.limits = { ...(w.profile.limits || {}), ...set }
    w.profile.energy = { ...(w.profile.energy || {}), ...energy }
    if (w.discover.status === 'not_started') w.discover.status = 'in_progress'
    w.discover.lastSource = source
  }, ['discover'])
  if (!ok) return { status: 'not_saved', message: "Couldn't save: this copy of Uncapped is read-only.", asks }
  return { status: asks.length ? 'saved_partly' : 'saved', message: said.map((s) => `Saved: ${s}.`).join(' '), asks }
}

async function skipTheme($, theme) {
  await mutate($, (w) => { w.discover.depth[theme] = 'skipped' }, ['discover'])
}

// A short adaptive round: Claude reads the answers, marks which are thin,
// and asks up to three follow-ups where the answer would change the
// directions. The chat does the same thing conversationally.
// Follow-up questions get an id each, and the answer boxes are keyed by that
// id, so an answer can only ever be saved against the question it was typed
// under. Saving clears the boxes.
function followKey(f, i) {
  return `follow.${f.id || `n${i}`}`
}

async function runFollowUps($, place = 'discover-next', fresh = false) {
  const w = await getWork($)
  const out = await ask($, followUpPrompt(w, METHODS), {
    label: 'Choosing your follow-up questions',
    explain: 'Reading your answers for the details that would most change your directions.',
    steps: ['Checking which answers give enough to work with', 'Picking the follow-ups that would change your directions most'],
    builder: 'discover', kind: 'followups', maxTokens: 8000, effort: 'medium', place, fresh,
  })
  if (!out) return
  const round = (w.discover.followRound || 0) + 1
  // Up to three questions in the first round, at most two in the second.
  const qs = (out.questions || []).slice(0, round >= 2 ? 2 : 3).map((q, i) => ({ ...q, id: `r${round}q${i + 1}${fingerprint(q.q).slice(0, 5)}` }))
  await mutate($, (w2) => {
    for (const [k, v] of Object.entries(out.depth || {})) if (['enough', 'thin'].includes(v) && w2.profile.answers[k]) w2.discover.depth[k] = v
    w2.discover.followups = qs
    if (!qs.length) w2.discover.followRound = round
    // What the interview read: four kinds of evidence and whether there's enough.
    w2.discover.reading = { at: now(), round: qs.length ? round - 1 : round, signals: out.signals || {}, readiness: out.readiness || null, notKnown: Array.isArray(out.notKnown) ? out.notKnown : [] }
  }, ['discover'])
  await clearFollowDrafts($)
  // Enough is about them only. What buyers will do is for testing, so it is
  // never shown here as something missing from the interview.
  const aboutYou = out.readiness?.enough ? [] : out.readiness?.missing || []
  await opResult($, qs.length
    ? { intro: `Here ${qs.length === 1 ? 'is one follow-up question' : `are ${qs.length} follow-up questions`}, just below. Answer any you like, in a sentence or two.`, nextWhy: 'Then press Save my answers, or skip straight to building your portfolio garden.' }
    : out.readiness?.enough
      ? { intro: 'I have enough to suggest the directions I would explore first.', lines: [], nextWhy: 'Next: build your portfolio garden, just below. Each direction will say what to test first.' }
      : { intro: "I'll suggest the directions I would explore first from what you've told me so far.", lines: aboutYou.length ? [`${aboutYou.length === 1 ? 'One thing' : 'A couple of things'} only you can tell me could still change them: ${aboutYou.join('; ')}. You can add ${aboutYou.length === 1 ? 'it' : 'them'} to your answers any time.`] : [], nextWhy: 'Next: build your portfolio garden, just below. Each direction will say what to test first.' })
}

async function clearFollowDrafts($) {
  await update($, uiA, (u) => ({ ...u, drafts: Object.fromEntries(Object.entries(u.drafts || {}).filter(([k]) => !k.startsWith('follow.'))) }))
}

async function saveFollowUpAnswers($) {
  const ui = await read($, uiA)
  const w = await read($, workA)
  const round = (w.discover.followRound || 0) + 1
  const log = []
  for (const [i, f] of (w.discover.followups || []).entries()) {
    const v = ui.drafts[followKey(f, i)]
    if (v && v.trim()) {
      await saveTheme($, f.theme || 'led', `${f.q}\n${v.trim()}`, 'add', 'enough')
      log.push({ id: f.id || `r${round}n${i}`, theme: f.theme || 'led', q: f.q, answer: v.trim(), round, at: now() })
    } else {
      // Asked but left: remembered, so the next round doesn't ask it again.
      log.push({ id: f.id || `r${round}n${i}`, theme: f.theme || 'led', q: f.q, answer: '', skipped: true, round, at: now() })
    }
  }
  const answered = log.filter((x) => !x.skipped).length
  await mutate($, (w2) => {
    w2.discover.followRound = round
    w2.discover.followups = []
    w2.discover.followupLog = [...(w2.discover.followupLog || []), ...log]
  }, ['discover'])
  await clearFollowDrafts($)
  await go($, { view: 'discover', stage: 'overview' })
  await update($, uiA, (u) => ({ ...u, op: u.op?.place === 'discover-next' ? { ...u.op, seen: true } : u.op, opNote: null, notice: answered ? `Saved: ${answered === 1 ? 'your follow-up answer' : `${answered} follow-up answers`}, each with its own question.` : 'Nothing to save: the answer boxes were empty.' }))
}

// A garden built once every copied answer is settled starts with no review
// marks; one built while copies remain is marked by the live check.
function freshGardenMarks(w2) {
  const ar = w2.discover.answerRepair
  if (ar && !copiedAnswers(w2).length) {
    const offers = ar.pending?.offers || {}
    ar.pending = Object.keys(offers).length ? { garden: false, directions: {}, offers, at: now() } : null
    ar.reviewed = Object.fromEntries(Object.entries(ar.reviewed || {}).filter(([k]) => k.startsWith('offer:')))
  }
}

// Keeps up to five earlier gardens, so building a new one never loses one.
function keepEarlierGarden(w2) {
  if (w2.discover.early) w2.discover.earlierGardens = [{ at: w2.discover.early.at || w2.updatedAt || now(), early: w2.discover.early }, ...(w2.discover.earlierGardens || [])].slice(0, 5)
}

async function runEarlyRead($, place = 'discover-next', fresh = false) {
  const w = await getWork($)
  const out = await ask($, earlyReadPrompt(w, METHODS), {
    label: 'Growing your portfolio garden',
    explain: 'Several directions you could earn from, each with who buys it, a price to test, the money it could make in your hours, and a first step.',
    steps: ['Starting from your week, your money goal and your energy', 'Finding the threads that run through what you have done and want', 'Checking each direction has a buyer with a reason to pay now', 'Working out the money and time for each one'],
    builder: 'discover', kind: 'early', name: 'early', deep: true, maxTokens: 24000, effort: 'medium', place, fresh,
  })
  if (!out) return null
  out.directions = (out.directions || []).map((x, i) => ({ ...x, id: x.id || `d${i + 1}` }))
  out.at = now()
  await mutate($, (w2) => {
    keepEarlierGarden(w2)
    w2.discover.early = out
    freshGardenMarks(w2)
    w2.discover.rounds = (w2.discover.rounds || 0) + 1
    w2.discover.status = w2.discover.status === 'done' ? 'done' : 'in_progress'
    w2.events.unshift({ at: now(), text: 'Discover grew your portfolio garden.' })
  }, ['discover'])
  await opResult($, {
    intro: "Here's your portfolio garden: possible directions to explore.",
    lines: [`${out.directions.length} directions, from what you've already done to what you'd like to grow into. They're listed just below.`, 'Compare them on how soon each could earn (my estimate) and how excited you are about it (your score).'],
    nextWhy: "Next: open the one that interests you most and read my recommendation. You don't have to choose yet.",
    next: [{ label: 'Open your portfolio garden', go: { view: 'discover', stage: 'garden' } }],
  })
  return out
}

async function react($, id, value) {
  await mutate($, (w) => { w.discover.reactions[id] = w.discover.reactions[id] === value ? undefined : value }, ['discover'])
}

async function setExcitement($, id, n) {
  await mutate($, (w) => { w.discover.excitement[id] = Number(n) }, ['discover'])
}

async function sharpen($, place = 'garden-sharpen', fresh = false) {
  const ui = await read($, uiA)
  await mutate($, (w) => {
    for (const [k, v] of Object.entries(ui.drafts)) if (k.startsWith('note.') && v?.trim()) w.discover.notes[k.slice(5)] = v.trim()
  }, ['discover'])
  const w = await getWork($)
  const out = await ask($, sharpenPrompt(w, METHODS), {
    label: 'Sharpening the directions you liked',
    explain: 'Developing what you loved, working out what would decide the maybes, and dropping what you said no to.',
    steps: ['Keeping what you loved and developing it', 'Working out what would decide the maybes', 'Dropping what you said no to', 'Re-checking the money and time for each one'],
    builder: 'discover', kind: 'early', name: 'sharpen', deep: true, maxTokens: 24000, effort: 'medium', place, fresh,
  })
  if (!out) return
  const prev = w.discover.reactions
  const prevEx = w.discover.excitement
  out.directions = (out.directions || []).map((x, i) => ({ ...x, id: x.id || `s${i + 1}` }))
  out.at = now()
  await mutate($, (w2) => {
    keepEarlierGarden(w2)
    w2.discover.early = out
    freshGardenMarks(w2)
    w2.discover.reactions = Object.fromEntries(out.directions.filter((x) => prev[x.id]).map((x) => [x.id, prev[x.id]]))
    w2.discover.excitement = Object.fromEntries(out.directions.filter((x) => prevEx[x.id]).map((x) => [x.id, prevEx[x.id]]))
    w2.discover.rounds = (w2.discover.rounds || 0) + 1
  }, ['discover'])
  await opResult($, { intro: 'Your directions are sharpened, using your reactions and notes.', lines: ['The updated directions are on this screen. The earlier version is kept.'], nextWhy: 'Next: open the one you are most drawn to and read my recommendation.' })
}


// Directions saved before 0.2.1 have a price but not the rest of the money
// (attendees, how many a month, costs, hours). This asks Claude to estimate
// those inputs only; lib/money.js does the arithmetic.
async function workOutNumbers($, id, place = `numbers-${id}`, fresh = false) {
  const w = await getWork($)
  const d = (w.discover.early?.directions || []).find((x) => x.id === id)
  if (!d) return null
  const out = await ask($, numbersPrompt(w, d, METHODS), {
    label: 'Working out the numbers',
    explain: 'Estimating how many buyers, how often, the costs and all the hours, so the money can be worked out properly. The arithmetic is done here, not by Claude.',
    steps: [], builder: 'discover', kind: 'numbers', name: 'numbers', target: id, args: { id }, maxTokens: 1500, place, fresh,
  })
  if (!out) return null
  await mutate($, (w2) => {
    const x = (w2.discover.early?.directions || []).find((y) => y.id === id)
    if (x) x.money = { ...out, at: now() }
  }, ['discover'])
  const m = moneyFor({ ...d, money: out }, w.profile)
  await opResult($, {
    intro: 'The numbers are worked out, just below.',
    lines: [m.complete ? `Estimated profit ${fmtRange(m.profit, curOf(w))} a month for about ${m.hours} working hours.` : `Still unknown: ${m.missing.join(', ')}.`],
    nextWhy: 'Every figure is an estimate to test, and the price is a guess until buyers show you otherwise.',
  })
  return out
}

// Starts an offer from a direction: its first offer, or (grow = n) one of the
// offers it could grow into. People can grow several streams, so this never
// deletes others: earlier ones stay saved as income streams.
// What a direction's first offer (or one it could grow into, g) fills in.
function draftsForDirection(d, g) {
  const drafts = {}
  for (const f of OFFER_FIELDS) drafts[`offer.${f}`] = String(d[f === 'name' ? (d.firstOffer ? 'firstOffer' : 'title') : f] ?? '')
  drafts['offer.whyYou'] = d.whyYou || ''
  drafts['offer.toTest'] = d.toTest || ''
  drafts['offer.direction'] = d.short || cleanShort(d)
  drafts['offer.startWith'] = d.startWith || ''
  drafts['offer.format'] = d.shape?.format || ''
  if (g) {
    // Another offer in the same direction: only what the garden said about it.
    Object.assign(drafts, { 'offer.name': g.name || '', 'offer.buyer': g.buyer || '', 'offer.handover': g.receives || '', 'offer.problem': '', 'offer.whyNow': '', 'offer.priceLow': '', 'offer.priceHigh': '', 'offer.priceUnit': '', 'offer.priceWhy': '', 'offer.startWith': '', 'offer.format': '', 'offer.toTest': `Whether ${g.buyer ? lowerFirst(g.buyer) : 'these buyers'} want this, and what they pay for it now` })
  }
  return drafts
}

async function chooseDirection($, id, grow = null) {
  const w = await getWork($)
  const d = (w.discover.early?.directions || []).find((x) => x.id === id)
  if (!d) return
  const drafts = draftsForDirection(d, grow != null ? (d.growInto || [])[grow] : null)
  await mutate($, (w2) => { w2.discover.chosenId = id }, ['discover'])
  await update($, uiA, (u) => ({ ...u, drafts: { ...u.drafts, ...drafts } }))
  await go($, { view: 'discover', stage: 'offer' })
}

async function keepAsStream($, id) {
  const w = await read($, workA)
  const d = (w.discover.early?.directions || []).find((x) => x.id === id)
  if (!d) return
  await mutate($, (w2) => {
    if (w2.offers.some((o) => o.fromDirection === id)) return
    w2.offers.push({ id: `o${w2.offers.length + 1}`, rev: 1, status: 'idea', fromDirection: id, createdAt: now(), history: [], name: d.title, buyer: d.buyer, problem: d.problem, whyNow: d.whyNow, handover: d.handover, priceLow: d.priceLow, priceHigh: d.priceHigh, priceUnit: d.priceUnit, priceWhy: d.priceWhy, firstStep: d.firstStep })
  }, ['discover'])
  await setUi($, { notice: `Kept "${d.title}" as a possible income stream. It's under Saved info, ready when you are.` })
}

function offerFromDrafts(drafts, base) {
  const o = { ...(base || {}) }
  for (const f of [...OFFER_FIELDS, 'whyYou', 'toTest', 'direction', 'startWith', 'format']) {
    const v = drafts[`offer.${f}`]
    if (v === undefined) continue
    o[f] = ['priceLow', 'priceHigh'].includes(f) ? Number(String(v).replace(/[^0-9.]/g, '')) || '' : String(v).trim()
  }
  return o
}

async function confirmFirstOffer($) {
  const ui = await read($, uiA)
  await mutate($, (w) => {
    const existing = activeOffer(w)
    if (existing && existing.status !== 'idea') {
      applyOfferChange(w, existing, offerFromDrafts(ui.drafts, existing))
    } else {
      // Provisional: a working offer to test, usable by every builder straight away.
      const o = offerFromDrafts(ui.drafts, { id: `o${w.offers.length + 1}`, rev: 1, status: 'confirmed', provisional: true, createdAt: now(), history: [], fromDirection: w.discover.chosenId })
      w.offers.push(o)
      w.activeOfferId = o.id
    }
    w.discover.status = 'done'
    w.events.unshift({ at: now(), text: `Chose the offer you're working on: ${activeOffer(w)?.name}.` })
  }, ['discover'])
  await clearOfferDrafts($)
  await go($, { view: 'discover', stage: 'done' })
}

async function makeActive($, id) {
  await mutate($, (w) => {
    const o = w.offers.find((x) => x.id === id)
    if (!o) return
    if (o.status === 'idea') o.status = 'confirmed'
    w.activeOfferId = id
  }, ['discover'])
  await setUi($, { notice: 'That offer is now the one your builders work from. Your other streams are still saved.' })
}

// ======================================================================
// shared facts: offers and positioning, with change tracking
// ======================================================================

async function confirmOfferEdits($) {
  const ui = await read($, uiA)
  const ids = await mutate($, (w) => {
    const o = activeOffer(w)
    if (!o) return []
    return applyOfferChange(w, o, offerFromDrafts(ui.drafts, o))
  }, ['offer', 'discover'])
  if (ids && ids.length) {
    const w = await read($, workA)
    const fields = [...new Set(ids.flatMap((id) => w.builders[id].review.fields))]
    await setUi($, { notice: `${changeMessage(fields, ids)} Want to review those? They're marked "Review suggested".` })
  } else {
    await setUi($, { notice: ids ? 'Saved. Nothing else depended on what you changed.' : null })
  }
  await clearOfferDrafts($)
  await setUi($, { confirm: null })
}

async function clearOfferDrafts($) {
  await update($, uiA, (u) => ({ ...u, drafts: Object.fromEntries(Object.entries(u.drafts).filter(([k]) => !k.startsWith('offer.'))) }))
}

async function setPositioning($, fields, origin) {
  const ids = await mutate($, (w) => {
    const prev = w.positioning || { rev: 0 }
    const next = { ...prev, ...fields }
    const changed = ['line', 'bioShort', 'bioLong'].filter((f) => String(prev[f] ?? '') !== String(next[f] ?? ''))
    if (!changed.length) return []
    next.rev = (prev.rev || 0) + 1
    next.history = [{ rev: prev.rev, at: now(), before: { line: prev.line, bioShort: prev.bioShort, bioLong: prev.bioLong } }, ...(prev.history || [])].slice(0, 20)
    w.positioning = next
    const hit = prev.rev ? flagReviews(w, 'positioning', changed, null, { positioningRev: next.rev }).filter((id) => id !== origin) : []
    for (const id of hit) {
      w.builders[id].review.before = Object.fromEntries(changed.map((f) => [f, prev[f]]))
      w.builders[id].review.after = Object.fromEntries(changed.map((f) => [f, next[f]]))
    }
    if (origin && w.builders[origin]) w.builders[origin].basedOn = basedOnNow(w)
    return hit
  }, ['brand'])
  if (ids && ids.length) {
    const w = await read($, workA)
    await setUi($, { notice: `${changeMessage(['line'], ids)} They're marked "Review suggested".` })
  }
}

// ======================================================================
// the builders 02 to 10
// ======================================================================

async function saveBuilderAnswer($, id, q) {
  const ui = await read($, uiA)
  const v = ui.drafts[`b.${id}.${q.id}`]
  if (v === undefined) return
  await mutate($, (w) => {
    const b = (w.builders[id] = w.builders[id] || { status: 'in_progress', answers: {} })
    b.answers = { ...(b.answers || {}), [q.id]: String(v).trim() }
    if (b.status === 'not_started' || !b.status) b.status = 'in_progress'
  }, [id])
}

async function quickOffer($) {
  const ui = await read($, uiA)
  const text = (ui.drafts['quickOffer'] || '').trim()
  if (!text) return
  await mutate($, (w) => {
    const o = { id: 'o1', rev: 1, status: 'draft', name: text, buyer: '', problem: '', createdAt: now(), history: [] }
    w.offers.push(o)
    w.activeOfferId = o.id
  }, [])
}

// What each builder's result is called in sentences.
const RESULT_NAME = { sales: 'first 10 customers plan', substack: 'Substack strategy' }
async function build($, id, place = `builder-${id}`, fresh = false) {
  if (id === 'substack') return startStrategy($, fresh)
  const w = await getWork($)
  const def = BY_ID[id]
  const answers = w.builders[id]?.answers || {}
  const short = RESULT_NAME[id] || def.title.replace('The ', '').replace(' Builder', '')
  const today = new Date(await $.clock.now()).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
  // A Substack strategy is written in four steps (v3, 11 Nov): this call chooses the publication and ten posts.
  const v3 = id === 'substack'
  const out = await ask($, v3 ? substackChoosePrompt(w, answers, METHODS, today) : builderPrompt(id, w, answers, METHODS, today), {
    label: v3 ? 'Choosing your ten posts' : `Building your ${RESULT_NAME[id] || def.title.replace('The ', '')}`,
    explain: v3 ? "Reading everything you've told Uncapped, then choosing your publication and ten posts. Each post's card is written next." : `Using your answers here and everything you've built so far to draft your ${short.toLowerCase()}.`,
    // First 10 thinks little and writes a lot: at the model's own effort it spent about 13,000 of 18,000 tokens thinking (3 minutes) and ran past its cap.
    steps: def.steps, builder: id, kind: id, name: 'build', target: id, args: { id }, maxTokens: id === 'sales' || id === 'substack' ? 24000 : 12000, ...(id === 'sales' ? { effort: 'low' } : id === 'substack' ? { effort: 'medium' } : {}), place, fresh,
  })
  if (!out) return
  await mutate($, (w2) => {
    const b = (w2.builders[id] = w2.builders[id] || { answers: {} })
    pushHistory(b, 'before rebuilding')
    b.output = id === 'substack' && out.publication ? { ...out, v: 3 } : out
    b.status = b.status === 'done' ? 'done' : 'in_progress'
    b.basedOn = basedOnNow(w2)
    b.review = null
    b.edited = {}
    b.updatedAt = now()
    if (id === 'offer') b.rev = (b.rev || 0) + 1
    if (id === 'offer' && b.rev > 1) {
      const hit = flagReviews(w2, 'packages', ['packages'], null, { packagesRev: b.rev })
      if (hit.length) w2.events.unshift({ at: now(), text: changeMessage(['packages'], hit) })
    }
    w2.events.unshift({ at: now(), text: `Built your ${def.title.replace('The ', '')}.` })
  }, [id])
  if (id === 'website') await writeSite($)
  await opResult($, {
    intro: v3 ? 'Your ten posts are chosen and saved.' : `Here's your ${short.toLowerCase()}. It's saved.`,
    lines: v3 ? ['Uncapped is now researching each post and writing its card. Each card appears in Posts as soon as it is written.'] : ['Read it through: anything you change by hand is kept, even when it is rebuilt later.'],
    next: [{ label: `Read your ${short.toLowerCase()}`, go: { view: 'builder', builder: id, stage: 'result' } }],
  })
  // v3: research, then each post's card, in the background (the chat isn't kept waiting). An older strategy keeps its briefs.
  if (id === 'substack') { if (isV3Strategy(out)) void runSubstackCards($); else await writeAllBriefs($, place) }
}

async function markDone($, id) {
  await mutate($, (w) => {
    if (id === 'discover') w.discover.status = 'done'
    else w.builders[id].status = w.builders[id].status === 'done' ? 'in_progress' : 'done'
  }, [id])
}

async function startEdit($, id, path, value, asks) {
  await setUi($, { editing: { builder: id, path, value: String(value ?? ''), asks } })
}

async function saveEdit($, scope) {
  const ui = await read($, uiA)
  const ed = ui.editing
  if (!ed) return
  const id = ed.builder
  await mutate($, (w) => {
    const b = w.builders[id]
    const old = getPath(b.output, ed.path)
    const val = typeof old === 'number' ? Number(ed.value.replace(/[^0-9.]/g, '')) || 0 : Array.isArray(old) ? ed.value.split('\n').map((s) => s.trim()).filter(Boolean) : ed.value
    pushHistory(b, 'before your edit')
    setPath(b.output, ed.path, val)
    b.edited = { ...(b.edited || {}), [ed.path]: true }
    b.updatedAt = now()
  }, [id])
  await setUi($, { editing: null })
  if (ed.asks === 'positioning' && scope === 'everywhere') {
    await setPositioning($, { line: ed.value.trim() }, id)
  }
}

async function chooseOption($, id, key, index) {
  await mutate($, (w) => {
    const b = w.builders[id]
    b.choices = { ...(b.choices || {}), [key]: index }
  }, [id])
  if (id === 'brand' && key === 'positioning') {
    const w = await read($, workA)
    const out = w.builders.brand.output
    await setPositioning($, { line: out.positioning[index]?.line || '', bioShort: out.bioShort, bioLong: out.bioLong }, 'brand')
  }
}

async function useBios($) {
  const w = await read($, workA)
  const out = w.builders.brand?.output
  if (!out) return
  const idx = w.builders.brand.choices?.positioning ?? 0
  await setPositioning($, { line: out.positioning[idx]?.line || '', bioShort: out.bioShort, bioLong: out.bioLong }, 'brand')
  await setUi($, { notice: 'Saved as your positioning. Other builders will use it.' })
}

async function restore($, id, i) {
  await mutate($, (w) => {
    const b = w.builders[id]
    const h = b.history?.[i]
    if (!h) return
    const current = b.output
    b.output = structuredClone(h.output)
    b.history.splice(i, 1)
    b.history.unshift({ at: now(), reason: 'before restoring an earlier version', output: current })
  }, [id])
  await setUi($, { notice: 'Restored that version. The one you replaced is in the list too.' })
}

// ---------- reviews ----------
async function previewRevision($, id, place = `review-${id}`, fresh = false) {
  const w = await getWork($)
  const b = w.builders[id]
  const out = await ask($, revisePrompt(id, w, b.review, METHODS), {
    label: `Drafting an update to your ${ASSET_NAME[id]}`,
    explain: 'Only the parts that used what changed are rewritten. Your own edits are left alone.',
    steps: ['Finding the parts that used what you changed', 'Rewriting only those parts', 'Leaving everything else, including your own edits, as it was'],
    builder: id, kind: 'revise', name: 'revise', target: id, args: { id }, maxTokens: 12000, place, fresh,
  })
  if (!out) return
  // Never touch a part the person edited themselves without saying so.
  const changes = changedPaths(b.output, out.output)
  const editedHits = changes.filter((p) => b.edited?.[p])
  await mutate($, (w2) => {
    w2.builders[id].review.proposal = { summary: out.summary, output: out.output, changes, editedHits, at: now() }
  }, [])
  await opResult($, { intro: `The suggested changes to your ${ASSET_NAME[id]} are just below.`, nextWhy: 'Nothing has changed yet: approve them, edit them first, or keep what you have.' })
}

async function approveRevision($, id) {
  await mutate($, (w) => {
    const b = w.builders[id]
    const p = b.review?.proposal
    if (!p) return
    pushHistory(b, 'before the approved update')
    b.output = p.output
    b.basedOn = basedOnNow(w)
    b.review = null
    b.updatedAt = now()
    w.events.unshift({ at: now(), text: `Updated your ${ASSET_NAME[id]} after a change you approved.` })
  }, [id])
  await setUi($, { notice: `Updated. The earlier version of your ${ASSET_NAME[id]} is saved under "Earlier versions".` })
}

async function deferReview($, id) {
  await mutate($, (w) => {
    const r = w.builders[id].review
    if (r) { r.state = 'deferred'; r.deferredAt = now() }
  }, [])
}

async function dismissReview($, id) {
  await mutate($, (w) => {
    const b = w.builders[id]
    b.review = { state: 'dismissed', at: now() }
    b.basedOn = basedOnNow(w)
  }, [])
}

// ---------- content, sales, operations, website ----------
async function contentFeedback($, i, place = `draft-${i}`, fresh = false) {
  const w = await getWork($)
  const ui = await read($, uiA)
  const idea = w.builders.content.output.ideas[i]
  const draft = ui.drafts[`draft.${i}`] ?? w.builders.content.drafts?.[i] ?? ''
  if (!draft.trim()) { await setUi($, { error: 'Write a few lines first, then I can give you feedback.' }); return }
  await mutate($, (w2) => { w2.builders.content.drafts = { ...(w2.builders.content.drafts || {}), [i]: draft } }, ['content'])
  const text = await ask($, feedbackPrompt(w, idea, draft, METHODS), { label: 'Reading your draft', explain: 'What works, and up to three specific suggestions. Your words stay yours: nothing is rewritten.', steps: [], builder: 'content', kind: 'feedback', name: 'feedback', target: String(i), args: { i }, raw: true, maxTokens: 1200, place, fresh })
  if (!text) return
  await mutate($, (w2) => { w2.builders.content.feedback = { ...(w2.builders.content.feedback || {}), [i]: text.trim() } }, ['content'])
  await opResult($, { intro: 'My feedback on your draft is just below.', nextWhy: 'Edit your draft if any of it helps, then save it.' })
}

async function saveDraft($, i) {
  const ui = await read($, uiA)
  await mutate($, (w) => { w.builders.content.drafts = { ...(w.builders.content.drafts || {}), [i]: ui.drafts[`draft.${i}`] ?? '' } }, ['content'])
  await setUi($, { notice: 'Draft saved.' })
}

async function setPersonStatus($, i, status) {
  await mutate($, (w) => { w.builders.sales.tracker = { ...(w.builders.sales.tracker || {}), [i]: status } }, ['sales'])
}

async function toggleCheck($, i) {
  await mutate($, (w) => {
    const t = (w.builders.operations.ticks = w.builders.operations.ticks || {})
    t[i] = !t[i]
  }, ['operations'])
}

async function writeSite($) {
  const w = await read($, workA)
  const out = w?.builders?.website?.output
  if (!out) return
  try {
    await $.fs.write(FILES.site, siteHtml(out, w))
  } catch (e) {}
}

async function previewSite($) {
  await writeSite($)
  await $.prompt.submit({ text: `Please open my starter website, ${FILES.site}, in the Browser pane so I can look at it.`, asUser: true })
}

async function talkItThrough($, id) {
  const def = BY_ID[id]
  // Desktop refuses a prompt that starts with "/", so the skill runs as a command.
  await $.command.run({ command: `${PLUGIN}:coach`, args: def.title })
}

// ======================================================================
// workspace, backups and updates
// ======================================================================

async function setUpHere($) {
  await createWorkspace($, VERSION)
  await loadInto($)
}

async function backup($) {
  const dir = await backupNow($, 'manual')
  await setUi($, { notice: `Backed up to ${dir}.` })
}

// Updates go through Claude Code's own plugin manager: the same command the
// docs give, which also refreshes Pivot School's release list first (tested
// 10 Nov: 0.3.0 to 0.3.1 in one step). Claude Desktop doesn't refresh that
// list by itself, and doesn't always tell a plugin where Claude Code is
// (CLAUDE_CODE_EXECPATH was missing on the 10 Nov clean-account test), so
// look for the copy Claude Desktop keeps in the person's Library too.
const MANUAL_UPDATE = "In Claude Desktop: + next to the message box, then Plugins, then Manage plugins. Click + Add, then Manage marketplaces. Next to pivot-school, click the three dots, then Check for updates, then Done. Then click Uncapped, then Update, and start a new chat in this folder."

async function claudeExe($) {
  const exe = await $.env.get('CLAUDE_CODE_EXECPATH')
  if (exe) return exe
  try {
    const r = await $.process.run(['/bin/sh', '-c', 'ls -t "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude 2>/dev/null | head -1'], { timeoutMs: 10000 })
    const found = String(r.stdout || '').trim()
    if (r.exitCode === 0 && found) return found
  } catch (e) {}
  return null
}

async function checkForUpdates($) {
  await setUi($, { update: { state: 'checking', text: 'Checking for a newer version of Uncapped...' } })
  const exe = await claudeExe($)
  if (!exe) {
    await setUi($, { update: { state: 'manual', text: `Uncapped can't run the update from here. ${MANUAL_UPDATE}` } })
    return
  }
  const { id, scopes } = await installsToUpdate($, exe)
  await backupNow($, 'before-update')
  try {
    const outs = []
    for (const scope of scopes.length ? scopes : [null]) {
      const r = await $.process.run([exe, 'plugin', 'update', id, ...(scope ? ['--scope', scope] : [])], { timeoutMs: 120000 })
      outs.push({ code: r.exitCode, out: `${r.stdout || ''}\n${r.stderr || ''}`.trim() })
    }
    const all = outs.map((o) => o.out).join('\n')
    const failed = outs.filter((o) => o.code !== 0 && !/already at the latest/i.test(o.out))
    const to = (all.match(/updated from \S+ to (\d[\w.-]*)/i) || [])[1]
    if (/marketplace not refreshed|failed to refresh/i.test(all)) {
      await setUi($, { update: { state: 'failed', text: "Uncapped couldn't reach Pivot School's list of versions just now, so nothing changed. Check your internet connection and try again." } })
    } else if (failed.length) {
      await setUi($, { update: { state: 'failed', text: `The update didn't go through, so nothing changed. Your work is safe. ${MANUAL_UPDATE}` } })
    } else if (to) {
      await setUi($, { latest: null, update: { state: 'updated', text: `Uncapped is updated to ${to}. Start a new chat in this folder to use it. Your work is untouched, and it's backed up.` } })
    } else {
      await setUi($, { latest: null, update: { state: 'current', text: `You're on the latest version (${VERSION}).` } })
    }
  } catch (e) {
    await setUi($, { update: { state: 'failed', text: `The update didn't go through (${String(e?.message || e).slice(0, 200)}). Nothing changed. ${MANUAL_UPDATE}` } })
  }
}

// The published version of Uncapped, read from the plugin's own manifest in
// Pivot School's public repository. Read once a session so the bar above the
// message box can say when a newer Uncapped is ready; nothing about the person
// is sent. Only for the customer install, never a preview or test copy.
// GitHub Pages will not serve a folder beginning with a dot, so this reads the
// file from the repository itself.
const RELEASES = 'https://raw.githubusercontent.com/thegabrielaflax/uncapped/main/plugins/uncapped/.claude-plugin/plugin.json'

function isNewer(a, b) {
  const parts = (v) => String(v || '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0)
  const x = parts(a), y = parts(b)
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0)
  return false
}

async function noteLatest($) {
  if ((await pluginId($)) !== 'uncapped@pivot-school') return
  const r = await $.http.fetch(RELEASES)
  if (!r?.ok) return
  const v = JSON.parse(r.text || '{}')?.version
  if (typeof v === 'string' && isNewer(v, VERSION)) await setUi($, { latest: v })
}

// Every copy of Uncapped this folder can use, by the name Claude Code installed
// it under (uncapped@pivot-school for a customer): the one for the whole
// computer ("Add to this computer") and the folder's own. An update with no
// scope reaches only the folder's copy; on the 10 Nov test the panel ran the
// computer's copy, so each one is updated by name.
async function installsToUpdate($, exe) {
  let list = []
  try {
    const r = await $.process.run([exe, 'plugin', 'list', '--json'], { timeoutMs: 30000 })
    const parsed = JSON.parse(String(r.stdout || '[]'))
    if (Array.isArray(parsed)) list = parsed
  } catch (e) {}
  const trim = (p) => String(p || '').replace(/\/+$/, '')
  const cwd = trim((await read($, uiA))?.cwd)
  const mine = list.filter((p) => String(p?.id || '').startsWith(`${PLUGIN}@`))
  const usable = mine.filter((p) => p.scope === 'user' || ((p.scope === 'project' || p.scope === 'local') && cwd && trim(p.projectPath) === cwd))
  const cached = /plugins\/cache\/[^/]+\/[^/]+\//.test(String($.plugin.root)) ? await pluginId($) : null
  const id = cached || (usable.find((p) => p.enabled !== false) || usable[0] || mine.find((p) => p.enabled !== false) || mine[0])?.id || (await pluginId($))
  const scopes = [...new Set(usable.filter((p) => p.id === id).map((p) => p.scope))]
  return { id: String(id), scopes }
}

async function pluginId($) {
  // Installed copies live in ~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/
  const m = String($.plugin.root).match(/plugins\/cache\/([^/]+)\/([^/]+)\//)
  if (m) return `${m[2]}@${m[1]}`
  const m2 = String($.plugin.root).match(/plugins\/marketplaces\/([^/]+)\//)
  if (m2) return `${PLUGIN}@${m2[1]}`
  return `${PLUGIN}@pivot-school`
}

// ======================================================================
// drawing
// ======================================================================
// Every screen gets `c`: { $, E, ui, work, nav, px }. px is the width the
// pane gives us in CSS pixels, so artwork is laid out to fit and never
// forces sideways scrolling.

const T = (E, text, props = {}) => <E.Text color={C.ink} wrap="wrap" {...props}>{String(text ?? '')}</E.Text>
const Small = (E, text, props = {}) => <E.Text size="footnote" color={C.taupeInk} wrap="wrap" {...props}>{String(text ?? '')}</E.Text>
const Label = (E, text, color = C.taupeInk) => <E.Text size="caption" weight="bold" color={color}>{String(text).toUpperCase()}</E.Text>
const Head = (E, text, size = 'heading') => <E.Text size={size} weight="semibold" color={C.espresso} wrap="wrap">{String(text ?? '')}</E.Text>
const Margin = (E, text) => <E.Text italic color={C.blue} wrap="wrap">{String(text ?? '')}</E.Text>

// Drawings carry their own width and height in the markup and get no width
// props: Desktop then draws each at its own size, never wider than the space
// it sits in. A fixed width prop could be wider than the panel's column and
// push every card past the panel's right edge.
function Art(E, source, alt) {
  if (!E.Svg) return null
  return <E.Svg source={source} alt={alt} />
}

function Title(c, text, size = 28, opts = {}) {
  if (!c.E.Svg) return Head(c.E, text, 'title')
  return Art(c.E, serifTitleSvg(text, { px: c.px, fonts: FONTS, size }), text)
}

function Note(c, text) {
  if (!c.E.Svg) return Margin(c.E, text)
  return Art(c.E, noteSvg(text, { px: Math.min(c.px, 520), fonts: FONTS }), text)
}

// What Claude Desktop draws, from the Design check. A false here switches to
// the fallback the hub design system names; nothing else depends on it.
const DESKTOP = { highlight: true, hover: true, spine: true }

// Every card names a tone, and the tone sets its color, border and hover.
// Every color has one job (hub design system 5.2): butter is the next move,
// pink a decision, blue Claude working, green done, sand saved to read,
// white one item of many, cream dashed an open invitation.
const TONE = {
  next: { bg: C.butterTint, border: C.espresso, hover: C.hoverButter },
  decide: { bg: C.pinkTint, border: C.espresso },
  working: { bg: C.blueTint, border: C.blue },
  done: { bg: V.doneBg, border: V.doneBorder },
  summary: { bg: V.surface, border: V.line },
  item: { bg: V.surface, border: V.line, hover: V.hover },
  invite: { bg: V.bg, border: V.disabled, dashed: true },
  plain: { bg: V.surface, border: V.line },
  inset: { bg: V.inset, border: V.inset },
}
// Older call sites pass a tint; read it as the tone it stood for.
function toneOf(o) {
  if (o.tone) return o.tone
  if (o.dashed) return 'invite'
  return { [C.butterTint]: 'next', [C.pinkTint]: 'decide', [C.blueTint]: 'working', [C.greenTint]: 'done', [C.sand]: 'summary', [C.cream]: 'invite' }[o.tint] || 'plain'
}
function Card(E, children, opts = {}) {
  const t = TONE[toneOf(opts)] || TONE.plain
  // Hover needs a keyed Box: it's the card's own hover scope.
  const hover = DESKTOP.hover && opts.key && t.hover ? { backgroundColor: t.hover, ...(t.hoverBorder ? { borderColor: t.hoverBorder } : {}) } : undefined
  return (
    <E.Box key={opts.key} flexDirection="column" gap={S.tight} paddingX={2} paddingY={1} borderStyle={t.dashed ? 'dashed' : 'round'} borderColor={opts.border || t.border} backgroundColor={t.bg} hover={hover}>
      {children}
    </E.Box>
  )
}

function Row(E, children) {
  return <E.Box flexDirection="row" flexWrap="wrap" gap={1}>{children}</E.Box>
}

// Every press hands its work off and returns at once. Desktop gives a press
// 10 seconds; a request to Claude takes longer, and a press that runs past
// that is dropped (seen on 4 Nov: the work never finished, so people pressed
// again). The work carries on, and shows its progress and result in place.
function later(fn) {
  return () => { Promise.resolve().then(fn).catch(() => {}) }
}

// Buttons (8.1): primary (one per screen, in the Next move), secondary, or
// plain for navigation. kind: true or 'primary', 'plain', else secondary.
function Btn(E, key, label, onPress, kind, opts = {}) {
  // Every press is a visible button (11 Nov): plain text-only buttons read as text in Desktop.
  const v = kind === true || kind === 'primary' ? { variant: 'primary' } : { variant: 'secondary' }
  return <E.Button key={key} label={label} onPress={later(onPress)} {...v} {...opts} />
}

// A few words on the highlighter (6.1), or semibold where Desktop can't draw it.
function Hl(E, key, text, color = C.butter) {
  return DESKTOP.highlight ? <E.Text key={key} backgroundColor={color}>{String(text)}</E.Text> : <E.Text key={key} weight="semibold">{String(text)}</E.Text>
}

// A section title inside the content (6.1).
const SectionTitle = (E, key, text) => <E.Text key={key} size="heading" weight="semibold" color={C.espresso} wrap="wrap">{String(text)}</E.Text>

// The one Next move card per screen (8.3): label, the action as a title, why in
// a sentence or two, then the primary button and at most one more.
function NextMove(E, key, { label = 'Your next move', title, body, actions = [], extra = [], foot, tone }) {
  return U2.NextCard(E, key, { label, title, body, actions, extra, foot, tone })
  return Card(E, [
    <E.Text key={`${key}-l`} size="caption" weight="bold" color={C.blue}>{String(label).toUpperCase()}</E.Text>,
    title ? <E.Text key={`${key}-t`} size="heading" weight="semibold" color={C.espresso} wrap="wrap">{title}</E.Text> : null,
    body ? <E.Text key={`${key}-b`} color={C.ink} wrap="wrap">{String(body)}</E.Text> : null,
    ...extra,
    actions.length ? Row(E, actions) : null,
  ].filter(Boolean), { key, tone: 'next' })
}

// An item card (8.11): white, a hairline border, hover, and a spine in its color.
function ItemCard(E, key, spine, children) {
  const hover = DESKTOP.hover ? { backgroundColor: V.hover } : undefined
  if (!DESKTOP.spine || !spine) {
    return <E.Box key={key} flexDirection="column" gap={S.tight} paddingX={2} paddingY={1} borderStyle="round" borderColor={spine && !DESKTOP.spine ? spine : C.line} backgroundColor={C.white} hover={hover}>{children}</E.Box>
  }
  return (
    <E.Box key={key} flexDirection="row" borderStyle="round" borderColor={C.line} backgroundColor={C.white} hover={hover}>
      <E.Box width={1} flexShrink={0} backgroundColor={spine} />
      <E.Box flexDirection="column" gap={S.tight} paddingX={2} paddingY={1} flexGrow={1} flexShrink={1}>{children}</E.Box>
    </E.Box>
  )
}

// A message to copy (8.14): the whole message, then Copy message.
function CopyBlock($, E, key, label, text, note = 'Uncapped never sends anything.') {
  return (
    <E.Box key={key} flexDirection="column" gap={S.tight}>
      <E.Text key={`${key}-l`} size="caption" weight="bold" color={C.blue}>{String(label).toUpperCase()}</E.Text>
      <E.Box key={`${key}-box`} flexDirection="column" paddingX={2} paddingY={1} backgroundColor={V.inset}><E.Text key={`${key}-m`} color={V.body} wrap="wrap">{String(text)}</E.Text></E.Box>
      <E.Box key={`${key}-r`} flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
        {Btn(E, `${key}-copy`, 'Copy message', () => copyText($, text, 'Copied. Paste it into your own messages.'))}
        <E.Text key={`${key}-n`} size="footnote" color={C.taupeInk}>{note}</E.Text>
      </E.Box>
    </E.Box>
  )
}

// Key facts (8.9): label above value; two columns when wide, at most six.
function KeyFacts(E, key, pairs, wide) {
  const facts = pairs.filter(([, v]) => v).slice(0, 6)
  if (!facts.length) return null
  return (
    <E.Box key={key} flexDirection={wide ? 'row' : 'column'} flexWrap="wrap" columnGap={2} rowGap={1} paddingX={2} paddingY={1} backgroundColor={V.inset}>
      {facts.map(([l, v], i) => (
        <E.Box key={`${key}-${i}`} flexDirection="column" gap={S.none} width={wide && facts.length > 1 ? '47%' : undefined}>
          <E.Text size="caption" weight="bold" color={C.taupeInk}>{String(l).toUpperCase()}</E.Text>
          <E.Text color={C.ink} wrap="wrap">{String(v)}</E.Text>
        </E.Box>
      ))}
    </E.Box>
  )
}

// Tabs (8.10): the selected one is secondary with a dot, the rest plain.
function Tabs(E, key, tabs, cur, onPick) {
  return (
    <E.Box key={key} flexDirection="row" flexWrap="wrap" gap={1}>
      {tabs.map((t) => (t.id === cur
        ? <E.Button key={`${key}-${t.id}`} variant="secondary" label={`${t.label}${t.count != null ? ` · ${t.count}` : ''}`} onPress={later(() => onPick(t.id))} />
        : <E.Button key={`${key}-${t.id}`} variant="secondary" dimColor label={`${t.label}${t.count != null ? ` · ${t.count}` : ''}`} onPress={later(() => onPick(t.id))} />))}
    </E.Box>
  )
}

// A choice row (8.12), in place of a drop-down for five options or fewer.
function ChoiceRow(E, key, label, options, cur, onPick) {
  return (
    <E.Box key={key} flexDirection="column" gap={S.none}>
      <E.Text size="caption" weight="bold" color={C.taupeInk}>{String(label).toUpperCase()}</E.Text>
      <E.Box flexDirection="row" flexWrap="wrap" gap={1}>
        {options.map((o, i) => (o === cur
          ? <E.Button key={`${key}-${i}`} variant="secondary" label={`✓ ${o}`} onPress={later(() => onPick(o))} />
          : <E.Button key={`${key}-${i}`} variant="secondary" label={o} onPress={later(() => onPick(o))} />))}
      </E.Box>
    </E.Box>
  )
}

// A status stepper (8.12): the stops so far filled, one button to move on.
function StatusStepper(E, key, stops, at, next) {
  return (
    <E.Box key={key} flexDirection="column" gap={S.tight}>
      <E.Text key={`${key}-line`} color={C.ink} wrap="wrap">{stops.map((s, i) => `${i <= at ? '●' : '○'} ${s}`).join('  ─  ')}</E.Text>
      {next ? Row(E, next) : null}
    </E.Box>
  )
}

// A back link (8.15), at the top of a sub-page.
const BackLink = (E, key, label, fn) => Btn(E, key, `← ${label}`, fn, 'plain')

function statusLabel(s) {
  return s === 'done' ? 'Done' : s === 'in_progress' ? 'In progress' : 'Not started'
}

function savedWhen(work) {
  if (!work?.updatedAt) return ''
  const d = new Date(work.updatedAt)
  // Today: just the time ("Saved 4:19 PM"); otherwise the date and time.
  return new Date().toDateString() === d.toDateString() ? d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' }) : d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' })
}

function Header($, c) {
  const { E, ui, work, nav } = c
  const when = savedWhen(work)
  if (!work || isWorkshop(work)) {
    return [
      <E.Box key="hdr-brand" flexDirection="row" flexWrap="wrap" alignItems="center" justifyContent="space-between" gap={1}>
        {E.Svg ? Art(E, wordmarkSvg({ fonts: FONTS, size: 24, color: V.wordmark }), 'Uncapped') : <E.Text weight="bold" italic color={V.wordmark}>Uncapped</E.Text>}
        {ui.readOnly ? <E.Text size="footnote" weight="bold" color={V.heading}>Read-only</E.Text> : when ? (
          <E.Box key="hdr-saved" flexDirection="row" gap={1} alignItems="center">
            <E.Text key="hdr-dot" size="footnote" color={V.doneBorder}>●</E.Text>
            <E.Text key="hdr-when" size="footnote" color={V.meta}>{`Saved ${when.replace(/\b(AM|PM)\b/, (m) => m.toLowerCase())}`}</E.Text>
          </E.Box>
        ) : null}
      </E.Box>,
    ]
  }
  // Tabs are plain buttons: the current one is bold espresso with a blue
  // underline, so the one blue main action on each screen stays the only blue.
  const tab = (key, label, view, extra = {}, onPress) => {
    const on = nav.view === view || (view === 'discover' && nav.view === 'builder' && nav.builder === 'discover')
    return (
      on
        ? <E.Button key={key} label={label} variant="secondary" onPress={later(onPress || (() => go($, { view, ...extra })))} />
        : <E.Button key={key} label={label} variant="secondary" onPress={later(onPress || (() => go($, { view, ...extra })))} />
    )
  }
  const brand = (
    <E.Box key="hdr-brand" flexDirection="row" flexWrap="wrap" alignItems="center" justifyContent="space-between" gap={1}>
      <E.Box flexDirection="row" flexWrap="wrap" alignItems="flex-end" gap={1}>
        {E.Svg ? Art(E, wordmarkSvg({ fonts: FONTS, size: c.px < 360 ? 26 : 30 }), 'Uncapped') : <E.Text weight="bold" italic color={C.blue}>Uncapped</E.Text>}
        {E.Svg ? Art(E, pivotSvg({ pivot: PIVOT, height: 19 }), 'by Pivot School') : <E.Text color={C.espresso}>by Pivot School</E.Text>}
      </E.Box>
      {ui.readOnly ? <E.Text size="footnote" weight="bold" color={C.espresso}>Read-only</E.Text> : when ? (isWorkshop(work) ? Chip(E, 'hdr-saved', `Saved ${when}`, 'next') : <E.Text size="footnote" color={BODY}>{`Saved ${when}`}</E.Text>) : null}
    </E.Box>
  )
  const mkRule = (key) => (E.Svg ? <E.Svg key={key} source={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${c.px} 6" width="${c.px}" height="6"><rect y="2" width="${c.px}" height="2" fill="${C.espresso}"/></svg>`} alt="divider" /> : null)
  const tabs = work && ui.ws === 'ready' && work.onboarding?.seen && !isWorkshop(work)
    ? (
      <E.Box key="hdr-tabs" flexDirection="row" flexWrap="wrap" columnGap={2} rowGap={0}>
        {[tab('nav-home', 'Home', 'home'), tab('nav-discover', 'Discover', 'discover', { stage: 'overview' }), tab('nav-tests', 'Experiments', 'tests'), tab('nav-profile', 'Saved info', 'profile'), tab('nav-help', 'How it works', 'tour', { step: 1 }), tab('nav-settings', 'Updates', 'settings'), tab('nav-feedback', 'Feedback or help', 'feedback', {}, () => openFeedback($))]}
      </E.Box>
    )
    : null
  return [brand, mkRule('hdr-rule'), tabs, tabs ? mkRule('hdr-rule2') : null]
}

function Banners($, c) {
  const { E, ui } = c
  const out = []
  // A request started somewhere not on this screen (the chat, or a screen the
  // person left) gets a slim line here with a way back to it.
  const op = ui.op
  if (op && !c.places?.has(op.place) && (op.status === 'running' || !op.seen)) {
    const from = op.place === 'chat' ? 'asked in the chat' : 'on another screen'
    const lines = op.status === 'running'
      ? [T(E, `${op.label}: still working (${from}).`, { weight: 'semibold' }), Small(E, elapsedText(op))]
      : op.status === 'done'
        ? [T(E, `${op.label}: done (${from}).`, { weight: 'semibold' })]
        : [T(E, `${op.label}: didn't finish (${from}).`, { weight: 'semibold' }), Small(E, op.error || '')]
    const acts = [
      op.nav && op.place !== 'chat' ? Btn(E, 'op-goto', op.status === 'running' ? 'Show me' : 'Go there', () => go($, op.nav)) : null,
      op.status === 'running' ? Btn(E, 'stop', 'Stop', () => stopAsking($)) : Btn(E, 'op-seen', 'OK', () => opResult($, { seen: true })),
    ]
    out.push(Card(E, [...lines, Row(E, acts)], { tone: 'working' }))
  }
  if (ui.error) out.push(Card(E, [Label(E, "Couldn't do that", C.espresso), T(E, ui.error), Row(E, [Btn(E, 'dismiss-err', 'OK', () => setUi($, { error: null })), Btn(E, 'report-err', 'Tell Gabriela about this', () => openFeedback($, 'broken'))])], { tone: 'decide' }))
  if (ui.notice) out.push(Card(E, [T(E, ui.notice, { weight: 'medium' }), Row(E, [Btn(E, 'dismiss-note', 'Got it', () => setUi($, { notice: null }))])], { tone: 'done' }))
  return out
}

function curOf(work) {
  return work?.profile?.limits?.currency || '$'
}

function lowerFirst(t) {
  const x = String(t || '')
  if (/^(I|I'm|I've|Gabriela)\b/.test(x)) return x
  return /^[A-Z]([a-z]|\s)/.test(x) ? x[0].toLowerCase() + x.slice(1) : x
}

// Names in a sentence: "James, the other trainers at his gym and your friends".
// Only a leading "The", "A" or "Your" is lowered, so a person's name keeps its capital.
const inSentence = (n) => String(n || '').replace(/^(The|A|An|Your|Other|Some)\b/, (w) => w.toLowerCase())
function nameList(names) {
  const xs = (names || []).filter(Boolean).map((n, i) => i ? inSentence(n) : String(n))
  return xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : (xs[0] || '')
}

// A short name for a direction: its own short title if it has one, else the
// part of the full title before who it's for.
function shortTitle(d) {
  if (d?.short) return d.short
  let t = String(d?.title || '').split(/ for | to help | aimed at |: |, /)[0].trim()
  if (t.length > 52) t = t.slice(0, 52).replace(/\s+\S*$/, '') + '…'
  return t ? t[0].toUpperCase() + t.slice(1) : 'A direction'
}

// Where you are: "Discover → Portfolio garden → Band 8a interview prep". Every
// step but the last goes back there.
function Crumbs($, c, items) {
  const { E } = c
  return (
    <E.Box key="crumbs" flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
      {items.flatMap((it, i) => [
        i ? <E.Text key={`cr-sep-${i}`} color={C.taupeInk}>{'→'}</E.Text> : null,
        it.go ? <E.Button key={`crumb-${i}`} variant="secondary" label={it.label} onPress={later(() => go($, it.go))} /> : <E.Text key={`cr-${i}`} weight="semibold" color={C.espresso} wrap="wrap">{it.label}</E.Text>,
      ]).filter(Boolean)}
    </E.Box>
  )
}

function elapsedText(op) {
  const n = op.elapsed || 0
  const took = n < 60 ? `${n} seconds` : `${Math.floor(n / 60)} min ${String(n % 60).padStart(2, '0')} s`
  if (!op.typical) return `Working for ${took}. This can take a minute or two.`
  const typ = op.typical < 60 ? `about ${op.typical} seconds` : `about ${Math.round(op.typical / 30) / 2} minutes`
  if (n > op.typical * 1.6 + 20) return `Working for ${took}. That's longer than usual (${typ}), but it's still going. Stopping is safe: your answers are saved.`
  return `Working for ${took}. This usually takes ${typ}.`
}

// While the portfolio garden grows, from the panel or the chat: a little
// planting stop-motion, so it's plain that something is happening.
const gardenGrowing = (ui) => ui?.op?.status === 'running' && ui.op.name === 'early'
function GardenGrowing($, c, key) {
  const { E, ui } = c
  const op = ui.op || {}
  c.places?.add(op.place)
  return Card(E, [
    ArtOf(E, `${key}-art`, plantingSvg({ px: Math.min(c.px - 40, 560), fonts: FONTS, frame: ui.plantFrame || 0 })),
    <E.Text key={`${key}-t`} size="heading" weight="semibold" color={C.espresso} wrap="wrap">Planting your portfolio garden</E.Text>,
    T(E, "This takes up to 6 minutes. When it's ready, your ideas open right here."),
    Small(E, elapsedText(op), { color: C.ink }),
    Row(E, [Btn(E, `${key}-stop`, 'Stop', () => stopAsking($), 'plain')]),
  ], { tone: 'working', key })
}

// A plan being written: it's in motion, and here's what's coming.
function PlanComing($, c, key) {
  const { E, ui } = c
  const op = ui.op || {}
  const ss = op.target === 'substack'
  const posts = op.name === 'briefs'
  const pr = op.progress || {}
  return (
    <E.Box key={key} flexDirection="row" borderStyle="round" borderColor={G.marigold} backgroundColor={G.paleYellow}>
      <E.Box width={1} flexShrink={0} backgroundColor={G.marigold} />
      <E.Box flexDirection="column" gap={S.tight} paddingX={2} paddingY={1} flexGrow={1} flexShrink={1}>
        {ArtOf(E, `${key}-art`, celebrateSvg({ px: Math.min(c.px - 60, 480), fonts: FONTS, line: "it's on its way!" }))}
        <E.Text size="heading" weight="semibold" color={G.ink} wrap="wrap">{posts ? 'Your Substack strategy is nearly ready' : ss ? 'Your Substack strategy is being written' : 'Your First 10 plan is being written'}</E.Text>
        {posts ? <E.Text color={G.ink} wrap="wrap">{`Your plan is written. Now each post is getting its full brief: the idea, where to open, the story beat by beat and where to land it. ${pr.total ? `${pr.done || 0} of ${pr.total} posts ready.` : ''}`}</E.Text> : null}
        {posts ? null : <E.Text color={G.ink} wrap="wrap">{ss ? "Claude is writing it now from your answers: what to publish first, ten posts in order, your first Note and how to reach your first readers. It appears right here the moment it's ready." : "Claude is writing it now: who to message first, your list of ten and what to ask on your calls. It appears right here the moment it's ready."}</E.Text>}
        <E.Text size="footnote" color={G.gray} wrap="wrap">{elapsedText(op)}</E.Text>
        <E.Box flexDirection="row">{Btn(E, `${key}-stop`, 'Stop', () => stopAsking($), 'plain')}</E.Box>
      </E.Box>
    </E.Box>
  )
}

// Progress, result or error, drawn exactly where the person pressed.
// `opts.idle` is what the place shows when nothing is happening there; while
// a request runs it's replaced, so its buttons can't be pressed twice.
function OpSlot($, c, place, idle = []) {
  const { E, ui } = c
  c.places?.add(place)
  const op = ui.op?.place === place ? ui.op : null
  const note = ui.opNote?.place === place ? ui.opNote : null
  const out = []
  if (op?.status === 'running' && op.name === 'early') return [GardenGrowing($, c, `op-${place}`)]
  if (op?.status === 'running' && ((op.name === 'build' && (op.target === 'substack' || op.target === 'sales')) || op.name === 'briefs')) return [PlanComing($, c, `op-${place}`)]
  if (op?.status === 'running') {
    out.push(Card(E, [
      <E.Box key={`opw-${place}`} flexDirection="row" gap={1} alignItems="center">
        <E.Text color={C.blue} weight="bold">{'\u2733'}</E.Text>
        <E.Text weight="semibold" color={C.espresso} wrap="wrap">{`${op.label}…`}</E.Text>
      </E.Box>,
      op.explain ? T(E, op.explain) : null,
      ...(op.steps || []).map((x, i) => <E.Text key={`ops-${place}-${i}`} color={C.ink} wrap="wrap">{`·  ${x}`}</E.Text>),
      T(E, elapsedText(op), { color: C.ink }),
      Small(E, 'Claude sends its answer all at once, so there is no percentage to show. Everything you have answered is already saved.'),
      Row(E, [Btn(E, `stop-${place}`, 'Stop', () => stopAsking($))]),
    ], { tone: 'working', key: `op-${place}` }))
    return out
  }
  if (note) {
    out.push(Card(E, [
      T(E, note.text, { weight: 'medium' }),
      Row(E, [
        Btn(E, `note-ok-${place}`, 'OK', () => setUi($, { opNote: null })),
        note.state === 'done' && CAN_RERUN.includes(note.name) ? Btn(E, `fresh-${place}`, 'Make a fresh version anyway', () => rerun($, note.name, note.args, place, true)) : null,
      ]),
    ], { tone: 'done', key: `op-${place}` }))
  }
  if (op && op.status === 'done' && !op.seen) {
    out.push(Card(E, [
      op.intro ? <E.Text key={`opi-${place}`} weight="semibold" color={C.espresso} wrap="wrap">{op.intro}</E.Text> : T(E, `${op.label}: done.`, { weight: 'semibold' }),
      ...(op.lines || []).map((x, i) => <E.Text key={`opl-${place}-${i}`} color={C.ink} wrap="wrap">{x}</E.Text>),
      op.nextWhy ? Small(E, op.nextWhy, { color: C.ink }) : null,
      Row(E, [
        ...(op.next || []).map((n, i) => Btn(E, `opn-${place}-${i}`, n.label, () => go($, n.go), i === 0)),
        Btn(E, `op-seen-${place}`, (op.next || []).length ? 'Not now' : 'OK', () => opResult($, { seen: true })),
      ]),
    ], { tone: 'done', key: `op-${place}` }))
  }
  if (op && ['failed', 'stopped', 'save-failed'].includes(op.status) && !op.seen) {
    // One clear way forward; the original button is hidden meanwhile.
    const saveFailed = op.status === 'save-failed'
    const tokens = (op.calls || []).map((k) => `${k.role}: ${k.model}, ${k.usage ? `${k.usage.output_tokens} of ${k.maxTokens} reply tokens` : 'no reply'}${k.effort && k.effort !== 'default' ? `, effort ${k.effort}` : ''}`)
    out.push(Card(E, [
      Label(E, saveFailed ? 'Written, not saved' : op.status === 'stopped' ? 'Stopped' : "That didn't work", C.espresso),
      T(E, op.error || 'Something went wrong.', { color: C.ink }),
      T(E, saveFailed ? "The plan is kept here, and a copy is in my-work/support. Save again won't ask Claude again." : op.unchanged ? 'Nothing from this was saved, and your saved work is unchanged (checked in your folder just now).' : "Nothing from this was saved. Uncapped couldn't confirm the rest of your saved work, so check it before carrying on.", { color: C.ink }),
      Row(E, [
        saveFailed
          ? Btn(E, `save-again-${place}`, 'Save again', () => saveAgain($, place), true)
          : CAN_RERUN.includes(op.name) ? Btn(E, `retry-${place}`, 'Try again', () => rerun($, op.name, op.args, place, false), true) : null,
        Btn(E, `op-seen-${place}`, 'Not now', () => opResult($, { seen: true })),
        Btn(E, `report-${place}`, 'Report this problem', () => openFeedback($, 'broken')),
      ]),
      Disclosure($, c, `err-${place}`, 'Details for a report', 'what happened technically', [
        Small(E, `What happened: ${op.why || op.error || 'unknown'}`, { color: C.ink }),
        Small(E, `Request ${op.id}, attempt ${op.attempt || 1}, ${op.elapsed || 0} seconds.`, { color: C.ink }),
        ...tokens.map((t, n) => <E.Text key={`err-call-${place}-${n}`} size="footnote" color={C.ink} wrap="wrap">{`Call ${n + 1}, ${t}`}</E.Text>),
        (op.replies || []).length ? Small(E, `Claude's reply is kept on this computer only, in ${op.replies.join(', ')}. It isn't added to a report unless you choose to attach it.`, { color: C.ink }) : null,
      ]),
    ], { tone: 'decide', key: `op-${place}` }))
    return out
  }
  return [...out, ...(Array.isArray(idle) ? idle : [idle])]
}

function Footer(c) {
  const { E, ui, nav } = c
  if (nav.view !== 'settings') return null
  return (
    <E.Box key="footer" flexDirection="column" gap={0} marginTop={1}>
      {Small(E, ui.readOnly ? 'Read-only: nothing will be saved with this version.' : `Your work is saved in this folder, under my-work. Uncapped ${ui.version}.`, { color: BODY })}
      {Small(E, 'To come back: start a new chat in this folder (Code tab) and send "Open Uncapped". The panel opens beside the chat. In a chat that is already open, the Open Uncapped button above the message box, or /uncapped, opens it too.', { color: BODY })}
    </E.Box>
  )
}

// ---------- setup ----------
function SetupView($, c) {
  const { E, ui } = c
  return [
    Title(c, "Let's give your work a home", 28),
    T(E, "Uncapped saves everything in the folder this session is open in, so you can close Claude and pick up where you left off. This folder doesn't have any Uncapped work in it yet."),
    Card(E, [
      T(E, 'Usually you open the Uncapped folder from your download (Documents, then Uncapped). If you meant to use this folder, set it up here.'),
      Small(E, `This folder: ${ui.cwd || ''}`),
      Row(E, [Btn(E, 'setup-here', 'Use this folder for Uncapped', () => setUpHere($), true)]),
    ], { tint: C.butterTint }),
  ]
}

// ---------- onboarding ----------
const MAKES = ['A specific offer and buyer', 'Priced packages', 'Positioning and bio', 'A rewritten LinkedIn profile', 'Content ideas you write from', 'A Substack plan', 'A one-page website to launch', 'Your first buyers mapped', 'A client onboarding kit', 'A booking page and business basics']

function WelcomeView($, c) {
  const { E } = c
  return [
    E.Svg ? Art(E, polaroidSvg2(PHOTO, "hi, I'm Gabriela!", { px: c.px, fonts: FONTS }), 'Gabriela Flax, smiling, in a polaroid') : null,
    Title(c, "Let's find what you could get paid for.", 30, { highlight: true }),
    T(E, "Uncapped is my portfolio career method, built into Claude. It finds the skills and knowledge you could get paid for, from your work and your life, then helps you build the offer, price it and market it alongside your 9-to-5."),
    Card(E, [Label(E, 'What you can create', C.blue), ...MAKES.map((m, i) => <E.Text key={`mk-${i}`} color={C.ink}>{`·  ${m}`}</E.Text>)], { tint: C.cream }),
    Row(E, [Btn(E, 'tour', 'Take the 1-minute tour', () => go($, { view: 'tour', step: 1 }), true), Btn(E, 'skip-tour', 'Skip, start Discover', () => finishOnboarding($, 'discover'))]),
    Small(E, 'You can see the tour again any time from How it works. Something confusing or not working? Use Feedback or help to let Gabriela know.'),
  ]
}

const TOUR = [
  null,
  { title: 'Start with Discover', body: ["Discover is where I'd start with you in a session. It asks about your work, your life, what people come to you for and what you'd love to try. You don't need a business idea: most people start without one.", 'It grows a portfolio garden: several directions you could earn from, each with a buyer, a problem, a price to test and a first step. You compare what could earn soonest with what excites you most, then pick one to start with. The others stay saved.'] },
  { title: 'Ten builders, one system', body: ['Everything Discover learns feeds the other nine. Your offer becomes packages, your packages and positioning become your LinkedIn, your website and your outreach. You never type the same thing twice.'], map: true },
  { title: 'Go wherever you like', body: ["The builders aren't a fixed sequence. Update your LinkedIn, go back to your offer, then work on your website. Each builder shows what it's using from the others, and tells you if it needs something you haven't given it yet."] },
  { title: 'Change your mind safely', body: ["If you change who your offer is for, its price or what's included, Uncapped saves the old version and marks anything that described it, such as your LinkedIn or website, as Review suggested.", 'You preview each suggested update, then approve it, leave it for later or keep things as they are. Nothing changes without you, and earlier versions are always recoverable.'] },
  { title: 'Your work is yours', body: ['Everything is saved as files in your Uncapped folder, on your computer. Closing this panel or Claude never loses anything.', 'To come back: open Claude, click Code, start a new chat in your Uncapped folder and send "Open Uncapped". The panel opens beside the chat. Once a chat is open, the Open Uncapped button above the message box (or /uncapped) reopens it.', 'You can answer Discover here or in the chat. Both save to the same place.'] },
]

function TourView($, c) {
  const { E, nav } = c
  const step = Math.max(1, Math.min(TOUR.length - 1, nav.step || 1))
  const s = TOUR[step]
  const last = step === TOUR.length - 1
  return [
    Small(E, `${step} of ${TOUR.length - 1}   ${TOUR.slice(1).map((_, i) => (i + 1 === step ? '●' : '○')).join(' ')}`),
    Title(c, s.title, 28),
    ...s.body.map((b, i) => <E.Text key={`tb-${i}`} color={C.ink} wrap="wrap">{b}</E.Text>),
    s.map && E.Svg ? Art(E, builderMapSvg({ px: Math.min(c.px, 520) }), 'Discover feeds Offer and Brand, which feed LinkedIn, Content, Substack and Website, then Sales, then Delivery and Operations.') : null,
    Row(E, [
      step > 1 ? Btn(E, 'tour-back', 'Back', () => go($, { view: 'tour', step: step - 1 })) : null,
      last ? Btn(E, 'tour-done', 'Start Discover', () => finishOnboarding($, 'discover'), true) : Btn(E, 'tour-next', 'Next', () => go($, { view: 'tour', step: step + 1 }), true),
      Btn(E, 'tour-skip', last ? 'Go to my home screen' : 'Skip the tour', () => finishOnboarding($, 'home')),
    ].filter(Boolean)),
  ]
}

async function finishOnboarding($, where) {
  await mutate($, (w) => { w.onboarding = { ...(w.onboarding || {}), seen: true, tourDone: true } }, [])
  if (where === 'discover') await go($, { view: 'discover', stage: 'overview' })
  else await go($, { view: 'home' })
}

// ---------- home ----------
function ReviewSummary($, c) {
  const { E, work } = c
  const flagged = Object.entries(work.builders || {}).filter(([, b]) => b?.review?.state === 'suggested')
  if (!flagged.length) return null
  const ids = flagged.map(([id]) => id)
  const fields = [...new Set(flagged.flatMap(([, b]) => b.review.fields || []))]
  return Card(E, [
    Label(E, 'Review suggested', C.espresso),
    T(E, `${changeMessage(fields, ids)} Want to review ${ids.length === 1 ? 'it' : 'those'}?`, { weight: 'medium' }),
    Row(E, ids.map((id) => Btn(E, `rev-${id}`, `Review ${ASSET_NAME[id]}`, () => go($, { view: 'builder', builder: id, stage: 'result' })))),
    Small(E, 'Nothing changes until you approve it. You can leave these for later.'),
  ], { tint: C.butterTint })
}

function ResumeCard($, c) {
  const { E, work } = c
  const p = discoverProgress(work)
  if (work.discover?.status !== 'done') {
    const nextT = THEMES.find((t) => t.id === p.next)
    const started = p.done > 0
    return Card(E, [
      Label(E, started ? 'Pick up where you left off' : 'Start here', C.blue),
      Head(E, started ? `Discover: ${p.done} of ${p.total} themes saved` : 'Discover: find what you could get paid for'),
      p.hasDirections ? T(E, 'Your portfolio garden is ready to explore.') : nextT ? T(E, `Next: ${nextT.label.toLowerCase()}.`) : p.ready ? T(E, p.provisional ? 'Your first directions are next.' : 'You have given me plenty. Your portfolio garden is next.') : T(E, 'A couple of follow-ups would sharpen your directions.'),
      Row(E, [
        p.hasDirections ? Btn(E, 'resume-garden', 'See my portfolio garden', () => go($, { view: 'discover', stage: 'garden' }), true) : Btn(E, 'resume-chat', started ? 'Carry on in the chat' : 'Start in the chat', () => continueInChat($), true),
        p.hasDirections ? null : Btn(E, 'resume-here', 'Answer here instead', () => answerNext($)),
        started ? Btn(E, 'resume-saved', "See what's saved", () => go($, { view: 'discover', stage: 'overview' })) : null,
      ].filter(Boolean)),
    ], { tint: C.blueTint, border: C.blue })
  }
  const next = BUILDERS.find((b) => builderStatus(work, b.id) === 'in_progress') || BUILDERS.find((b) => builderStatus(work, b.id) === 'not_started')
  if (!next) return Card(E, [Head(E, 'All ten builders done.'), T(E, 'Come back whenever something changes: update your offer and Uncapped will show you what else needs a look.')], { tint: C.blueTint })
  const doing = builderStatus(work, next.id) === 'in_progress'
  return Card(E, [
    Label(E, doing ? 'Carry on' : 'Suggested next', C.blue),
    Head(E, `${next.num}  ${next.title}`),
    T(E, next.short),
    Row(E, [Btn(E, 'next-up', doing ? 'Carry on' : 'Start', () => openBuilder($, next.id), true)]),
    Small(E, "Or open any builder below. You don't have to go in order."),
  ], { tint: C.blueTint, border: C.blue })
}

function HomeView($, c) {
  const { E, work } = c
  const done = BUILDERS.filter((b) => builderStatus(work, b.id) === 'done').length
  const started = BUILDERS.filter((b) => builderStatus(work, b.id) !== 'not_started').length
  const offer = activeOffer(work)
  const cur = work.profile?.limits?.currency || '$'
  const first = (work.profile?.name || '').split(' ')[0]
  const items = [
    Title(c, first ? `Welcome back, ${first}.` : 'Welcome to Uncapped.', 28),
    ...RepairNotice($, c),
    ResumeCard($, c),
    work.signpost ? SignpostCard($, c, work.signpost) : null,
    (work.experiments || []).length ? Card(E, [Label(E, 'Your tests', C.blue), ...(work.experiments || []).slice(0, 3).map((x, i) => <E.Text key={`ht-${i}`} color={C.ink} wrap="wrap">{experimentLine(x)}</E.Text>), Row(E, [Btn(E, 'home-report', 'Report what happened', () => go($, { view: 'report' }), true), Btn(E, 'home-tests', 'See my tests', () => openBuilder($, 'sales'))])], { tint: C.white, border: C.blue }) : null,
    ReviewSummary($, c),
  ]
  if (offer && offer.status !== 'idea') items.push(PlansCard($, c, offer))
  if (offer && offer.status !== 'idea') {
    const streams = work.offers.filter((o) => o.id !== offer.id).length
    items.push(E.Svg ? Art(E, offerCardSvg2({ label: 'THE OFFER YOU STARTED WITH', name: offer.name, buyer: offer.buyer, problem: offer.problem, priceText: priceText(offer, cur), firstStep: offer.firstStep }, { px: Math.min(c.px, 560), fonts: FONTS }), `Your offer: ${offer.name}`) : Head(E, offer.name))
    items.push(Row(E, [Btn(E, 'edit-offer', 'Change this offer', () => go($, { view: 'builder', builder: 'offer', stage: 'offer-edit' })), streams ? Btn(E, 'see-streams', `Your other income streams (${streams})`, () => go($, { view: 'profile' })) : null].filter(Boolean)))
  }
  items.push(<E.Box key="bl-head" flexDirection="row" justifyContent="space-between" flexWrap="wrap"><E.Text size="heading" weight="semibold" color={C.espresso}>Your ten builders</E.Text><E.Text size="footnote" color={C.taupeInk}>{`${done} done, ${started - done} in progress`}</E.Text></E.Box>)
  for (const b of BUILDERS) {
    const st = builderStatus(work, b.id)
    const rv = b.id === 'discover' ? null : reviewStatus(work.builders?.[b.id])
    const pill = rv && rv !== 'Up to date' ? rv : statusLabel(st)
    const pillColor = rv === 'Review suggested' ? C.espresso : st === 'done' ? C.blue : st === 'in_progress' ? C.espresso : C.taupeInk
    items.push(
      <E.Box key={`card-${b.id}`} flexDirection="column" gap={0} padding={1} borderStyle="round" borderColor={b.id === 'discover' && st === 'not_started' ? C.blue : C.espresso} backgroundColor={b.id === 'discover' ? C.blueTint : b.tint === C.cream ? C.white : b.tint}>
        <E.Box flexDirection="row" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <E.Text size="heading" weight="semibold" color={C.espresso}>{`${b.num}  ${b.title.replace('The ', '')}`}</E.Text>
          <E.Text size="caption" weight="bold" color={pillColor}>{pill.toUpperCase()}</E.Text>
        </E.Box>
        <E.Text color={C.ink} wrap="wrap">{b.short}</E.Text>
        {b.id === 'discover' && st === 'not_started' ? <E.Text size="footnote" weight="bold" color={C.blue}>Recommended first: everything else builds on it.</E.Text> : null}
        <E.Box flexDirection="row" gap={1}>
          <E.Button key={`open-${b.id}`} label={st === 'not_started' ? 'Start' : st === 'done' ? 'Open' : 'Carry on'} onPress={later(() => openBuilder($, b.id))} variant={b.id === 'discover' && st !== 'done' ? 'primary' : 'secondary'} />
        </E.Box>
      </E.Box>,
    )
  }
  return items
}

// Home: the working offer and the two plans built from it.
function PlansCard($, c, o) {
  const { E, work } = c
  const sb = work.builders?.sales
  const ss = work.builders?.substack
  const list = sb?.output?.list || []
  const cn = contactCounts(list.map((p, i) => contactOf(sb, keyOf(p, i))))
  const forOther = (b) => b?.output && b.basedOn?.offerId && b.basedOn.offerId !== o.id && b.keptFor !== o.id
  const line = (key, label, b, text, btn, id) => (
    <E.Box key={key} flexDirection="row" flexWrap="wrap" gap={1} alignItems="center" justifyContent="space-between">
      <E.Box flexDirection="column" flexGrow={1} minWidth={24}>
        <E.Text weight="semibold" color={C.espresso}>{label}</E.Text>
        <E.Text size="footnote" color={C.ink} wrap="wrap">{forOther(b) ? 'Built for an earlier offer: open it to choose what to do.' : text}</E.Text>
      </E.Box>
      <E.Button key={`${key}-open`} label={btn} variant={id === 'sales' && !sb?.output ? 'primary' : 'secondary'} onPress={later(() => openBuilder($, id))} />
    </E.Box>
  )
  return Card(E, [
    Label(E, 'Your offer and plans', C.blue),
    T(E, o.name, { weight: 'semibold' }),
    o.provisional ? Small(E, 'Provisional: your working offer to test.', { color: BODY }) : null,
    line('pl-sales', 'First 10 customers', sb, sb?.output ? `${cn.sent} of ${list.length} contacted, ${cn.talked} conversation${cn.talked === 1 ? '' : 's'}. ${sb.output.firstMove?.who ? `First move: ${sb.output.firstMove.who}.` : ''}` : 'Who to approach first, how to find them and what to say.', sb?.output ? 'Open' : 'Find my first 10 customers', 'sales'),
    line('pl-substack', 'Substack strategy', ss, ss?.output ? `Write first: ${firstPost(ss.output)}` : 'What to write about, for whom, and how to invite the next conversation.', ss?.output ? 'Open' : 'Build my Substack strategy', 'substack'),
  ], { tint: C.white, border: C.blue })
}

async function continueInChat($) {
  await $.command.run({ command: `${PLUGIN}:discover`, args: '' })
}

async function answerNext($) {
  const w = await read($, workA)
  const p = discoverProgress(w)
  if (p.next) await go($, { view: 'discover', stage: 'question', theme: p.next })
  else await go($, { view: 'discover', stage: 'overview' })
}

async function openBuilder($, id) {
  const w = await read($, workA)
  if (id === 'discover') {
    const d = w.discover
    await go($, { view: 'discover', stage: d.status === 'done' ? 'done' : d.early ? 'garden' : 'overview' })
    return
  }
  const b = w.builders?.[id]
  await go($, { view: 'builder', builder: id, stage: b?.output ? 'result' : 'questions', step: 0 })
}

// ---------- shared builder pieces ----------
function BuilderTop($, E, ui, def, work, c) {
  const st = builderStatus(work, def.id)
  const showEx = ui.showExample === def.id
  return [
    Row(E, [Btn(E, 'back', '← All builders', () => go($, { view: 'home' }))]),
    <E.Box key="bt-head" flexDirection="row" justifyContent="space-between" flexWrap="wrap" gap={1}>
      <E.Text size="caption" weight="bold" color={C.blue}>{`BUILDER ${def.num}`}</E.Text>
      <E.Text size="caption" weight="bold" color={C.taupeInk}>{statusLabel(st).toUpperCase()}</E.Text>
    </E.Box>,
    c ? Title(c, def.title, 28) : Head(E, def.title, 'title'),
    T(E, def.short, { weight: 'medium' }),
    Row(E, [Btn(E, `ex-${def.id}`, showEx ? "Hide Bella's example" : "See Bella's example", () => setUi($, { showExample: showEx ? null : def.id }))]),
    showEx ? Card(E, [Label(E, 'Where Bella was'), T(E, def.bellaWas), Label(E, "Bella's version", C.blue), T(E, def.bellaGot), Small(E, 'Bella is the example from the Uncapped page. Your version comes from your answers.')], { dashed: true, tint: C.cream }) : null,
  ]
}

function Question($, E, ui, key, q, saved) {
  const val = ui.drafts[key] ?? saved ?? ''
  const parts = [
    <E.Text key={`qt-${key}`} size="heading" weight="semibold" color={C.espresso} wrap="wrap">{q.q}</E.Text>,
    q.help ? Small(E, q.help) : null,
  ]
  if (q.kind === 'select') {
    parts.push(<E.Select key={key} label={q.q} options={q.options.map((o) => ({ value: o, label: o }))} value={val || undefined} onSelect={(v) => setDraft($, key, v)} />)
  } else {
    parts.push(<E.Input key={key} label={q.optional ? 'Your answer (optional)' : 'Your answer'} placeholder={q.examples?.[0] ? `For example: ${q.examples[0]}` : ''} value={val} rows={q.rows || 3} onInput={(v) => setDraft($, key, v)} onSubmit={(v) => setDraft($, key, v)} />)
    if (q.examples?.length) {
      parts.push(Small(E, 'Need a nudge? Tap an example to start from it:'))
      parts.push(Row(E, q.examples.slice(0, 3).map((ex, i) => Btn(E, `ex-${key}-${i}`, ex.length > 60 ? ex.slice(0, 57) + '...' : ex, () => setDraft($, key, val ? `${val}\n${ex}` : ex)))))
    }
  }
  return parts
}

// ---------- Discover ----------
const STATE_MARK = { answered: '✓', enough: '✓', thin: '◐', partial: '◐', skipped: '–', missing: '○' }
const STATE_WORD = { answered: 'saved', enough: 'saved, plenty to work with', thin: 'saved, could use a little more', partial: 'partly saved', skipped: 'skipped', missing: 'not yet' }

function themePreview(work, id) {
  const p = work.profile || {}
  if (id === 'start') return work.discover?.startingPoint ? STARTING_POINTS[work.discover.startingPoint] : p.answers?.idea || ''
  if (id === 'week') {
    const L = p.limits || {}
    const cur = L.currency || '$'
    return [L.hoursExact ? `about ${L.hoursExact} hours a week` : L.hours ? `${L.hours} hours a week` : '', L.income ? `${money(L.income, cur)}/month in additional income` : '', L.goal ? L.goal.toLowerCase() : ''].filter(Boolean).join(' · ')
  }
  if (id === 'energy') {
    const En = p.energy || {}
    return [En.more ? `more of: ${En.more}` : '', En.less ? `less of: ${En.less}` : '', En.never ? `never again: ${En.never}` : ''].filter(Boolean).join(' · ')
  }
  return p.answers?.[id] || ''
}

function DiscoverOverview($, c) {
  const { E, work } = c
  const p = discoverProgress(work)
  const out = [
    Title(c, 'Discover', 30),
    ...RepairNotice($, c),
    T(E, 'Finds the skills and knowledge you could get paid for, from your work and your life, and grows a portfolio of directions to choose from.'),
    Card(E, [
      Label(E, 'Two ways to answer, one place it saves', C.blue),
      T(E, 'In the chat it feels like a conversation, and I ask follow-ups when something sounds promising. Here you answer one question at a time. Switch whenever you like: everything saves to the same place and shows up here straight away.'),
      Row(E, [Btn(E, 'disc-chat', p.done ? 'Carry on in the chat' : 'Start in the chat', () => continueInChat($), true), Btn(E, 'disc-here', 'Answer here instead', () => answerNext($))]),
    ], { tint: C.blueTint }),
    <E.Box key="th-head" flexDirection="row" justifyContent="space-between" flexWrap="wrap"><E.Text size="heading" weight="semibold" color={C.espresso}>What you've told me</E.Text><E.Text size="footnote" color={C.taupeInk}>{`${p.done} of ${p.total} themes`}</E.Text></E.Box>,
  ]
  for (const t of THEMES) {
    const st = p.states[t.id]
    const prev = themePreview(work, t.id)
    out.push(
      <E.Box key={`th-${t.id}`} flexDirection="column" gap={0} paddingX={1} paddingY={0} borderStyle="round" borderColor={st === 'missing' ? C.taupeLight : C.espresso} backgroundColor={st === 'missing' ? C.cream : C.white}>
        <E.Box flexDirection="row" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <E.Text weight="semibold" color={C.espresso}>{`${STATE_MARK[st]}  ${t.label}`}</E.Text>
          <E.Text size="caption" color={st === 'thin' ? C.espresso : C.taupeInk}>{STATE_WORD[st]}</E.Text>
        </E.Box>
        {prev ? <E.Text size="footnote" color={C.ink} wrap="wrap">{prev.length > 220 ? prev.slice(0, 217) + '...' : prev}</E.Text> : null}
        <E.Box flexDirection="row" gap={1}><E.Button key={`th-edit-${t.id}`} variant="secondary" label={st === 'missing' ? 'Answer here' : 'Edit'} onPress={later(() => go($, { view: 'discover', stage: 'question', theme: t.id }))} /></E.Box>
      </E.Box>,
    )
  }
  out.push(...OpSlot($, c, 'discover-next', DiscoverNext($, c, p)))
  return out
}

function EnergyForm($, c, q) {
  const { E, ui, work } = c
  const En = work.profile.energy || {}
  const lists = { more: ui.drafts['energy.more'] ?? En.more ?? '', less: ui.drafts['energy.less'] ?? En.less ?? '', never: ui.drafts['energy.never'] ?? En.never ?? '' }
  const has = (k, chip) => lists[k].split(',').map((s) => s.trim()).includes(chip)
  const where = (chip) => ['more', 'less', 'never'].find((k) => has(k, chip)) || 'none'
  const setChip = async (chip, k) => {
    const strip = (s) => s.split(',').map((x) => x.trim()).filter((x) => x && x !== chip)
    const next = { more: strip(lists.more), less: strip(lists.less), never: strip(lists.never) }
    if (k !== 'none') next[k].push(chip)
    await update($, uiA, (u) => ({ ...u, drafts: { ...u.drafts, 'energy.more': next.more.join(', '), 'energy.less': next.less.join(', '), 'energy.never': next.never.join(', ') } }))
  }
  const opts = [{ value: 'none', label: 'No strong feeling' }, { value: 'more', label: 'More of this' }, { value: 'less', label: 'Less of this' }, { value: 'never', label: 'Never again' }]
  return [
    ...q.chips.map((chip) => <E.Select key={`en-${chip}`} label={chip.charAt(0).toUpperCase() + chip.slice(1)} options={opts} value={where(chip)} onSelect={(v) => setChip(chip, v)} />),
    Small(E, 'Anything else? Add it in your own words, separated by commas.'),
    <E.Input key="energy.more" label="More of this" value={lists.more} rows={1} onInput={(v) => setDraft($, 'energy.more', v)} onSubmit={(v) => setDraft($, 'energy.more', v)} />,
    <E.Input key="energy.less" label="Less of this" value={lists.less} rows={1} onInput={(v) => setDraft($, 'energy.less', v)} onSubmit={(v) => setDraft($, 'energy.less', v)} />,
    <E.Input key="energy.never" label="Never again" value={lists.never} rows={1} onInput={(v) => setDraft($, 'energy.never', v)} onSubmit={(v) => setDraft($, 'energy.never', v)} />,
  ]
}

function WeekForm($, c) {
  const { E, ui, work } = c
  const L = work.profile.limits || {}
  const d = ui.drafts
  return [
    <E.Select key="week.hours" label="Hours you could give this in a normal week" options={Object.keys(HOURS).map((o) => ({ value: o, label: `${o} hours` }))} value={d['week.hours'] ?? (L.hours || undefined)} onSelect={(v) => setDraft($, 'week.hours', v)} />,
    <E.Input key="week.hoursExact" label="Or type it (optional), for example: about 8" value={d['week.hoursExact'] ?? (L.hoursExact ? String(L.hoursExact) : '')} rows={1} onInput={(v) => setDraft($, 'week.hoursExact', v)} onSubmit={(v) => setDraft($, 'week.hoursExact', v)} />,
    <E.Select key="week.goal" label="Is this about adding to your salary or replacing it?" options={GOALS.map((o) => ({ value: o, label: o }))} value={d['week.goal'] ?? (L.goal || undefined)} onSelect={(v) => setDraft($, 'week.goal', v)} />,
    <E.Select key="week.currency" label="Currency" options={CURRENCIES.map((o) => ({ value: o, label: { $: 'US dollars ($)', '£': 'Pounds (£)', '€': 'Euros (€)', CA$: 'Canadian dollars (CA$)', A$: 'Australian dollars (A$)' }[o] }))} value={d['week.currency'] ?? (L.currency || '$')} onSelect={(v) => setDraft($, 'week.currency', v)} />,
    <E.Input key="week.income" label="Extra a month that would feel meaningful, for example 3000 or $3k" value={d['week.income'] ?? (L.income ? String(L.income) : '')} rows={1} onInput={(v) => setDraft($, 'week.income', v)} onSubmit={(v) => setDraft($, 'week.income', v)} />,
  ]
}

async function saveQuestion($, theme) {
  const ui = await read($, uiA)
  const d = ui.drafts
  let r
  if (theme === 'start') {
    if (d['q.name'] !== undefined) await saveName($, d['q.name'])
    r = await saveStartingPoint($, d['start.kind'] || (await read($, workA)).discover.startingPoint, d['q.start'])
  } else if (theme === 'week') {
    r = await saveWeek($, { hours: d['week.hoursExact']?.trim() ? d['week.hoursExact'] : d['week.hours'], goal: d['week.goal'], currency: d['week.currency'], income: d['week.income'] })
  } else if (theme === 'energy') {
    r = await saveWeek($, { more: d['energy.more'], less: d['energy.less'], never: d['energy.never'] })
  } else {
    if (theme === 'now' && d['name'] !== undefined) await saveName($, d['name'])
    r = await saveTheme($, theme, d[`q.${theme}`] ?? '')
  }
  if (r?.status === 'saved' || r?.status === 'saved_partly') await setUi($, { notice: r.message + (r.asks?.length ? ` One thing to check: ${r.asks.join(' ')}` : '') })
  else if (r?.status === 'needs_clarification') await setUi($, { notice: `Not saved yet: ${r.message}` })
  else if (r?.status === 'not_saved') await setUi($, { error: r.message })
  return r
}

function DiscoverQuestion($, c) {
  const { E, ui, work, nav } = c
  const theme = nav.theme || discoverProgress(work).next || 'now'
  const q = questionFor(theme, work.discover.startingPoint)
  const idx = THEMES.findIndex((t) => t.id === theme)
  const body = [Small(E, `${THEMES[idx]?.label || ''} · theme ${idx + 1} of ${THEMES.length}`)]
  if (q.kind === 'start') {
    body.push(<E.Text key="qs" size="heading" weight="semibold" color={C.espresso} wrap="wrap">{q.q}</E.Text>, Small(E, q.help))
    if (!work.profile.name) body.push(<E.Input key="q.name" label="What should I call you?" value={ui.drafts['q.name'] ?? ''} rows={1} onInput={(v) => setDraft($, 'q.name', v)} onSubmit={(v) => setDraft($, 'q.name', v)} />)
    body.push(<E.Select key="start.kind" label="Which sounds most like you?" options={Object.entries(STARTING_POINTS).map(([value, label]) => ({ value, label }))} value={ui.drafts['start.kind'] ?? (work.discover.startingPoint || undefined)} onSelect={(v) => setDraft($, 'start.kind', v)} />)
    body.push(<E.Input key="q.start" label="Anything you already have in mind? (optional)" value={ui.drafts['q.start'] ?? work.profile.answers.start ?? ''} rows={3} onInput={(v) => setDraft($, 'q.start', v)} onSubmit={(v) => setDraft($, 'q.start', v)} />)
  } else if (q.kind === 'limits') {
    body.push(<E.Text key="qw" size="heading" weight="semibold" color={C.espresso} wrap="wrap">{q.q}</E.Text>, Small(E, q.help), ...WeekForm($, c))
  } else if (q.kind === 'energy') {
    body.push(<E.Text key="qe" size="heading" weight="semibold" color={C.espresso} wrap="wrap">{q.q}</E.Text>, Small(E, q.help), ...EnergyForm($, c, q))
  } else {
    if (q.withName) body.push(<E.Input key="name" label="What should I call you?" placeholder="Your first name" value={ui.drafts['name'] ?? work.profile.name ?? ''} rows={1} onInput={(v) => setDraft($, 'name', v)} onSubmit={(v) => setDraft($, 'name', v)} />)
    body.push(...Question($, E, ui, `q.${theme}`, q, work.profile.answers?.[theme]))
  }
  const nextTheme = () => discoverProgress(work).next
  body.push(Row(E, [
    Btn(E, 'q-save-next', 'Save and continue', async () => {
      const r = await saveQuestion($, theme)
      if (r && ['saved', 'saved_partly'].includes(r.status)) {
        const w2 = await read($, workA)
        const n = discoverProgress(w2).next
        await go($, n && n !== theme ? { view: 'discover', stage: 'question', theme: n } : { view: 'discover', stage: 'overview' })
        if (r.message) await setUi($, { notice: r.message })
      }
    }, true),
    Btn(E, 'q-save', 'Save', () => saveQuestion($, theme)),
    q.kind === 'energy' || q.optional || ['try', 'buyers', 'know'].includes(theme) ? Btn(E, 'q-skip', 'Skip for now', async () => { await skipTheme($, theme); await answerNext($) }) : null,
    Btn(E, 'q-overview', 'Back to Discover', () => go($, { view: 'discover', stage: 'overview' })),
  ].filter(Boolean)))
  return [Title(c, 'Discover', 26), Card(E, body)]
}

function DiscoverFollowups($, c) {
  return [Title(c, 'A few follow-ups', 26), ...OpSlot($, c, 'followups-end', FollowupsBlock($, c, 'followups-end'))]
}

// The follow-up questions, with answer boxes keyed to each question's id.
function FollowupsBlock($, c, place) {
  const { E, ui, work } = c
  const f = work.discover.followups || []
  if (!f.length) {
    return [Card(E, [T(E, 'Your answers already give me enough to work with.'), Row(E, [Btn(E, `grow-${place}`, 'Build my portfolio garden', () => runEarlyRead($, place), true), Btn(E, 'fu-back', 'Back to Discover', () => go($, { view: 'discover', stage: 'overview' }))])])]
  }
  return [
    Card(E, [
      Head(E, f.length === 1 ? 'One follow-up question' : `${f.length} follow-up questions`),
      T(E, 'These are the details that would change what I can suggest. Answer any you like, in a sentence or two. Leave a box empty to skip it.'),
      ...f.map((x, i) => (
        <E.Box key={`fqb-${x.id || i}`} flexDirection="column" gap={1} paddingTop={1}>
          <E.Text weight="semibold" color={C.espresso} wrap="wrap">{x.q}</E.Text>
          {x.why ? Small(E, x.why, { color: C.ink }) : null}
          <E.Input key={followKey(x, i)} label="Your answer" value={ui.drafts[followKey(x, i)] ?? ''} rows={4} onInput={(v) => setDraft($, followKey(x, i), v)} onSubmit={(v) => setDraft($, followKey(x, i), v)} />
        </E.Box>
      )),
      Row(E, [Btn(E, 'fu-save', 'Save my answers', () => saveFollowUpAnswers($), true), Btn(E, 'fu-chat', 'Answer them in the chat instead', () => continueInChat($)), Btn(E, 'fu-skip', 'Skip, build my portfolio garden', () => runEarlyRead($, place))]),
    ], { tint: C.white, border: C.blue }),
  ]
}

// What comes next at the bottom of Discover: follow-ups, building the
// garden, or the garden itself, all in the same place.
function DiscoverNext($, c, p) {
  const { E, work } = c
  if ((work.discover.followups || []).length) return FollowupsBlock($, c, 'discover-next')
  if (p.hasDirections) {
    const ds = work.discover.early?.directions || []
    return [Card(E, [
      Head(E, "Your portfolio garden: possible directions to explore"),
      T(E, `${ds.length} directions. Open one to read my recommendation, or open the whole garden to compare them.`),
      ...ds.map((d) => (
        <E.Box key={`dn-${d.id}`} flexDirection="row" flexWrap="wrap" gap={1} alignItems="center" justifyContent="space-between">
          <E.Box flexDirection="column" flexGrow={1} minWidth={24}>
            <E.Text weight="semibold" color={C.espresso} wrap="wrap">{shortTitle(d)}</E.Text>
            <E.Text size="footnote" color={C.ink} wrap="wrap">{`${d.buyer ? `For ${lowerFirst(d.buyer)}. ` : ''}${priceText(d, curOf(work))}`}</E.Text>
          </E.Box>
          <E.Button key={`dn-open-${d.id}`} label="Explore this direction" onPress={later(() => go($, { view: 'discover', stage: 'direction', id: d.id }))} />
        </E.Box>
      )),
      Row(E, [Btn(E, 'to-garden', 'Open your portfolio garden', () => go($, { view: 'discover', stage: 'garden' }), true), Btn(E, 'regrow', 'Rebuild it with my latest answers', () => runEarlyRead($, 'discover-next'))]),
    ], { tint: C.butterTint })]
  }
  if (p.ready) {
    // Enough is about them, never about proof of demand: that is what the
    // directions' tests are for. Only what they alone could tell is named.
    const about = p.aboutYou
    return [Card(E, [
      Head(E, p.provisional ? 'Ready for your first directions' : 'I have enough to suggest your first directions'),
      T(E, p.provisional
        ? `${p.rounds >= 2 ? "That's the end of the first interview. " : ''}Next I'll suggest the directions I would explore first, each with who buys it, what they get, a price to test and the main thing to test first.${about.length ? '' : ' If anything about you could still change them, I will say so.'} It can take up to 6 minutes.`
        : `${p.whyReady ? `${p.whyReady} ` : ''}Next I'll suggest the directions I would explore first, each with who buys it, what they get, a price to test and the main thing to test first. It can take up to 6 minutes. You can revisit your answers later.`, { color: C.ink }),
      about.length ? Small(E, `${about.length === 1 ? 'One thing' : 'A couple of things'} only you can tell me could still change them: ${about.join('; ')}. You can add ${about.length === 1 ? 'it' : 'them'} to your answers any time.`, { color: BODY }) : null,
      Row(E, [Btn(E, 'grow', 'Build my portfolio garden', () => runEarlyRead($, 'discover-next'), true), p.unjudged && p.rounds < 2 ? Btn(E, 'followups', 'Check my answers first', () => runFollowUps($, 'discover-next')) : null].filter(Boolean)),
    ], { tint: C.butterTint })]
  }
  if (p.coreDone) {
    return [Card(E, [Head(E, 'A few follow-ups would sharpen your directions'), T(E, p.thin.length ? `Some answers are thin: ${p.thin.map((id) => THEMES.find((t) => t.id === id).short).join(', ')}. A detail or two there changes what I can suggest.` : "Before I build your garden, I'd like to ask one or two follow-ups where your answers sounded most promising."), Row(E, [Btn(E, 'followups', 'Follow-ups here', () => runFollowUps($, 'discover-next'), true), Btn(E, 'followups-chat', 'Do them in the chat', () => continueInChat($)), Btn(E, 'grow-anyway', 'Build my portfolio garden', () => runEarlyRead($, 'discover-next'))])], { tint: C.butterTint })]
  }
  return []
}

const BASIS = { demonstrated: "You've done this", adjacent: 'Close to what you have done', aspirational: 'Something to grow into' }
const KIND_WORDS = { done: "you've done this", knows: 'you know this', wants: 'you want this', curious: "you're curious" }

// The portfolio garden: an overview of possible directions, not a report.
// What Uncapped sees first, then one compact card per direction. Excitement
// and earning speed are compared on demand; unknowns stay unknown.
function DiscoverGarden($, c) {
  const { E, ui, work } = c
  const d = work.discover
  const e = d.early
  const cur = curOf(work)
  const wide = c.px >= 600
  const dirs = e.directions || []
  const rv = needsReview(work)
  const st = e.strengths || {}
  const sig = d.reading?.signals || {}
  // Prefer the garden's own summary of strengths; fall back to the interview's reading.
  const kinds = [
    ['capability', 'Shown you can do'], ['enjoyment', 'You enjoy'], ['aspiration', 'You want to grow into'], ['demand', 'Real demand so far'],
  ].map(([k, label]) => ({ k, label, items: (st[k] || []).length ? st[k] : (sig[k] || []).map((x) => (k === 'demand' ? demandText(x) : x.text)).filter(Boolean) }))
  // The top of the screen: a short read, the main thing to test, and at most
  // three unknowns. Anything more stays one press away, never dropped.
  const unknowns = (Array.isArray(e.unknowns) ? e.unknowns : (e.gaps || []).map((text) => ({ text }))).map((x) => (typeof x === 'string' ? { text: x } : x)).filter((x) => String(x?.text || '').trim())
  const topUnknowns = unknowns.slice(0, 3)
  const aboutYou = topUnknowns.filter((x) => x.about === 'you')
  const toFind = topUnknowns.filter((x) => x.about !== 'you')
  const moreUnknowns = unknowns.slice(3)
  const mainTest = String(e.mainTest || '').trim().replace(/^(the main thing to test (first )?is|test|to test|testing)\s+/i, '').replace(/[.\s]+$/, '')
  const researched = dirs.filter((x) => (work.research || []).some((r) => r.directionId === x.id && (r.items || []).length)).length
  const out = [
    Crumbs($, c, [{ label: 'Discover', go: { view: 'discover', stage: 'overview' } }, { label: 'Portfolio garden' }]),
    Title(c, 'Your portfolio garden', 28),
    ...RepairNotice($, c),
    T(E, e.read || '', { color: C.ink }),
    mainTest ? T(E, `Here are the directions I'd explore first. The main thing to test is ${lowerFirst(mainTest)}.`, { color: C.espresso }) : null,
    // One line each, so a long uncertainty never runs into the next. A rule or
    // license is marked as something to check, never as settled.
    toFind.length ? (
      <E.Box key="g-unknowns" flexDirection="column" gap={0}>
        <E.Text size="caption" weight="bold" color={BODY}>STILL TO FIND OUT</E.Text>
        {toFind.map((x, i) => <E.Text key={`gu-${i}`} size="footnote" color={C.ink} wrap="wrap">{`${x.about === 'rules' ? 'To check: ' : ''}${x.text}`}</E.Text>)}
      </E.Box>
    ) : null,
    aboutYou.length ? (
      <E.Box key="g-about-you" flexDirection="column" gap={0}>
        <E.Text size="caption" weight="bold" color={BODY}>ONLY YOU CAN TELL ME</E.Text>
        {aboutYou.map((x, i) => <E.Text key={`gy-${i}`} size="footnote" color={C.ink} wrap="wrap">{String(x.text)}</E.Text>)}
        <E.Text size="footnote" color={BODY} wrap="wrap">{`${aboutYou.length === 1 ? 'It' : 'They'} could change these directions. You can add ${aboutYou.length === 1 ? 'it' : 'them'} to your answers any time.`}</E.Text>
      </E.Box>
    ) : null,
    moreUnknowns.length ? Disclosure($, c, 'more-unknowns', 'More that is still unknown', `${moreUnknowns.length} more`, moreUnknowns.map((x, i) => <E.Text key={`mu-${i}`} size="footnote" color={BODY} wrap="wrap">{String(x.text)}</E.Text>)) : null,
    e.range ? T(E, e.range, { color: C.ink }) : null,
    e.range ? Row(E, [Btn(E, 'range-explore', 'Tell me about other interests', () => go($, { view: 'discover', stage: 'question', theme: 'try' }))]) : null,
    e.throughLine ? Note(c, e.throughLine) : null,
    kinds.some((x) => x.items.length) ? (
      <E.Box key="g-strengths" flexDirection="row" flexWrap="wrap" columnGap={3} rowGap={1}>
        {kinds.map(({ k, label, items }) => (
          <E.Box key={`gs-${k}`} flexDirection="column" gap={0} minWidth={22} flexGrow={1}>
            <E.Text size="caption" weight="bold" color={BODY}>{label.toUpperCase()}</E.Text>
            <E.Text color={items.length ? C.ink : BODY} wrap="wrap">{items.length ? items.slice(0, 3).join(' · ') : k === 'demand' ? 'None yet: that is what tests find out.' : 'Nothing clear yet.'}</E.Text>
          </E.Box>
        ))}
      </E.Box>
    ) : null,
    Small(E, `${dirs.length} possible direction${dirs.length === 1 ? '' : 's'}. They're starting points to explore and test, not decisions. Open one to see my take and the next step.`, { color: BODY }),
    Small(E, researched ? `Research: saved for ${researched} of ${dirs.length} direction${dirs.length === 1 ? '' : 's'}.` : 'Research: none yet. Each direction lists what to look up, whenever you want to.', { color: BODY }),
  ]
  const card = (x, i) => {
    const m = moneyFor(x, work.profile)
    const status = directionStatus(work, x)
    const v = directionView(work, x)
    const price = m.priceLow != null ? `${fmtRange({ lo: m.priceLow, hi: m.priceHigh }, cur)} ${m.M ? (/^[aeiou]/.test(m.M.unit) ? 'an ' : 'a ') + m.M.unit : x.priceUnit || ''}`.trim() : null
    const priceTag = x.money?.demo ? 'demo data' : m.basis === 'researched' ? 'researched' : x.money ? 'a guess to test' : 'from your earlier garden'
    return (
      <E.Box key={`gc-${x.id}`} flexDirection="column" gap={1} padding={1} borderStyle="round" borderColor={rv.directions[x.id] ? C.espresso : C.taupeLight} backgroundColor={C.white} width={wide ? '48%' : '100%'}>
        <E.Box flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
          {Eyebrow(E, `gc-n-${x.id}`, `${String(i + 1).padStart(2, '0')} · ${BASIS[x.basis] || x.stage || ''}`)}
          {status.word !== 'Exploring · nothing selected yet' ? Chip(E, `gc-st-${x.id}`, status.word, 'white') : null}
          {rv.directions[x.id] ? Chip(E, `gc-rv-${x.id}`, 'Needs review', 'butter') : null}
        </E.Box>
        <E.Text size="heading" weight="semibold" color={C.espresso} wrap="wrap">{cleanShort(x)}</E.Text>
        <E.Text color={C.ink} wrap="wrap">{x.opportunity || v.summary}</E.Text>
        {x.firstOffer ? <E.Text color={C.espresso} wrap="wrap">{`First offer: ${x.firstOffer}${price ? `  ·  ${price}, ${priceTag}` : ''}`}</E.Text> : price ? <E.Text color={C.espresso} wrap="wrap">{`${price}  ·  ${priceTag}`}</E.Text> : null}
        {!x.firstOffer && (x.whyYou || v.appeal) ? <E.Text size="footnote" color={BODY} wrap="wrap">{`Why it fits: ${x.whyYou || v.appeal}`}</E.Text> : null}
        <E.Box flexDirection="row"><E.Button key={`explore-${x.id}`} label="Explore" variant={i === 0 ? 'primary' : 'secondary'} onPress={later(() => go($, { view: 'discover', stage: 'direction', id: x.id }))} /></E.Box>
      </E.Box>
    )
  }
  out.push(<E.Box key="g-cards" flexDirection="row" flexWrap="wrap" columnGap={2} rowGap={1}>{dirs.map(card)}</E.Box>)
  // Compare: your excitement against my estimate of earning speed, with its basis.
  const compare = dirs.map((x) => {
    const months = Number(x.monthsToFirstIncome)
    const speed = x.monthsToFirstIncome == null || isNaN(months) ? 'unknown' : months < 1 ? 'a few weeks' : `about ${months} month${months === 1 ? '' : 's'}`
    return (
      <E.Box key={`cmp-${x.id}`} flexDirection="column" gap={0} paddingY={0}>
        <E.Text weight="semibold" color={C.espresso} wrap="wrap">{cleanShort(x)}</E.Text>
        <E.Text color={C.ink} wrap="wrap">{`Soonest first income (my estimate): ${speed}${x.speedBasis ? `. ${x.speedBasis}` : ''}`}</E.Text>
        <E.Select key={`excite-${x.id}`} label="Your excitement" options={[{ value: '0', label: 'Not scored yet' }, ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} of 5${n === 5 ? ', very' : n === 1 ? ', not much' : ''}` }))]} value={String(d.excitement?.[x.id] || 0)} onSelect={(val) => setExcitement($, x.id, val)} />
      </E.Box>
    )
  })
  out.push(Disclosure($, c, 'compare-garden', 'Compare them', 'your excitement against how soon each could earn', [
    Small(E, 'Excitement is yours to score; it stays "not scored" until you do. Earning speed is my estimate from your hours and who you can reach, not a promise.', { color: BODY }),
    ...compare,
  ]))
  out.push(...OpSlot($, c, 'garden-sharpen', [Row(E, [Btn(E, 'garden-answers', 'Review your Discover answers', () => go($, { view: 'discover', stage: 'overview' })), Btn(E, 'regrow-garden', 'Rebuild it with my latest answers', () => runEarlyRead($, 'garden-sharpen'))])]))
  return out.filter(Boolean)
}

const OFFER_LABELS = { name: "Your offer, in a line", buyer: 'Who might buy it', problem: 'The problem it solves', whyNow: 'What might make them look for it', handover: 'What they get', priceLow: 'Price to test: low', priceHigh: 'Price to test: high', priceUnit: 'Per (project, month, session...)', priceWhy: 'What the price assumes', firstStep: 'First step this week', toTest: 'The main thing still to test' }

function OfferForm($, E, ui, base, confirmLabel, onConfirm) {
  return OFFER_FIELDS.map((f) => (
    <E.Input key={`offer.${f}`} label={OFFER_LABELS[f]} value={String(ui.drafts[`offer.${f}`] ?? base?.[f] ?? '')} rows={['problem', 'buyer', 'handover', 'priceWhy', 'whyNow', 'firstStep'].includes(f) ? 2 : 1} onInput={(v) => setDraft($, `offer.${f}`, v)} onSubmit={(v) => setDraft($, `offer.${f}`, v)} />
  )).concat([Row(E, [Btn(E, 'offer-confirm', confirmLabel, onConfirm, true)])])
}

function DiscoverOffer($, c) {
  const { E, ui, work } = c
  const cur = work.profile.limits?.currency || '$'
  const draft = offerFromDrafts(ui.drafts, {})
  return [
    Title(c, 'The offer you start with', 28),
    ui.drafts['offer.direction'] ? Small(E, `Direction: ${ui.drafts['offer.direction']}`, { color: BODY }) : null,
    T(E, "Make it yours: change any line, then choose it. Your buyer plan and Substack strategy are built from this one, so you only choose it once. It stays provisional until you've tested it. The other directions stay in your garden."),
    E.Svg ? Art(E, offerCardSvg2({ name: draft.name, buyer: draft.buyer, problem: draft.problem, priceText: priceText(draft, cur), firstStep: draft.firstStep }, { px: Math.min(c.px, 560), fonts: FONTS }), 'Your offer card') : null,
    Card(E, [
      ...OfferForm($, E, ui, draft, 'Work on this offer', () => confirmFirstOffer($)).slice(0, -1),
      <E.Input key="offer.toTest" label={OFFER_LABELS.toTest} value={String(ui.drafts['offer.toTest'] ?? '')} rows={2} onInput={(v) => setDraft($, 'offer.toTest', v)} onSubmit={(v) => setDraft($, 'offer.toTest', v)} />,
      Row(E, [Btn(E, 'offer-confirm', 'Work on this offer', () => confirmFirstOffer($), true)]),
    ]),
    ui.drafts['offer.whyYou'] ? Small(E, `What you already have going for you: ${ui.drafts['offer.whyYou']}`) : null,
    ui.drafts['offer.startWith'] ? Small(E, `Where to start testing: ${ui.drafts['offer.startWith']}`) : null,
    Row(E, [Btn(E, 'offer-back-garden', 'Back to my garden', () => go($, { view: 'discover', stage: 'garden' }))]),
  ]
}

function DiscoverDone($, c) {
  const { E, work } = c
  const o = activeOffer(work)
  const cur = work.profile.limits?.currency || '$'
  return [
    Note(c, 'found it!'),
    Title(c, `There it is${work.profile.name ? `, ${work.profile.name.split(' ')[0]}` : ''}.`, 30),
    o && E.Svg ? Art(E, offerCardSvg2({ name: o.name, buyer: o.buyer, problem: o.problem, priceText: priceText(o, cur), firstStep: o.firstStep }, { px: Math.min(c.px, 560), fonts: FONTS }), `Your offer: ${o.name}`) : null,
    T(E, "This is your working offer: your best guess to test, not a promise. Next, find the first 10 people to talk to about it. Your Substack strategy can grow alongside, from the same offer, so use whichever step fits your week."),
    o?.toTest ? Small(E, `The main thing still to test: ${o.toTest}`, { color: C.ink }) : null,
    Row(E, [Btn(E, 'to-first10', 'Find my first 10 customers', () => openBuilder($, 'sales'), true), Btn(E, 'to-substack', 'Build my Substack strategy', () => openBuilder($, 'substack'))]),
    Row(E, [Btn(E, 'to-garden2', 'Back to my garden', () => go($, { view: 'discover', stage: 'garden' })), Btn(E, 'to-home', 'Home', () => go($, { view: 'home' }))]),
  ]
}

// ======================================================================
// Brand pieces, taken from the landing page: cream paper, espresso ink, 2px
// espresso borders, tinted uppercase labels, one blue main action per screen,
// Cormorant Garamond headings and Caveat notes drawn as artwork with the
// real font files, and "Uncapped" always in the Fraunces wordmark.
// ======================================================================
const TONES = {
  blue: { bg: C.blueTint, fg: C.blue },
  butter: { bg: C.butterTint, fg: C.espresso },
  pink: { bg: C.pinkTint, fg: C.espresso },
  paper: { bg: C.paper, fg: C.espresso },
  white: { bg: C.white, fg: C.espresso },
}
// Essential text never goes lighter than the landing page's body color.
const BODY = '#4A3F37'

// Chips state facts and are never pressable (8.6).
const CHIP = {
  done: { bg: C.greenTint, border: C.green, fg: C.espresso },
  here: { bg: C.butter, border: C.espresso, fg: C.espresso },
  next: { bg: C.white, border: C.espresso, fg: C.espresso },
  working: { bg: C.blue, border: C.blue, fg: C.white },
  pick: { bg: C.butter, border: C.espresso, fg: C.espresso },
  yours: { bg: C.pinkTint, border: C.espresso, fg: C.espresso },
  totest: { bg: C.white, border: C.taupe, fg: C.taupeInk },
}
const CHIP2 = { done: 'done', here: 'here', next: 'quiet', working: 'accent', pick: 'pick', yours: 'quiet', totest: 'quiet', paper: 'quiet', white: 'quiet', blue: 'working', butter: 'pick', pink: 'decide', ring: 'here', quiet: 'quiet', accent: 'accent', decide: 'decide' }
function Chip(E, key, text, tone = 'paper') {
  return U2.Chip(E, key, text, String(tone).startsWith('lens:') ? tone : CHIP2[tone] || 'quiet')
  const lens = String(tone).startsWith('lens:') ? LENS[String(tone).slice(5)] : null
  const t = lens ? { bg: lens.color, border: lens.border, fg: lens.text } : CHIP[tone] || { ...(TONES[tone] || TONES.paper), border: C.espresso }
  return (
    <E.Box key={key} paddingX={1} borderStyle="round" borderColor={t.border} backgroundColor={t.bg} alignSelf="flex-start">
      <E.Text size="caption" weight="bold" color={t.fg}>{String(text).toUpperCase()}</E.Text>
    </E.Box>
  )
}
const Chips = (E, key, chips) => (chips.filter(Boolean).length ? <E.Box key={key} flexDirection="row" flexWrap="wrap" gap={1}>{chips.filter(Boolean)}</E.Box> : null)

function Eyebrow(E, key, text, color = C.blue) {
  return <E.Text key={key} size="caption" weight="bold" color={color} wrap="wrap">{String(text).toUpperCase()}</E.Text>
}

// A labeled fact: small uppercase label, then the words in body text.
function Fact(E, key, label, value, props = {}) {
  if (!value) return null
  return (
    <E.Box key={key} flexDirection="column" gap={0}>
      <E.Text size="caption" weight="bold" color={C.taupeInk}>{String(label).toUpperCase()}</E.Text>
      <E.Text color={C.ink} wrap="wrap" {...props}>{String(value)}</E.Text>
    </E.Box>
  )
}

// A section: heading in Cormorant, an optional label on the right, its body.
function Section(c, key, title, body, opts = {}) {
  const { E } = c
  return (
    <E.Box key={key} flexDirection="column" gap={1} padding={1} borderStyle="round" borderColor={opts.border || C.espresso} backgroundColor={opts.tint || C.white}>
      <E.Box flexDirection="row" flexWrap="wrap" gap={1} alignItems="center" justifyContent="space-between">
        {Title(c, title, 21, { px: Math.min(c.colPx || c.px, 460) - 24 })}
        {opts.chip ? Chip(E, `${key}-chip`, opts.chip, opts.chipTone) : null}
      </E.Box>
      {body}
    </E.Box>
  )
}

const SOURCE_TONE = { 'a buyer said it': 'blue', 'their own thought': 'butter', "claude's suggestion": 'pink' }
const SOURCE_WORDS = { 'a buyer said it': 'A buyer said it', 'their own thought': 'Your own thought', "claude's suggestion": 'My guess' }

// ======================================================================
// One direction. The first view answers three questions: what is the idea,
// what does Uncapped think of it, and what should I do next. Everything
// else is in sections that open on demand, each with a summary when closed.
// ======================================================================

// Text from the earlier garden that tied a direction to another of the
// person's businesses. It stays out of the current recommendation unless
// they choose that link.
const LINKED = /pivot school|trimester zero work|your other work|other business|audience builder|audience for|feed(?:s|ing)? (?:into|your)|bring(?:s|ing)? (?:women|people|clients) into/i

function cleanShort(d) {
  if (d?.short) return d.short
  let t = String(d?.title || '').replace(/^(a|an|the)\s+/i, '')
  t = t.split(/ for | to help | aimed at | co-hosted| with a |: |, /)[0].trim()
  if (t.length > 48) t = t.slice(0, 48).replace(/\s+\S*$/, '') + '…'
  return t ? t[0].toUpperCase() + t.slice(1) : 'A direction'
}

function firstSentence(t) {
  const x = String(t || '').trim()
  const m = /^(.+?[.!?])(\s|$)/.exec(x)
  return m ? m[1] : x
}

// What the screen needs, from either the current shape or the earlier one.
function directionView(work, x) {
  const legacy = !x.money
  const linkOk = Boolean(x.linkChosen)
  const assumptions = (x.assumptions || []).filter((a) => linkOk || !LINKED.test(String(a.belief || a.text || '')))
  const hiddenLinks = (x.assumptions || []).length - assumptions.length + (!linkOk && LINKED.test(String(x.toTest || '')) ? 1 : 0)
  const risky = [...assumptions].sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.risk] ?? 3) - ({ high: 0, medium: 1, low: 2 }[b.risk] ?? 3))[0]
  const summary = x.summary || [x.buyer ? `For ${lowerFirst(x.buyer)}.` : '', x.handover ? `They leave with ${lowerFirst(x.handover)}.` : ''].filter(Boolean).join(' ')
  const appeal = x.take?.appeal || firstSentence(x.whyYou)
  const limitation = x.take?.limitation || (risky ? `It isn't known yet whether ${lowerFirst(String(risky.belief || risky.text).replace(/\.$/, ''))}.` : '')
  const basis = x.take?.basis || (risky ? `${SOURCE_WORDS[String(risky.source || '').toLowerCase()] || 'An assumption'}, not tested yet.` : '')
  const learn = x.nextTest?.learn || (risky ? `Whether ${lowerFirst(String(risky.belief || risky.text).replace(/\.$/, ''))}, from what people have actually done and spent, not what they say they'd do.` : 'What people with this problem already do about it, and what they spend.')
  const toTest = !linkOk && LINKED.test(String(x.toTest || '')) ? '' : x.toTest
  return { legacy, assumptions, hiddenLinks, risky, summary, appeal, limitation, basis, learn, toTest }
}

function directionStatus(work, x) {
  const exp = (work.experiments || []).find((e) => e.source?.directionId === x.id || e.ref?.directionId === x.id || e.directionId === x.id)
  const offer = (work.offers || []).find((o) => o.fromDirection === x.id) || (work.discover.chosenId === x.id ? activeOffer(work) : null)
  if (exp) return { word: 'Testing', exp, offer }
  if (offer) return { word: 'Your working offer', offer }
  if (work.discover.shortlist?.[x.id]) return { word: 'Shortlisted' }
  return { word: 'Exploring · nothing selected yet' }
}

// An accessible disclosure: a plain button that says what's inside even
// when closed. Opening it changes nothing else on the screen.
// A disclosure (8.8): a full-width row with + and −, a summary in words, and
// its body on white when open. In a group, opening one closes the others.
function Disclosure($, c, key, title, summary, body, opts = {}) {
  const { E, ui } = c
  const open = opts.forceOpen || (opts.group ? ui.grp?.[opts.group] === key : Boolean(ui.sec?.[key]))
  return (
    <E.Box key={`sec-${key}`} flexDirection="column" paddingX={1} borderStyle="round" borderColor={V.line} backgroundColor={V.surface}>
      <E.Box key={`sec-row-${key}`} flexDirection="row" gap={1} alignItems="flex-start">
        <E.Box flexDirection="column" gap={0} flexGrow={1} flexShrink={1} minWidth={0}>
          <E.Text weight="semibold" color={C.espresso} wrap="wrap">{title}</E.Text>
          {summary ? (opts.summaryInk ? <E.Text color={C.ink} wrap="wrap">{summary}</E.Text> : <E.Text size="footnote" color={C.taupeInk} wrap="wrap">{summary}</E.Text>) : null}
        </E.Box>
        <E.Box key={`sec-bx-${key}`} flexShrink={0}><E.Button key={`sec-btn-${key}`} variant="secondary" label={open ? 'Close −' : 'Open +'} onPress={later(() => toggleSection($, key, opts.group))} /></E.Box>
      </E.Box>
      {open ? <E.Box key={`sec-body-${key}`} flexDirection="column" gap={S.tight} paddingX={1} paddingBottom={1}>{body}</E.Box> : null}
    </E.Box>
  )
}

function Rule(c, key) {
  if (!c.E.Svg) return null
  const w = Math.min(c.colPx || c.px, c.px)
  return <c.E.Svg key={key} source={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 5" width="${w}" height="5"><rect y="2" width="${w}" height="1.5" fill="${C.taupeLight}"/></svg>`} alt="divider" />
}

function DirectionView($, c) {
  const { E, ui, work, nav } = c
  const d = work.discover
  const all = d.early.directions || []
  const i = all.findIndex((x) => x.id === nav.id)
  const x = all[i]
  const back = [{ label: 'Discover', go: { view: 'discover', stage: 'overview' } }, { label: 'Portfolio garden', go: { view: 'discover', stage: 'garden' } }]
  if (!x) return [Crumbs($, c, back), T(E, "That direction isn't in your garden any more."), Row(E, [Btn(E, 'dv-all', 'Back to all directions', () => go($, { view: 'discover', stage: 'garden' }), true)])]
  const wide = c.px >= 600
  c.colPx = wide ? Math.floor(c.px * 0.64) : c.px
  const cur = curOf(work)
  const v = directionView(work, x)
  const st = directionStatus(work, x)
  const rvAll = needsReview(work)
  const rv = rvAll.directions[x.id]
  const unsettled = rvAll.pairs.length > 0
  const stale = Boolean(rv)
  const m = moneyFor(x, work.profile)
  const demo = Boolean(x.money?.demo)
  const here = { view: 'discover', stage: 'direction', id: x.id }
  const research = (work.research || []).filter((r) => r.directionId === x.id || r.direction === x.id)
  const priceText2 = m.priceLow != null ? `${fmtRange({ lo: m.priceLow, hi: m.priceHigh }, cur)} ${m.M ? (/^[aeiou]/.test(m.M.unit) ? 'an ' : 'a ') + m.M.unit : x.priceUnit || ''}`.trim() : 'not set'
  const priceTag = demo ? 'demo data' : m.basis === 'researched' ? 'researched' : v.legacy ? 'from your earlier garden' : 'a guess to test'
  const perRun = m.hoursPrep == null && m.hoursDelivery == null ? null : (m.hoursPrep ?? 0) + (m.hoursDelivery ?? 0)
  const workText = m.hours != null ? `about ${m.hours} hours a month` : perRun != null ? `${perRun} hours per ${m.M?.run || 'sale'}, plus time finding buyers` : 'not worked out yet'
  const workTag = demo ? 'demo data' : m.hours != null ? 'estimate' : perRun != null ? (v.legacy ? 'from your earlier garden' : 'estimate') : ''
  const findings = (st.exp?.findings || []).length
  const evidence = st.exp ? (findings ? `${findings} set${findings === 1 ? '' : 's'} of findings` : 'test planned, no findings yet') : 'none yet'

  // ---- the first view
  const head = [
    Crumbs($, c, back),
    Title(c, cleanShort(x), 30, { highlight: true }),
    <E.Box key="dv-status" flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
      <E.Text size="footnote" color={BODY}>{st.word}</E.Text>
      <E.Button key="dv-how" variant="secondary" label={ui.sec?.how ? 'Hide how this works' : 'How this works ›'} onPress={later(() => toggleSection($, 'how'))} />
    </E.Box>,
    ui.sec?.how ? (
      <E.Box key="dv-how-body" flexDirection="column" gap={0} padding={1} borderStyle="round" borderColor={C.taupeLight} backgroundColor={C.cream}>
        {[['Exploring', 'reading a direction. Nothing is decided.'], ['Shortlisted', 'keeping it to compare. Still nothing decided.'], ['Working offer', 'your current best guess to test. Not proven or permanent; switch any time.'], ['Testing', 'a small experiment with real people.'], ['Evidence', 'what the tests show: understanding the problem, positive reactions, someone paying, repeat sales.']].map(([k, t], n) => <E.Text key={`dv-how-${n}`} color={C.ink} wrap="wrap">{`${n + 1}. ${k}: ${t}`}</E.Text>)}
      </E.Box>
    ) : null,
    T(E, x.opportunity || v.summary, { color: C.ink }),
    x.firstOffer ? (
      <E.Box key="dv-first-offer" flexDirection="column" gap={1} padding={1} borderStyle="round" borderColor={C.espresso} backgroundColor={C.white}>
        <E.Text size="caption" weight="bold" color={BODY}>A FIRST OFFER</E.Text>
        <E.Text weight="semibold" color={C.espresso} wrap="wrap">{x.firstOffer}</E.Text>
        {x.buyer ? <E.Text color={C.ink} wrap="wrap">{`Who might buy it: ${x.buyer}`}</E.Text> : null}
        <E.Text color={C.ink} wrap="wrap">{`Price to test: ${priceText2}  ·  ${priceTag}`}</E.Text>
        {st.offer ? <E.Text size="footnote" color={BODY} wrap="wrap">{`You're working on this offer: ${st.offer.name}.`}</E.Text> : (
          <E.Box flexDirection="column" gap={0}>
            <E.Box flexDirection="row"><E.Button key="dv-use-first" label="Work on this offer" onPress={later(() => chooseDirection($, x.id))} /></E.Box>
            <E.Text size="footnote" color={BODY} wrap="wrap">Makes it your working offer: your buyer plan and Substack strategy are built from it. It stays provisional until you've tested it, and you can switch any time.</E.Text>
          </E.Box>
        )}
      </E.Box>
    ) : null,
  ]

  const notice = stale ? (
    <E.Box key="dv-review" flexDirection="column" gap={1} padding={1} borderStyle="round" borderColor={C.espresso} backgroundColor={C.butterTint}>
      <E.Text weight="bold" color={C.espresso}>Needs review</E.Text>
      <E.Text color={C.ink} wrap="wrap">{unsettled
        ? `This direction was written while some of your follow-up answers were saved under the wrong question${rv.claimsMissing ? ', and part of it wrongly says an answer was missing' : ''}. My recommendation is on hold until they're checked.`
        : 'Your answers are corrected, but this direction was written before that. I can rewrite just this direction from your corrected answers; the current version is kept in its history.'}</E.Text>
      {OpSlot($, c, `regen-${x.id}`, [Row(E, unsettled
        ? [Btn(E, 'dv-review-go', 'Review affected answers', () => go($, { view: 'discover', stage: 'repair', from: here }), true)]
        : [Btn(E, 'dv-regen', 'Rewrite this direction', () => rewriteDirection($, x.id), true), Btn(E, 'dv-keep', 'Keep it as it is', () => markReviewed($, x.id))])])}
      {!unsettled ? <E.Text size="footnote" color={BODY} wrap="wrap">Rewriting is one request on your plan. Nothing else in your garden changes.</E.Text> : null}
    </E.Box>
  ) : null

  const take = !stale ? (
    <E.Box key="dv-take" flexDirection="column" gap={1} padding={1} borderStyle="round" borderColor={C.blue} backgroundColor={C.white}>
      {Note(c, "Uncapped's take")}
      <E.Text color={C.ink} wrap="wrap">{v.appeal}</E.Text>
      {v.limitation ? <E.Text color={C.ink} wrap="wrap">{`The catch: ${lowerFirst(v.limitation)}`}</E.Text> : null}
      {v.basis ? <E.Text size="footnote" color={BODY} wrap="wrap">{`Based on: ${v.basis}`}</E.Text> : null}
    </E.Box>
  ) : null

  const fact = (key, label, value, tag) => (
    <E.Box key={key} flexDirection="column" gap={0} minWidth={18} flexGrow={1}>
      <E.Text size="caption" weight="bold" color={BODY}>{label.toUpperCase()}</E.Text>
      <E.Text weight="semibold" color={C.espresso} wrap="wrap">{value}</E.Text>
      {tag ? <E.Text size="footnote" color={tag === 'demo data' ? C.espresso : BODY}>{tag === 'demo data' ? 'DEMO DATA' : tag}</E.Text> : null}
    </E.Box>
  )
  const facts = (
    <E.Box key="dv-facts" flexDirection="row" flexWrap="wrap" columnGap={3} rowGap={1}>
      {fact('f-price', `Price per ${m.M?.unit || 'sale'}`, m.priceLow != null ? fmtRange({ lo: m.priceLow, hi: m.priceHigh }, cur) : 'not set', priceTag)}
      {fact('f-work', 'Estimated work', workText, workTag)}
      {fact('f-evidence', 'Evidence', evidence, st.exp ? '' : 'nothing tested yet')}
    </E.Box>
  )

  const nextAction = !stale ? (
    <E.Box key="dv-next" flexDirection="column" gap={1} padding={1} borderStyle="round" borderColor={C.espresso} backgroundColor={C.butterTint}>
      <E.Text size="caption" weight="bold" color={C.espresso}>RECOMMENDED NEXT STEP</E.Text>
      <E.Text weight="semibold" color={C.espresso} wrap="wrap">{st.exp ? 'Run your test, then report what happened' : x.nextTest?.label || 'Plan a validation test'}</E.Text>
      <E.Text color={C.ink} wrap="wrap">{st.exp ? `Your plan is in Experiments & validation: ${st.exp.title}.` : `What we need to learn: ${v.learn}`}</E.Text>
      {!st.exp && x.startWith ? <E.Text color={C.ink} wrap="wrap">{`Start with: ${x.startWith}`}</E.Text> : null}
      {!st.exp && x.startWith ? <E.Text size="footnote" color={BODY} wrap="wrap">A starting point to test, not the whole market. The direction stays wider than this first test.</E.Text> : null}
      {OpSlot($, c, `dir-test-${x.id}`, [Row(E, [st.exp
        ? Btn(E, 'dv-open-test', 'Open the test plan', () => go($, { view: 'experiment', id: st.exp.id, from: here }), true)
        : Btn(E, 'dv-plan', x.nextTest?.label || 'Plan a validation test', () => planExperiment($, { directionId: x.id }, '', `dir-test-${x.id}`), true)]),
        !st.exp ? <E.Text key="dv-plan-what" size="footnote" color={BODY} wrap="wrap">Writes a short test plan (who to approach, messages, questions, what to record and a review date) and saves it in Experiments & validation. One request on your plan.</E.Text> : null])}
    </E.Box>
  ) : null

  // ---- on demand
  const offerBody = [
    Fact(E, 'od-offer', x.firstOffer ? 'The first offer' : 'The offer', x.firstOffer || x.title),
    Fact(E, 'od-buyer', x.firstOffer ? 'Who might buy it' : "Who it's for", x.buyer),
    Fact(E, 'od-problem', 'Their problem', x.problem),
    Fact(E, 'od-outcome', 'What they walk away with', x.handover),
    Fact(E, 'od-now', x.firstOffer ? 'What might make them look for it' : 'What creates the buying moment', x.whyNow),
    x.shape?.format ? Fact(E, 'od-shape', 'Its shape', `${x.shape.format}${x.shape.scope ? `. ${x.shape.scope}` : ''}`) : null,
    (x.shape?.receives || []).length ? Fact(E, 'od-receives', 'What the buyer receives', x.shape.receives.join('; ')) : null,
    x.delivery ? Fact(E, 'od-delivery', 'What it takes to deliver', x.delivery) : null,
    x.reach ? Fact(E, 'od-reach', 'How you could reach buyers', x.reach) : null,
  ]
  const fit = fitLines(x, work.profile)
  const takeaway = m.complete
    ? `About ${fmtRange(m.profit, cur)} profit a month for about ${m.hours} hours of work, roughly ${fmtRange(m.rate, cur)} an hour.${demo ? ' (Demo data.)' : ' (Estimates.)'}`
    : `${priceText2}${v.legacy ? ', from your earlier garden' : ''}. The monthly money isn't worked out yet, so I won't guess a total.`
  const est = (val, tag = 'estimate') => (val == null ? 'unknown' : `${val}`) + (val == null ? '' : `  ·  ${demo ? 'demo data' : tag}`)
  const wo = demo ? 'worked out from demo data' : 'worked out from estimates'
  const calcGroup = (key, title, rows) => (
    <E.Box key={key} flexDirection="column" gap={0}>
      <E.Text size="caption" weight="bold" color={BODY}>{title.toUpperCase()}</E.Text>
      {rows.map(([l, val], n) => (
        <E.Box key={`${key}-${n}`} flexDirection="row" flexWrap="wrap" justifyContent="space-between" columnGap={2}>
          <E.Text color={C.ink} wrap="wrap">{l}</E.Text>
          <E.Text color={C.espresso}>{val}</E.Text>
        </E.Box>
      ))}
    </E.Box>
  )
  const M = m.M || { unit: 'sale', run: 'sale', runs: 'sales' }
  const calc = [
    calcGroup('cg-rev', 'Revenue', [
      [`Price per ${M.unit}`, `${m.priceLow != null ? fmtRange({ lo: m.priceLow, hi: m.priceHigh }, cur) : 'unknown'}  ·  ${priceTag}`],
      ...(m.model === 'seats' ? [['Paying attendees per event', est(m.buyersPerRun)]] : []),
      [m.model === 'subscription' ? 'Paying subscribers' : m.model === 'product' ? 'Items sold a month' : `${M.runs[0].toUpperCase()}${M.runs.slice(1)} a month`, est(m.runs)],
      ...(m.model === 'seats' || m.model === 'talk' || m.model === 'project' ? [[`Revenue per ${M.run}`, m.perRunRevenue ? `${fmtRange(m.perRunRevenue, cur)}  ·  ${wo}` : 'unknown']] : []),
      ['Revenue a month', m.revenue ? `${fmtRange(m.revenue, cur)}  ·  ${wo}` : 'unknown'],
    ]),
    calcGroup('cg-cost', 'Costs', [
      [`Costs per ${M.run}${m.costNote ? ` (${m.costNote})` : ''}`, est(m.costPerRun != null ? fmtMoney(m.costPerRun, cur) : null)],
      ...(m.fixedCostsPerMonth ? [['Fixed costs a month', est(fmtMoney(m.fixedCostsPerMonth, cur))]] : []),
      ['Costs a month', m.costs != null ? `${fmtMoney(m.costs, cur)}  ·  ${wo}` : 'unknown'],
    ]),
    calcGroup('cg-time', 'Total working time', [
      ...(m.model !== 'subscription' ? [[`Preparing and delivering, per ${M.run}`, perRun == null ? 'unknown' : `${perRun} hours  ·  ${demo ? 'demo data' : v.legacy ? 'from your earlier garden' : 'estimate'}`]] : []),
      ...(m.model === 'subscription' ? [['Writing or making it, a month', est(m.hoursMaking)]] : []),
      ['Finding buyers, a month', est(m.hoursSales != null ? `${m.hoursSales} hours` : null)],
      ['Admin, a month', est(m.hoursAdmin != null ? `${m.hoursAdmin} hours` : null)],
      ['All your hours, a month', m.hours != null ? `${m.hours} hours  ·  ${wo}` : 'unknown'],
    ]),
    calcGroup('cg-profit', 'Profit and fit with your goal', [
      ['Profit a month', m.profit ? `${fmtRange(m.profit, cur)}  ·  ${wo}` : 'unknown'],
      ['Profit per working hour', m.rate ? `${fmtRange(m.rate, cur)}  ·  ${wo}` : 'unknown'],
    ]),
    ...(m.complete ? fit.slice(1) : fit).map((l, n) => <E.Text key={`cg-fit-${n}`} color={C.ink} wrap="wrap">{l}</E.Text>),
    Small(E, 'A figure worked out from estimates is still an estimate. Your goal says whether this fits your life; it never sets what customers pay.', { color: BODY }),
  ]
  const moneyBody = [
    T(E, takeaway, { color: C.ink }),
    x.viability ? <E.Text key="mb-viable" color={C.ink} wrap="wrap">{`Is it practical: ${x.viability}`}</E.Text> : null,
    ...(m.complete ? fit.slice(0, 1).map((l, n) => <E.Text key={`mb-fit-${n}`} color={C.ink} wrap="wrap">{l}</E.Text>) : []),
    !v.legacy && (m.why || x.priceWhy) ? Small(E, `Why this price: ${m.why || x.priceWhy}`, { color: C.ink }) : null,
    v.legacy ? Small(E, 'The reasoning saved with this price came from the earlier version, which priced from your income goal, so it isn\'t shown as current.', { color: BODY }) : null,
    OpSlot($, c, `numbers-${x.id}`, !m.complete && v.legacy ? [Row(E, [Btn(E, 'dv-numbers', 'Work out the numbers', () => workOutNumbers($, x.id, `numbers-${x.id}`))]), Small(E, 'One short request on your plan. Claude estimates attendees, costs and hours from the buyer, not from your goal; the sums are done here.', { color: BODY })] : []),
    Disclosure($, c, `calc-${x.id}`, 'View calculation and assumptions', m.complete ? 'revenue, costs, time, profit' : `${m.missing.length} figures still unknown`, calc),
  ]
  const linked = linkedTests(work, x)
  const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) } catch (e) { return '' } }
  const KIND = { comparable: 'Comparable offer', price: 'Published price', 'buyer-language': 'How buyers put it', alternative: 'What buyers do instead', obstacle: 'Obstacle' }
  const researchBody = [
    <E.Text key="ev-you-h" size="caption" weight="bold" color={BODY}>FROM YOUR ANSWERS</E.Text>,
    x.basis ? Small(E, `Your experience: ${BASIS[x.basis] || x.basis}`, { color: C.ink }) : null,
    T(E, x.whyYou || 'Nothing specific yet.', { color: C.ink }),
    x.fitEnergy ? Small(E, `Energy: ${x.fitEnergy}`, { color: C.ink }) : null,
    x.demand?.evidence ? Small(E, `Demand so far: ${x.demand.evidence}${{ same: ' (for this offer)', adjacent: ' (for related work, so not yet demand for this offer)', none: '' }[x.demand.closeness] ?? ''}`, { color: C.ink }) : null,
    (work.discover?.reading?.signals?.demand || []).length ? Small(E, `What you told me: ${(work.discover.reading.signals.demand || []).map((dm) => `${demandText(dm)} (${dm.paid ? 'paid' : 'asked, not paid'})`).join('; ')}.`, { color: BODY }) : null,
    <E.Text key="ev-res-h" size="caption" weight="bold" color={BODY}>FROM RESEARCH</E.Text>,
    ...(research.length ? research.flatMap((r, n) => [
      <E.Text key={`rs-h-${n}`} weight="semibold" color={C.espresso} wrap="wrap">{`Researched ${fmtDate(r.at)}: ${(r.items || []).length} source${(r.items || []).length === 1 ? '' : 's'}${(r.couldntRead || []).length ? `, ${r.couldntRead.length} couldn't be read` : ''}`}</E.Text>,
      ...(r.items || []).map((it, k) => (
        <E.Box key={`rs-${n}-${k}`} flexDirection="column" gap={0}>
          <E.Text size="caption" weight="bold" color={BODY}>{(KIND[it.kind] || 'Source').toUpperCase()}</E.Text>
          <E.Text color={C.ink} wrap="wrap">{it.fact}</E.Text>
          {it.url ? <E.Link key={`rs-l-${n}-${k}`} href={it.url} label={`${it.title || it.url.replace(/^https?:\/\//, '').slice(0, 50)}${it.date ? ` (${it.date})` : ''}`} /> : null}
        </E.Box>
      )),
      ...(r.inferences || []).map((t2, k) => <E.Text key={`rs-inf-${n}-${k}`} size="footnote" color={BODY} wrap="wrap">{`What I infer: ${t2}`}</E.Text>),
    ]) : [T(E, 'Nothing on this page comes from market research yet.', { color: C.ink })]),
    ...OpSlot($, c, `research-${x.id}`, research.length
      ? [Row(E, [Btn(E, 'dv-update-research', 'Update the recommendation with this research', () => rewriteDirection($, x.id, `research-${x.id}`, false, 'research')), Btn(E, 'dv-research-again', 'Research again', () => startResearch($, x.id, `research-${x.id}`, true))]), Small(E, 'Updating rewrites this direction from your answers and the research. The current version is kept in its history. One request on your plan.', { color: BODY })]
      : [Row(E, [Btn(E, 'dv-research', 'Research this direction', () => startResearch($, x.id))]), Small(E, `Looks for comparable offers, published prices, the words buyers use, what they do instead and any obstacles: at most ${RESEARCH_LIMITS.searches} searches, on your own Claude plan (Claude may ask you to allow web search). Every source is saved with its link and date.`, { color: BODY })]),
    <E.Text key="ev-tests-h" size="caption" weight="bold" color={BODY}>FROM YOUR TESTS</E.Text>,
    ...(linked.some((t3) => (t3.findings || []).length) ? linked.flatMap((t3) => (t3.findings || []).map((f, k) => <E.Text key={`ev-f-${t3.id}-${k}`} color={C.ink} wrap="wrap">{`${t3.title}: ${f.summary}`}</E.Text>)) : [T(E, 'No findings yet. A test is how this gets real evidence from buyers.', { color: C.ink })]),
    Small(E, 'Similar offers, published prices, followers or likes show what exists. They never prove that buyers will pay you.', { color: BODY }),
  ]
  const asBody = [
    ...v.assumptions.map((a, n) => (
      <E.Box key={`as-${n}`} flexDirection="column" gap={0}>
        <E.Text color={C.ink} wrap="wrap">{a.belief || a.text}</E.Text>
        <E.Text size="footnote" color={BODY}>{`${SOURCE_WORDS[String(a.source || '').toLowerCase()] || 'Assumption'}${a.risk ? `  ·  ${a.risk} risk` : ''}`}</E.Text>
      </E.Box>
    )),
    v.toTest ? Fact(E, 'as-decides', 'The question that decides it', v.toTest, { italic: true }) : null,
    ...research.flatMap((r) => r.stillNeeds || []).slice(0, 4).map((t2, k) => <E.Text key={`as-sn-${k}`} color={C.ink} wrap="wrap">{`Needs buyer conversations or a paid test: ${t2}`}</E.Text>),
    v.hiddenLinks ? (
      <E.Box key="as-links" flexDirection="column" gap={0}>
        <E.Text size="footnote" color={BODY} wrap="wrap">{`Left out: ${v.hiddenLinks === 1 ? 'one point' : `${v.hiddenLinks} points`} from the earlier version that tied this idea to your other work. You haven't chosen that link, so this is judged on its own.`}</E.Text>
        <E.Box flexDirection="row"><E.Button key="as-link-keep" variant="secondary" label="I do want that link" onPress={later(() => chooseLink($, x.id))} /></E.Box>
      </E.Box>
    ) : null,
  ]
  const highRisk = v.assumptions.filter((a) => a.risk === 'high').length
  const assets = linkedAssets(work, x)
  const testsBody = linked.length
    ? linked.map((t3) => (
      <E.Box key={`dt-${t3.id}`} flexDirection="row" flexWrap="wrap" gap={1} alignItems="center" justifyContent="space-between">
        <E.Text color={C.ink} wrap="wrap">{`${STATUS_WORD[t3.status] || t3.status}: ${t3.title}`}</E.Text>
        <E.Button key={`dt-open-${t3.id}`} label="Open" onPress={later(() => go($, { view: 'experiment', id: t3.id, from: here }))} />
      </E.Box>
    ))
    : [T(E, 'No tests yet. The recommended next step above plans one.', { color: C.ink })]
  const assetsBody = assets.length
    ? assets.map((a) => <E.Text key={`da-${a.id}`} color={C.ink} wrap="wrap">{`${a.title}${a.review ? '  ·  update suggested' : ''}`}</E.Text>)
    : [T(E, "Nothing uses this direction yet. You can use it in a builder while you test it; its assumptions and evidence travel with it, labeled as untested.", { color: C.ink })]
  const sources = research.reduce((n2, r) => n2 + (r.items || []).length, 0)
  const grow = (x.growInto || []).filter((g) => g && (g.name || typeof g === 'string'))
  const scopeBody = [
    x.whyThisScope ? T(E, x.whyThisScope, { color: C.ink }) : null,
    grow.length ? <E.Text key="sc-grow-h" size="caption" weight="bold" color={BODY}>OTHER OFFERS OR AUDIENCES IT COULD GROW INTO</E.Text> : null,
    ...grow.map((g, n) => (
      <E.Box key={`sc-grow-${n}`} flexDirection="column" gap={0}>
        <E.Text weight="semibold" color={C.espresso} wrap="wrap">{typeof g === 'string' ? g : g.name}</E.Text>
        {typeof g !== 'string' && (g.buyer || g.receives) ? <E.Text size="footnote" color={C.ink} wrap="wrap">{[g.buyer ? `For ${lowerFirst(g.buyer)}` : '', g.receives ? `They get ${lowerFirst(g.receives)}` : ''].filter(Boolean).join('. ')}</E.Text> : null}
        {!st.offer && typeof g !== 'string' ? <E.Box flexDirection="row"><E.Button key={`dv-use-grow-${n}`} variant="secondary" label="Work on this offer instead" onPress={later(() => chooseDirection($, x.id, n))} /></E.Box> : null}
      </E.Box>
    )),
  ].filter(Boolean)
  const sections = [
    Disclosure($, c, `offer-${x.id}`, x.firstOffer ? 'The first offer' : 'Offer details', x.shape?.format ? lowerFirst(x.shape.format) : "who it's for, what they get", offerBody),
    scopeBody.length ? Disclosure($, c, `scope-${x.id}`, 'Why this scope, and what it could grow into', grow.length ? `${grow.length} other offer${grow.length === 1 ? '' : 's'} or audience${grow.length === 1 ? '' : 's'}` : 'why it starts here', scopeBody) : null,
    Disclosure($, c, `market-${x.id}`, 'Evidence', [research.length ? `${sources} source${sources === 1 ? '' : 's'}, researched ${fmtDate(research[research.length - 1].at)}` : 'not researched yet', linked.some((t3) => (t3.findings || []).length) ? 'findings in' : 'no buyer findings yet'].join(' · '), researchBody),
    Disclosure($, c, `as-${x.id}`, 'Still to find out', `${v.assumptions.length} assumption${v.assumptions.length === 1 ? '' : 's'}${highRisk ? `, ${highRisk} high risk` : ''}`, asBody, { forceOpen: false }),
    Disclosure($, c, `money-${x.id}`, 'Pricing and economics', m.complete ? `${fmtRange(m.profit, cur)} profit a month${demo ? ' (demo data)' : ' (estimate)'}` : 'monthly money not worked out yet', moneyBody),
    Disclosure($, c, `tests-${x.id}`, 'Experiments', linked.length ? `${linked.length} test${linked.length === 1 ? '' : 's'}` : 'none yet', testsBody),
    Disclosure($, c, `assets-${x.id}`, 'Assets', assets.length ? `${assets.length} use it` : 'none yet', assetsBody),
  ]

  // ---- secondary options, each saying what it does
  const option = (key, label, what, onPress) => (
    <E.Box key={`opt-${key}`} flexDirection="column" gap={0}>
      <E.Box flexDirection="row"><E.Button key={key} label={label} onPress={later(onPress)} /></E.Box>
      <E.Text size="footnote" color={BODY} wrap="wrap">{what}</E.Text>
    </E.Box>
  )
  const options = stale ? [option('dv-all', 'Back to all directions', 'Your garden, to compare every direction.', () => go($, { view: 'discover', stage: 'garden' }))] : [
    option('dv-shortlist', work.discover.shortlist?.[x.id] ? 'Remove from shortlist' : 'Shortlist it', 'Keeps it to compare with others. Nothing is decided.', () => toggleShortlist($, x.id)),
    option('dv-refine', 'Something feels off', 'Tell me what, in your words. I\'ll suggest changes for you to accept or reject.', () => setUi($, { refineOpen: ui.refineOpen === x.id ? null : x.id })),
    ui.refineOpen === x.id ? (
      <E.Box key="dv-refine-box" flexDirection="column" gap={1}>
        <E.Input key={`refine.${x.id}`} label="What feels off?" value={ui.drafts[`refine.${x.id}`] || ''} rows={6} onInput={(val) => setDraft($, `refine.${x.id}`, val)} onSubmit={(val) => setDraft($, `refine.${x.id}`, val)} />
        {Row(E, [Btn(E, 'dv-refine-chat', 'Talk it through in the chat', () => refineInChat($, x)), Btn(E, 'dv-refine-close', 'Close', () => setUi($, { refineOpen: null }))])}
      </E.Box>
    ) : null,
    st.offer || x.firstOffer ? null : option('dv-use', 'Use as my working offer', 'Makes it your current best guess to test. It isn\'t proven or permanent, and you can switch any time.', () => chooseDirection($, x.id)),
    st.offer || (work.offers || []).some((o) => o.fromDirection === x.id) ? null : option('dv-keep-stream', 'Keep as a possible income stream', 'Saves it under Saved info to come back to. Nothing is decided.', () => keepAsStream($, x.id)),
    option('dv-all', 'Back to all directions', 'Your garden, to compare every direction.', () => go($, { view: 'discover', stage: 'garden' })),
  ]

  const main = [...head, notice, take, facts, nextAction, Rule(c, 'dv-rule'), ...sections].filter(Boolean)
  const side = [<E.Text key="dv-opt-h" size="caption" weight="bold" color={BODY}>OTHER OPTIONS</E.Text>, ...options].filter(Boolean)
  if (!wide) return [...main, Rule(c, 'dv-rule2'), ...side]
  return [
    <E.Box key="dv-cols" flexDirection="row" columnGap={3} alignItems="flex-start">
      <E.Box key="dv-main" flexDirection="column" gap={1} width="64%">{main}</E.Box>
      <E.Box key="dv-side" flexDirection="column" gap={1} width="32%" paddingTop={6}>{side}</E.Box>
    </E.Box>,
  ]
}

// Tests for a direction: planned from it, or from an offer made from it.
function linkedTests(work, x) {
  const offerIds = (work.offers || []).filter((o) => o.fromDirection === x.id || (work.discover.chosenId === x.id && o.id === work.activeOfferId)).map((o) => o.id)
  return (work.experiments || []).filter((t) => t.source?.directionId === x.id || offerIds.includes(t.source?.offerId))
}

// Builder results built from an offer made from this direction.
function linkedAssets(work, x) {
  const offerIds = (work.offers || []).filter((o) => o.fromDirection === x.id || (work.discover.chosenId === x.id && o.id === work.activeOfferId)).map((o) => o.id)
  return BUILDERS.filter((b) => b.id !== 'discover' && work.builders?.[b.id]?.output && offerIds.includes(work.builders[b.id].basedOn?.offerId)).map((b) => ({ id: b.id, title: b.title.replace('The ', ''), review: work.builders[b.id].review?.state === 'suggested' }))
}

async function toggleSection($, key, group) {
  if (!group) return update($, uiA, (u) => ({ ...u, sec: { ...(u.sec || {}), [key]: !u.sec?.[key] } }))
  let opened = false
  await update($, uiA, (u) => { opened = u.grp?.[group] !== key; return { ...u, grp: { ...(u.grp || {}), [group]: opened ? key : null } } })
  if (opened) { try { await $.ui.scroll({ to: { key: `sec-${key}` }, in: PANE }) } catch (e) {} }
}

async function chooseLink($, id) {
  await mutate($, (w) => { const x = (w.discover.early?.directions || []).find((y) => y.id === id); if (x) x.linkChosen = true }, ['discover'])
}

// Rewrites one direction from corrected answers. The current version is kept
// in that direction's history; nothing else in the garden changes.
async function rewriteDirection($, id, place = `regen-${id}`, fresh = false, why = 'repair') {
  const w = await getWork($)
  const d = (w.discover.early?.directions || []).find((x) => x.id === id)
  if (!d) return null
  const { history, ...current } = d
  const out = await ask($, directionPrompt(w, current, METHODS), {
    label: why === 'research' ? 'Updating the recommendation with the research' : 'Rewriting this direction',
    explain: why === 'research' ? "Rewriting this direction from your answers and the research: what it supports, what it doesn't, and the price basis. The current version is kept." : 'From your corrected answers, in the current format: a short summary, my take, the money worked out from the buyer, and the next test. The current version is kept.',
    steps: [], builder: 'discover', kind: 'direction', name: 'direction', target: id, args: { id }, deep: true, maxTokens: 12000, effort: 'medium', place, fresh,
  })
  if (!out) return null
  await mutate($, (w2) => {
    const list = w2.discover.early?.directions || []
    const n = list.findIndex((x) => x.id === id)
    if (n < 0) return false
    const prev = list[n]
    const { history: h, ...prevCurrent } = prev
    list[n] = { ...out, id, history: [{ at: now(), reason: why === 'research' ? 'updated with research' : 'rewritten after correcting copied answers', version: prevCurrent }, ...(h || [])].slice(0, 5) }
    const ar = (w2.discover.answerRepair = w2.discover.answerRepair || {})
    ar.reviewed = { ...(ar.reviewed || {}), [id]: now() }
    w2.events.unshift({ at: now(), text: `Rewrote one direction from your corrected answers: ${cleanShort(list[n])}.` })
    return true
  }, ['discover'])
  await opResult($, { intro: why === 'research' ? 'Updated with the research. The earlier version is kept in its history.' : 'Rewritten from your corrected answers. The earlier version is kept in its history.', nextWhy: 'Read my take and the next step at the top of this page.' })
  return out
}

async function toggleShortlist($, id) {
  await mutate($, (w) => { w.discover.shortlist = { ...(w.discover.shortlist || {}), [id]: !w.discover.shortlist?.[id] } }, ['discover'])
}

async function researchInChat($, x) {
  await $.prompt.submit({ text: `Research the market for one of my portfolio garden directions: "${x.title}" (for ${x.buyer}). Look for similar offers and what they charge, and where these buyers talk about this problem. Keep what pages say apart from what you infer, link every source, say when a page couldn't be read, and save it with save_research so it shows in the Uncapped panel. Remember that similar businesses don't prove anyone will pay me.`, asUser: true })
}

async function refineInChat($, x) {
  const ui = await read($, uiA)
  const said = String(ui.drafts[`refine.${x.id}`] || '').trim()
  await $.prompt.submit({ text: `In my portfolio garden, the direction "${x.title}" feels off to me.${said ? ` In my words: ${said}` : ''} Suggest specific changes to the offer (buyer, format, price or scope) for me to accept or reject, and don't change anything until I say yes.`, asUser: true })
}

// ---------- follow-up answers saved under the wrong question (0.2.0) ----------
function themeName(id) {
  const t = THEMES.find((x) => x.id === id)
  return t ? t.label : id
}

function RepairNotice($, c) {
  const { E, work, nav } = c
  const r = needsReview(work)
  if (r.pairs.length) {
    return [Card(E, [
      Head(E, r.pairs.length === 1 ? 'One follow-up answer needs checking' : `${r.pairs.length} follow-up answers need checking`),
      T(E, "In the last version, the follow-up answer boxes kept your earlier answers, so some were saved under a second question too. Your first answer to each question wasn't affected. Your portfolio garden was built while these copies were saved, so treat it as needing review."),
      Row(E, [Btn(E, 'repair-open', 'Check them', () => go($, { view: 'discover', stage: 'repair' }), true)]),
    ], { tint: C.butterTint, key: 'repair-notice' })]
  }
  if (r.garden && nav.stage !== 'repair') {
    return [Card(E, [
      Head(E, 'Your portfolio garden needs a review'),
      T(E, `It was built while some follow-up answers were saved under the wrong question. ${Object.keys(r.directions).length ? `Directions marked "Needs review" used those answers directly; the others may have been influenced too.` : 'None of the directions names them directly, but all of them were read from every answer.'} Nothing has been rebuilt or replaced.`),
      ...OpSlot($, c, 'repair-garden', [Row(E, [Btn(E, 'repair-rebuild', 'Rebuild it with my corrected answers', () => runEarlyRead($, 'repair-garden')), Btn(E, 'repair-reviewed', "I've reviewed it", () => markReviewed($, 'garden'))])]),
    ], { tint: C.butterTint, key: 'repair-notice' })]
  }
  return []
}

function ReviewBadge($, c, key, why) {
  const { E } = c
  return (
    <E.Box key={`rb-${key}`} flexDirection="column" gap={0} padding={1} borderStyle="round" borderColor={C.espresso} backgroundColor={C.butterTint}>
      <E.Text weight="bold" color={C.espresso}>Needs review</E.Text>
      <E.Text color={C.ink} wrap="wrap">{why}</E.Text>
      <E.Box flexDirection="row" gap={1}><E.Button key={`rb-ok-${key}`} variant="secondary" label="Mark as reviewed" onPress={later(() => markReviewed($, key))} /></E.Box>
    </E.Box>
  )
}

function reviewWhy(v) {
  if (!v) return ''
  if (v.claimsMissing) return 'Part of this says one of your answers was missing. It wasn\'t: a different answer had been saved under that question by mistake. Read it with that in mind.'
  return `Built partly from a follow-up answer that was saved under the wrong question${v.hits?.length ? ` (it mentions ${v.hits.map((h) => h[0].toUpperCase() + h.slice(1)).join(', ')})` : ''}.`
}

function DiscoverRepair($, c) {
  const { E, ui, work } = c
  const r = needsReview(work)
  const out = [
    Crumbs($, c, [{ label: 'Discover', go: { view: 'discover', stage: 'overview' } }, { label: 'Check your follow-up answers' }]),
    Title(c, 'Check your follow-up answers', 26),
    T(E, "Each pair below is two follow-up questions holding exactly the same answer. It was most likely typed for one of them and copied to the other by a bug. Your saved file doesn't record which, so I won't guess: tell me where it belongs. Nothing changes until you choose, and a backup of your answers is made first."),
  ]
  if (!r.pairs.length) out.push(Card(E, [Head(E, 'All checked'), T(E, 'Every follow-up answer now sits under one question you chose.')], { tint: C.white }))
  r.pairs.forEach((p, n) => {
    const pick = ui.repairPick?.[p.key]
    const other = pick === 'first' ? p.second : pick === 'second' ? p.first : null
    const kept = pick === 'first' ? p.first : pick === 'second' ? p.second : null
    const qBlock = (x, which) => (
      <E.Box key={`rq-${p.key}-${which}`} flexDirection="column" gap={0} paddingTop={1}>
        <E.Text size="caption" weight="bold" color={C.taupeInk}>{`${which === 'a' ? 'FIRST' : 'SECOND'} QUESTION · ${themeName(x.theme).toUpperCase()}`}</E.Text>
        <E.Text weight="semibold" color={C.espresso} wrap="wrap">{x.q}</E.Text>
      </E.Box>
    )
    const body = [
      Label(E, `Pair ${n + 1} of ${r.pairs.length}`, C.blue),
      qBlock(p.first, 'a'),
      qBlock(p.second, 'b'),
      <E.Box key={`ra-${p.key}`} flexDirection="column" gap={0} paddingTop={1}>
        <E.Text size="caption" weight="bold" color={C.taupeInk}>SAVED UNDER BOTH</E.Text>
        <E.Text italic color={C.ink} wrap="wrap">{`"${p.answer}"`}</E.Text>
      </E.Box>,
    ]
    if (!pick) {
      body.push(T(E, 'Which question was this answer for?', { weight: 'semibold' }))
      body.push(Row(E, [
        Btn(E, `rp-first-${n}`, 'The first question', () => setRepairPick($, p.key, 'first')),
        Btn(E, `rp-second-${n}`, 'The second question', () => setRepairPick($, p.key, 'second')),
        Btn(E, `rp-both-${n}`, 'Both', () => settleCopy($, p.key, 'both')),
      ]))
    } else {
      body.push(T(E, `It stays under the ${pick} question. It will be removed from the ${pick === 'first' ? 'second' : 'first'} one:`, { weight: 'semibold' }))
      body.push(<E.Text key={`ro-${p.key}`} color={C.espresso} wrap="wrap">{other.q}</E.Text>)
      body.push(<E.Input key={`repair.${p.key}`} label="Answer that question instead (optional: leave empty to clear it)" value={ui.drafts[`repair.${p.key}`] || ''} rows={4} onInput={(v) => setDraft($, `repair.${p.key}`, v)} onSubmit={(v) => setDraft($, `repair.${p.key}`, v)} />)
      body.push(Row(E, [Btn(E, `rp-save-${n}`, 'Save this', () => settleCopy($, p.key, pick), true), Btn(E, `rp-back-${n}`, 'Back', () => setRepairPick($, p.key, null))]))
      void kept
    }
    out.push(Card(E, body, { tint: C.white, key: `rp-${p.key}` }))
  })
  const dirs = Object.keys(r.directions)
  if (r.garden || dirs.length || Object.keys(r.offers).length) {
    const ds = (work.discover.early?.directions || []).filter((d) => r.directions[d.id])
    out.push(Card(E, [
      Head(E, 'What was built from these answers'),
      T(E, 'Your portfolio garden was built while the copies were saved. These used them directly:'),
      ...ds.map((d) => <E.Text key={`rd-${d.id}`} color={C.ink} wrap="wrap">{`·  ${shortTitle(d)}: ${reviewWhy(r.directions[d.id])}`}</E.Text>),
      ...Object.keys(r.offers).map((id) => <E.Text key={`ro2-${id}`} color={C.ink} wrap="wrap">{`·  Your working offer, ${(work.offers.find((o) => o.id === id) || {}).name || ''}: it came from one of these directions.`}</E.Text>),
      Small(E, "Nothing has been rebuilt or replaced. When you've corrected the answers, you can rebuild the garden, or review each one and keep it.", { color: C.ink }),
    ], { tint: C.cream }))
  }
  out.push(Row(E, [Btn(E, 'rp-done', 'Back to Discover', () => go($, { view: 'discover', stage: 'overview' }))]))
  return out
}

async function setRepairPick($, key, pick) {
  await update($, uiA, (u) => ({ ...u, repairPick: { ...(u.repairPick || {}), [key]: pick } }))
}

// Settles one pair. Backs up the answers first (once), then removes or
// replaces the copy under the question the person said it doesn't belong to.
// What was built from the copies stays marked until reviewed or rebuilt.
async function settleCopy($, key, keepWith) {
  const w = await getWork($)
  const r = needsReview(w)
  const pair = r.pairs.find((p) => p.key === key)
  if (!pair) return
  const ui = await read($, uiA)
  const other = keepWith === 'first' ? pair.second : keepWith === 'second' ? pair.first : null
  const replacement = other ? String(ui.drafts[`repair.${key}`] || '') : ''
  let backupDir = w.discover.answerRepair?.backup
  if (!backupDir) backupDir = await backupNow($, 'before-answer-repair')
  const ok = await mutate($, (w2) => {
    const ar = (w2.discover.answerRepair = w2.discover.answerRepair || {})
    ar.backup = ar.backup || backupDir
    ar.settled = ar.settled || []
    ar.reviewed = ar.reviewed || {}
    if (!ar.pending) ar.pending = { garden: r.garden, directions: r.directions, offers: r.offers, at: now() }
    if (other) {
      const t = editFollowup(w2.profile.answers[other.theme], other.q, other.a, replacement)
      if (t === null) return false
      w2.profile.answers[other.theme] = t
    }
    ar.settled.push({ key, choice: keepWith, at: now(), question: other?.q || '', cleared: Boolean(other && !replacement.trim()), replaced: Boolean(other && replacement.trim()) })
    w2.events.unshift({ at: now(), text: other ? 'Fixed a follow-up answer that was saved under the wrong question.' : 'Kept a follow-up answer under both of its questions.' })
    return true
  }, ['discover'])
  if (!ok) { await setUi($, { error: "Couldn't change that answer: it no longer matches what's saved. Nothing was changed." }); return }
  await update($, uiA, (u) => ({
    ...u,
    repairPick: { ...(u.repairPick || {}), [key]: null },
    drafts: Object.fromEntries(Object.entries(u.drafts || {}).filter(([k]) => k !== `repair.${key}`)),
    notice: other ? (replacement.trim() ? 'Saved: your new answer replaced the copy.' : 'Saved: the copy was removed. The answer stays under the question you chose.') : 'Saved: the answer stays under both questions.',
  }))
}

async function markReviewed($, key) {
  await mutate($, (w) => {
    const ar = (w.discover.answerRepair = w.discover.answerRepair || {})
    if (!ar.pending) { const r = needsReview(w); ar.pending = { garden: r.garden, directions: r.directions, offers: r.offers, at: now() } }
    ar.reviewed = { ...(ar.reviewed || {}), [key]: now() }
  }, ['discover'])
}

function DiscoverView($, c) {
  const { work, nav } = c
  const stage = nav.stage || 'overview'
  if (stage === 'question') return DiscoverQuestion($, c)
  if (stage === 'followups') return DiscoverFollowups($, c)
  if (stage === 'repair') return DiscoverRepair($, c)
  if (stage === 'direction' && work.discover.early) return DirectionView($, c)
  if (stage === 'garden' && work.discover.early) return DiscoverGarden($, c)
  if (stage === 'offer') return DiscoverOffer($, c)
  if (stage === 'done') return DiscoverDone($, c)
  return DiscoverOverview($, c)
}

// ---------- builders 02 to 10 ----------
const LABELS = {
  transformation: 'The transformation', packages: 'Packages', notFor: "Who it isn't for", expansion: 'Where it leads', anxietyReducer: 'What makes it an easy yes', capacity: 'Does it fit your week?', testFirst: 'Test it first',
  includes: "What's included", notIncluded: 'Not included', timeline: 'Timeline', priceWhy: 'Why that price', for: "Who it's for", role: 'Role',
  dinnerParty: 'Your dinner-party answer', credibility: 'Your credibility line', bioShort: 'Short bio', bioLong: 'Longer bio', proof: 'Proof you can use', proofGaps: 'Proof worth collecting', wordsToUse: 'Words to use', wordsToAvoid: 'Words to avoid',
  buyerOnLinkedIn: 'Is your buyer on LinkedIn?', about: 'About section', featured: 'Featured', experience: 'Experience entry', services: 'Services', skills: 'Skills', beforeYouEdit: 'Before you edit',
  themes: 'Your themes', cadence: 'Cadence', firstPiece: 'Your first piece',
  job: "Your newsletter's job", reader: 'Your one reader', promise: 'The promise', articles: 'Article plan', distribution: 'Getting it read', welcomeNote: 'Welcome note',
  needItYet: 'Do you need a website yet?', hero: 'Hero', gap: 'The gap', offers: 'What you offer', about2: 'About', faq: 'Questions people ask', closing: 'Closing', launchSteps: 'Launch steps',
  findMore: 'Where to find more buyers', weeklyCap: 'How many to contact', closingQuestion: 'End every conversation with',
  steps: 'From yes to first session', welcomeEmail: 'Welcome email', intake: 'Intake questionnaire', kickoff: 'Kickoff agenda', scope: 'Scope reminder',
  caveat: 'Before you start', booking: 'Your booking page', basics: 'The three basics', contract: 'Contract checklist', invoicing: 'Invoicing', accountant: 'Finding an accountant', checklist: 'Your checklist',
  headline: 'Headline', subhead: 'Subhead', cta: 'Button', heading: 'Heading', body: 'Body', points: 'Points', subject: 'Subject', questions: 'Questions', agenda: 'Agenda', mustHaves: 'Must-haves', redFlags: 'Get a lawyer if you see', employmentCheck: 'If you are employed', essentials: 'On every invoice', terms: 'Payment terms', whereToLook: 'Where to look', rules: 'Rules', length: 'Length', description: 'Description', title: 'Title', line: 'Line', subline: 'Supporting line', included: 'Included', contact: 'Contact between sessions',
}

function labelFor(k) {
  return LABELS[k] || (isNaN(Number(k)) ? k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()) : '')
}

// Draws any result generically: text you can edit, lists, and cards.
function Fields($, E, ui, id, value, path, depth) {
  const ed = ui.editing
  if (value == null) return []
  if (typeof value === 'string' || typeof value === 'number' || (Array.isArray(value) && value.every((v) => typeof v === 'string'))) {
    const isEditing = ed && ed.builder === id && ed.path === path
    const text = Array.isArray(value) ? value.map((v) => `·  ${v}`).join('\n') : String(value)
    const k = path.split('.').pop()
    const asks = ['hero.headline', 'banner.line'].includes(path) ? 'positioning' : undefined
    if (isEditing) {
      return [
        <E.Input key={`edit-${path}`} label={`Editing: ${labelFor(k)}`} value={ed.value} rows={Math.min(10, Math.max(2, Math.ceil(String(ed.value).length / 60)))} onInput={(v) => update($, uiA, (u) => ({ ...u, editing: { ...u.editing, value: v } }))} onSubmit={(v) => update($, uiA, (u) => ({ ...u, editing: { ...u.editing, value: v } }))} autoFocus />,
        ed.asks === 'positioning'
          ? Card(E, [T(E, 'This line is your positioning. Use the new wording everywhere, or just here?', { weight: 'semibold' }), Row(E, [Btn(E, 'save-everywhere', 'Everywhere', () => saveEdit($, 'everywhere'), true), Btn(E, 'save-here', 'Just here', () => saveEdit($, 'here')), Btn(E, 'cancel-edit', 'Cancel', () => setUi($, { editing: null }))])], { tint: C.butterTint })
          : Row(E, [Btn(E, 'save-edit', 'Save', () => saveEdit($), true), Btn(E, 'cancel-edit', 'Cancel', () => setUi($, { editing: null }))]),
      ]
    }
    return [
      <E.Box key={`f-${path}`} flexDirection="column" gap={0}>
        {k && labelFor(k) ? <E.Text size="caption" weight="bold" color={C.taupeInk}>{labelFor(k).toUpperCase()}</E.Text> : null}
        <E.Text color={C.ink}>{text}</E.Text>
        <E.Box flexDirection="row" gap={1}><E.Button key={`e-${path}`} label="Edit" variant="secondary" onPress={later(() => startEdit($, id, path, Array.isArray(value) ? value.join('\n') : value, asks))} /></E.Box>
      </E.Box>,
    ]
  }
  if (Array.isArray(value)) {
    const k = path.split('.').pop()
    return [
      k ? Label(E, labelFor(k)) : null,
      ...value.map((item, i) => Card(E, Fields($, E, ui, id, item, `${path}.${i}`, depth + 1), { tint: depth % 2 ? C.white : C.cream })),
    ]
  }
  return Object.entries(value).flatMap(([k, v]) => {
    if (typeof v === 'object' && v && !Array.isArray(v) && depth === 0) {
      return [Label(E, labelFor(k), C.blue), Card(E, Fields($, E, ui, id, v, path ? `${path}.${k}` : k, depth + 1))]
    }
    return Fields($, E, ui, id, v, path ? `${path}.${k}` : k, depth + 1)
  })
}

function NeedsCard($, E, ui, def, work) {
  const out = []
  if (def.needs?.includes('offer') && !activeOffer(work)) {
    out.push(Card(E, [
      Head(E, 'This builder needs an offer to work from'),
      T(E, "Discover is the best way to find one. If you already know what you're selling, describe it in a line and carry on."),
      <E.Input key="quickOffer" label="Your offer in one line: who it's for and what they get" placeholder="Four-week launch plans for founders of consumer brands" value={ui.drafts['quickOffer'] || ''} rows={2} onInput={(v) => setDraft($, 'quickOffer', v)} onSubmit={(v) => setDraft($, 'quickOffer', v)} />,
      Row(E, [Btn(E, 'quick-offer', 'Use this offer', () => quickOffer($), true), Btn(E, 'go-discover', 'Go to Discover', () => openBuilder($, 'discover'))]),
    ], { tint: C.butterTint }))
  }
  if (def.needs?.includes('positioning') && !work.positioning?.line) {
    out.push(Card(E, [
      T(E, 'Tip: this works best once the Brand Builder has given you a positioning line. You can carry on without it.'),
      Row(E, [Btn(E, 'go-brand', 'Open the Brand Builder', () => openBuilder($, 'brand'))]),
    ], { dashed: true, tint: C.cream }))
  }
  return out
}

function UsingCard($, E, def, work) {
  const o = activeOffer(work)
  const cur = work.profile.limits?.currency || '$'
  const lines = []
  if (o) lines.push(`Your offer: ${o.name}${o.buyer ? `, for ${o.buyer}` : ''}${o.status === 'draft' ? ' (draft)' : ''}`)
  if (o && priceText(o, cur)) lines.push(`Price to test: ${priceText(o, cur)}`)
  if (work.builders?.offer?.output && def.id !== 'offer') lines.push(`Your packages: ${(work.builders.offer.output.packages || []).map((p) => p.name).join(', ')}`)
  if (work.positioning?.line && ['linkedin', 'website', 'content', 'substack', 'sales'].includes(def.id)) lines.push(`Your positioning: ${work.positioning.line}`)
  if (work.profile.limits?.hours) lines.push(`Your week: ${work.profile.limits.hours} hours`)
  if (work.profile.energy?.never) lines.push(`Never again: ${work.profile.energy.never}`)
  if (!lines.length) return null
  return Card(E, [Label(E, "What I'm using from your other builders"), ...lines.map((l, i) => Small(E, `·  ${l}`, { key: `use-${i}` })), Small(E, "Something wrong? Change it at the source and I'll flag what needs a look.")], { dashed: true, tint: C.cream })
}

function ReviewCard($, E, ui, id, b) {
  const r = b.review
  if (!r || r.state === 'dismissed') return null
  if (r.proposal) {
    const p = r.proposal
    return Card(E, [
      Label(E, r.state === 'deferred' ? 'Suggested update, left for later' : 'Suggested update', C.blue),
      r.reason ? T(E, r.reason) : null,
      T(E, p.summary, { weight: 'medium' }),
      ...p.changes.slice(0, 8).flatMap((path, i) => [
        Small(E, labelFor(path.split('.').pop()) || path, { key: `pl-${i}`, weight: 'bold' }),
        <E.Text key={`pb-${i}`} color={C.taupe} strikethrough>{String(getPath(b.output, path) ?? '')}</E.Text>,
        <E.Text key={`pa-${i}`} color={C.ink}>{String(getPath(p.output, path) ?? '')}</E.Text>,
      ]),
      p.changes.length > 8 ? Small(E, `...and ${p.changes.length - 8} more small changes.`) : null,
      p.editedHits?.length ? T(E, 'Heads up: this would replace wording you edited yourself.', { weight: 'semibold', color: C.espresso }) : null,
      Row(E, [Btn(E, `approve-${id}`, 'Approve this update', () => approveRevision($, id), true), Btn(E, `later-${id}`, 'Later', () => deferReview($, id)), Btn(E, `keep-${id}`, 'Keep it as it is', () => dismissReview($, id))]),
      Small(E, 'Approving keeps the current version under "Earlier versions", so you can always go back.'),
    ], { tint: C.blueTint, border: C.blue })
  }
  return Card(E, [
    Label(E, r.state === 'deferred' ? 'Review later' : 'Review suggested', C.espresso),
    T(E, r.reason, { weight: 'medium' }),
    ...OpSlot($, DRAW, `review-${id}`, [Row(E, [Btn(E, `preview-${id}`, 'Show me the suggested changes', () => previewRevision($, id, `review-${id}`), true), r.state !== 'deferred' ? Btn(E, `defer-${id}`, 'Later', () => deferReview($, id)) : null, Btn(E, `dismiss-${id}`, 'Keep it as it is', () => dismissReview($, id))].filter(Boolean))]),
  ], { tint: C.butterTint })
}

function BuilderQuestions($, E, ui, def, work, nav) {
  const b = work.builders?.[def.id] || {}
  const qs = def.questions || []
  const step = Math.min(nav.step || 0, qs.length)
  if (step >= qs.length) {
    return [Card(E, [
      Head(E, b.output ? 'Rebuild with these answers?' : 'Ready when you are'),
      T(E, b.output ? 'Rebuilding keeps your current version under "Earlier versions".' : "I'll use your answers plus everything from your other builders."),
      ...OpSlot($, DRAW, `builder-${def.id}`, [Row(E, [Btn(E, 'build', b.output ? 'Rebuild' : `Build my ${RESULT_NAME[def.id] || def.title.replace('The ', '').replace(' Builder', '')}`, () => build($, def.id, `builder-${def.id}`), true), Btn(E, 'bq-back', 'Back', () => go($, { view: 'builder', builder: def.id, stage: 'questions', step: step - 1 })), b.output ? Btn(E, 'bq-result', 'Back to my results', () => go($, { view: 'builder', builder: def.id, stage: 'result' })) : null].filter(Boolean))]),
    ], { tint: C.blueTint })]
  }
  const q = qs[step]
  const key = `b.${def.id}.${q.id}`
  return [Card(E, [
    Small(E, `Question ${step + 1} of ${qs.length}`),
    ...Question($, E, ui, key, q, b.answers?.[q.id]),
    Row(E, [
      step > 0 ? Btn(E, 'bq-prev', 'Back', async () => { await saveBuilderAnswer($, def.id, q); await go($, { view: 'builder', builder: def.id, stage: 'questions', step: step - 1 }) }) : null,
      Btn(E, 'bq-next', 'Next', async () => { await saveBuilderAnswer($, def.id, q); await go($, { view: 'builder', builder: def.id, stage: 'questions', step: step + 1 }) }, true),
      q.optional ? Btn(E, 'bq-skip', 'Skip', () => go($, { view: 'builder', builder: def.id, stage: 'questions', step: step + 1 })) : null,
    ].filter(Boolean)),
  ])]
}

// The custom top of each builder's results; the rest is drawn by Fields.
function ResultTop($, E, ui, def, work, b) {
  const out = b.output
  const cur = work.profile.limits?.currency || '$'
  const hours = HOURS[work.profile.limits?.hours] || 0
  if (def.id === 'offer') {
    return (out.packages || []).map((p, i) => {
      const rate = p.hours ? Math.round((Number(p.priceLow) || 0) / p.hours) : 0
      return Card(E, [
        <E.Text key={`pr-${i}`} size="caption" weight="bold" color={p.role === 'core' ? C.blue : C.taupeInk}>{String(p.role || '').toUpperCase()}</E.Text>,
        Head(E, p.name),
        <E.Text key={`pp-${i}`} size="title" weight="bold" color={C.espresso}>{priceText(p, cur) || 'price to set'}</E.Text>,
        rate ? Small(E, `About ${cur}${rate} an hour of your time at the low end, if it takes ${p.hours} hours.${hours ? ` You have about ${Math.round(hours * 4.33)} hours a month.` : ''}`) : null,
        Small(E, 'A starting point to test, from your numbers.'),
      ], { tint: p.role === 'core' ? C.blueTint : C.white })
    })
  }
  if (def.id === 'brand') {
    const chosen = b.choices?.positioning
    return [
      Label(E, 'Pick the line that sounds most like you', C.blue),
      ...(out.positioning || []).map((p, i) => Card(E, [
        <E.Text key={`pos-${i}`} size="heading" weight="semibold" color={C.espresso}>{`"${p.line}"`}</E.Text>,
        Small(E, p.angle),
        Row(E, [Btn(E, `pick-pos-${i}`, chosen === i ? '✓ My line' : 'Use this one', () => chooseOption($, 'brand', 'positioning', i), chosen === i)]),
      ], { tint: chosen === i ? C.blueTint : C.white })),
      Small(E, 'These are drafts built from your words. Edit any of them below until they sound like you.'),
      Row(E, [Btn(E, 'use-bios', 'Save my line and bios as my positioning', () => useBios($))]),
    ]
  }
  if (def.id === 'linkedin') {
    const pick = b.choices?.headline ?? 0
    const before = b.answers?.currentHeadline
    return [
      Card(E, [
        <E.Box key="li-banner" padding={1} backgroundColor={C.blue} flexDirection="column"><E.Text italic weight="semibold" color={C.butter}>{out.banner?.line || ''}</E.Text><E.Text size="footnote" color={C.blueLight}>{out.banner?.subline || ''}</E.Text></E.Box>,
        T(E, work.profile.name || 'You', { weight: 'bold' }),
        before ? <E.Text key="li-before" color={C.taupe} strikethrough>{before}</E.Text> : null,
        T(E, out.headlines?.[pick] || '', { weight: 'semibold' }),
        Small(E, (out.about || '').slice(0, 220) + ((out.about || '').length > 220 ? '...' : '')),
      ], { tint: C.white }),
      Label(E, 'Headline options', C.blue),
      ...(out.headlines || []).map((h, i) => Row(E, [Btn(E, `pick-h-${i}`, pick === i ? '✓ Using' : 'Use', () => chooseOption($, 'linkedin', 'headline', i), pick === i), T(E, h)])),
    ]
  }
  if (def.id === 'content') {
    const sel = b.choices?.idea ?? null
    const ideas = out.ideas || []
    const parts = [Label(E, 'Your ideas. Pick one to write', C.blue)]
    ideas.forEach((idea, i) => parts.push(Row(E, [Btn(E, `idea-${i}`, sel === i ? '✓ Writing this' : 'Write this', () => chooseOption($, 'content', 'idea', i), sel === i), T(E, `${idea.title}  (${idea.theme}, ${idea.type})`)])))
    if (sel != null && ideas[sel]) {
      const idea = ideas[sel]
      parts.push(Card(E, [
        Head(E, idea.title),
        T(E, `Hook: ${idea.hook}`), T(E, `Story: ${idea.story}`), T(E, `Lesson: ${idea.lesson}`), T(E, `Invite: ${idea.invite}`),
        Small(E, `Comes from: ${idea.source || 'a suggestion'}`),
        <E.Input key={`draft.${sel}`} label="Write it here, in your own words" value={ui.drafts[`draft.${sel}`] ?? b.drafts?.[sel] ?? ''} rows={10} onInput={(v) => setDraft($, `draft.${sel}`, v)} onSubmit={(v) => setDraft($, `draft.${sel}`, v)} />,
        Small(E, `${String(ui.drafts[`draft.${sel}`] ?? b.drafts?.[sel] ?? '').split(/\s+/).filter(Boolean).length} words. LinkedIn posts land best at 150 to 300.`),
        ...OpSlot($, DRAW, `draft-${sel}`, [Row(E, [Btn(E, 'save-draft', 'Save draft', () => saveDraft($, sel)), Btn(E, 'feedback', 'Get feedback (no rewriting)', () => contentFeedback($, sel, `draft-${sel}`), true)])]),
        b.feedback?.[sel] ? Card(E, [Label(E, 'Feedback', C.blue), <E.Markdown key={`fb-${sel}`} text={b.feedback[sel]} />], { tint: C.blueTint }) : null,
      ], { tint: C.cream }))
    }
    return parts
  }
  if (def.id === 'sales') {
    const tr = b.tracker || {}
    const counts = ['to contact', 'sent', 'replied', 'call booked'].map((s) => `${(out.map || []).filter((_, i) => (tr[i] || 'to contact') === s).length} ${s}`)
    return [
      Small(E, counts.join('  ·  ')),
      ...(out.map || []).map((p, i) => Card(E, [
        Row(E, [Head(E, p.name), <E.Text key={`w-${i}`} size="caption" weight="bold" color={p.warmth === 'warm' ? C.blue : C.taupeInk}>{String(p.warmth || '').toUpperCase()}</E.Text>]),
        Small(E, `${p.who} · ${p.howKnown}`),
        T(E, `Why them: ${p.why}`), T(E, `Angle: ${p.angle}`),
        Label(E, 'First message'), T(E, p.message),
        Label(E, 'A week later'), T(E, p.followUp),
        <E.Select key={`status-${i}`} label="Status" options={['to contact', 'sent', 'replied', 'call booked', 'not now'].map((s) => ({ value: s, label: s }))} value={tr[i] || 'to contact'} onSelect={(v) => setPersonStatus($, i, v)} />,
      ], { tint: p.warmth === 'warm' ? C.pinkTint : C.white })),
    ]
  }
  if (def.id === 'operations') {
    const ticks = b.ticks || {}
    return [
      Label(E, 'Your checklist', C.blue),
      ...(out.checklist || []).map((c, i) => Row(E, [Btn(E, `tick-${i}`, ticks[i] ? '✓ Done' : 'Mark done', () => toggleCheck($, i), !!ticks[i]), T(E, `${c.item}: ${c.how}`)])),
      Small(E, `${Object.values(ticks).filter(Boolean).length} of ${(out.checklist || []).length} done`),
    ]
  }
  if (def.id === 'website') {
    return [
      Card(E, [
        Small(E, 'yourname.com', { color: C.taupe }),
        Head(E, out.hero?.headline || '', 'title'),
        T(E, out.hero?.subhead || ''),
        <E.Box key="cta" padding={1} backgroundColor={C.blue}><E.Text weight="bold" color={C.white}>{out.hero?.cta || ''}</E.Text></E.Box>,
      ], { tint: C.white }),
      Row(E, [Btn(E, 'preview-site', 'Open my starter page', () => previewSite($), true)]),
      Small(E, `Saved as ${FILES.site} in your Uncapped folder. It's a starting point: the build prompt below turns it into your real site.`),
    ]
  }
  if (def.id === 'substack') {
    const pick = b.choices?.name ?? 0
    return [
      Card(E, [Head(E, out.names?.[pick]?.name || '', 'title'), T(E, out.promise || ''), Small(E, `For: ${out.reader || ''}`)], { tint: C.sand }),
      ...(out.names || []).map((n, i) => Row(E, [Btn(E, `pick-n-${i}`, pick === i ? '✓ Using' : 'Use', () => chooseOption($, 'substack', 'name', i), pick === i), T(E, `${n.name}: ${n.why}`)])),
    ]
  }
  return []
}

// ======================================================================
// First 10 Customers and Substack: one offer, chosen once in Discover.
// Each plan is saved against the offer it was built for; switching offers
// never overwrites a plan without asking.
// ======================================================================
// The record for one person (lib/model.js keeps message, reply and
// conversation apart, and reads older one-status records).
function contactOf(b, slot) {
  return contactRecord((b?.tracker || {})[slot])
}
const slotOf = (p, i) => (p?.slot != null ? p.slot : i + 1)
// Notes are kept by person: a name they gave survives a rebuild; a prospect
// to find is kept by its place in the list.
const keyOf = (p, i) => (p?.name && p.kind !== 'prospect to find' ? `n:${String(p.name).trim().toLowerCase()}` : `s:${slotOf(p, i)}`)
// "To find" is only for someone not yet identified: once they write who it is,
// the place counts as someone they know. Someone described without a name is known.
const stillToFind = (p, t) => p?.kind === 'prospect to find' && !String(t?.found || '').trim()
const personName = (p, t) => p?.name || String(t?.found || '').trim() || p?.label || (p?.kind === 'prospect to find' ? 'A prospect to find' : 'Someone you know')

async function saveContact($, slot, patch, who) {
  const ui = await read($, uiA)
  const key = (f) => `f10.${slot}.${f}`
  await mutate($, (w) => {
    const b = w.builders.sales
    const k = who || `s:${slot}`
    const prev = contactOf(b, k)
    const next = { ...prev, ...(patch || {}) }
    for (const f of ['response', 'learned', 'next', 'intro', 'found']) if (ui.drafts[key(f)] !== undefined) next[f] = String(ui.drafts[key(f)]).trim()
    // When it was sent, so the message stays on their record as the one they sent.
    if (patch?.sent === 'sent' && (!prev.sent || prev.sent === 'not sent yet')) next.sentAt = now()
    delete next.status
    next.at = now()
    b.tracker = { ...(b.tracker || {}), [k]: next }
  }, ['sales'])
  await update($, uiA, (u) => ({ ...u, drafts: Object.fromEntries(Object.entries(u.drafts || {}).filter(([k]) => !k.startsWith(`f10.${slot}.`))), notice: patch ? null : 'Saved on this person.' }))
}

// Which offer a plan belongs to, and what to do when it isn't the current one.
function PlanOfferCard($, c, id, b) {
  const { E, work } = c
  const o = activeOffer(work)
  if (id === 'substack' && b?.output && o && isWorkshop(work)) {
    const offers = chosenOffers(work)
    const yes = offers.filter((x) => substackSupports(work, x))
    const no = offers.filter((x) => !substackSupports(work, x))
    if (!no.length) return Small(E, offers.length > 1 ? `One Substack for all your offers: ${offers.map((x) => x.name).join('; ')}.` : `Built for your offer: ${o.name}${o.provisional ? ' (provisional)' : ''}`, { color: BODY })
    return Card(E, [
      Label(E, 'One Substack for all your offers', C.blue),
      T(E, `It was built for ${yes.map((x) => `"${x.name}"`).join(' and ') || 'an earlier offer'}, and doesn't mention ${no.map((x) => `"${x.name}"`).join(' and ')} yet.`),
      Row(E, [Btn(E, 'ws-sub-update', 'Update it for all my offers in the chat', () => planInChat($, 'substack', false, '', 'portfolio'))]),
    ], { key: 'ws-sub-offers', tone: 'decide' })
  }
  const forId = b?.basedOn?.offerId
  if (!b?.output || !o || !forId || forId === o.id || b.keptFor === o.id) return o ? Small(E, `Built for your offer: ${o.name}${o.provisional ? ' (provisional)' : ''}`, { color: BODY }) : null
  const planOffer = (work.offers || []).find((x) => x.id === forId)
  const stored = b.byOffer?.[o.id]
  if (isWorkshop(work)) {
    return Card(E, [
      T(E, `This plan was built for ${shortName(planOffer?.name || 'an earlier offer')}`, { weight: 'semibold', color: C.espresso }),
      T(E, `You're now working on ${shortName(o.name)}. Build a plan for it, or keep using this one.`),
      ...OpSlot($, DRAW, `plan-${id}`, [Row(E, [
        stored ? Btn(E, `plan-restore-${id}`, 'Open the plan for this offer', () => swapPlan($, id), true) : Btn(E, `plan-new-${id}`, 'Build a new plan in the chat', () => newPlanForOffer($, id), true),
        Btn(E, `plan-keep-${id}`, 'Keep this plan', () => keepPlanFor($, id)),
        Btn(E, `plan-revise-${id}`, 'Adapt this plan instead', () => revisePlanForOffer($, id), 'plain'),
      ])]),
      Small(E, `Your notes on who you've contacted stay saved with ${shortName(planOffer?.name || 'that offer')}.`),
    ], { tone: 'decide', key: 'ws-plan-other' })
  }
  return Card(E, [
    Label(E, 'This plan belongs to another offer', C.espresso),
    T(E, `It was built for "${planOffer?.name || 'an earlier offer'}". You're now working on "${o.name}".`),
    ...OpSlot($, DRAW, `plan-${id}`, [Row(E, [
      stored ? Btn(E, `plan-restore-${id}`, 'Open the plan for this offer', () => swapPlan($, id), true) : Btn(E, `plan-new-${id}`, 'Build a new plan for this offer', () => newPlanForOffer($, id), true),
      Btn(E, `plan-revise-${id}`, 'Revise this plan for it', () => revisePlanForOffer($, id)),
      Btn(E, `plan-keep-${id}`, 'Keep this plan as it is', () => keepPlanFor($, id)),
    ])]),
    Small(E, 'Either way this plan stays saved under its own offer, with your notes on who you contacted. Revising is one request on your plan.'),
  ], { tone: 'decide' })
}

function archivePlan(b, work) {
  const forId = b.basedOn?.offerId
  if (!forId || !b.output) return
  const name = (work.offers || []).find((x) => x.id === forId)?.name || ''
  b.byOffer = { ...(b.byOffer || {}), [forId]: { output: b.output, tracker: b.tracker || {}, answers: b.answers || {}, basedOn: b.basedOn, offerName: name, at: now() } }
}
async function newPlanForOffer($, id) {
  await mutate($, (w) => { const b = w.builders[id]; archivePlan(b, w); b.output = null; b.tracker = {}; b.reviseFrom = null; b.keptFor = null; b.status = 'in_progress' }, [id])
  const w2 = await read($, workA)
  if (isWorkshop(w2) && !fallbackFor(w2, 'plans')) await planInChat($, id)
  else await go($, { view: 'builder', builder: id, stage: 'questions', step: 0 })
}
async function revisePlanForOffer($, id) {
  const w = await getWork($)
  const b = w.builders[id]
  const name = (w.offers || []).find((x) => x.id === b.basedOn?.offerId)?.name || 'an earlier offer'
  await mutate($, (w2) => { const b2 = w2.builders[id]; archivePlan(b2, w2); b2.reviseFrom = { offerName: name, output: b2.output } }, [id])
  await build($, id, `plan-${id}`)
  await mutate($, (w2) => { if (w2.builders[id]) w2.builders[id].reviseFrom = null }, [id])
}
async function keepPlanFor($, id) {
  await mutate($, (w) => { w.builders[id].keptFor = activeOffer(w)?.id || null }, [id])
}
async function swapPlan($, id) {
  await mutate($, (w) => {
    const b = w.builders[id]
    const o = activeOffer(w)
    const stored = b.byOffer?.[o.id]
    if (!stored) return
    archivePlan(b, w)
    Object.assign(b, { output: stored.output, tracker: stored.tracker, answers: stored.answers, basedOn: stored.basedOn })
    delete b.byOffer[o.id]
  }, [id])
}

// What the builder will do with the offer, before any question.
function PlanIntroCard($, c, id) {
  const { E, work } = c
  const o = activeOffer(work)
  if (!o) return null
  const what = id === 'sales'
    ? 'I\'ll help you work out who to approach first, where to find them, what to say and what to learn, and give you a simple way to keep track. A question or two first, only where your answer changes the plan.'
    : 'I\'ll help you decide what your Substack is for and who it\'s for, what to become known for, what to write first, how to mention your offer in a way that fits, and how to reach your first readers. A question or two first, only where your answer changes the strategy.'
  return Card(E, [
    Label(E, id === 'sales' ? 'Your first 10 customers' : 'Your Substack strategy', C.blue),
    T(E, `Using your working offer: ${o.name}${o.buyer ? `, for ${lowerFirst(o.buyer)}` : ''}.`, { weight: 'semibold' }),
    o.toTest ? Small(E, `The main thing still to test: ${o.toTest}`, { color: C.ink }) : null,
    o.provisional ? Small(E, 'It\'s provisional, and that\'s fine: this plan is how you test it.', { color: BODY }) : null,
    T(E, what),
  ], { tint: C.blueTint })
}

function SalesResult($, c, b) {
  const { E, ui, work } = c
  const ws = isWorkshop(work)
  const out = b.output || {}
  const list = out.list || []
  const fm = out.firstMove || {}
  const st = list.map((p, i) => contactOf(b, keyOf(p, i)))
  const known = list.filter((p, i) => !stillToFind(p, st[i])).length
  const toFind = list.length - known
  const connectors = list.filter((p) => p.role === 'connector').length
  const cn = contactCounts(st)
  const talked = cn.talked
  const lastNext = list.map((p, i) => ({ p, t: st[i] })).filter((x) => x.t.next && x.t.reply !== 'said not now').sort((a, z) => String(z.t.at || '').localeCompare(String(a.t.at || '')))[0]
  const person = (p, i) => {
    const slot = slotOf(p, i)
    const who = keyOf(p, i)
    const t = contactOf(b, who)
    const d = (f) => ui.drafts[`f10.${slot}.${f}`] ?? t[f] ?? ''
    const name = personName(p, t)
    const finding = stillToFind(p, t)
    const body = [
      p.who ? Small(E, p.who, { color: C.ink }) : null,
      p.why ? T(E, `${p.role === 'connector' ? 'Who they could introduce you to' : 'Why them'}: ${p.why}`) : null,
      finding ? T(E, `How to find one: ${p.findBy || p.reach || ''}`) : p.reach ? T(E, `How to reach them: ${p.reach}`) : null,
      p.kind === 'prospect to find' ? <E.Input key={`f10.${slot}.found`} label="Found someone? Their name or initials" placeholder="Once you know who it is, they stop being someone to find" value={String(d('found'))} rows={1} onInput={(v) => setDraft($, `f10.${slot}.found`, v)} onSubmit={(v) => setDraft($, `f10.${slot}.found`, v)} /> : null,
      p.message ? <E.Text key={`f10-mt-${slot}`} size="caption" weight="bold" color={BODY}>{`${String(p.messageType || 'first message').toUpperCase()}, TO ADAPT`}</E.Text> : null,
      p.message ? T(E, p.message, { color: C.ink }) : null,
      p.followUp ? Small(E, `A week later, if there's no reply: ${p.followUp}`, { color: BODY }) : null,
      t.draft ? <E.Text key={`f10-draft-h-${slot}`} size="caption" weight="bold" color={C.blue}>YOUR FIRST MESSAGE, READY TO SEND</E.Text> : null,
      t.draft ? (E.Code ? <E.Code key={`f10-draft-${slot}`} source={t.draft} wrap="wrap" /> : T(E, t.draft)) : null,
      t.draft ? Small(E, 'Copy it into your own messages. Uncapped never sends anything.', { color: BODY }) : null,
      <E.Text key={`f10-rec-${slot}`} size="caption" weight="bold" color={BODY}>YOUR RECORD</E.Text>,
      <E.Select key={`f10-ms-${slot}`} label="Message" options={OUTREACH.map((x) => ({ value: x, label: x }))} value={t.sent} onSelect={(v) => saveContact($, slot, { sent: v }, who)} />,
      <E.Select key={`f10-rp-${slot}`} label="Reply" options={REPLY.map((x) => ({ value: x, label: x }))} value={t.reply} onSelect={(v) => saveContact($, slot, { reply: v }, who)} />,
      <E.Select key={`f10-cv-${slot}`} label="Conversation" options={TALK.map((x) => ({ value: x, label: x }))} value={t.talk} onSelect={(v) => saveContact($, slot, { talk: v }, who)} />,
      <E.Input key={`f10.${slot}.response`} label="What they said" value={String(d('response'))} rows={2} onInput={(v) => setDraft($, `f10.${slot}.response`, v)} onSubmit={(v) => setDraft($, `f10.${slot}.response`, v)} />,
      <E.Input key={`f10.${slot}.intro`} label="Introductions or encouragement" placeholder="Who they introduced you to, or what they said that encouraged you" value={String(d('intro'))} rows={1} onInput={(v) => setDraft($, `f10.${slot}.intro`, v)} onSubmit={(v) => setDraft($, `f10.${slot}.intro`, v)} />,
      <E.Select key={`f10-sg-${slot}`} label="Their strongest response so far" options={SIGNALS.map((x) => ({ value: x, label: x }))} value={t.signal || 'none yet'} onSelect={(v) => saveContact($, slot, { signal: v }, who)} />,
      <E.Input key={`f10.${slot}.learned`} label="What you learned" value={String(d('learned'))} rows={2} onInput={(v) => setDraft($, `f10.${slot}.learned`, v)} onSubmit={(v) => setDraft($, `f10.${slot}.learned`, v)} />,
      <E.Input key={`f10.${slot}.next`} label="Next action" value={String(d('next'))} rows={1} onInput={(v) => setDraft($, `f10.${slot}.next`, v)} onSubmit={(v) => setDraft($, `f10.${slot}.next`, v)} />,
      Row(E, [Btn(E, `f10-save-${slot}`, 'Save notes on this person', () => saveContact($, slot, null, who))]),
    ]
    return Disclosure($, c, `f10-p-${slot}`, `${slot}. ${name}`, [p.role === 'connector' ? 'around your buyer: can introduce you' : 'possible buyer', finding ? 'to find' : `you know them${WARMTH[p.temperature] ? `, ${WARMTH[p.temperature]}` : ''}`, contactStage(t)].join(' · '), body)
  }
  const cv = out.conversation || {}
  const by = out.buyer || {}
  return [
    out.summary ? T(E, out.summary, { color: C.ink }) : null,
    out.expect ? Small(E, out.expect, { color: BODY }) : null,
    <E.Box key="f10-first" flexDirection="column" gap={1} padding={1} borderStyle="round" borderColor={C.espresso} backgroundColor={C.butterTint}>
      <E.Text size="caption" weight="bold" color={C.espresso}>YOUR FIRST MOVE</E.Text>
      <E.Text size="heading" weight="semibold" color={C.espresso} wrap="wrap">{`Start with ${fm.who || 'the first person on your list'}`}</E.Text>
      {fm.why ? <E.Text color={C.ink} wrap="wrap">{ws ? firstSentence(fm.why) : fm.why}</E.Text> : null}
      {ws ? Disclosure($, c, 'f10-first-msg', 'The message to send', 'and what a useful reply tells you', [
        fm.send ? <E.Text key="f10-fm-send" color={C.ink} wrap="wrap">{fm.send}</E.Text> : null,
        fm.usefulReply ? <E.Text key="f10-fm-useful" color={C.ink} wrap="wrap">{`A useful reply would tell you: ${lowerFirst(fm.usefulReply)}`}</E.Text> : null,
        <E.Text key="f10-fm-note" size="footnote" color={BODY} wrap="wrap">Uncapped never sends anything. Copy it into your own email or messages and make it sound like you.</E.Text>,
      ].filter(Boolean)) : null}
      {!ws && fm.send ? <E.Text size="caption" weight="bold" color={BODY}>WHAT TO SEND, TO ADAPT IN YOUR OWN WORDS</E.Text> : null}
      {!ws && fm.send ? <E.Text color={C.ink} wrap="wrap">{fm.send}</E.Text> : null}
      {!ws && fm.usefulReply ? <E.Text color={C.ink} wrap="wrap">{`A useful reply would tell you: ${lowerFirst(fm.usefulReply)}`}</E.Text> : null}
      {!ws ? <E.Text size="footnote" color={BODY} wrap="wrap">Uncapped never sends anything. Copy it into your own email or messages and make it sound like you.</E.Text> : null}
    </E.Box>,
    Small(E, `Your list: ${list.length} ${list.length === 1 ? 'person' : 'people'} to approach, ${known} you know and ${toFind} still to find; ${list.length - connectors} possible ${list.length - connectors === 1 ? 'buyer' : 'buyers'} and ${connectors} around your buyer. Ten people to approach are not ten customers.`, { color: BODY }),
    <E.Text key="f10-counts" size="footnote" weight="semibold" color={C.ink} wrap="wrap">{`Messages sent ${cn.sent}  ·  replies ${cn.replied}  ·  conversations ${talked} of about 10${cn.booked ? ` (${cn.booked} booked)` : ''}  ·  introductions or encouragement ${cn.encouraged}`}</E.Text>,
    talked >= 10 ? (
      <E.Box key="f10-read" flexDirection="column" gap={0} padding={1} borderStyle="round" borderColor={C.blue} backgroundColor={C.blueTint}>
        <E.Text size="caption" weight="bold" color={C.blue}>{`${talked} CONVERSATIONS: TIME TO LOOK FOR THE PATTERN`}</E.Text>
        <E.Text color={C.ink} wrap="wrap">Which pattern do you hear? They describe the problem with more heat than you did and ask how to start (build and price it). Polite interest with no urgency or budget (keep the offer, change the buyer). Every conversation drifts to a different problem (rebuild around that one). They clearly need it but your description didn't land (change your words). Re-aim before you rebuild.</E.Text>
      </E.Box>
    ) : talked >= 5 ? Small(E, `${talked} conversations: an early look. Note what you keep hearing, but give it about ten before you change the offer or the buyer.`, { color: C.ink }) : null,
    lastNext ? Small(E, `Where you left off: ${personName(lastNext.p, lastNext.t)}, ${lowerFirst(lastNext.t.next)}`, { color: C.ink }) : null,
    out.weeklyCap ? Small(E, `Pace: ${out.weeklyCap}`, { color: BODY }) : null,
    Disclosure($, c, 'f10-list', 'Your list of 10', `${known} you know, ${toFind} to find`, list.map(person)),
    Disclosure($, c, 'f10-buyer', 'Who to look for', 'what makes someone relevant now', [
      by.description ? T(E, by.description) : null,
      (by.lookFor || []).length ? Fact(E, 'f10-look', 'What to look for', by.lookFor.join('; ')) : null,
      (by.relevantNow || []).length ? Fact(E, 'f10-now', 'Signs they need it now', by.relevantNow.join('; ')) : null,
      by.hasProblem ? Fact(E, 'f10-has', 'Who feels the problem', by.hasProblem) : null,
      by.champion ? Fact(E, 'f10-champ', "Who'd push for it inside the business", by.champion) : null,
      by.approves ? Fact(E, 'f10-app', 'Who approves the spend', by.approves) : null,
    ].filter(Boolean)),
    Disclosure($, c, 'f10-routes', 'Where to find them', `${(out.routes || []).length} routes`, (out.routes || []).map((r, i) => (
      <E.Box key={`f10-r-${i}`} flexDirection="column" gap={0}>
        <E.Text weight="semibold" color={C.espresso} wrap="wrap">{r.route}</E.Text>
        <E.Text color={C.ink} wrap="wrap">{r.how}</E.Text>
        {r.fit ? <E.Text size="footnote" color={BODY} wrap="wrap">{r.fit}</E.Text> : null}
      </E.Box>
    ))),
    Disclosure($, c, 'f10-talk', cv.type === 'research' ? 'What to learn in each conversation' : 'What to ask in each conversation', cv.type ? `a ${cv.type} conversation` : '', [
      cv.why ? T(E, cv.why) : null,
      ...(cv.questions || []).map((q, i) => <E.Text key={`f10-q-${i}`} color={C.ink} wrap="wrap">{`${i + 1}. ${qText(q)}`}</E.Text>),
      closeSteps(cv).length ? Fact(E, 'f10-close', 'How to close every conversation', closeSteps(cv).join(' ')) : null,
      cv.ask ? Fact(E, 'f10-ask', cv.type === 'research' ? 'When a paid pilot could fit' : 'How to ask', cv.ask) : null,
      PilotCheck($, c, b, cv.pilot),
    ].filter(Boolean)),
    Disclosure($, c, 'f10-track', 'What to record', out.tracker?.review ? 'and when to look back' : '', [
      ...(out.tracker?.record || []).map((r, i) => <E.Text key={`f10-tr-${i}`} color={C.ink} wrap="wrap">{`·  ${r}`}</E.Text>),
      typeof out.tracker?.review === 'string' ? Small(E, out.tracker.review, { color: C.ink }) : null,
      ...(out.tracker?.review?.milestones || []).filter((m) => m?.what).map((m, i) => Small(E, m.when ? `${m.when}: ${m.what}` : m.what, { color: C.ink, key: `f10-ms-${i}` })),
      Small(E, 'Record each contact on their line in your list above. It\'s saved in your folder, so you can pick up where you left off.', { color: BODY }),
    ].filter(Boolean)),
  ].filter(Boolean)
}

// A clear problem is a reason to explore a small paid pilot; these three
// checks come first, and when any is unclear the next step is research.
// A blank left in the pilot ("[number] days") is never shown as if it were
// decided: it becomes a choice for the person, saved with the plan.
const BLANK = /\[([^\]\n]{1,60})\]/g
function blanksIn(text) {
  return [...String(text || '').matchAll(BLANK)].map((m) => {
    const before = String(text).slice(0, m.index).split(/[.;:!?,]/).pop().trim().split(/\s+/).slice(-3).join(' ')
    const after = String(text).slice(m.index + m[0].length).split(/[.;:!?,]/)[0].trim().split(/\s+/).slice(0, 4).join(' ')
    return { what: m[1], around: `${before} ___ ${after}`.trim() }
  })
}
function fillBlanks(text, field, decisions) {
  let n = 0
  return String(text || '').replace(BLANK, () => {
    const v = String(decisions?.[`pilot.${field}.${n++}`] || '').trim()
    return v || '___'
  })
}
async function saveDecision($, key) {
  const ui = await read($, uiA)
  const v = String(ui.drafts[`f10.decide.${key}`] ?? '').trim()
  await mutate($, (w) => { const b = w.builders.sales; b.decisions = { ...(b.decisions || {}), [key]: v } }, ['sales'])
  await update($, uiA, (u) => ({ ...u, drafts: Object.fromEntries(Object.entries(u.drafts || {}).filter(([k]) => k !== `f10.decide.${key}`)), notice: v ? 'Saved your choice.' : 'Cleared your choice.' }))
}
function PilotCheck($, c, b, p, opts = {}) {
  const { E, ui } = c
  const x = p || {}
  const dec = b.decisions || {}
  const choices = []
  const line = (field, lead) => {
    const raw = x[field] ? String(x[field]) : ''
    blanksIn(raw).forEach((bl, i) => choices.push({ key: `pilot.${field}.${i}`, label: `Your choice: ${bl.what}`, around: bl.around }))
    return `${lead}${raw ? ` ${fillBlanks(raw, field, dec)}` : ''}`
  }
  const texts = [line('wantsHelp', '1. They want help with it, not just agree it\'s a problem.'), line('outcome', '2. You can deliver a tightly scoped outcome.'), line('approval', '3. They have a plausible way to approve the spend.'), line('ifUnclear', 'If any of these is unclear, the next step is another research conversation, not a pitch.')]
  if (String(x.decide || '').trim()) choices.push({ key: 'pilot.decide', label: 'Your choice', around: x.decide, plain: true })
  const open = choices.filter((ch) => !String(dec[ch.key] || '').trim())
  const choiceRows = choices.map((ch) => (
    <E.Box key={`f10-dec-${ch.key}`} flexDirection="column" gap={0}>
      <E.Text color={C.ink} wrap="wrap">{ch.plain ? ch.around : `It depends on your scope: "${ch.around}". Choose it, then it fills the blank above.`}</E.Text>
      <E.Input key={`f10.decide.${ch.key}`} label={ch.label} value={String(ui.drafts[`f10.decide.${ch.key}`] ?? dec[ch.key] ?? '')} rows={1} onInput={(v) => setDraft($, `f10.decide.${ch.key}`, v)} onSubmit={(v) => setDraft($, `f10.decide.${ch.key}`, v)} />
      {Row(E, [Btn(E, `f10-dec-save-${ch.key}`, 'Save my choice', () => saveDecision($, ch.key))])}
    </E.Box>
  ))
  if (opts.checklist) {
    const fill = (field) => (x[field] ? fillBlanks(String(x[field]), field, dec) : '')
    const rows = [['They want help, not just agree it\'s a problem', fill('wantsHelp')], ['You can promise one tight outcome', fill('outcome')], ['They can say yes', fill('approval')]].map(([lead, d]) => (d ? `${lead}: ${d}` : `${lead}.`))
    return Card(E, [
      Label(E, 'Before you suggest a paid pilot, check all three', C.taupeInk),
      ...ListRows(E, 'f10-pl', rows, '□'),
      Small(E, x.ifUnclear ? `If any check is unclear: ${lowerFirst(fillBlanks(String(x.ifUnclear), 'ifUnclear', dec))}` : 'If any check is unclear, have another research conversation instead of pitching.'),
      choices.length ? Label(E, open.length ? `A decision to make before you offer it${open.length > 1 ? ` (${open.length})` : ''}` : 'Your choices', C.espresso) : null,
      ...choiceRows,
    ].filter(Boolean), { key: 'f10-pilot', tone: 'summary' })
  }
  return (
    <E.Box key="f10-pilot" flexDirection="column" gap={0} padding={1} borderStyle="round" borderColor={C.taupe} backgroundColor={C.cream}>
      <E.Text size="caption" weight="bold" color={C.espresso}>BEFORE YOU SUGGEST A PAID PILOT</E.Text>
      <E.Text color={C.ink} wrap="wrap">A clear problem is a reason to explore one. Check three things from the conversation first:</E.Text>
      {texts.map((t2, i) => <E.Text key={`f10-pl-${i}`} color={C.ink} wrap="wrap">{t2}</E.Text>)}
      {choices.length ? <E.Text key="f10-dec-h" size="caption" weight="bold" color={C.espresso}>{open.length ? `A DECISION TO MAKE BEFORE YOU OFFER IT${open.length > 1 ? ` (${open.length})` : ''}` : 'YOUR CHOICES'}</E.Text> : null}
      {choiceRows}
    </E.Box>
  )
}

function SubstackResult($, c, b) {
  const { E } = c
  const out = b.output || {}
  const fi = out.firstIssue || {}
  const om = out.offerMention || {}
  const di = out.distribution || {}
  const kf = out.knownFor || {}
  const rd = out.reader || {}
  const list = (pre, xs) => (xs || []).map((x, i) => <E.Text key={`ss-${pre}-${i}`} color={C.ink} wrap="wrap">{`·  ${x}`}</E.Text>)
  // The first screen: the reader promise, the first issue, and what to do next.
  // Everything else is one press away.
  const promise = String(rd.promise || firstSentence(rd.getsEachTime) || '').trim()
  return [
    <E.Box key="ss-promise" flexDirection="column" gap={1} padding={1} borderStyle="round" borderColor={C.espresso} backgroundColor={C.sand}>
      <E.Text size="caption" weight="bold" color={C.espresso}>THE READER PROMISE</E.Text>
      <E.Text size="heading" weight="semibold" color={C.espresso} wrap="wrap">{promise || out.job?.recommendation || ''}</E.Text>
    </E.Box>,
    <E.Box key="ss-first" flexDirection="column" gap={1} padding={1} borderStyle="round" borderColor={C.espresso} backgroundColor={C.butterTint}>
      <E.Text size="caption" weight="bold" color={C.espresso}>WRITE THIS FIRST</E.Text>
      <E.Text weight="semibold" color={C.espresso} wrap="wrap">{fi.workingTitle || (out.issues || [])[0]?.title || ''}</E.Text>
      {fi.type ? <E.Text size="footnote" color={BODY} wrap="wrap">{`A${/^[aeiou]/i.test(fi.type) ? 'n' : ''} ${fi.type}${fi.subtitle ? `: ${lowerFirst(fi.subtitle)}` : ''}`}</E.Text> : null}
    </E.Box>,
    out.nextAction ? (
      <E.Box key="ss-next" flexDirection="column" gap={0}>
        <E.Text size="caption" weight="bold" color={C.espresso}>WHAT TO DO NEXT</E.Text>
        <E.Text color={C.ink} wrap="wrap">{out.nextAction}</E.Text>
      </E.Box>
    ) : null,
    out.voice?.profile ? Disclosure($, c, 'ss-voice', 'Your voice', 'as Claude heard it: correct it in the chat', [
      T(E, out.voice.profile),
      (out.voice.words || []).length ? Small(E, `Words you use: ${out.voice.words.map((w) => `"${w}"`).join(', ')}`, { color: C.ink }) : null,
      out.voice.pov ? Fact(E, 'ss-pov', 'Your point of view', out.voice.pov) : null,
    ].filter(Boolean)) : null,
    Disclosure($, c, 'ss-job', 'What your Substack is for', 'and the goal', [
      out.job?.recommendation ? T(E, out.job.recommendation, { weight: 'semibold' }) : null,
      out.job?.why ? T(E, out.job.why) : null,
      out.job?.goal ? Fact(E, 'ss-goal', 'The goal', out.job.goal) : null,
    ].filter(Boolean)),
    Disclosure($, c, 'ss-reader', 'The reader', rd.relationToBuyer ? 'and how they relate to your buyer' : '', [
      rd.who ? Fact(E, 'ss-who', 'Who it\'s for', rd.who) : null,
      rd.workingThrough ? Fact(E, 'ss-wt', 'What they\'re working through', rd.workingThrough) : null,
      rd.getsEachTime ? Fact(E, 'ss-gets', 'What they get every time', rd.getsEachTime) : null,
      rd.relationToBuyer ? Fact(E, 'ss-rel', 'How they relate to your buyer', rd.relationToBuyer) : null,
    ].filter(Boolean)),
    Disclosure($, c, 'ss-known', 'What to become known for', kf.lane || kf.topic || '', [
      kf.lane || kf.topic ? T(E, kf.lane || kf.topic, { weight: 'semibold' }) : null,
      kf.belief ? Fact(E, 'ss-belief', 'The sentence to repeat', kf.belief) : null,
      Small(E, 'Repetition builds reputation: stay with this for longer than feels comfortable.', { color: BODY }),
      ...list('ang', kf.angles),
      kf.howIssuesBuild ? Small(E, kf.howIssuesBuild, { color: C.ink }) : null,
    ].filter(Boolean)),
    Disclosure($, c, 'ss-issues', 'Your first posts, as an arc', `${(out.issues || []).length} posts`, [
      out.order ? T(E, out.order) : null,
      ...(out.issues || []).map((x, i) => Disclosure($, c, `ss-post-${i}`, `${i + 1}. ${x.title}`, [x.type, x.mirror].filter(Boolean).join(' · '), [
        x.whyHere ? Fact(E, `ss-why-${i}`, 'Why it comes here', x.whyHere) : null,
        ...(x.headlines || []).filter((hl) => hl?.text).map((hl, n) => <E.Text key={`ss-h-${i}-${n}`} color={C.ink} wrap="wrap">{`Headline: "${hl.text}"${hl.whyOpen ? `. Why they'd open it: ${lowerFirst(hl.whyOpen)}` : ''}`}</E.Text>),
        x.deliver ? Fact(E, `ss-del-${i}`, 'What the post has to deliver', x.deliver) : null,
        x.angle ? Fact(E, `ss-ang-${i}`, 'The angle', x.angle) : null,
        x.whyReaderCares ? Small(E, `Why they'd care: ${x.whyReaderCares}`, { color: C.ink }) : null,
        x.drawOn ? Small(E, `Draw on: ${x.drawOn}`, { color: C.ink }) : null,
        (x.beats || []).length ? <E.Text key={`ss-b-h-${i}`} size="caption" weight="bold" color={BODY}>THE BEATS</E.Text> : null,
        ...(x.beats || []).map((b2, n) => <E.Text key={`ss-b-${i}-${n}`} color={C.ink} wrap="wrap">{`${n + 1}. ${b2}`}</E.Text>),
        x.prompt ? <E.Text key={`ss-pp-${i}`} weight="semibold" color={C.espresso} wrap="wrap">{`Writing prompt: ${String(x.prompt).replace(/^WRITING PROMPT:\s*/i, '')}`}</E.Text> : null,
        x.cta?.ask ? Fact(E, `ss-cta-${i}`, 'Call to action', `${x.cta.ask}${x.cta.why ? `. Why here: ${lowerFirst(x.cta.why)}` : ''}`) : null,
        x.purpose ? Small(E, `What it does for the publication: ${x.purpose}`, { color: BODY }) : null,
      ].filter(Boolean))),
      Small(E, 'Structure, not drafts: the stories, opinions and words are yours.', { color: BODY }),
    ].filter(Boolean)),
    Disclosure($, c, 'ss-outline', 'Your first issue outline', fi.workingTitle || '', [
      fi.workingTitle ? Fact(E, 'ss-t', 'Working title', `${fi.workingTitle}${fi.subtitle ? `. Subtitle: ${fi.subtitle}` : ''}`) : null,
      fi.opening ? Fact(E, 'ss-o', 'Opening', fi.opening) : null,
      fi.point ? Fact(E, 'ss-p', 'The point you want to make', fi.point) : null,
      ...(fi.prompts || []).map((q, i) => <E.Text key={`ss-pr-${i}`} color={C.ink} wrap="wrap">{`Writing prompt: ${String(q).replace(/^WRITING PROMPT:\s*/i, '')}`}</E.Text>),
      fi.ending ? Fact(E, 'ss-e', 'Ending', fi.ending) : null,
      fi.needsFromYou ? <E.Text key="ss-needs" weight="semibold" color={C.espresso} wrap="wrap">{`I need this from you: ${fi.needsFromYou}`}</E.Text> : null,
      Small(E, 'This is an outline, not a draft: beats and questions only. The words and the story are yours. Put the subscribe button after the first line or two, and the invitation mid-issue and again at the end.', { color: BODY }),
    ].filter(Boolean)),
    Disclosure($, c, 'ss-offer', 'Mentioning your offer', om.inviteType || '', [
      om.issue ? Fact(E, 'ss-oi', 'In which issue', `${om.issue}${om.where ? `, ${lowerFirst(om.where)}` : ''}`) : null,
      om.invitation ? Fact(E, 'ss-inv', 'An example invitation', om.invitation) : null,
      om.why ? Small(E, om.why, { color: C.ink }) : null,
    ].filter(Boolean)),
    Disclosure($, c, 'ss-dist', 'Reaching your first readers', di.cadence || '', [
      di.start ? Fact(E, 'ss-start', 'How to start', di.start) : null,
      di.cadence ? Fact(E, 'ss-cad', 'Cadence', di.cadence) : null,
      (di.aroundEachIssue || []).length ? <E.Text key="ss-around-h" size="caption" weight="bold" color={BODY}>AROUND EACH ISSUE</E.Text> : null,
      ...list('around', di.aroundEachIssue),
      (di.shareWith || []).length ? <E.Text key="ss-share-h" size="caption" weight="bold" color={BODY}>WHO TO SHARE IT WITH</E.Text> : null,
      ...list('share', di.shareWith),
      di.toConversation ? Fact(E, 'ss-conv', 'Turning a reply into a conversation', di.toConversation) : null,
    ].filter(Boolean)),
    Disclosure($, c, 'ss-signals', 'What to pay attention to', '', [
      ...list('sig', out.signals?.watch),
      out.signals?.useThem ? Small(E, out.signals.useThem, { color: C.ink }) : null,
    ].filter(Boolean)),
    (out.names || []).length || out.branding?.direction ? Disclosure($, c, 'ss-names', 'A name and a branding direction', 'they can change later', [
      ...(out.names || []).map((n, i) => <E.Text key={`ss-n-${i}`} color={C.ink} wrap="wrap">{`${n.name}${n.why ? `: ${n.why}` : ''}`}</E.Text>),
      out.branding?.direction ? Fact(E, 'ss-brand', 'Branding direction', out.branding.direction) : null,
      out.branding?.avoid ? Small(E, `Steer away from: ${out.branding.avoid}`, { color: C.ink }) : null,
      Small(E, 'Never let a name or a banner hold up your first issue.', { color: BODY }),
    ].filter(Boolean)) : null,
    (b.examples || []).length ? Disclosure($, c, 'ss-studied', 'Substacks worth studying', `${b.examples.length}`, b.examples.map((x, i) => {
      const st = (out.studied || []).find((y) => String(y.name || '').trim().toLowerCase() === x.name.toLowerCase()) || {}
      return (
        <E.Box key={`ss-st-${i}`} flexDirection="column" gap={0}>
          <E.Text weight="semibold" color={C.espresso} wrap="wrap">{x.name}</E.Text>
          <E.Text size="footnote" color={BODY} wrap="wrap">{x.url}</E.Text>
          {st.takeaway || x.study ? <E.Text color={C.ink} wrap="wrap">{`Worth studying: ${st.takeaway || x.study}`}</E.Text> : null}
          {st.angle || x.angle ? <E.Text color={C.ink} wrap="wrap">{`Your different angle: ${st.angle || x.angle}`}</E.Text> : null}
        </E.Box>
      )
    })) : null,
  ].filter(Boolean)
}

function BuilderResult($, E, ui, def, work) {
  const b = work.builders[def.id]
  const out = []
  if (def.id === 'sales' || def.id === 'substack') {
    out.push(PlanOfferCard($, DRAW, def.id, b))
    out.push(...(def.id === 'sales' ? SalesResult($, DRAW, b) : SubstackResult($, DRAW, b)))
    out.push(Card(E, [
      Row(E, [
        Btn(E, 'answers', 'Change my answers', () => go($, { view: 'builder', builder: def.id, stage: 'questions', step: 0 })),
        Btn(E, 'talk', 'Talk it through in the chat', () => talkItThrough($, def.id)),
        Btn(E, 'to-other-plan', def.id === 'sales' ? 'Open my Substack strategy' : 'Open my first 10 customers', () => openBuilder($, def.id === 'sales' ? 'substack' : 'sales')),
      ]),
      b.history?.length ? Label(E, `Earlier versions (${b.history.length})`) : null,
      ...(b.history || []).slice(0, 5).map((h, i) => Row(E, [Small(E, `${new Date(h.at).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}, ${h.reason}`), Btn(E, `restore-${i}`, 'Restore', () => restore($, def.id, i))])),
    ], { dashed: true, tint: C.cream }))
    return out.filter(Boolean)
  }
  out.push(ReviewCard($, E, ui, def.id, b))
  out.push(...ResultTop($, E, ui, def, work, b))
  const skip = { offer: [], brand: ['positioning'], linkedin: ['headlines', 'banner'], content: ['ideas'], substack: ['names'], website: [], sales: ['map'], delivery: [], operations: ['checklist'] }[def.id] || []
  const rest = Object.fromEntries(Object.entries(b.output).filter(([k]) => !skip.includes(k)))
  out.push(...Fields($, E, ui, def.id, rest, '', 0))
  out.push(Card(E, [
    Row(E, [
      Btn(E, 'done', b.status === 'done' ? '✓ Marked done' : 'Mark as done', () => markDone($, def.id), b.status !== 'done'),
      Btn(E, 'answers', 'Change my answers', () => go($, { view: 'builder', builder: def.id, stage: 'questions', step: 0 })),
      Btn(E, 'talk', 'Talk it through in the chat', () => talkItThrough($, def.id)),
    ]),
    b.history?.length ? Label(E, `Earlier versions (${b.history.length})`) : null,
    ...(b.history || []).slice(0, 5).map((h, i) => Row(E, [Small(E, `${new Date(h.at).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}, ${h.reason}`), Btn(E, `restore-${i}`, 'Restore', () => restore($, def.id, i))])),
  ], { dashed: true, tint: C.cream }))
  return out
}

function OfferEdit($, E, ui, work) {
  const o = activeOffer(work)
  if (!o) return NeedsCard($, E, ui, BY_ID.offer, work)
  return [
    Head(E, 'Change your offer', 'title'),
    T(E, "Edit what's changed and confirm. Uncapped saves the old version and tells you which of your other work describes the old one. Nothing else changes until you say so."),
    Card(E, OfferForm($, E, ui, o, 'Confirm these changes', () => confirmOfferEdits($))),
    o.history?.length ? Small(E, `Version ${o.rev}. Earlier: ${o.history.slice(0, 3).map((h) => `v${h.rev} (${h.changed.join(', ')})`).join('; ')}`) : null,
    Row(E, [Btn(E, 'offer-back', 'Back', () => go($, { view: 'builder', builder: 'offer', stage: work.builders?.offer?.output ? 'result' : 'questions' }))]),
  ]
}

function BuilderView($, E, ui, work, nav, c) {
  const def = BY_ID[nav.builder]
  if (!def) return HomeView($, E, ui, work)
  if (def.id === 'discover') return DiscoverView($, c)
  const out = [...BuilderTop($, E, ui, def, work, c)]
  if (nav.stage === 'offer-edit') return [...out, ...OfferEdit($, E, ui, work)]
  out.push(...NeedsCard($, E, ui, def, work))
  const journey = def.id === 'sales' || def.id === 'substack'
  if (def.id === 'sales' && !work.builders?.sales?.output) out.push(TestsCard($, c))
  const ctxNote = work.builders?.[def.id]?.context?.note
  if (ctxNote) out.push(Card(E, [Label(E, 'Carried over for you', C.blue), T(E, ctxNote), Small(E, "I'll use this when you build. You don't need to explain it again.")], { tint: C.butterTint }))
  if (!journey) out.push(UsingCard($, E, def, work))
  else if (!(nav.stage === 'result' && work.builders?.[def.id]?.output)) out.push(PlanIntroCard($, c, def.id))
  if (def.id === 'offer' && activeOffer(work)) out.push(...OpSlot($, c, 'offer-test', [Row(E, [Btn(E, 'offer-test', 'Plan a test for this offer', () => planExperiment($, { offerId: activeOffer(work).id }, '', 'offer-test'))])]))
  if (def.id === 'offer' && activeOffer(work)) out.push(Row(E, [Btn(E, 'change-offer', 'Change your offer (buyer, scope, price)', () => go($, { view: 'builder', builder: 'offer', stage: 'offer-edit' }))]))
  const b = work.builders?.[def.id]
  if (nav.stage === 'result' && b?.output) out.push(...BuilderResult($, E, ui, def, work))
  else if (activeOffer(work) || !def.needs?.includes('offer')) out.push(...BuilderQuestions($, E, ui, def, work, nav))
  if (def.id === 'sales' && nav.stage === 'result' && b?.output) out.push(TestsCard($, c))
  return out
}

// ---------- saved info and updates ----------
function ProfileView($, c) {
  const { E, work } = c
  const p = work.profile
  const cur = p.limits?.currency || '$'
  const out = [
    Title(c, 'Saved info', 28),
    T(E, "Everything Uncapped knows, all from you. Change anything and the builders use the new version. It's saved in this folder, under my-work."),
  ]
  out.push(Card(E, [Label(E, 'You'), T(E, p.name || 'No name saved yet'), Row(E, [Btn(E, 'pf-name', 'Change', () => go($, { view: 'discover', stage: 'question', theme: 'now' }))])]))
  for (const t of THEMES) {
    const prev = themePreview(work, t.id)
    out.push(Card(E, [Label(E, t.label), prev ? T(E, prev) : Small(E, 'Not answered yet.'), Row(E, [Btn(E, `pf-${t.id}`, prev ? 'Edit' : 'Answer', () => go($, { view: 'discover', stage: 'question', theme: t.id }))])], { tint: prev ? C.white : C.cream }))
  }
  if (p.answers?.idea) out.push(Card(E, [Label(E, 'An idea you mentioned earlier'), T(E, p.answers.idea)], { tint: C.cream }))
  if (work.offers.length) {
    out.push(Head(E, 'Your income streams'))
    for (const o of work.offers) {
      const active = o.id === work.activeOfferId
      out.push(Card(E, [
        Label(E, active ? 'The offer your builders use' : o.status === 'idea' ? 'Kept for later' : 'Saved offer', active ? C.blue : C.taupeInk),
        <E.Text key={`of-${o.id}`} weight="semibold" color={C.espresso} wrap="wrap">{o.name}</E.Text>,
        o.buyer ? T(E, `For: ${o.buyer}`) : null,
        priceText(o, cur) ? T(E, `Price to test: ${priceText(o, cur)}`) : null,
        active ? null : Row(E, [Btn(E, `mk-${o.id}`, 'Make this the one my builders use', () => makeActive($, o.id))]),
      ], { tint: active ? C.blueTint : C.white }))
    }
  }
  if (work.positioning?.line) out.push(Card(E, [Label(E, `Positioning, version ${work.positioning.rev}`, C.blue), T(E, work.positioning.line)]))
  if (work.events?.length) out.push(Card(E, [Label(E, 'Recent changes'), ...work.events.slice(0, 8).map((ev, i) => <E.Text key={`evt-${i}`} size="footnote" color={C.taupeInk} wrap="wrap">{`${new Date(ev.at).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}  ${ev.text}`}</E.Text>)], { dashed: true, tint: C.cream }))
  return out
}

function SettingsView($, c) {
  const { E, ui, work } = c
  if (work && isWorkshop(work)) {
    const sw = (key, bg, border, name, text) => (
      <E.Box key={key} flexDirection="row" gap={1} alignItems="center">
        <E.Box paddingX={1} backgroundColor={bg} borderStyle="round" borderColor={border} flexShrink={0}><E.Text size="caption" weight="semibold" color={V.heading}>{name}</E.Text></E.Box>
        <E.Text color={V.body} wrap="wrap">{text}</E.Text>
      </E.Box>
    )
    return [
      PageHead(c, '', 'Updates and help'),
      PLUGIN !== 'uncapped' ? U2.Panel(E, 'help-probe', 'inset', [U2.Cap(E, 'help-probe-l', 'Preview only: dark mode check'), U2.Body(E, 'help-probe-t', `Claude's theme setting reads: ${THEME_PROBE || 'not read yet'}`)]) : null,
      U2.Panel(E, 'help-how', 'surface', [
        U2.Cap(E, 'help-how-l', 'How the panel works'),
        U2.Body(E, 'help-how-t', "You answer questions in the chat beside this panel. This panel keeps everything you build, so you always know where you are and what's next."),
        sw('help-sw-y', V.nextBg, V.nextBorder, 'Yellow', 'is your next move.'),
        sw('help-sw-p', V.decideBg, V.decideBorder, 'Pink', 'needs a decision from you.'),
        sw('help-sw-b', V.workingBg, V.workingBorder, 'Blue', 'means Claude is working.'),
        sw('help-sw-g', V.doneBg, V.doneBorder, 'Green', 'is done.'),
      ]),
      U2.Panel(E, 'help-updates', 'surface', [
        U2.Cap(E, 'help-updates-l', 'Updates'),
        <E.Text key="help-ver" weight="semibold" color={V.heading}>{`You're on Uncapped ${ui.version}.`}</E.Text>,
        ui.latest && isNewer(ui.latest, VERSION) ? U2.Body(E, 'help-latest', `Uncapped ${ui.latest} is ready.`) : null,
        U2.Body(E, 'help-upd-t', "Updates come only from Pivot School. They bring new questions, builders and fixes, replace Uncapped's own files, and never touch your work. Uncapped backs your work up first. When a new version is ready, an Update button also shows above the message box."),
        U2.Line(E, 'help-upd-a', [Btn(E, 'check-updates', 'Check for updates', () => checkForUpdates($), true), Btn(E, 'backup', 'Back up now', () => backup($), 'plain')]),
        ui.update ? U2.Body(E, 'help-upd-r', ui.update.text) : null,
        U2.Meta(E, 'help-work', 'Everything is in the my-work folder inside this folder: uncapped.json holds it all, kit has readable copies of each builder, backups has copies taken before updates.'),
      ]),
      U2.Panel(E, 'help-fb', 'surface', [
        U2.Cap(E, 'help-fb-l', 'Feedback or help'),
        U2.Body(E, 'help-fb-t', "Stuck, confused, or have an idea? Tell Gabriela. Uncapped opens an email draft for you to check; nothing is sent until you press Send, and your answers aren't included."),
        U2.Line(E, 'help-fb-a', [Btn(E, 'help-feedback', 'Feedback or help', () => openFeedback($))]),
      ]),
      U2.Panel(E, 'help-support', 'surface', [
        U2.Cap(E, 'help-support-l', 'Something not working?'),
        U2.Body(E, 'help-support-t', 'A support report lists your Uncapped version and what went wrong, without your answers, so Pivot School can help. Fixes arrive as updates.'),
        U2.Line(E, 'help-support-a', [Btn(E, 'support', ui.supportPath ? 'Make a new report' : 'Make a support report', () => supportReport($), ui.supportPath ? 'plain' : undefined)]),
      ]),
      ui.supportPath ? U2.Panel(E, 'help-support-done', 'done', [
        U2.Cap(E, 'help-support-done-l', 'Your support report is ready', V.doneText),
        U2.Body(E, 'help-support-done-t', 'It lists your Uncapped version and what went wrong, and none of your answers. It is saved in your Uncapped folder, under my-work, then support.'),
        U2.Line(E, 'help-support-done-a', [Btn(E, 'support-email', 'Email it to Gabriela', () => emailSupport($)), Btn(E, 'support-reveal', 'Show it in Finder', () => revealSupport($), 'plain')]),
        U2.Meta(E, 'help-support-done-m', 'The email opens as a draft in your own email app. Nothing is sent until you press Send.'),
      ]) : null,
    ].filter(Boolean)
  }
  return [
    Title(c, 'Updates and help', 28),
    Card(E, [
      Label(E, `Uncapped ${ui.version}`, C.blue),
      ui.latest && isNewer(ui.latest, VERSION) ? T(E, `Uncapped ${ui.latest} is ready.`) : null,
      T(E, "Updates come only from Pivot School. They bring new questions, builders and fixes, replace Uncapped's own files, and never touch your work. Uncapped backs your work up first. When a new version is ready, an Update button also shows above the message box."),
      Row(E, [Btn(E, 'check-updates', 'Check for updates', () => checkForUpdates($), true)]),
      ui.update ? T(E, ui.update.text) : null,
    ]),
    Card(E, [
      Label(E, 'Your work'),
      T(E, 'Everything is in the my-work folder inside this folder: uncapped.json holds it all, kit has readable copies of each builder, backups has copies taken before updates.'),
      Row(E, [Btn(E, 'backup', 'Back up now', () => backup($))]),
    ], { tint: C.cream }),
    Card(E, [
      Label(E, 'Something not working?'),
      T(E, "Make a support report: it lists your Uncapped version and what went wrong, without your answers, so Pivot School can help. Fixes arrive as updates."),
      Row(E, [Btn(E, 'support', 'Make a support report', () => supportReport($))]),
      ui.support ? Small(E, ui.support) : null,
    ], { tint: C.cream }),
  ]
}

// ======================================================================
// experiments: plan a test, bring back what happened, read it, decide
// ======================================================================

async function planExperiment($, ref, focus, place = 'plan-form', fresh = false) {
  const w = await getWork($)
  const src = experimentSource(w, ref)
  if (!src) { await setUi($, { error: 'Choose an offer or a direction to test first.' }); return null }
  // A plan is about 4,000 to 5,000 tokens of JSON. The reply limit counts
  // Claude's thinking too (up to 8,400 tokens seen on 4 Nov), so the limit
  // is generous and thinking is kept to medium.
  const plan = await ask($, planPrompt(w, src, focus, METHODS), {
    label: 'Planning a test you can run this week',
    explain: 'The assumption that matters most, who to talk to, your messages and conversation guide, and what would support or weaken the idea.',
    steps: ['Finding the assumption that matters most', 'Choosing a test that fits your week and who you can reach', 'Writing your messages and conversation guide', 'Deciding what would support, weaken or change the idea'],
    builder: 'sales', kind: 'plan', name: 'plan', target: ref?.offerId || ref?.directionId || '', args: { ref: ref || null, focus: focus || '' }, maxTokens: 20000, effort: 'medium', place, fresh,
  })
  if (!plan) return null
  const x = { ...experimentFrom(plan, src, ref || (src.id ? { offerId: src.id } : null)), opId: currentOpId }
  return savePlan($, x, place)
}

// Saving is separate from writing: if the plan was written but couldn't be
// saved, it's kept (in the panel and in my-work/support) and "Save again"
// saves it without asking Claude again. A plan is saved once per request.
async function savePlan($, x, place) {
  let saved = false
  let why = ''
  try {
    const r = await mutate($, (w2) => {
      if ((w2.experiments || []).some((e) => e.opId && e.opId === x.opId)) return 'already'
      w2.experiments = [x, ...(w2.experiments || [])]
      const b = (w2.builders.sales = w2.builders.sales || { answers: {}, status: 'in_progress' })
      if (!b.status || b.status === 'not_started') b.status = 'in_progress'
      w2.events.unshift({ at: now(), text: `Planned a test: ${x.title}.` })
      return 'saved'
    }, ['sales'])
    // Confirm on disk, not just in memory.
    const onDisk = JSON.parse(await $.fs.read(FILES.work))
    saved = Boolean(r) && (onDisk.experiments || []).some((e) => e.id === x.id || (e.opId && e.opId === x.opId))
    if (!saved) why = (await read($, uiA)).readOnly ? 'this version can only read your work' : 'the plan was not in the saved file afterwards'
  } catch (e) {
    why = String(e?.message || e).slice(0, 200)
  }
  if (!saved) {
    try { await $.fs.write(`my-work/support/unsaved-plan-${x.id}.json`, JSON.stringify(x, null, 1)) } catch (e) {}
    await update($, uiA, (u) => ({ ...u, pendingSave: { ...(u.pendingSave || {}), [place]: x }, op: u.op?.place === place ? { ...u.op, status: 'save-failed', error: "The plan was written, but Uncapped couldn't save it to your folder.", why, unchanged: false } : u.op }))
    return null
  }
  await update($, uiA, (u) => ({ ...u, pendingSave: { ...(u.pendingSave || {}), [place]: null } }))
  await opResult($, {
    status: 'done',
    intro: `Your test plan is ready: ${x.title}.`,
    lines: [x.uncertaintyText ? `What it tests: ${x.uncertaintyText}` : '', (x.steps || [])[0] ? `First step: ${x.steps[0]}` : '', x.reviewOn ? `Review on ${x.reviewOn}.` : ''].filter(Boolean),
    nextWhy: "It's saved in Experiments & validation. Open it for your messages, conversation guide and what to record.",
    next: [{ label: 'Open the test plan', go: { view: 'experiment', id: x.id, from: place === 'chat' ? null : await read($, navA) } }],
  })
  return x
}

async function saveAgain($, place) {
  const x = (await read($, uiA)).pendingSave?.[place]
  if (x) await savePlan($, x, place)
}

async function setExperimentStatus($, id, status) {
  await mutate($, (w) => { const x = (w.experiments || []).find((e) => e.id === id); if (x) x.status = status }, ['sales'])
}

async function organiseFindings($, id, notes, who, place = `report-${id}`, fresh = false) {
  const w = await getWork($)
  const x = (w.experiments || []).find((e) => e.id === id)
  if (!x || !String(notes || '').trim()) return null
  return ask($, organisePrompt(w, x, notes, who, METHODS), {
    label: 'Organizing what happened',
    explain: 'Keeping what people did apart from what you think it means, with their exact words.',
    steps: ['Separating what people did from what you think it means', 'Keeping their exact words', 'Noting what is still unknown'],
    builder: 'sales', kind: 'organise', name: 'organise', target: id, args: { id }, maxTokens: 4000, place, fresh,
  })
}

async function saveFindings($, id, organised, notes, who, source, extra) {
  const f = { id: `f${Date.now().toString(36)}`, at: now(), source, raw: String(notes || '').slice(0, 8000), who: who || '', ...organised, extra: extra || '' }
  const ok = await mutate($, (w) => {
    const x = (w.experiments || []).find((e) => e.id === id)
    if (!x) return false
    x.findings = [...(x.findings || []), f]
    if (x.status === 'planned') x.status = 'running'
    w.events.unshift({ at: now(), text: `Saved findings for ${x.title}.` })
    return true
  }, ['sales'])
  return ok ? f : null
}

// What the debrief adds to a reading: what it supports, each buyer's signal,
// a question to ask better, and the one change before the next message or call.
function readingExtras(r) {
  const sig = (r.signals || []).filter((x) => x?.what).slice(0, 8)
  const q = (r.questionFix || []).filter((x) => x?.better)
  return [
    r.supports ? `\nWhat the responses support: ${r.supports}` : '',
    sig.length ? `\nWhat buyers said or did: ${sig.map((x) => `${x.kind || 'unsorted'}: ${x.who ? `${x.who}, ` : ''}${x.what}`).join('; ')}` : '',
    ...q.map((x) => `\nA question that may have steered the answer: "${x.asked}" (${x.issue}). Better: "${x.better}"`),
    r.adjust?.what && r.adjust.area !== 'none' ? `\nThe one change before the next message or call (${r.adjust.area}): ${r.adjust.what}${r.adjust.why ? `, because ${r.adjust.why}` : ''}. Not applied: they decide.` : '',
  ].join('')
}
// A First 10 plan's outreach, kept as a test so what comes back has a home,
// tied to its offer. Reused once it exists.
async function outreachTest($, o) {
  let w = await read($, workA)
  const has = (x) => x.kind === 'outreach' && x.source?.offerId === o.id
  if (!(w.experiments || []).some(has)) {
    const b = outreachFor(w, o).plan
    if (!b?.output) return null
    const out = b.output
    const batch = firstBatch(b)
    const x = experimentFrom({
      title: `First 10 Customers: ${o.name}`, kind: 'outreach', buyer: o.buyer || out.buyer?.lookFor?.[0] || '', problem: o.problem || '', uncertaintyText: o.toTest || '',
      outreach: batch.filter((p) => p.draft).map((p) => ({ to: personName(p.p, contactOf(b, p.key)), message: p.draft })),
      guide: { problem: (out.conversation?.questions || []).map(qText).filter(Boolean), closers: closeSteps(out.conversation) },
      capture: out.tracker?.record || [], reviewInDays: 14,
    }, o, { offerId: o.id })
    await mutate($, (w2) => { w2.experiments = [...(w2.experiments || []), { ...x, status: 'running' }] }, ['sales'])
    w = await read($, workA)
  }
  return (w.experiments || []).find(has)
}
async function reportOutreach($) {
  const o = workingOffer(await read($, workA))
  if (!o) return
  const x = await outreachTest($, o)
  if (x) await debriefInChat($, x)
}

async function readFindings($, id, place = `report-${id}`, fresh = false) {
  const w = await getWork($)
  const x = (w.experiments || []).find((e) => e.id === id)
  if (!x) return null
  const r = await ask($, readingPrompt(w, x, METHODS), {
    label: 'Reading what your findings suggest',
    explain: 'A tentative reading: what the evidence does and does not show, and the most useful next step. Nothing about your offer changes until you decide.',
    steps: ['Checking what the evidence does and does not show', 'Keeping problem, reactions, paying and repeating apart', 'Working out the most useful next step'],
    builder: 'sales', kind: 'reading', name: 'reading', target: id, args: { id }, maxTokens: 4000, place, fresh,
  })
  if (!r) return null
  await mutate($, (w2) => {
    const x2 = (w2.experiments || []).find((e) => e.id === id)
    x2.readings = [...(x2.readings || []), { at: now(), tentative: true, ...r }]
    x2.status = 'reviewing'
    w2.signpost = { at: now(), experimentId: id, title: x2.title, learned: r.learned, limits: r.limits, mayChange: r.proposedChange && r.proposedChange.field !== 'none' ? r.proposedChange : null, next: r.next, contentIdea: r.contentIdea || '', review: [], tentative: true }
  }, ['sales'])
  await opResult($, {
    intro: 'Your findings are saved. Here is a tentative reading.',
    lines: [r.learned ? `What it suggests: ${r.learned}` : '', r.limits ? `What it can't tell you yet: ${r.limits}` : ''].filter(Boolean),
    nextWhy: 'Nothing about your offer has changed. Read the full reading and decide what to do next.',
    next: [{ label: 'See the reading and decide', go: { view: 'experiment', id } }],
  })
  return r
}

// A decision is the person's. Only a confirmed decision with an offer
// change touches shared facts, and then only the assets that used them.
async function decide($, id, choice, why, applyChange) {
  const w = await read($, workA)
  const x = (w.experiments || []).find((e) => e.id === id)
  if (!x || !DECISIONS[choice]) return { status: 'needs_clarification' }
  const reading = (x.readings || [])[x.readings.length - 1]
  const change = applyChange && reading?.proposedChange && reading.proposedChange.field !== 'none' ? reading.proposedChange : null
  let flagged = []
  await mutate($, (w2) => {
    const x2 = w2.experiments.find((e) => e.id === id)
    x2.decisions = [...(x2.decisions || []), { at: now(), choice, label: DECISIONS[choice], why: why || reading?.recommended?.why || '', change }]
    x2.status = choice === 'pause' ? 'paused' : choice === 'continue' ? 'running' : 'decided'
    if (change && x2.source?.offerId) {
      const o = w2.offers.find((oo) => oo.id === x2.source.offerId)
      if (o) {
        const val = ['priceLow', 'priceHigh'].includes(change.field) ? Number(String(change.to).replace(/[^0-9.]/g, '')) || o[change.field] : change.to
        flagged = applyOfferChange(w2, o, { ...o, [change.field]: val })
      }
    }
    w2.signpost = { ...(w2.signpost || {}), at: now(), experimentId: id, title: x2.title, decided: DECISIONS[choice], tentative: false, review: flagged, changed: change ? change.field : null }
    w2.events.unshift({ at: now(), text: `Decided on ${x2.title}: ${DECISIONS[choice]}.` })
  }, ['sales', 'offer'])
  return { status: 'saved', flagged, change }
}

async function openWithContext($, builderId, note, prefill) {
  await mutate($, (w) => {
    const b = (w.builders[builderId] = w.builders[builderId] || { answers: {}, status: 'in_progress' })
    b.context = { note, at: now() }
    if (prefill) b.answers = { ...(b.answers || {}), ...prefill }
    if (!b.status || b.status === 'not_started') b.status = 'in_progress'
  }, [])
  await mark($, `Opened ${builderId} with context from a test`)
  const w = await read($, workA)
  const has = Boolean(w.builders[builderId]?.output)
  await go($, { view: 'builder', builder: builderId, stage: has && !prefill ? 'result' : 'questions', step: 0 })
}

async function saveResearch($, id, topic, items, implication, extra = {}) {
  return mutate($, (w) => {
    const kinds = ['comparable', 'price', 'buyer-language', 'alternative', 'obstacle']
    const clean = (items || []).filter((it) => it && String(it.fact || '').trim()).slice(0, 12).map((it) => ({ kind: kinds.includes(it.kind) ? it.kind : 'comparable', title: String(it.title || '').slice(0, 160), url: String(it.url || ''), fact: String(it.fact).slice(0, 600), inference: String(it.inference || '').slice(0, 400), date: String(it.date || '') }))
    const entry = { id: `r${Date.now().toString(36)}`, at: now(), topic, items: clean, implication: implication || '', directionId: extra.directionId || null, inferences: (extra.inferences || []).slice(0, 6), stillNeeds: (extra.stillNeeds || []).slice(0, 6), couldntRead: (extra.couldntRead || []).slice(0, 6), by: extra.by || 'chat', searches: extra.searches ?? null }
    const x = id ? (w.experiments || []).find((e) => e.id === id) : null
    if (x) x.research = [...(x.research || []), entry]
    else w.research = [...(w.research || []), entry]
    return entry
  }, ['sales'])
}

// Bounded research for one direction, run by a research agent on the
// customer's own Claude. The press starts it and returns; the agent's call to
// save_research completes it, shown where the person pressed.
async function startResearch($, id, place = `research-${id}`, fresh = false) {
  const w = await getWork($)
  const d = (w.discover.early?.directions || []).find((x) => x.id === id)
  if (!d) return
  const t0 = await $.clock.now()
  const label = 'Researching this direction'
  const reqId = requestId('research', id, JSON.stringify({ d, research: (w.research || []).filter((r) => r.directionId === id).length }), fresh ? `fresh${t0}` : '')
  const claim = await claimOp($, { id: reqId, name: 'research', label, place, target: id }, t0)
  lastClaim = claim
  if (claim.state !== 'started') { await setUi($, { opNote: { place, state: claim.state, text: refusalText(claim, label), name: 'research', target: id, args: { id } } }); return }
  const op = { id: reqId, name: 'research', label, explain: `Comparable offers, published prices, the words buyers use, what they do instead, and any obstacles. At most ${RESEARCH_LIMITS.searches} searches. Every source is saved with its link and today's date.`, steps: [], place, nav: await read($, navA), target: id, args: { id }, status: 'running', startedAt: t0, elapsed: 0, typical: 0, attempt: claim.op.attempt }
  await setUi($, { op, opNote: null, error: null })
  void showPlace($, place)
  let r = null
  const description = `Uncapped research: ${cleanShort(d)}`
  try {
    r = await $.agent.spawn({ subagentType: RESEARCHER, prompt: researchPrompt(w, d, new Date(t0).toISOString().slice(0, 10)), description })
  } catch (e) { r = { deny: String(e?.message || e) } }
  if (r?.deny) {
    const why = String(r.deny)
    await finishOp($, reqId, 'failed', { error: "Research couldn't start.", outcome: why }, await $.clock.now())
    await update($, uiA, (u) => (u.op?.id === reqId ? { ...u, op: { ...u.op, status: 'failed', error: "Research couldn't start in this Claude window.", why, unchanged: true } } : u))
    return
  }
  const run = { opId: reqId, directionId: id, place, searches: 0, fetches: 0, saved: false, startedAt: t0, description }
  // The spawn names its agent; if it ever doesn't, find it by its description,
  // or take the first researcher whose tools or finish arrive while this runs.
  const agentId = r?.agentId || (await findResearcher($, description))
  if (agentId) researchRuns.set(agentId, run)
  else pendingResearch = run
}

async function findResearcher($, description) {
  try {
    const list = await $.agent.list()
    const mine = (list || []).filter((a) => a.type === RESEARCHER && (!description || a.description === description) && !researchRuns.has(a.id))
    return mine[mine.length - 1]?.id || null
  } catch (e) { return null }
}

// The research run a tool call or finish belongs to, adopting a pending one.
async function researchRunFor($, agentId, checkType = false) {
  if (!agentId) return null
  if (researchRuns.has(agentId)) return researchRuns.get(agentId)
  if (!pendingResearch) return null
  if (checkType) {
    try { const a = (await $.agent.list()).find((x) => x.id === agentId); if (a && a.type !== RESEARCHER) return null } catch (e) {}
  }
  const run = pendingResearch
  pendingResearch = null
  researchRuns.set(agentId, run)
  return run
}

async function finishResearch($, run, entry) {
  const t1 = await $.clock.now()
  run.saved = true
  const n = entry?.items?.length || 0
  await finishOp($, run.opId, 'done', { outcome: `saved ${n} sources`, calls: [{ role: 'research', model: 'sonnet', searches: run.searches, fetches: run.fetches }] }, t1)
  await update($, uiA, (u) => (u.op?.id === run.opId ? { ...u, op: { ...u.op, status: 'done', endedAt: t1, elapsed: Math.round((t1 - run.startedAt) / 1000), intro: n ? `Research saved: ${n} source${n === 1 ? '' : 's'}, each with its link and today's date.` : 'The research found no usable sources. Nothing was invented.', lines: [`${run.searches} search${run.searches === 1 ? '' : 'es'} and ${run.fetches} page${run.fetches === 1 ? '' : 's'} read.`, ...(entry?.couldntRead?.length ? [`Couldn't read ${entry.couldntRead.length} page${entry.couldntRead.length === 1 ? '' : 's'} (they needed a login or failed).`] : [])], nextWhy: n ? "Next: update the recommendation with what it found. Nothing changes until you do." : '' } } : u))
}


// ---------- experiment screens ----------
const STATUS_WORD = { planned: 'Planned', running: 'Running', reviewing: 'Findings in', decided: 'Decided', paused: 'Paused' }

function TestsCard($, c) {
  const { E, work } = c
  const list = work.experiments || []
  return Card(E, [
    Label(E, 'Your tests', C.blue),
    T(E, "An offer is a guess until buyers tell you otherwise. Plan a small test, run it, then tell Uncapped what happened: here, from the home screen, or just in the chat."),
    ...list.slice(0, 6).map((x) => Row(E, [<E.Text key={`tl-${x.id}`} weight="semibold" color={C.espresso} wrap="wrap">{`${STATUS_WORD[x.status] || x.status}: ${x.title}`}</E.Text>, Btn(E, `open-x-${x.id}`, 'Open', () => go($, { view: 'experiment', id: x.id }))])),
    Row(E, [Btn(E, 'plan-test', list.length ? 'Plan another test' : 'Plan a test', () => go($, { view: 'plan' }), !list.length), list.length ? Btn(E, 'report-sales', 'Report what happened', () => go($, { view: 'report' }), true) : null].filter(Boolean)),
  ], { tint: C.blueTint, border: C.blue })
}

function PlanView($, c) {
  const { E, ui, work } = c
  const offers = (work.offers || []).map((o) => ({ value: `o:${o.id}`, label: `Offer: ${o.name}` }))
  const dirs = (work.discover?.early?.directions || []).map((d) => ({ value: `d:${d.id}`, label: `Direction: ${d.title}` }))
  const opts = [...offers, ...dirs]
  const pick = ui.drafts['plan.src'] || opts[0]?.value
  const toRef = (v) => (v?.startsWith('o:') ? { offerId: v.slice(2) } : v?.startsWith('d:') ? { directionId: v.slice(2) } : null)
  return [
    Title(c, 'Plan a test', 28),
    T(E, "Pick what to test and, if you know, what you're least sure about. I'll suggest one small experiment that fits your week, with the messages and questions to run it."),
    opts.length ? <E.Select key="plan.src" label="What are you testing?" options={opts} value={pick} onSelect={(v) => setDraft($, 'plan.src', v)} /> : T(E, 'You need an offer or a direction first: Discover grows them.'),
    <E.Select key="plan.focus" label="What are you least sure about?" options={[{ value: '', label: 'Not sure, suggest the most important one' }, ...Object.entries(UNCERTAINTIES).map(([value, label]) => ({ value, label }))]} value={ui.drafts['plan.focus'] || ''} onSelect={(v) => setDraft($, 'plan.focus', v)} />,
    ...OpSlot($, c, 'plan-form', [Row(E, [opts.length ? Btn(E, 'plan-go', 'Plan my test', () => planExperiment($, toRef(pick), UNCERTAINTIES[ui.drafts['plan.focus']] || '', 'plan-form'), true) : Btn(E, 'plan-disc', 'Go to Discover', () => openBuilder($, 'discover'), true), Btn(E, 'plan-back', 'Back', () => openBuilder($, 'sales'))])]),
  ]
}

function List(E, key, label, items) {
  if (!items?.length) return null
  return <E.Box key={key} flexDirection="column" gap={0}>{[Label(E, label), ...items.map((t, i) => <E.Text key={`${key}-${i}`} color={C.ink} wrap="wrap">{`·  ${typeof t === 'string' ? t : t.text || JSON.stringify(t)}`}</E.Text>)]}</E.Box>
}

function SignpostCard($, c, sp) {
  const { E, work } = c
  if (!sp) return null
  const x = (work.experiments || []).find((e) => e.id === sp.experimentId)
  const flagged = (sp.review || []).filter((id) => work.builders?.[id]?.review?.state === 'suggested' || work.builders?.[id]?.review?.state === 'deferred')
  const nextB = sp.next?.builder && BY_ID[sp.next.builder] ? sp.next.builder : 'sales'
  return Card(E, [
    Label(E, sp.decided ? `You decided: ${sp.decided}` : 'What your test suggests (not decided yet)', C.blue),
    sp.learned ? T(E, `What we learned: ${sp.learned}`, { weight: 'medium' }) : null,
    sp.limits ? Small(E, `What it can't tell us yet: ${sp.limits}`) : null,
    sp.mayChange && !sp.decided ? T(E, `This may change your offer: ${sp.mayChange.field} → "${sp.mayChange.to}". ${sp.mayChange.why || ''}`) : null,
    sp.changed ? T(E, `You changed your offer's ${sp.changed}.${flagged.length ? ` ${changeMessage([sp.changed], flagged)} Want to review those?` : ''}`) : null,
    sp.next?.label ? T(E, `Next: ${sp.next.label}. ${sp.next.why || ''}`) : null,
    Row(E, [
      x && !sp.decided ? Btn(E, 'sp-decide', 'Decide what to do', () => go($, { view: 'experiment', id: x.id }), true) : null,
      ...flagged.map((id) => Btn(E, `sp-rev-${id}`, `Review ${ASSET_NAME[id]}`, () => go($, { view: 'builder', builder: id, stage: 'result' }))),
      sp.contentIdea ? Btn(E, 'sp-post', 'Draft a post about this', () => openWithContext($, 'content', `From your test "${sp.title}": ${sp.learned} Post idea: ${sp.contentIdea}`, { opinions: sp.contentIdea })) : null,
      sp.next?.label && nextB !== 'content' ? Btn(E, 'sp-next', sp.next.label, () => (nextB === 'sales' ? go($, { view: 'plan' }) : openWithContext($, nextB, `From your test "${sp.title}": ${sp.learned}`))) : null,
    ].filter(Boolean)),
  ], { tint: C.butterTint })
}

// Experiments & validation: every test, wherever it was planned from.
function TestsView($, c) {
  const { E, work } = c
  const list = work.experiments || []
  return [
    Crumbs($, c, [{ label: 'Experiments & validation' }]),
    Title(c, 'Experiments & validation', 28),
    T(E, 'Small tests with real people, and what they showed. Plan one from a direction or your working offer; bring back what happened here or in the chat. Both save to the same test.', { color: BODY }),
    ...(list.length ? list.map((x) => (
      <E.Box key={`tl-${x.id}`} flexDirection="column" gap={0} padding={1} borderStyle="round" borderColor={C.espresso} backgroundColor={C.white}>
        <E.Text weight="semibold" color={C.espresso} wrap="wrap">{x.title}</E.Text>
        <E.Text size="footnote" color={BODY} wrap="wrap">{`${STATUS_WORD[x.status] || x.status}${x.reviewOn ? ` · review on ${x.reviewOn}` : ''} · ${(x.findings || []).length} set${(x.findings || []).length === 1 ? '' : 's'} of findings · testing ${x.sourceName || 'an idea'}`}</E.Text>
        <E.Box flexDirection="row" gap={1} paddingTop={1}><E.Button key={`tl-open-${x.id}`} label="Open" onPress={later(() => go($, { view: 'experiment', id: x.id }))} /><E.Button key={`tl-report-${x.id}`} label="Report what happened" onPress={later(() => go($, { view: 'report', id: x.id }))} /></E.Box>
      </E.Box>
    )) : [T(E, "No tests yet. Open a direction in your portfolio garden and press Plan a validation test, or plan one for your working offer.", { color: C.ink }), Row(E, [Btn(E, 'tl-garden', 'Go to your portfolio garden', () => go($, { view: 'discover', stage: work.discover.early ? 'garden' : 'overview' }), true)])]),
  ]
}

function ExperimentView($, c) {
  const { E, ui, work, nav } = c
  const x = (work.experiments || []).find((e) => e.id === nav.id)
  if (!x) return [T(E, 'That test is no longer saved.'), Row(E, [Btn(E, 'x-back', 'Back to Experiments', () => go($, { view: 'tests' }))])]
  const fromDir = nav.from?.stage === 'direction' ? (work.discover.early?.directions || []).find((d) => d.id === nav.from.id) : null
  const reading = (x.readings || [])[x.readings.length - 1]
  const decided = (x.decisions || [])[x.decisions.length - 1]
  const g = x.guide || {}
  const out = [
    Crumbs($, c, [{ label: 'Experiments & validation', go: { view: 'tests' } }, { label: x.title }]),
    fromDir ? Row(E, [Btn(E, 'x-back', `← Back to ${cleanShort(fromDir)}`, () => go($, nav.from))]) : null,
    <E.Text key="x-status" size="caption" weight="bold" color={C.blue}>{`TEST · ${(STATUS_WORD[x.status] || x.status).toUpperCase()}${x.reviewOn ? ` · REVIEW ON ${x.reviewOn}` : ''}`}</E.Text>,
    Title(c, x.title, 26),
    Small(E, `Testing: ${x.sourceName}. An offer is a guess until buyers tell you otherwise.`),
    Row(E, [Btn(E, 'x-report', 'Report what happened', () => go($, { view: 'report', id: x.id }), true), x.status === 'planned' ? Btn(E, 'x-start', "I've started", () => setExperimentStatus($, x.id, 'running')) : null].filter(Boolean)),
    work.signpost?.experimentId === x.id ? SignpostCard($, c, work.signpost) : null,
  ]
  if (reading) {
    out.push(Card(E, [
      Label(E, decided ? 'Latest reading' : 'What your findings suggest (tentative)', C.blue),
      T(E, reading.learned, { weight: 'medium' }),
      ...Object.entries(EVIDENCE).map(([k, lab]) => <E.Text key={`ev-${k}`} color={C.ink} wrap="wrap">{`${lab}: ${LEVELS[reading.evidence?.[k]?.level] || 'No evidence yet'}${reading.evidence?.[k]?.why ? `. ${reading.evidence[k].why}` : ''}`}</E.Text>),
      reading.limits ? Small(E, `What it can't tell us yet: ${reading.limits}`) : null,
      reading.recommended?.choice ? T(E, `My suggestion: ${DECISIONS[reading.recommended.choice] || reading.recommended.choice}. ${reading.recommended.why || ''}`) : null,
      reading.proposedChange && reading.proposedChange.field !== 'none' ? T(E, `Possible change (not applied): ${reading.proposedChange.field} → "${reading.proposedChange.to}"`, { italic: true }) : null,
      decided ? Small(E, `You decided: ${decided.label}${decided.why ? `, because ${decided.why}` : ''}.`) : Label(E, 'Your decision'),
      decided ? null : Row(E, [
        ...(reading.options || []).filter((o) => DECISIONS[o.choice]).map((o) => Btn(E, `dec-${o.choice}`, DECISIONS[o.choice], () => decide($, x.id, o.choice, o.why, false), o.choice === reading.recommended?.choice && !(reading.proposedChange && reading.proposedChange.field !== 'none'))),
        reading.proposedChange && reading.proposedChange.field !== 'none' && x.source?.offerId ? Btn(E, 'dec-apply', `Change my offer's ${reading.proposedChange.field}`, () => decide($, x.id, reading.proposedChange.field === 'buyer' ? 'revise_buyer' : reading.proposedChange.field === 'problem' ? 'revise_problem' : 'change_offer', reading.proposedChange.why, true), true) : null,
      ].filter(Boolean)),
    ], { tint: C.white, border: C.blue }))
  }
  out.push(Card(E, [
    Label(E, 'What you believe, and why'),
    T(E, x.believe), Small(E, x.why),
    List(E, 'x-ass', 'Assumptions', (x.assumptions || []).map((a) => `${a.text} (${a.source})`)),
    Label(E, 'What this test is for', C.blue), T(E, x.uncertaintyText, { weight: 'medium' }),
    Small(E, `${x.kind}. ${x.whyThisTest || ''}`),
  ]))
  out.push(Card(E, [
    Label(E, 'Run it', C.blue),
    List(E, 'x-steps', 'Steps', x.steps), x.who ? T(E, `Who first: ${x.who}`) : null,
    ...(x.outreach || []).flatMap((m, i) => [Small(E, `Message to ${m.to}:`, { weight: 'bold' }), E.Code ? <E.Code key={`x-msg-${i}`} source={m.message} wrap="wrap" /> : T(E, m.message)]),
    List(E, 'g-w', 'Warm-up questions', g.warmups), List(E, 'g-p', 'About the problem (past behavior only)', g.problem), List(E, 'g-m', 'About money and buying', g.money), List(E, 'g-c', 'To close', g.closers),
    List(E, 'x-avoid', 'Avoid', x.avoid), List(E, 'x-cap', 'After each conversation, write down', x.capture),
  ], { tint: C.cream }))
  out.push(Card(E, [
    Label(E, 'How to read what comes back'),
    List(E, 's-s', 'Would support it', x.signals?.support), List(E, 's-w', 'Would weaken it', x.signals?.weaken), List(E, 's-c', 'Would change it', x.signals?.change),
    x.bringBack ? Small(E, x.bringBack) : null,
  ], { dashed: true, tint: C.cream }))
  if (x.assets?.length) out.push(Card(E, [Label(E, 'Things that help you run it'), ...x.assets.map((a, i) => Row(E, [<E.Text key={`as-${i}`} color={C.ink} wrap="wrap">{`${BY_ID[a.builder]?.title || a.builder}: ${a.what}. Helps you learn: ${a.purpose}`}</E.Text>, BY_ID[a.builder] ? Btn(E, `as-go-${i}`, 'Make it', () => openWithContext($, a.builder, `For your test "${x.title}": ${a.what}. It should help you learn: ${a.purpose}. Keep claims accurate: no invented results or demand.`)) : null].filter(Boolean)))]))
  if (x.findings?.length) out.push(Card(E, [Label(E, `What you've brought back (${x.findings.length})`), ...x.findings.slice().reverse().flatMap((f, i) => [
    <E.Text key={`fi-${i}`} weight="semibold" color={C.espresso} wrap="wrap">{`${new Date(f.at).toLocaleString('en-US', { day: 'numeric', month: 'short' })}: ${f.summary}`}</E.Text>,
    f.counts ? Small(E, `Contacted ${f.counts.contacted || 0} · replied ${f.counts.replied || 0} · conversations ${f.counts.conversations || 0} · paid ${f.counts.paid || 0}`) : null,
    ...(f.quotes || []).map((q, j) => <E.Text key={`fq-${i}-${j}`} italic color={C.ink} wrap="wrap">{`"${q}"`}</E.Text>),
    List(E, `fo-${i}`, 'Observed', (f.observations || []).map((o) => `${o.text} (${o.kind})`)),
    List(E, `fin-${i}`, 'Your interpretation', f.interpretations), List(E, `fu-${i}`, 'Still unknown', f.unknowns),
  ])], { tint: C.white }))
  if (x.research?.length) out.push(Card(E, [Label(E, 'Research'), ...x.research.flatMap((r, i) => [T(E, r.topic, { weight: 'semibold' }), ...r.items.map((it, j) => <E.Text key={`rs-${i}-${j}`} size="footnote" color={C.ink} wrap="wrap">{`${it.fact} (source: ${it.url || it.source})${it.inference ? ` · My inference: ${it.inference}` : ''}`}</E.Text>), r.implication ? Small(E, `What to test: ${r.implication}`) : null])], { dashed: true, tint: C.cream }))
  if (x.decisions?.length > 1) out.push(Card(E, [Label(E, 'How your thinking has changed'), ...x.decisions.map((d, i) => <E.Text key={`dh-${i}`} size="footnote" color={C.ink} wrap="wrap">{`${new Date(d.at).toLocaleString('en-US', { day: 'numeric', month: 'short' })}: ${d.label}${d.why ? `, because ${d.why}` : ''}`}</E.Text>)], { dashed: true, tint: C.cream }))
  return out
}

function ReportView($, c) {
  const { E, ui, work, nav } = c
  const list = work.experiments || []
  if (!list.length) return [Title(c, 'Report what happened', 28), T(E, "There's no test yet. Plan one in the Sales Builder, or tell me in the chat what you've tried and I'll help you set it up."), Row(E, [Btn(E, 'rp-plan', 'Plan a test', () => go($, { view: 'plan' }), true)])]
  const id = ui.drafts['report.id'] || nav.id || list.find((x) => !['decided', 'paused'].includes(x.status))?.id || list[0].id
  const pending = ui.pendingFindings && ui.pendingFindings.id === id ? ui.pendingFindings : null
  const out = [
    Title(c, 'Report what happened', 28),
    T(E, "Paste anything: rough notes, replies, a summary of a call, or \"nobody replied\". I'll organize it, keep their exact words, and keep what happened apart from what you think it means."),
    list.length > 1 ? <E.Select key="report.id" label="Which test is this about?" options={list.map((x) => ({ value: x.id, label: x.title }))} value={id} onSelect={(v) => setDraft($, 'report.id', v)} /> : Small(E, `Test: ${list[0].title}`),
    <E.Input key="report.notes" label="What happened" placeholder="Had 3 calls. Two said onboarding delays cost them a client last quarter..." value={ui.drafts['report.notes'] || ''} rows={8} onInput={(v) => setDraft($, 'report.notes', v)} onSubmit={(v) => setDraft($, 'report.notes', v)} />,
    <E.Input key="report.who" label="Who with? (roles are enough, optional)" value={ui.drafts['report.who'] || ''} rows={1} onInput={(v) => setDraft($, 'report.who', v)} onSubmit={(v) => setDraft($, 'report.who', v)} />,
  ]
  if (!pending) {
    out.push(...OpSlot($, c, `report-${id}`, [Row(E, [Btn(E, 'rp-organise', 'Organize my notes', () => organiseReport($, id), true), Btn(E, 'rp-cancel', 'Cancel', () => go($, { view: 'experiment', id }))])]))
    return out
  }
  const o = pending.organised
  out.push(Card(E, [
    Label(E, 'Here is what I took from it. Check it before it is saved', C.blue),
    T(E, o.summary, { weight: 'medium' }),
    List(E, 'po', 'What happened (observed)', (o.observations || []).map((x) => `${x.text} (${x.kind})`)),
    ...(o.quotes || []).map((q, i) => <E.Text key={`pq-${i}`} italic color={C.ink} wrap="wrap">{`"${q}"`}</E.Text>),
    List(E, 'pi', 'What you think it means (your interpretation)', o.interpretations),
    List(E, 'pu', 'Still unknown', o.unknowns),
    ...(o.missing || []).flatMap((m, i) => [T(E, m.q, { weight: 'semibold' }), <E.Input key={`rp-miss-${i}`} label="Answer if you know (optional)" value={ui.drafts[`rp.miss.${i}`] || ''} rows={1} onInput={(v) => setDraft($, `rp.miss.${i}`, v)} onSubmit={(v) => setDraft($, `rp.miss.${i}`, v)} />]),
  ], { tint: C.white, border: C.blue }))
  out.push(...OpSlot($, c, `report-${id}`, [Row(E, [Btn(E, 'rp-save', 'Save and read what it means', () => saveReport($, id, o), true), Btn(E, 'rp-redo', 'Organize again', () => setUi($, { pendingFindings: null }))])]))
  return out
}

async function organiseReport($, id, place = `report-${id}`, fresh = false) {
  const u = await read($, uiA)
  const o = await organiseFindings($, id, u.drafts['report.notes'], u.drafts['report.who'], place, fresh)
  if (!o) return
  await setUi($, { pendingFindings: { id, organised: o } })
  await opResult($, { intro: "Here's what I took from your notes, just below. Check it before it's saved.", nextWhy: 'Answer anything I asked if you know, then press Save and read what it means.' })
}

async function saveReport($, id, o) {
  const u = await read($, uiA)
  const extra = (o.missing || []).map((m, i) => (u.drafts[`rp.miss.${i}`] ? `${m.q} ${u.drafts[`rp.miss.${i}`]}` : '')).filter(Boolean).join('\n')
  const f = await saveFindings($, id, o, u.drafts['report.notes'], u.drafts['report.who'], 'panel', extra)
  if (!f) { await setUi($, { error: "Couldn't save your findings. Nothing was changed; your notes are still here." }); return }
  await update($, uiA, (uu) => ({ ...uu, pendingFindings: null, drafts: { ...uu.drafts, 'report.notes': '', 'report.who': '' } }))
  await readFindings($, id, `report-${id}`)
}

// What "Try again" and "Make a fresh version anyway" run, by request name.
const CAN_RERUN = ['followups', 'early', 'sharpen', 'build', 'revise', 'feedback', 'plan', 'organise', 'reading', 'numbers', 'direction', 'research']
async function rerun($, name, a, place, fresh) {
  const x = a || {}
  if (name === 'followups') return runFollowUps($, place, fresh)
  if (name === 'early') return runEarlyRead($, place, fresh)
  if (name === 'sharpen') return sharpen($, place, fresh)
  if (name === 'build') return build($, x.id, place, fresh)
  if (name === 'revise') return previewRevision($, x.id, place, fresh)
  if (name === 'feedback') return contentFeedback($, x.i, place, fresh)
  if (name === 'plan') return planExperiment($, x.ref, x.focus, place, fresh)
  if (name === 'organise') return organiseReport($, x.id, place, fresh)
  if (name === 'reading') return readFindings($, x.id, place, fresh)
  if (name === 'numbers') return workOutNumbers($, x.id, place, fresh)
  if (name === 'direction') return rewriteDirection($, x.id, place, fresh, place.startsWith('research-') ? 'research' : 'repair')
  if (name === 'research') return startResearch($, x.id, place, fresh)
  return null
}

// ---------- feedback and help ----------
const LABELS_FOR_FEEDBACK = {
  theme: Object.fromEntries(THEMES.map((t) => [t.id, t.label])),
  builder: Object.fromEntries(BUILDERS.map((b) => [b.id, b.title])),
}

// Remembers the last few screens and actions (never answers), so a report
// can say where someone got stuck without them reconstructing it.
async function mark($, action) {
  await update($, uiA, (u) => ({ ...u, lastAction: action, trail: [...(u.trail || []), action].slice(-8) }))
}

async function feedbackContext($) {
  const ui = await read($, uiA)
  const nav = await read($, navA)
  const v = await $.session.version().catch(() => null)
  const surface = await $.session.surface().catch(() => null)
  return { nav, where: whereText(nav, LABELS_FOR_FEEDBACK), guess: guessGoal(nav, LABELS_FOR_FEEDBACK), context: { error: ui.error || (ui.op && ['failed', 'save-failed'].includes(ui.op.status) ? `${ui.op.label}: ${ui.op.why || ui.op.error} (request ${ui.op.id}; ${(ui.op.calls || []).map((k) => `${k.role} ${k.model} ${k.usage ? k.usage.output_tokens : '-'}/${k.maxTokens}`).join(', ')})` : null), lastAction: ui.lastAction || null, trail: ui.trail || [], version: ui.version, claudeCode: v?.version || null, surface: surface || 'desktop', time: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) } }
}

async function openFeedback($, kind = 'broken') {
  const f = await feedbackContext($)
  if (f.nav.view === 'feedback') return
  await setUi($, {
    feedback: { kind, where: f.where, goal: f.guess, goalGuessed: Boolean(f.guess), goalConfirmed: false, expected: '', actual: f.context.error ? `Uncapped showed: "${f.context.error}"` : '', details: '', replyTo: '', screenshot: false, excerpt: '', context: f.context, removed: {}, stage: 'edit', status: null, savedAs: null, returnTo: f.nav },
    error: null,
  })
  await go($, { view: 'feedback' })
}

async function setFeedback($, patch) {
  await update($, uiA, (u) => ({ ...u, feedback: { ...(u.feedback || {}), ...patch } }))
}

async function saveFeedbackFile($, fb) {
  const t = now().replace(/[:.]/g, '-').slice(0, 19)
  const path = `my-work/support/feedback-${t}.md`
  await $.fs.write(path, `To: ${FEEDBACK_TO}\nSubject: ${subjectFor(fb)}\n\n${reportText(fb)}\n`)
  return path
}

async function openEmailDraft($) {
  const ui = await read($, uiA)
  const fb = ui.feedback
  if (!fb) return { status: 'none' }
  if (!looksLikeEmail(fb.replyTo)) { await setFeedback($, { status: 'bad_email' }); return { status: 'bad_email' } }
  let savedAs = fb.savedAs
  try { savedAs = await saveFeedbackFile($, fb) } catch (e) {}
  try {
    const r = await $.process.run(['/usr/bin/open', mailtoUrl(fb, savedAs)], { timeoutMs: 15000 })
    if (r.exitCode === 0) {
      await setFeedback($, { status: 'opened', savedAs })
      await mark($, 'Opened a feedback email draft')
      return { status: 'opened', savedAs }
    }
    await setFeedback($, { status: 'failed', savedAs, reason: (r.stderr || '').slice(0, 160) })
    return { status: 'failed', savedAs }
  } catch (e) {
    await setFeedback($, { status: 'failed', savedAs, reason: String(e?.message || e).slice(0, 160) })
    return { status: 'failed', savedAs }
  }
}

// Copies text for the person and says whether it worked: Desktop's copy first,
// then the Mac's pbcopy; if both fail, it says to select and copy it by hand.
async function copyText($, text, done) {
  let ok = false
  try { ok = Boolean((await $.ui.copy({ text: String(text), surface: 'desktop' }))?.isCopied) } catch (e) {}
  if (!ok) { try { ok = (await $.process.run(['/usr/bin/pbcopy'], { stdin: String(text), timeoutMs: 10000 })).exitCode === 0 } catch (e) {} }
  await setUi($, { notice: ok ? done : "Couldn't copy automatically. Select the text and copy it." })
}

async function copyReport($, surface) {
  const ui = await read($, uiA)
  const fb = ui.feedback
  if (!fb) return
  const text = `To: ${FEEDBACK_TO}\nSubject: ${subjectFor(fb)}\n\n${reportText(fb)}`
  let ok = false
  try { ok = (await $.ui.copy({ text, surface: surface || 'desktop' })).isCopied } catch (e) {}
  if (!ok) { try { ok = (await $.process.run(['/usr/bin/pbcopy'], { stdin: text, timeoutMs: 10000 })).exitCode === 0 } catch (e) {} }
  await setFeedback($, { status: ok ? 'copied' : 'copy_failed' })
}

const FB_STATUS = {
  opened: 'A draft is open in your email app, addressed to Gabriela. It is not sent until you press Send there. Attach a screenshot there if you have one.',
  failed: "Couldn't open your email app. Your report isn't lost: it's saved in this folder (shown below). Try again, or copy it and paste it into an email to gabriela@gabrielaflaxcoaching.com.",
  copied: 'Copied. Paste it into an email to gabriela@gabrielaflaxcoaching.com.',
  copy_failed: "Couldn't copy automatically. Select the report below and copy it.",
  bad_email: "That reply address doesn't look like an email address. Fix it or leave it blank.",
}

function FeedbackView($, c) {
  const { E, ui } = c
  const fb = ui.feedback
  if (!fb) return [Title(c, 'Feedback or help', 28), T(E, 'Nothing to report yet.'), Row(E, [Btn(E, 'fb-new', 'Start a report', () => openFeedback($))])]
  const back = () => go($, fb.returnTo?.view && fb.returnTo.view !== 'feedback' ? fb.returnTo : { view: 'home' })
  if (fb.stage === 'review') {
    const text = `To: ${FEEDBACK_TO}\nSubject: ${subjectFor(fb)}\n\n${reportText(fb)}`
    return [
      Title(c, 'Check your report', 28),
      T(E, "This is everything that goes to Gabriela. Nothing else is included: no answers, no results, no file paths."),
      E.Code ? <E.Code key="fb-text" source={text} wrap="wrap" /> : T(E, text),
      fb.status ? Card(E, [T(E, FB_STATUS[fb.status] || ''), fb.savedAs ? Small(E, `Saved copy: ${fb.savedAs}`) : null], { tint: fb.status === 'opened' || fb.status === 'copied' ? C.butterTint : C.pinkTint }) : null,
      Row(E, [
        Btn(E, 'fb-email', fb.status === 'failed' ? 'Try again' : 'Open email draft', () => openEmailDraft($), true),
        Btn(E, 'fb-copy', 'Copy report', () => copyReport($)),
        Btn(E, 'fb-edit', 'Edit', () => setFeedback($, { stage: 'edit', status: null })),
        Btn(E, 'fb-done', 'Back to where I was', back),
      ]),
    ]
  }
  const ctx = fb.context || {}
  const ctxItems = [
    ['error', ctx.error ? `Message on screen: ${redact(ctx.error)}` : null],
    ['lastAction', ctx.lastAction ? `Last action: ${ctx.lastAction}` : null],
    ['trail', ctx.trail?.length ? `Recent steps: ${ctx.trail.join(' → ')}` : null],
    ['version', `Uncapped ${ctx.version || '?'}, Claude Code ${ctx.claudeCode || '?'}`],
    ['time', `Time: ${ctx.time || ''}`],
  ].filter(([, v]) => v)
  const inp = (key, label, rows, field, ph) => <E.Input key={key} label={label} placeholder={ph || ''} value={fb[field] || ''} rows={rows} onInput={(v) => setFeedback($, { [field]: v, ...(field === 'goal' ? { goalConfirmed: true } : {}) })} onSubmit={(v) => setFeedback($, { [field]: v })} />
  return [
    Title(c, 'Feedback or help', 28),
    T(E, 'Tell Gabriela what happened. You review everything before it goes anywhere.'),
    Small(E, `Where you were: ${fb.where}`),
    <E.Select key="fb-kind" label="What's this about?" options={Object.entries(KINDS).map(([value, k]) => ({ value, label: k.label }))} value={fb.kind} onSelect={(v) => setFeedback($, { kind: v })} />,
    inp('fb-goal', fb.goalGuessed && !fb.goalConfirmed ? 'What were you trying to do? (my guess from the screen: change it if it is wrong)' : 'What were you trying to do?', 2, 'goal'),
    fb.kind === 'idea' ? null : inp('fb-expected', 'What did you expect to happen?', 2, 'expected'),
    fb.kind === 'idea' ? null : inp('fb-actual', 'What happened instead?', 2, 'actual'),
    inp('fb-details', fb.kind === 'idea' ? 'Your idea' : 'Anything else? (optional)', 3, 'details'),
    inp('fb-reply', 'Your email, if you would like a reply (optional)', 1, 'replyTo', 'you@example.com'),
    <E.Select key="fb-shot" label="Screenshot" options={[{ value: 'no', label: 'No screenshot' }, { value: 'yes', label: "I'll attach one in my email app" }]} value={fb.screenshot ? 'yes' : 'no'} onSelect={(v) => setFeedback($, { screenshot: v === 'yes' })} />,
    inp('fb-excerpt', 'Paste a short excerpt only if it helps (optional, nothing is included otherwise)', 2, 'excerpt'),
    Card(E, [
      Label(E, 'Context Uncapped adds (you can remove any)'),
      ...ctxItems.map(([k, v]) => Row(E, [<E.Text key={`fc-${k}`} size="footnote" color={fb.removed?.[k] ? C.taupe : C.ink} strikethrough={Boolean(fb.removed?.[k])} wrap="wrap">{v}</E.Text>, Btn(E, `fc-x-${k}`, fb.removed?.[k] ? 'Put back' : 'Remove', () => setFeedback($, { removed: { ...(fb.removed || {}), [k]: !fb.removed?.[k] } }))])),
    ], { dashed: true, tint: C.cream }),
    Row(E, [Btn(E, 'fb-review', 'Review report', () => setFeedback($, { stage: 'review', status: null }), true), Btn(E, 'fb-cancel', 'Cancel', back)]),
  ]
}

// ======================================================================
// A plan's questions, for the chat's build_plan tool: id, wording, choices.
function planQuestions(id) {
  return (BY_ID[id].questions || []).map((q) => `${q.id}: "${q.q}"${q.optional ? ' (optional)' : ''}${q.options ? ` [choices: ${q.options.join(' / ')}]` : ''}`).join('; ')
}

// The workshop edition (the default). The Claude chat is the one place to
// answer questions: the Discover interview and its follow-ups, corrections,
// the questions behind each plan, refining the garden, and the debrief of a
// test. The panel shows what's saved, where the person is and what to do
// next, and holds the decisions: choosing an offer, marking a contact.
// Saved work marked edition: 'full' shows the whole ten-builder product.
const isWorkshop = (work) => work?.edition !== 'full'
// A step whose chat hand-off can't be verified in Claude Desktop uses its one
// signposted workshop fallback in the panel, and only that route is shown.
// Set here for a release; saved work can set it too (tests).
const WORKSHOP_FALLBACK = { discover: false, plans: false, debrief: false }
const fallbackFor = (work, step) => Boolean(WORKSHOP_FALLBACK[step] || work?.workshopFallback?.[step])
const WS_PLANS = ['sales', 'substack']
const WS_NAME = { sales: 'First 10 Customers', substack: 'Substack strategy' }

// The four ways to earn from what someone knows (Gabriela's lenses).
// The ways to earn, from the lightest commitment to the deepest (brand.js LENS).
const LENSES = LENS_ORDER.map((id) => ({ id, label: LENS[id].name, help: LENS[id].line }))
function lensOf(text) {
  const t = String(text || '').toLowerCase()
  if (!t) return ''
  // The older combined way ("publish or package it") is decided by the idea itself.
  if (/publish (it )?or package/.test(t)) return ''
  if (/teach|workshop|training|course|cohort|class|talks?\b|seminar|masterclass/.test(t)) return 'teach'
  if (/package|template|toolkit|checklist|\bkit\b|pack\b|bundle|swipe/.test(t)) return 'package'
  if (/publish|guide|newsletter|\bbook\b|paid publication/.test(t)) return 'publish'
  if (/with them|advise|alongside|working session|coach/.test(t)) return 'with'
  if (/for them|done.for|service|set.?up|build|review|audit|assessment/.test(t)) return 'for'
  return ''
}
const wasCombined = (t) => /publish (it )?or package/i.test(String(t || ''))

// Every idea in the garden, each a first offer or one its direction could grow into.
function gardenIdeas(work) {
  const g = work.discover?.early
  const out = []
  const norm = (x) => String(x || '').trim().toLowerCase()
  for (const d0 of g?.directions || []) {
    // A related idea that repeats the first offer is the same offer: one card, with the fuller wording.
    const dupAt = (d0.growInto || []).findIndex((x) => norm(x.name) && norm(x.name) === norm(d0.firstOffer || d0.title))
    const dup = dupAt >= 0 ? d0.growInto[dupAt] : null
    const d = dup ? { ...d0, format: d0.format || dup.format, change: dup.change || d0.change, does: dup.does || d0.does, doHeading: d0.doHeading || dup.doHeading, buyers: (dup.buyers || []).length ? dup.buyers : d0.buyers, timeOnce: d0.timeOnce || dup.timeOnce, timeEach: d0.timeEach || dup.timeEach, learn: d0.learn || dup.learn, handover: dup.gets || d0.handover } : d0
    out.push({ d: d0, grow: null, name: d.firstOffer || d.title, lens: lensOf(d.lens || d.route) || lensOf(d.shape?.format) || lensOf(d.firstOffer || d.title) || (wasCombined(d.lens || d.route) ? 'publish' : ''), buyer: d.buyer, price: priceText(d, curOf(work)) || d.priceNote || '', how: d.summary || '', why: d.whyNow || '', own: Boolean(d.own),
      // what makes ideas easy to compare (10 Nov); older gardens have none of these
      family: d.family || '', trigger: d.deliveryHours || d.testIt ? d.whyNow || '' : '', receives: d.deliveryHours || d.testIt ? d.handover || (d.shape?.receives || []).join('; ') : '', credible: d.deliveryHours || d.testIt ? d.whyYou || '' : '', hours: d.deliveryHours || '', size: d.size || '', test: d.testIt || '', next: d.next || '', needs: d.needs || '', proof: d.proof || '',
      // a picturable offer (10 Nov redesign)
      format: d.format || d.shape?.format || '', change: d.change || '', doHeading: d.doHeading || '', does: d.does || '', gets: d.does ? d.handover || (d.shape?.receives || []).join('; ') : '', buyers: Array.isArray(d.buyers) ? d.buyers : [], timeOnce: d.timeOnce || '', timeEach: d.timeEach || '', learn: d.learn || '', volume: d.volume || '' })
    ;(d0.growInto || []).forEach((x, n) => n === dupAt ? null : out.push({ d: d0, grow: n, name: x.name, lens: lensOf(x.lens) || lensOf(x.name) || (wasCombined(x.lens) ? 'publish' : ''), buyer: x.buyer, price: x.price || '', how: x.how || x.receives || '', why: x.why || '', own: Boolean(x.own),
      family: x.family || '', trigger: x.trigger || '', receives: x.trigger || x.hours ? x.receives || '' : '', credible: x.credible || '', hours: x.hours || '', size: x.size || '', test: x.test || '', next: x.next || '', needs: x.needs || '', proof: x.proof || '',
      format: x.format || '', change: x.change || '', doHeading: x.doHeading || '', does: x.does || '', gets: x.gets || '', buyers: Array.isArray(x.buyers) ? x.buyers : [], timeOnce: x.timeOnce || '', timeEach: x.timeEach || '', learn: x.learn || '', volume: x.volume || '' }))
  }
  return out
}
const ideaKey = (i) => (i.grow == null ? i.d.id : `${i.d.id}-grow-${i.grow}`)
function pickIdea(ideas, tf) {
  if (!tf) return null
  const norm = (x) => String(x || '').trim().toLowerCase()
  return ideas.find((i) => (!tf.direction || i.d.id === tf.direction) && norm(i.name) === norm(tf.idea)) || ideas.find((i) => i.d.id === tf.direction && i.grow == null) || null
}
const testFirstIdea = (work, ideas) => pickIdea(ideas, work.discover?.early?.testFirst)
// Where to start: the idea to test first, then up to two more, each with why.
function startList(work, ideas) {
  const out = []
  for (const tf of [work.discover?.early?.testFirst, ...(work.discover?.early?.thenTry || [])]) {
    const i = pickIdea(ideas, tf)
    if (i && !out.some((x) => x.i === i)) out.push({ i, why: tf.why || i.why || '' })
  }
  return out.slice(0, 3)
}

// Which garden an offer came from. A regrown garden reuses direction ids
// (d1, d2...), so an offer remembers the garden it was chosen from (fromGarden,
// the garden's own time) and is never matched to a new direction by its id.
function offerStale(work, o) {
  const g = work.discover?.early
  if (!o || o.status === 'idea' || !g || !o.fromDirection) return false
  if (o.fromGarden) return o.fromGarden !== g.at
  // Chosen before offers remembered their garden: stale once no idea in this
  // garden carries its name any more.
  const norm = (x) => String(x || '').trim().toLowerCase()
  return !gardenIdeas(work).some((i) => norm(i.name) === norm(o.name))
}
function isCurrentIdea(work, i) {
  const o = activeOffer(work)
  if (!o || o.status === 'idea' || offerStale(work, o) || o.fromDirection !== i.d.id) return false
  return o.fromGarden ? (o.fromGrow ?? null) === (i.grow ?? null) : String(o.name).trim().toLowerCase() === String(i.name).trim().toLowerCase()
}

// A plan built for the working offer (or kept for it).
// First 10 Customers belongs to one offer; the Substack supports the whole portfolio.
function planFor(work, id, o) {
  const b = work.builders?.[id]
  // Each space has its own Substack: the one open now counts only for an offer in that space.
  if (id === 'substack') return b?.output && o && (!b.spaceId || !o.spaceId || b.spaceId === o.spaceId) ? b : null
  return b?.output && o && (!b.basedOn?.offerId || b.basedOn.offerId === o.id || b.keptFor === o.id) ? b : null
}
const workingOffer = (work) => { const o = activeOffer(work); return o && o.status !== 'idea' && !offerStale(work, o) ? o : null }
// The offers they're focusing on: chosen from the garden they have now.
const chosenOffers = (work) => (work.offers || []).filter((o) => o.status !== 'idea' && !offerStale(work, o))
// Whether their Substack was built (or updated) with this offer in mind.
function substackSupports(work, o) {
  const b = o?.spaceId ? substackFor(work, o.spaceId) : work.builders?.substack
  if (!b?.output || !o) return false
  return [b.basedOn?.offerId, ...(b.basedOn?.offerIds || [])].includes(o.id) || b.keptFor === o.id
}
// Makes an offer the working offer, bringing back its First 10 plan if one was
// set aside for it (the plan it replaces is set aside under its own offer).
function activateOffer(w, id) {
  if (!(w.offers || []).some((o) => o.id === id)) return
  w.activeOfferId = id
  const b = w.builders?.sales
  const stored = b?.byOffer?.[id]
  if (stored && b.basedOn?.offerId !== id) {
    archivePlan(b, w)
    Object.assign(b, { output: stored.output, tracker: stored.tracker || {}, answers: stored.answers || {}, basedOn: stored.basedOn, keptFor: null, reviseFrom: null })
    delete b.byOffer[id]
  }
  // Its space's Substack comes back too; the one open now is kept under its own space.
  placeOffers(w)
  const sid = (w.offers || []).find((o) => o.id === id)?.spaceId
  if (sid && (w.builders?.substack || substackFor(w, sid))) activateSpace(w, sid)
}
// An offer they're focusing on, by name ("the balcony setup"), or null.
function offerNamed(work, q) {
  const n = (x) => String(x || '').trim().toLowerCase()
  const k = n(q)
  if (!k) return null
  const xs = chosenOffers(work)
  return xs.find((o) => n(o.name) === k || o.id === q) || xs.find((o) => n(o.name).startsWith(k) || n(shortName(o.name)) === k) || xs.find((o) => n(o.name).includes(k) || k.includes(n(shortName(o.name)))) || null
}
// A space, by name or id, or null.
function spaceNamed(work, q) {
  const n = (x) => String(x || '').trim().toLowerCase()
  const k = n(q)
  if (!k) return null
  const xs = spacesOf(work)
  return xs.find((sp) => sp.id === q || n(sp.name) === k) || xs.find((sp) => n(sp.name).startsWith(k) || k.startsWith(n(sp.name))) || xs.find((sp) => n(sp.name).includes(k) || k.includes(n(sp.name))) || xs.find((sp) => offersIn(work, sp.id).some((o) => n(o.name).includes(k))) || null
}
// An offer's way of earning, from the idea it came from.
function offerLens(work, o) {
  const d = (work.discover?.early?.directions || []).find((x) => x.id === o.fromDirection)
  const idea = d && o.fromGrow != null ? (d.growInto || [])[o.fromGrow] : null
  return (idea ? lensOf(idea.lens) || lensOf(idea.name) : d ? lensOf(d.lens || d.route) || lensOf(d.shape?.format) || lensOf(d.firstOffer) : '') || lensOf(o.name) || (wasCombined(idea?.lens || d?.lens || d?.route) ? 'publish' : '')
}
// An offer's First 10 plan, whether it's the one open now or set aside for it.
function outreachFor(work, o) {
  const b = work.builders?.sales
  const plan = b?.output && (b.basedOn?.offerId === o.id || b.keptFor === o.id || (!b.basedOn?.offerId && activeOffer(work)?.id === o.id)) ? b : b?.byOffer?.[o.id]?.output ? b.byOffer[o.id] : null
  const batch = plan ? firstBatch(plan) : []
  return { plan, batch, written: batch.filter((x) => x.draft).length, who: plan?.output?.firstMove?.who || '' }
}
// The people to message first: the plan's first batch (at most three), each
// with its key in the record, and whether a first message is written for them.
function firstBatch(b) {
  const list = (b?.output?.list || []).map((p, i) => ({ p, i, key: keyOf(p, i), slot: slotOf(p, i) }))
  const one = list.filter((x) => Number(x.p.batch) === 1)
  return (one.length ? one : list).slice(0, 3).map((x) => ({ ...x, draft: String(contactOf(b, x.key).draft || '').trim() }))
}
// First 10 Customers is finished once the plan exists and its first messages are written.
function first10Ready(work, o) {
  const b = planFor(work, 'sales', o)
  if (!b) return false
  const batch = firstBatch(b)
  return batch.length > 0 && batch.every((x) => x.draft)
}
// Where the person is: 1 Discover, 2 their offer, 3 First 10, 4 Substack, 5 both plans built.
function wsStage(work) {
  const o = workingOffer(work)
  if (!o) return work.discover?.early ? 2 : 1
  if (!first10Ready(work, o)) return 3
  if (!planFor(work, 'substack', o)) return 4
  return 5
}
function testFor(work) {
  const o = workingOffer(work)
  return o ? (work.experiments || []).find((x) => x.source?.offerId === o.id) || null : null
}

// ---- the steps, on every screen: a column on the left, or a row when narrow
function stepOf(nav) {
  if (nav.view === 'home') return 'home'
  if (nav.view === 'settings' || nav.view === 'feedback') return 'help'
  if (nav.view === 'discover') return ['garden', 'direction', 'offer', 'done', 'idea'].includes(nav.stage) ? 'offer' : 'discover'
  if (nav.view === 'builder') return nav.builder === 'discover' ? 'discover' : nav.builder
  if (nav.view === 'experiment' || nav.view === 'report') return 'test'
  if (nav.view === 'done') return 'done'
  if (nav.view === 'map') return 'map'
  if (nav.view === 'space') return `space:${nav.id}`
  if (nav.view === 'people') return 'people'
  return ''
}
function landingFor(work) {
  return [null, { view: 'discover', stage: 'overview' }, { view: 'discover', stage: 'garden' }, { view: 'builder', builder: 'sales', stage: 'result' }, { view: 'builder', builder: 'substack', stage: 'result' }, { view: 'done' }][wsStage(work)]
}
async function goStep($, id) {
  const w = await read($, workA)
  // Choosing a step closes "All steps" on a narrow panel.
  await update($, uiA, (u) => (u.grp?.nav ? { ...u, grp: { ...u.grp, nav: null } } : u))
  if (id === 'home') return go($, { view: 'home' })
  if (id === 'help') return go($, { view: 'settings' })
  if (id === 'map') return go($, { view: 'map' })
  if (id === 'discover') return go($, { view: 'discover', stage: 'overview' })
  if (id === 'offer') return go($, { view: 'discover', stage: 'garden' })
  if (id === 'test') { const x = testFor(w); return x ? go($, { view: 'experiment', id: x.id }) : go($, { view: 'discover', stage: 'garden' }) }
  if (id === 'done') return go($, { view: 'done' })
  if (id === 'people') return go($, { view: 'people' })
  if (String(id).startsWith('space:')) return go($, { view: 'space', id: String(id).slice(6) })
  return go($, { view: 'builder', builder: id, stage: 'result' })
}
// The rail (wide) and the list under "All steps" (narrow), version 2 (4.2):
// Home first, the four steps on one line each, then the extras and Updates & help.
// The rail (wide) and the step bar (narrow), built from STEPS: only live steps
// show, grouped by phase. ✓ done, ● where you are, the number for the rest.
const STEP_KEY = { discover: 'step-discover', offer: 'step-offer', sales: 'step-first10', substack: 'step-substack' }
function stepState(work, id, cur) {
  const st = LIVE_STEPS.find((x) => x.id === id)
  const stage = wsStage(work)
  if (id === cur) return 'here'
  if (st.pos < stage) return 'done'
  if (st.pos === stage) return 'next'
  return 'later'
}
function railItems($, c, cur) {
  const { E, work } = c
  const item = (key, label, id, state) => (state === 'here'
    ? <E.Button key={key} label={label} variant="secondary" onPress={later(() => goStep($, id))} />
    : <E.Button key={key} label={label} variant="secondary" dimColor={state === 'later'} onPress={later(() => goStep($, id))} />)
  const out = [item('step-home', '⌂  Home', 'home', cur === 'home' ? 'here' : ''), <E.Text key="rail-h" size="caption" weight="bold" color={V.meta}>YOUR PATH</E.Text>]
  for (const st of LIVE_STEPS) {
    const state = stepState(work, st.id, cur)
    const glyph = state === 'done' ? '✓ ' : state === 'here' ? '● ' : ''
    const btn = item(STEP_KEY[st.id], `${glyph}${st.pos}  ${st.name}`, st.id, state)
    out.push(state === 'next' ? <E.Box key={`rail-row-${st.id}`} flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">{btn}{U2.Chip(E, `rail-next-${st.id}`, 'Next', 'quiet')}</E.Box> : btn)
  }
  out.push(<E.Box key="rail-gap" height={1} />)
  const extra = []
  if (chosenOffers(work).length > 1) extra.push(['step-done', '★', 'Your portfolio', 'done'])
  else if (wsStage(work) === 5) extra.push(['step-done', '✓', 'Ready to test', 'done'])
  // More than one space: each one, and everyone they're talking to, one press away.
  if (spacesOf(work).length > 1) {
    for (const sp of spacesOf(work)) extra.push([`step-space-${sp.id}`, '◆', shortName(sp.name, 32), `space:${sp.id}`])
    extra.push(['step-people', '·', "Everyone you're talking to", 'people'])
  }
  if (testFor(work)) extra.push(['step-test', '·', 'Your test', 'test'])
  extra.push(['step-map', '◇', 'Your map', 'map'])
  extra.push(['step-help', '?', 'Updates & help', 'help'])
  for (const [key, glyph, name, id] of extra) out.push(item(key, id === cur ? `● ${name}` : `${glyph}  ${name}`, id, id === cur ? 'here' : ''))
  return out
}
// The step bar (narrow, under 560 px): Home, "Your path · 2 of 4 done", the dots, All steps.
// Dots for the step bar: one per live step in its phase color; the current one ringed in blue.
function stepDots(work, cur) {
  const n = LIVE_STEPS.length
  const dots = LIVE_STEPS.map((st, i) => {
    const state = stepState(work, st.id, cur)
    const x = 6 + i * 16
    const fill = state === 'done' ? V.doneBorder : state === 'here' ? V.accent : V.surface
    const stroke = state === 'done' ? V.doneBorder : state === 'here' ? V.accent : V.disabled
    return `<circle cx="${x}" cy="7" r="4.5" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`
  }).join('')
  const w = 12 + (n - 1) * 16
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 14" width="${w}" height="14">${dots}</svg>`
}
// The step footer: the previous and next step, then Updates & help and Feedback, as today.
function StepBar($, c, cur) {
  const { E, work } = c
  const done = LIVE_STEPS.filter((x) => stepState(work, x.id, cur) === 'done').length
  return [
    <E.Box key="bar" flexDirection="row" flexWrap="wrap" gap={1} alignItems="center" justifyContent="space-between">
      <E.Box key="bar-where" flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
        <E.Text key="bar-h" size="caption" weight="bold" color={V.accent}>{`YOUR PATH · ${done} OF ${LIVE_STEPS.length} DONE`}</E.Text>
        {E.Svg ? <E.Svg key="bar-dots" source={stepDots(work, cur)} alt={`${done} of ${LIVE_STEPS.length} steps done`} /> : null}
      </E.Box>
      {cur !== 'home' ? <E.Button key="bar-home" label="⌂ Home" variant="secondary" onPress={later(() => goStep($, 'home'))} /> : null}
    </E.Box>,
    Disclosure($, c, 'nav-steps', 'All steps', '', railItems($, c, cur), { group: 'nav' }),
  ]
}
// Dots for the step bar: done filled green, the current one blue, the rest open.

// ---- the one notice slot (8.4), under the navigation
function NoticeSlot($, c, cur) {
  const { E, ui } = c
  const slim = (key, text, acts) => (
    <E.Box key={key} flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
      <E.Text color={C.blue} wrap="wrap">{text}</E.Text>
      {acts}
    </E.Box>
  )
  if (ui.error) return [Card(E, [Label(E, "Couldn't do that", C.espresso), T(E, ui.error), Row(E, [Btn(E, 'dismiss-err', 'OK', () => setUi($, { error: null }), 'secondary', { role: 'dismiss' }), Btn(E, 'report-err', 'Tell Gabriela about this', () => openFeedback($, 'broken'))])], { tone: 'decide', key: 'notice' })]
  if (ui.notice) return [Card(E, [T(E, ui.notice, { weight: 'medium' }), Row(E, [Btn(E, 'dismiss-note', 'Got it', () => setUi($, { notice: null }), 'secondary', { role: 'dismiss' })])], { tone: 'done', key: 'notice' })]
  // A request started somewhere else gets one slim line, with a way to it.
  const op = ui.op
  if (op && !c.places?.has(op.place) && op.status === 'running') {
    const from = op.place === 'chat' ? 'from the chat' : 'on another screen'
    const text = op.status === 'running' ? `${op.label}: still working (${from}) · ${elapsedText(op)}` : op.status === 'done' ? `${op.label}: done (${from}).` : `${op.label}: didn't finish (${from}). ${op.error || ''}`
    return [slim('notice', text, [
      op.nav && op.place !== 'chat' ? Btn(E, 'op-goto', op.status === 'running' ? 'Show me' : 'Go there', () => go($, op.nav), 'plain') : op.name === 'early' ? Btn(E, 'op-goto', 'Show me', () => go($, { view: 'discover', stage: 'overview' }), 'plain') : null,
      op.status === 'running' ? Btn(E, 'stop', 'Stop', () => stopAsking($), 'plain') : Btn(E, 'op-seen', 'OK', () => opResult($, { seen: true }), 'plain', { role: 'dismiss' }),
    ].filter(Boolean))]
  }
  // Handed to the chat: in full on the screen it's about, a slim line elsewhere.
  const chat = ui.chatNote
  if (chat?.text) {
    if (!chat.for || chat.for === cur || chat.lead) {
      return [Card(E, [T(E, chat.text, { weight: 'medium' }), Row(E, [Btn(E, 'dismiss-note', 'Got it', () => setUi($, { chatNote: null }), 'secondary', { role: 'dismiss' })])], { tone: 'working', key: 'notice' })]
    }
    const where = { discover: 'Discover', offer: 'Your offer', sales: 'First 10 Customers', substack: 'Substack', test: 'Your test' }[chat.for] || ''
    return [slim('notice', `Claude is working on ${where} with you in the chat.`, [Btn(E, 'notice-show', 'Show me', () => goStep($, chat.for), 'plain')])]
  }
  // A request that finished somewhere else.
  if (op && !c.places?.has(op.place) && !op.seen) {
    const from = op.place === 'chat' ? 'from the chat' : 'on another screen'
    const text = op.status === 'running' ? `${op.label}: still working (${from}) · ${elapsedText(op)}` : op.status === 'done' ? `${op.label}: done (${from}).` : `${op.label}: didn't finish (${from}). ${op.error || ''}`
    return [slim('notice', text, [
      op.nav && op.place !== 'chat' ? Btn(E, 'op-goto', op.status === 'running' ? 'Show me' : 'Go there', () => go($, op.nav), 'plain') : op.name === 'early' ? Btn(E, 'op-goto', 'Show me', () => go($, { view: 'discover', stage: 'overview' }), 'plain') : null,
      op.status === 'running' ? Btn(E, 'stop', 'Stop', () => stopAsking($), 'plain') : Btn(E, 'op-seen', 'OK', () => opResult($, { seen: true }), 'plain', { role: 'dismiss' }),
    ].filter(Boolean))]
  }
  return []
}

// ---- the step footer: previous and next step, then help and feedback
function StepFooter($, c, cur) {
  const { E, work } = c
  const i = LIVE_STEPS.findIndex((x) => x.id === cur)
  const prev = i > 0 ? LIVE_STEPS[i - 1] : i === 0 ? { id: 'home', name: 'Home' } : null
  const after = chosenOffers(work).length > 1 ? { id: 'done', name: 'Your portfolio' } : wsStage(work) === 5 ? { id: 'done', name: 'Ready to test' } : null
  const next = cur === 'home' ? LIVE_STEPS.find((x) => stepState(work, x.id, '') === 'next') || after
    : i >= 0 && i < LIVE_STEPS.length - 1 ? LIVE_STEPS[i + 1] : cur === 'substack' ? after : null
  return (
    <E.Box key="ws-foot" flexDirection="column" gap={1} marginTop={1}>
      {prev || next ? (
        <E.Box key="ws-foot-steps" flexDirection="row" flexWrap="wrap" gap={2} justifyContent="space-between">
          {prev ? Btn(E, 'ws-prev', `← ${prev.name}`, () => goStep($, prev.id), 'plain', { dimColor: true }) : <E.Text key="ws-prev-none"> </E.Text>}
          {next ? Btn(E, 'ws-next-step', `Next step: ${next.name} →`, () => goStep($, next.id), 'plain') : null}
        </E.Box>
      ) : null}
      <E.Box key="ws-foot-help" flexDirection="row" flexWrap="wrap" gap={1}>
        <E.Button key="ws-help" label="Updates & help" variant="secondary" dimColor onPress={later(() => go($, { view: 'settings' }))} />
        <E.Button key="ws-feedback" label="Feedback" variant="secondary" dimColor onPress={later(() => openFeedback($))} />
        {PLUGIN !== 'uncapped' || work.designCheck ? <E.Button key="ws-design-check" label="Design check" variant="secondary" dimColor onPress={later(() => go($, { view: 'designcheck' }))} /> : null}
      </E.Box>
    </E.Box>
  )
}
// The title block (7.1) of a step: "STEP 3 OF 4 · SELL IT", the title in
// Cormorant, its promise, and where it stands (Done ✓, You're here, Next).

// ---- Your map (S10): every builder by phase, the ones to come marked.
function WsMap($, c) {
  // One picture (11 Nov, Gabriela: "make it an actual map"): the route through all ten
  // builders, then one row of buttons for the steps that are open, then what's coming.
  const { E, work, nav } = c
  const soon = nav.soon ? STEPS.find((x) => x.id === nav.soon) : null
  const wide = (c.colPx || c.px) >= 480
  const states = {}
  for (const st of LIVE_STEPS) { const s = stepState(work, st.id, ''); states[st.id] = s === 'done' ? 'done' : s === 'next' ? 'here' : 'todo' }
  const out = [PageHead(c, 'All 10 builders', 'Your map', `${LIVE_STEPS.length} are open now. The rest arrive as updates, and your work carries over.`)]
  if (soon) out.push(U2.Callout(E, 'map-soon', 'i', U2.Col(E, 'map-soon-c', [U2.Strong(E, 'map-soon-t', `${soon.name}: ${soon.promise}.`), U2.Meta(E, 'map-soon-m', "This builder isn't ready yet. Your other steps are all here, in order.")], S.none)))
  out.push(ArtOf(E, 'map-route', routeMapSvg({ px: Math.min(c.colPx || c.px, 760), states })))
  out.push(U2.SectionHead(E, 'map-open-h', { title: 'Open a step' }))
  out.push(
    <E.Box key="map-open" flexDirection="row" flexWrap="wrap" gap={1}>
      {LIVE_STEPS.map((st) => Btn(E, `map-go-${st.id}`, `${st.n}. ${st.name}`, () => goStep($, st.id), states[st.id] === 'here'))}
    </E.Box>,
  )
  const coming = STEPS.filter((x) => !x.live)
  out.push(U2.SectionHead(E, 'map-soon-h', { title: 'Coming as updates', sub: 'Each one builds on the work you already have here.' }))
  out.push(U2.Grid(E, 'map-soon-grid', coming.map((st) => (
    <E.Box key={`map-${st.id}`} flexDirection="column" gap={S.none} paddingX={1} paddingY={0} borderStyle="single" borderColor={V.line} backgroundColor={V.surface}>
      <E.Box key={`map-${st.id}-t`} flexDirection="row" flexWrap="wrap" gap={1} justifyContent="space-between" alignItems="center">
        <E.Text weight="semibold" color={V.heading}>{`${st.n}. ${st.name}`}</E.Text>
        {U2.Chip(E, `map-chip-${st.id}`, PHASES[st.phase].name, 'quiet')}
      </E.Box>
      {U2.Meta(E, `map-${st.id}-p`, `${sentenceCase(st.promise)}.`)}
    </E.Box>
  )), wide))
  return out
}

// ---- Updates and help (version 2 for the workshop edition; the full edition keeps its own)

// ---- hand-offs to the chat
// Starts one of Uncapped's chat steps by running its skill as a command, as if
// the person had typed it, with the step and the working offer in its words
// (Claude Code refuses a plugin message that starts with "/"). If even that is
// refused, one clear way on: copy the message and paste it into the chat.
// The same step pressed twice in quick succession starts the chat once.
let lastHandoff = { text: '', at: 0 }
async function toChat($, skill, args, note, lead) {
  const command = `${PLUGIN}:${skill}`
  const text = `/${command}${args ? ` ${args}` : ''}`
  const t = await $.clock.now()
  if (lastHandoff.text === text && t - lastHandoff.at < 10000) {
    await setUi($, { chatNote: { text: [lead, note].filter(Boolean).join(' '), lead: Boolean(lead) } })
    return true
  }
  lastHandoff = { text, at: t }
  try {
    await $.command.run({ command, args: args || '' })
    const forStep = skill === 'discover' ? 'discover' : skill === 'plan' ? (/^Substack/i.test(args || '') ? 'substack' : 'sales') : skill === 'debrief' ? 'test' : ['idea', 'refine'].includes(skill) ? 'offer' : null
    await setUi($, { chatNote: { text: [lead, note].filter(Boolean).join(' '), for: forStep, lead: Boolean(lead) }, notice: null, handoff: null, error: null })
    return true
  } catch (e) {
    await setUi($, { notice: lead || null, error: null, handoff: { text, why: String(e?.message || e).slice(0, 200) } })
    return false
  }
}
async function copyHandoff($) {
  const u = await read($, uiA)
  if (!u.handoff) return
  try {
    await $.ui.copy({ text: u.handoff.text })
    await setUi($, { notice: 'Copied. Paste it into the chat beside this panel and press Enter.' })
  } catch (e) {
    await setUi($, { notice: "Couldn't copy it from here: copy the message above, or type it into the chat." })
  }
}
function HandoffCard($, c) {
  const { E, ui } = c
  if (!ui.handoff) return null
  return Card(E, [
    Label(E, 'One more step', C.espresso),
    T(E, "Uncapped couldn't start this in the chat by itself. Copy this message, paste it into the chat beside this panel and press Enter:"),
    E.Code ? <E.Code key="handoff-msg" source={ui.handoff.text} wrap="wrap" /> : <E.Text key="handoff-msg" weight="semibold" color={C.espresso} wrap="wrap">{ui.handoff.text}</E.Text>,
    Row(E, [Btn(E, 'handoff-copy', 'Copy message', () => copyHandoff($), true), Btn(E, 'handoff-done', 'Done', () => setUi($, { handoff: null }))]),
  ], { key: 'handoff', tone: 'decide' })
}
async function discoverInChat($) {
  await mutate($, (w) => { w.onboarding = { ...(w.onboarding || {}), seen: true, tourDone: true } }, [])
  await go($, { view: 'discover', stage: 'overview' })
  await toChat($, 'discover', '', 'Discover is in the chat beside this panel. Your answers are saved here as you go.')
}
async function planInChat($, id, revise = false, lead = '', mode = '', where = null) {
  const w = await read($, workA)
  const o = workingOffer(w)
  await go($, where || { view: 'builder', builder: id, stage: 'result' })
  const note = mode === 'messages' ? 'Write your first messages with Claude in the chat beside this panel. Each one is saved on that person\'s record here, ready to copy.' : mode === 'portfolio' ? 'Claude is updating your Substack strategy in the chat beside this panel, so it supports every offer you\'re focusing on.' : `Claude is asking the questions in the chat beside this panel. Your ${WS_NAME[id]} appears here when it's ready.`
  // With more than one space, a Substack is for one space: its name and its offers go in the command.
  const sp = o && spacesOf(w).length > 1 ? spaceOf(w, o) : null
  const inSp = sp ? offersIn(w, sp.id) : chosenOffers(w)
  const offers = id === 'substack' && sp ? `for my space "${sp.name}": ${inSp.map((x) => x.name).join('; ')}` : mode === 'portfolio' ? `for my offers: ${inSp.map((x) => x.name).join('; ')}` : o ? `for my working offer: ${o.name}` : ''
  await toChat($, 'plan', `${WS_NAME[id]}${offers ? ` ${offers}` : ''}${revise ? ' (change my plan)' : mode === 'messages' ? ' (write my first messages)' : mode === 'portfolio' ? (sp ? ' (update it for every offer in this space)' : ' (update it for all my offers)') : ''}`, note, lead)
}
async function debriefInChat($, x) {
  await toChat($, 'debrief', x.title, 'Tell Claude what happened in the chat beside this panel. What you report is saved with this test.')
}
async function refineInChat($) {
  await toChat($, 'refine', 'my portfolio garden', "Tell Claude what's missing in the chat beside this panel. Your ideas and working offer stay as they are until you choose to change them.")
}
async function openSection($, key, group) {
  if (group) return update($, uiA, (u) => ({ ...u, grp: { ...(u.grp || {}), [group]: key } }))
  await update($, uiA, (u) => ({ ...u, sec: { ...(u.sec || {}), [key]: true } }))
  try { await $.ui.scroll({ to: { key: `sec-${key}` }, in: PANE, block: 'start' }) } catch (e) {}
}

// The one signposted fallback, for a step whose chat hand-off isn't verified.
function FallbackCard(E, key, text, btnKey, label, onPress) {
  return Card(E, [Label(E, 'Workshop fallback', C.espresso), T(E, text), Row(E, [Btn(E, btnKey, label, onPress, true)])], { key, tone: 'decide' })
}
// The step header band (7.2): the same on every step, so the person always
// knows "I'm on step N, called X". Status: done, here, next, or a sticker.
function StepHead(c, id, status, titleText) {
  const { E, work } = c
  const st = LIVE_STEPS.find((x) => x.id === id)
  if (!st) return U2.Cap(E, 'ws-eyebrow', String(id), V.accent)
  const state = status || (st.pos < wsStage(work) ? 'done' : 'here')
  // With more than one space, each Substack is for one kind of reader.
  const promise = id === 'substack' && spacesOf(work).length > 1 ? 'One publication for each kind of reader.' : `${sentenceCase(st.promise)}.`
  const chip = state === 'done' ? U2.Chip(E, 'ws-st-chip', 'Done ✓', 'done') : state === 'next' ? U2.Chip(E, 'ws-st-chip', 'Next', 'quiet') : U2.Chip(E, 'ws-st-chip', "You're here", 'here')
  return U2.TitleBlock(E, 'ws-stephead', { eyebrow: `Step ${st.pos} of ${LIVE_STEPS.length} · ${PHASES[st.phase].name}`, title: StepTitle(c, titleText || st.name), promise, chip })
}

// ---- welcome (version 2): the letter, the Next move, how it works, the path
// Artwork from brand.js ({ source, alt }) as an Svg element.
const ArtOf = (E, key, a) => (E.Svg && a ? <E.Svg key={key} source={a.source} alt={a.alt} /> : null)

// A step that isn't ready yet keeps its header and says what comes first (8.16).
function Signpost($, c, eyebrow, title, text, key, label, step, forStep) {
  const { E } = c
  const head = forStep ? [StepHead(c, forStep, 'next')] : [Eyebrow(E, 'ws-eyebrow', eyebrow), Title(c, title, 25)]
  return [...head, NextMove(E, 'ws-signpost', { label: 'First', title, body: text, actions: [Btn(E, key, label, () => goStep($, step), true)] })]
}

// ---- welcome
function discoverStarted(work, ui) {
  return Boolean(ui?.discoverLive || gardenGrowing(ui) || work.discover?.startingPoint || discoverProgress(work).done > 0 || work.discover?.early)
}
function WsWelcome($, c) {
  const { E, work } = c
  return [
    ArtOf(E, 'ws-welcome-letter', welcomeSvg({ px: Math.min(c.px, 620), fonts: FONTS, name: work.profile?.name, photo: PHOTO })),
    fallbackFor(work, 'discover')
      ? FallbackCard(E, 'ws-fb-discover', 'Today, answer the Discover questions here in the panel.', 'ws-start', 'Start Discover here', () => finishOnboarding($, 'discover'))
      : NextMove(E, 'ws-welcome-next', { title: 'Start Discover', body: 'About 20 minutes of questions about your work, your life and what people already ask you for.', actions: [Btn(E, 'ws-start', 'Start Discover in the chat', () => discoverInChat($), true)] }),
    U2.Col(E, 'ws-how', [U2.Cap(E, 'ws-how-l', 'How it works'), U2.Body(E, 'ws-how-t', "You answer questions in the chat beside this panel. This panel keeps everything you build, so you always know where you are and what's next.")], S.none),
    U2.Col(E, 'ws-path', [
      U2.Cap(E, 'ws-path-l', 'Your path'),
      U2.Grid(E, 'ws-path-g', LIVE_STEPS.map((st) => U2.Col(E, `ws-path-${st.id}`, [
        <E.Box key={`ws-path-${st.id}-h`} flexDirection="row" gap={1} alignItems="center">
          <E.Text weight="bold" color={V.accent}>{`${st.pos}.`}</E.Text>
          <E.Text weight="semibold" color={V.heading} wrap="wrap">{st.name}</E.Text>
        </E.Box>,
        U2.Meta(E, `ws-path-${st.id}-p`, `${sentenceCase(st.promise)}.`),
      ], S.none)), c.colPx >= 480),
    ], S.tight),
  ]
}

// ---- Home (version 2, 9.1): the greeting, the one next move, the numbers,
// the offers and the path, all at a glance.

// ---- 1. Discover (S1): what's saved, never an answer box
// A theme's one line: its saved summary, or its first sentence, never cut off.
function themeLine(work, id, v) {
  const s = String(work.profile?.summaries?.[id] || '').trim()
  return s || firstSentence(v)
}
async function seeIdeas($) {
  await mutate($, (w) => { w.celebrated = { ...(w.celebrated || {}), discover: true } }, ['discover'])
  await goStep($, 'offer')
}
function WsDiscover($, c) {
  const { E, work } = c
  const p = discoverProgress(work)
  const fb = fallbackFor(work, 'discover')
  const name = work.profile?.name ? `, ${work.profile.name}` : ''
  if (work.discover.early) c.places?.add('ws-grow')
  const ideas = work.discover.early ? gardenIdeas(work) : []
  const skills = new Set(ideas.map((i) => i.d.id)).size
  const tiles = THEMES.map((t) => {
    const { v, saved, skipped } = themeValue(work, t)
    const gist = saved ? (t.id === 'week' || t.id === 'energy' ? v : themeLine(work, t.id, v)) : skipped ? 'Skipped' : 'Not answered yet'
    const open = saved || skipped ? Btn(E, `ws-th-open-${t.id}`, 'Open', () => go($, { view: 'discover', stage: 'theme', theme: t.id }), 'plain') : null
    const answer = !saved && !fb ? Btn(E, `ws-add-${t.id}`, 'Answer in the chat', () => toChat($, 'discover', `add to: ${t.label}`, 'Answer it in the chat beside this panel. It\'s saved here as you go.'), 'plain') : null
    return U2.Tile(E, `ws-th-${t.id}`, { q: t.label, gist, muted: !saved, actions: [open || answer], spine: saved ? U2.SPINES()[THEMES.indexOf(t) % 4] : null })
  })
  return [
    StepHead(c, 'discover', work.discover?.early ? 'done' : 'here'),
    ...[].concat(discoverMove($, c)).filter(Boolean),
    U2.MetricStrip(E, 'ws-d-metrics', [
      { label: 'Themes covered', value: p.done, suffix: `of ${p.total}`, bar: { n: p.done, total: p.total, alt: `${p.done} of ${p.total} themes covered` }, context: !p.hasDirections && !p.ready && p.left ? `About ${p.left} ${p.left === 1 ? 'question' : 'questions'} to go` : '' },
      { label: 'Ideas in your garden', value: ideas.length, context: ideas.length ? `Across ${skills} skill${skills === 1 ? '' : 's'}` : 'They grow once Discover has enough.' },
    ], c.colPx || c.px),
    p.done ? U2.SectionHead(E, 'ws-d-title', { title: `What you've told me${name}`, right: !fb ? Btn(E, 'ws-add-new', 'Add something new in the chat', () => toChat($, 'discover', 'add something new', 'Tell Claude what\'s new in the chat. It\'s saved here, and Claude tells you if it changes your ideas.'), 'plain') : null }) : null,
    p.done ? U2.Grid(E, 'ws-d-tiles', tiles, (c.colPx || c.px) >= 480) : U2.Meta(E, 'ws-d-empty', 'Your answers appear here as you go.'),
  ].filter(Boolean)
}
// One Discover answer on its own page (7.6, 7.9).

// ---- 2. Your offer (S2): the portfolio garden
// A short name for an offer or idea in a line of context (10.3).
function shortName(name, max = 40) {
  const t = String(name || '').trim()
  if (t.length <= max) return t
  // The part before a colon, a dash or a bracket, else before " for ", if that reads on its own.
  for (const cut of [t.split(/:\s| — | \(|, /)[0].trim(), t.split(/ for /)[0].trim()]) if (cut.length <= max && cut.length >= 12) return cut
  // Whole words that fit, never ending on a little word ("with a", "for the").
  let words = t.split(/\s+/).reduce((acc, w) => (acc.done ? acc : (`${acc.s} ${w}`).trim().length <= max ? { s: `${acc.s} ${w}`.trim() } : { ...acc, done: true }), { s: '' }).s.split(' ')
  while (words.length > 2 && /^(a|an|the|with|for|of|and|to|in|on|by|your|their|or)$/i.test(words[words.length - 1])) words = words.slice(0, -1)
  return words.join(' ')
}
const SIZE_WORDS = { 'one session': 'one session', 'a few sessions': 'a few sessions', 'most of your hours': 'most of your hours', 'more than you have now': 'more than you have now' }
// Three ways to look across the garden (10 Nov): they can be three different ideas.
const PICKS = [['easiest', 'Easiest to test'], ['mostPerClient', 'Most per client'], ['mostExcited', 'You seem most excited']]
// Each way to earn, explained in a sentence with an example, above its ideas (Gabriela's words, 10 Nov).
const LENS_EXPLAIN = {
  publish: 'Share what you know through writing or media. For example, publish a newsletter that brings in clients and could later earn through paid subscriptions or sponsors.',
  package: 'Make a resource people can buy and use on their own. Think templates, toolkits, calculators or guides that help them finish a specific task.',
  teach: 'Help people learn a skill they can use themselves. For example, run a workshop where founders learn to read their own ad results.',
  with: "Work through their specific problem together. For example, review a founder's ads and landing page on a call and agree on what they should test next.",
  for: 'Take responsibility for a defined piece of work and hand back the result. For example, review the ads independently and deliver a 30-day strategy.',
}
function IdeaCard($, c, i, opts = {}) {
  const { E, work } = c
  const cur = isCurrentIdea(work, i)
  const k = ideaKey(i)
  const lens = LENS[i.lens]
  const inPortfolio = !cur && chosenOffers(work).some((o) => !offerStale(work, o) && o.fromDirection === i.d.id && (o.fromGrow ?? null) === (i.grow ?? null))
  const one = String(i.how || '').trim() ? firstSentence(i.how) : ''
  // A garden grown since 10 Nov shows each idea in the same comparable parts.
  const compare = Boolean(i.trigger || i.credible || i.hours || i.test)
  return ItemCard(E, `${opts.prefix || 'idea'}-${k}`, lens?.color, [
    Chips(E, `ic-chips-${k}`, [
      lens ? Chip(E, `ic-lens-${k}`, lens.name, `lens:${i.lens}`) : null,
      opts.pick ? Chip(E, `ic-pick-${k}`, 'My pick', 'pick') : null,
      opts.early ? Chip(E, `ic-early-${k}`, 'Try early', 'next') : null,
      ...(opts.picks || []).map((p, n) => Chip(E, `ic-pk-${k}-${n}`, p, 'pick')),
      cur ? Chip(E, `ic-cur-${k}`, 'Working offer', 'working') : inPortfolio ? Chip(E, `ic-in-${k}`, 'In your portfolio', 'done') : null,
      i.own ? Chip(E, `ic-own-${k}`, 'Your idea', 'yours') : null,
    ]),
    i.family ? <E.Text key={`ic-fam-${k}`} size="caption" weight="bold" color={C.taupeInk}>{String(i.family).toUpperCase()}</E.Text> : null,
    T(E, i.name, { weight: 'semibold', color: C.espresso }),
    ...(compare
      ? [
        KeyFacts(E, `ic-facts-${k}`, [['Who pays', i.buyer], ['When they look for help', i.trigger], ['What they get', i.receives], ['Why you', i.credible], ['Test price', i.price], ['Time to deliver', [i.hours, SIZE_WORDS[i.size] ? `(${SIZE_WORDS[i.size]})` : ''].filter(Boolean).join(' ')]], c.px >= 420),
        i.test ? Small(E, `How to test it: ${i.test}`, { color: C.ink }) : null,
        i.next ? Small(E, `Could lead to: ${i.next}`, { color: C.ink }) : null,
        i.needs ? Small(E, `It would need: ${i.needs}`, { color: C.ink }) : null,
        Small(E, i.proof || 'The buyer, price and demand are guesses to test.'),
      ]
      : [
        [i.buyer ? `For ${lowerFirst(i.buyer)}` : '', i.price].filter(Boolean).length ? Small(E, [i.buyer ? `For ${lowerFirst(i.buyer)}` : '', i.price].filter(Boolean).join(' · ')) : null,
        one ? T(E, one) : null,
        i.why ? Small(E, `Why they'd pay: ${i.why}`, { color: C.ink }) : null,
      ]),
    ...OpSlot($, c, `ws-use-${k}`, [Row(E, [
      cur || inPortfolio ? null : Btn(E, `${opts.prefix || 'ws-use'}-${k}`, 'Choose this offer', () => wsUseOffer($, i.d.id, i.grow)),
      Btn(E, `${opts.prefix ? `${opts.prefix}-more` : 'explore'}-${k}`, 'More about this', () => go($, { view: 'discover', stage: 'direction', id: i.d.id }), 'plain'),
    ].filter(Boolean))]),
  ])
}
async function keepOffer($) {
  await mutate($, (w) => { const o = activeOffer(w); if (o && w.discover?.early) o.fromGarden = w.discover.early.at }, ['discover'])
  await setUi($, { notice: 'Kept: your offer stays as it is, alongside your new ideas.' })
}
// ---- the Portfolio Garden (10 Nov redesign): a table of offers to look across,
// one offer at a time when you open it, and one to start with.
const GARDEN_COPY = "Look through a few offers and pick the one you'd be most excited to try first. We'll use it to build your plan for finding your first 10 customers and your Substack marketing strategy. You can come back and build a separate plan for another offer whenever you're ready."
const NEXT_COPY = "Start here to build your first 10 customers plan and Substack strategy. You can come back for another offer whenever you're ready."
const G = { card: '#FFFDF8', ink: '#2D221E', gray: '#655A52', stone: '#D9CFC1', marigold: '#FFD45C', paleYellow: '#FFF3C7', paleGreen: '#E8EDE2', paleBlue: '#E8EDF6', sand: '#F0E8DC' }
const LENS_TINT = { publish: '#EFE9DF', package: '#E9E4DE', teach: '#FFF1C2', with: '#FBE3E9', for: '#E5E8FF' }
const DO_HEADING = { publish: "What you'd write", package: "What you'd make", teach: "What you'd teach", with: "What you'd do together", for: "What you'd do" }
const ideaFormat = (i) => String(i.format || LENS[i.lens]?.name || '').trim()
const ideaChange = (i) => String(i.change || '').trim() || firstSentence(i.how || i.why || '')
const ideaTime = (i) => [i.timeOnce, i.timeEach].filter((x) => String(x || '').trim()).join(' · ') || i.hours || ''
const priceTimeLine = (i) => [i.price, ideaTime(i)].filter((x) => String(x || '').trim()).join(' · ')
function FormatTag(E, key, text, tint) {
  if (!text) return null
  return (
    <E.Box key={key} flexDirection="row">
      <E.Box paddingX={1} backgroundColor={tint || G.sand}><E.Text size="caption" weight="semibold" color={G.ink}>{text}</E.Text></E.Box>
    </E.Box>
  )
}
async function openIdea($, k) {
  await setUi($, { gardenFrom: k })
  await go($, { view: 'discover', stage: 'idea', key: k })
}
// Back to the garden as it was: the same view and filter, scrolled to the offer you opened.
async function backToGarden($) {
  const u = await read($, uiA)
  await go($, { view: 'discover', stage: 'garden' })
  if (u.gardenFrom) { try { await $.ui.scroll({ to: { key: `gp-${u.gardenFrom}` }, in: PANE, block: 'center' }) } catch (e) {} }
}
function OfferPreview($, c, i, half, tags) {
  const { E } = c
  const k = ideaKey(i)
  const change = ideaChange(i)
  const line = priceTimeLine(i)
  return (
    <E.Box key={`gp-${k}`} flexDirection="column" gap={S.tight} paddingX={2} paddingY={1} borderStyle="round" borderColor={G.stone} backgroundColor={G.card} width={half ? '48%' : '100%'} hover={DESKTOP.hover ? { borderColor: G.ink } : undefined}>
      {FormatTag(E, `gp-f-${k}`, ideaFormat(i), LENS_TINT[i.lens])}
      <E.Text weight="semibold" color={G.ink} wrap="wrap">{i.name}</E.Text>
      {change ? <E.Text size="footnote" color={G.gray} wrap="wrap">{change}</E.Text> : null}
      {line ? <E.Text size="footnote" weight="semibold" color={G.ink} wrap="wrap">{line}</E.Text> : null}
      {tags.length ? <E.Text size="caption" weight="semibold" color={C.blue} wrap="wrap">{tags.join(' · ')}</E.Text> : null}
      <E.Box flexDirection="row">{Btn(E, `ws-see-${k}`, 'See this offer ›', () => openIdea($, k), 'plain')}</E.Box>
    </E.Box>
  )
}
function WsGarden($, c) {
  const { E, work, ui } = c
  const g = work.discover.early
  if (!g) return Signpost($, c, '', 'Your ideas grow from Discover', 'Once Claude knows enough about you, they appear here.', 'go-discover', 'Go to Discover', 'discover', 'offer')
  const o = activeOffer(work)
  const stale = o && o.status !== 'idea' && offerStale(work, o)
  const chosen = workingOffer(work)
  const ideas = gardenIdeas(work)
  const start = startList(work, ideas)
  const first = start[0]?.i || null
  const tf = g.testFirst || {}
  const wide = (c.colPx || c.px) >= 480
  const view = (c.ui?.view?.offer && ['pick', 'all', 'ways'].includes(c.ui.view.offer)) ? c.ui.view.offer : 'pick'
  const setView = (id) => update($, uiA, (u) => ({ ...u, view: { ...(u.view || {}), offer: id } }))
  const head = [
    StepHead(c, 'offer', chosen ? 'done' : 'here', 'Portfolio Garden'),
    U2.ViewSwitch(E, 'ws-gview', [{ id: 'pick', label: 'Your pick' }, { id: 'all', label: `All ideas · ${ideas.length}` }, { id: 'ways', label: 'Ways to earn' }], view, setView),
  ]
  // A decision that blocks the step replaces the Next move (6.2).
  const decide = stale ? U2.NextCard(E, 'ws-stale', {
    tone: 'decide', label: 'Needs your decision', title: 'Your garden has grown since you chose your offer',
    body: `${shortName(o.name, 60)} and its plans stay saved. Look at the new ideas, or keep your offer.`,
    actions: [Btn(E, 'ws-stale-choose', 'Choose from the new ideas', async () => { await update($, uiA, (u) => ({ ...u, gFilter: 'all', view: { ...(u.view || {}), offer: 'all' } })) }, true), Btn(E, 'ws-stale-keep', 'Keep my offer', () => keepOffer($))],
  }) : null
  const invite = (key) => U2.Panel(E, key, 'invite', [
    U2.Strong(E, `${key}-t`, 'Not quite right?'),
    U2.Body(E, `${key}-b`, "Tell me what's missing in the chat and we'll find a better fit. Or add an idea of your own."),
    U2.Line(E, `${key}-a`, [Btn(E, 'ws-add-idea', 'Add my own idea in the chat', () => toChat($, 'idea', '', 'Tell Claude about your idea in the chat. Once it\'s shaped, it appears here in your garden.')), Btn(E, 'ws-refine', "Say what's missing in the chat", () => refineInChat($), 'plain')]),
    U2.Meta(E, `${key}-f`, 'Your ideas and your offer stay as they are until you choose to change them.'),
  ])

  if (view === 'all') {
    const counts = Object.fromEntries(LENS_ORDER.map((id) => [id, ideas.filter((i) => i.lens === id).length]))
    const filter = ui.gFilter && (ui.gFilter === 'all' || counts[ui.gFilter]) ? ui.gFilter : 'all'
    const shown = (filter === 'all' ? ideas : ideas.filter((i) => i.lens === filter)).slice().sort((a, z) => lensRank(a) - lensRank(z))
    return [
      ...head, decide,
      Tabs(E, 'lens-tabs', [{ id: 'all', label: 'All', count: ideas.length }, ...LENSES.filter((l) => counts[l.id]).map((l) => ({ id: l.id, label: l.label, count: counts[l.id] }))], filter, (id) => setUi($, { gFilter: id })),
      !chosen && !stale ? U2.Meta(E, 'ws-garden-copy', GARDEN_COPY, { color: V.body }) : null,
      filter !== 'all' && LENS_EXPLAIN[filter] ? U2.Meta(E, 'ws-filter-line', `${LENS[filter].line} ${LENS_EXPLAIN[filter]}`) : U2.Meta(E, 'ws-filter-line', 'From least of your time per sale to most. The squares on each card show how much of your time a sale takes.'),
      U2.Grid(E, 'ws-grid', shown.map((i) => IdeaCard2($, c, i, ideaChip(c, i, first))), wide),
      U2.Panel(E, 'ws-own-card', 'invite', [U2.Line(E, 'ws-own-l', [U2.Strong(E, 'ws-own-t', 'Got an idea of your own?'), Btn(E, 'ws-add-idea', 'Add my own idea in the chat', () => toChat($, 'idea', '', 'Tell Claude about your idea in the chat. Once it\'s shaped, it appears here in your garden.'), 'plain')])]),
    ].filter(Boolean)
  }

  if (view === 'ways') {
    const counts = Object.fromEntries(LENS_ORDER.map((id) => [id, ideas.filter((i) => i.lens === id).length]))
    const L = work.profile?.limits || {}
    const goal = L.income ? `${L.currency || ''}${L.income} a month` : ''
    const paths = (g.goalPaths || []).filter((x) => String(x?.path || '').trim())
    return [
      ...head,
      ArtOf(E, 'ws-ways-art', lensLadderSvg({ px: c.px, fonts: FONTS, counts, pick: first?.lens || null })),
      Note(c, 'The same skill can earn five ways. Start where it\'s easiest to say yes.'),
      U2.SectionHead(E, 'ws-ways-h', { title: 'How they differ' }),
      U2.Grid(E, 'ws-ways-g', LENS_ORDER.map((id) => U2.Panel(E, `ws-way-${id}`, 'surface', [
        <E.Box key={`ws-way-${id}-h`} flexDirection="row" gap={1} alignItems="center">
          <E.Box width={1} height={1} backgroundColor={U2.lensColor(id)} />
          <E.Text weight="semibold" color={V.heading}>{LENS[id].name}</E.Text>
          {U2.Meta(E, `ws-way-${id}-n`, `${counts[id] || 0} idea${counts[id] === 1 ? '' : 's'}`)}
        </E.Box>,
        U2.Meta(E, `ws-way-${id}-l`, LENS[id].line),
        U2.Facts(E, `ws-way-${id}-f`, [['What you do', LENS[id].does], ['What they get', LENS[id].gets], ['Your time per sale', LENS[id].time], ['Price per sale', LENS[id].price]], true, false),
      ])), wide),
      paths.length ? U2.Col(E, 'ws-paths', [
        U2.SectionHead(E, 'ws-paths-h', { title: goal ? `Ways to reach ${goal}` : 'Ways to reach your first goal', sub: 'Your goal sets what a first test is worth; the price comes from the work.' }),
        ...paths.map((x, n) => U2.Panel(E, `ws-path-${n}`, 'surface', [U2.Strong(E, `ws-path-${n}-t`, x.path), x.tradeoff ? U2.Meta(E, `ws-path-${n}-m`, x.tradeoff) : null])),
      ], S.tight) : null,
      U2.Line(E, 'ws-ways-all', [Btn(E, 'ws-ways-all-btn', `See all ${ideas.length} ideas`, () => setView('all'))]),
    ].filter(Boolean)
  }

  // Your pick (default)
  const picks = PICKS.map(([id, label]) => ({ id, label, i: pickIdea(ideas, g.picks?.[id]) })).filter((x) => x.i)
  const unknowns = (g.unknowns || []).map((x) => (typeof x === 'string' ? { text: x } : x))
  const cur = chosen ? ideas.find((i) => isCurrentIdea(work, i)) : null
  const feat = cur || first
  const move = stale ? null : chosen
    ? NextMove(E, 'ws-starting', {
      label: 'Your starting offer', title: chosen.name,
      body: "Build your plans for this offer. You can come back and choose another whenever you're ready, and this one keeps its plans.",
      actions: [
        Btn(E, 'ws-start-f10', planFor(work, 'sales', chosen) ? 'Open your First 10 plan' : 'Build your First 10 plan', () => (planFor(work, 'sales', chosen) ? goStep($, 'sales') : planInChat($, 'sales')), true),
        Btn(E, 'ws-start-ss', planFor(work, 'substack', chosen) ? 'Open your Substack strategy' : 'Build your Substack strategy', () => (planFor(work, 'substack', chosen) ? goStep($, 'substack') : planInChat($, 'substack'))),
      ],
    })
    : first ? NextMove(E, 'ws-pick', { label: 'My pick for you', title: first.name, body: firstSentence(tf.why || start[0].why || ''),
      extra: [
        [first.buyer ? `For ${lowerFirst(String(first.buyer).replace(/\.$/, ''))}` : '', first.price].filter(Boolean).length ? U2.Meta(E, 'ws-pick-for', [first.buyer ? `For ${lowerFirst(String(first.buyer).replace(/\.$/, ''))}` : '', first.price].filter(Boolean).join(' · '), { color: V.body }) : null,
        U2.Facts(E, 'ws-pick-f', [['What the first test needs to learn', first.learn || (first.grow == null ? first.d.toTest : '')], ['Where your first test starts', first.grow == null ? first.d.startWith : '']], wide),
      ],
      actions: [Btn(E, 'ws-pick-see', 'See this offer', () => openIdea($, ideaKey(first)), true), Btn(E, 'ws-pick-explore', 'See all ideas', () => setView('all'), 'plain')] })
      : NextMove(E, 'ws-pick', { title: 'Choose the offer to test first', body: GARDEN_COPY, actions: [Btn(E, 'ws-pick-explore', 'See all ideas', () => setView('all'), true)] })
  const featCard = feat ? U2.Panel(E, 'ws-feat', 'surface', [
    <E.Box key="ws-feat-c" flexDirection="row" flexWrap="wrap" gap={1}>{[feat.lens ? U2.Chip(E, 'ws-feat-lens', LENS[feat.lens].name, `lens:${feat.lens}`) : null, ideaChip(c, feat, first)].filter(Boolean)}</E.Box>,
    U2.Strong(E, 'ws-feat-t', feat.name),
    [feat.buyer ? `For ${lowerFirst(String(feat.buyer).replace(/\.$/, ''))}` : '', feat.price].filter(Boolean).length ? U2.Meta(E, 'ws-feat-m', [feat.buyer ? `For ${lowerFirst(String(feat.buyer).replace(/\.$/, ''))}` : '', feat.price].filter(Boolean).join(' · ')) : null,
    ideaChange(feat) ? U2.Body(E, 'ws-feat-o', ideaChange(feat)) : null,
    U2.Facts(E, 'ws-feat-f', [['What the first test needs to learn', feat.learn || (feat.grow == null ? feat.d.toTest : '')], ['Where your first test starts', feat.grow == null ? feat.d.startWith : '']], wide),
    U2.Line(E, 'ws-feat-a', [Btn(E, `ws-feat-see`, 'More about this', () => openIdea($, ideaKey(feat)), 'plain')]),
  ]) : null
  const dirs = g.directions || []
  const offers = chosenOffers(work)
  const older = (work.offers || []).filter((x) => x.status !== 'idea' && offerStale(work, x)).length
  return [
    ...head,
    decide, move,
    picks.length ? U2.RowList(E, 'ws-picks', { label: 'Three ways to choose', rows: picks.map((x) => ({ key: `ws-pk-${x.id}`, name: shortName(x.i.name, 70), meta: x.label, spine: U2.lensColor(x.i.lens), actions: [Btn(E, `ws-pk-open-${x.id}`, 'See this offer', () => openIdea($, ideaKey(x.i)), 'plain')] })) }) : null,
    g.read ? Disclosure($, c, 'ws-read-more', 'Why these ideas', 'my read of what you told me', [U2.Body(E, 'ws-read-t', g.read)]) : null,
    unknowns.length || g.range ? Disclosure($, c, 'ws-unknowns', `Still to check · ${unknowns.length}`, unknowns[0] ? firstSentence(unknowns[0].text) : 'what could still change your ideas', [U2.Bullets(E, 'ws-u', unknowns.map((u) => `${u.about === 'rules' ? 'To check: ' : ''}${u.text}`), '•'), g.range ? U2.Meta(E, 'ws-range', g.range) : null].filter(Boolean)) : null,
    dirs.length ? U2.RowList(E, 'ws-skills', {
      label: `Your ${dirs.length === 1 ? 'skill' : `${dirs.length} skills`} · ${ideas.length} ideas`,
      rows: dirs.map((d) => { const its = ideas.filter((i) => i.d === d); return { key: `ws-sk-${d.id}`, name: cleanShort(d), meta: `${its.length} idea${its.length === 1 ? '' : 's'} · ${[...new Set(its.map((i) => LENS[i.lens]?.name).filter(Boolean))].join(', ')}`, actions: [Btn(E, `ws-dir-open-${d.id}`, 'Open', () => go($, { view: 'discover', stage: 'direction', id: d.id }), 'plain')] } }),
    }) : null,
    offers.length > 1 ? U2.Col(E, 'ws-offers', [
      U2.SectionHead(E, 'ws-offers-h', { title: 'Your offers', right: U2.Meta(E, 'ws-offers-n', `${offers.length}`) }),
      ...offers.map((x) => U2.OfferCard(E, `ws-offer-row-${x.id}`, { lens: offerLens(work, x), title: shortName(x.name, 60), chip: chosen && chosen.id === x.id ? U2.Chip(E, `ws-offer-c-${x.id}`, 'Working offer', 'accent') : null, status: offerProgress(work, x), actions: [chosen && chosen.id === x.id ? null : Btn(E, `ws-offer-${x.id}`, 'Work on this offer', () => switchOffer($, x.id), 'plain')] })),
      older ? U2.Meta(E, 'ws-offers-older', `${older} offer${older === 1 ? '' : 's'} from an earlier garden ${older === 1 ? 'is' : 'are'} saved too.`) : null,
    ], S.tight) : null,
    invite('ws-refine-card'),
  ].filter(Boolean)
}

// ---- one offer, in full (7.9): every part the garden saved, under clear headings.

// ---- one offer, in full (10 Nov): what changes, price and time, what you'd do
// and what they'd get, who buys and when, why it fits you, the first test.
function WsOffer($, c) {
  const { E, work, nav } = c
  const ideas = gardenIdeas(work)
  const i = ideas.find((x) => ideaKey(x) === nav.key)
  if (!i) return WsGarden($, c)
  const k = ideaKey(i)
  const wide = (c.colPx || c.px) >= 480
  const cur = isCurrentIdea(work, i)
  const first = startList(work, ideas)[0]?.i || null
  const inPortfolio = !cur && chosenOffers(work).some((o) => !offerStale(work, o) && o.fromDirection === i.d.id && (o.fromGrow ?? null) === (i.grow ?? null))
  const buyers = (Array.isArray(i.buyers) && i.buyers.length ? i.buyers : [i.buyer]).filter((x) => String(x || '').trim())
  const doHead = String(i.doHeading || '').trim() || DO_HEADING[i.lens] || "What you'd do"
  const does = String(i.does || '').trim() || String(i.how || '').trim()
  const gets = String(i.gets || i.receives || '').trim()
  const change0 = ideaChange(i)
  const change = change0 && does.startsWith(change0.replace(/\.$/, '')) ? '' : change0
  const time = i.timeOnce || i.timeEach
    ? `${i.timeOnce || i.timeEach}${i.timeOnce && i.timeEach ? `, then ${lowerFirst(i.timeEach)}${/each|per |a month|a week|a session|a review/i.test(i.timeEach) ? '' : ' each time'}` : i.timeOnce ? ', once, to make it' : /each|per |a month|a week|across/i.test(i.timeEach) ? '' : ' each time'}`
    : i.hours || ''
  const sec = (key, title, body) => (String(body || '').trim() ? U2.Col(E, key, [U2.H2(E, `${key}-h`, title), typeof body === 'string' ? U2.Body(E, `${key}-b`, body) : body], S.none) : null)
  const d = i.d
  const startRow = cur
    ? [U2.Meta(E, 'wo-cur', 'This is your starting offer.'), U2.Line(E, 'wo-acts', [Btn(E, 'ws-start-f10', planFor(work, 'sales', workingOffer(work)) ? 'Open your First 10 plan' : 'Build your First 10 plan', () => (planFor(work, 'sales', workingOffer(work)) ? goStep($, 'sales') : planInChat($, 'sales')), true)])]
    : [U2.Meta(E, 'wo-next-copy', NEXT_COPY), U2.Line(E, 'wo-acts', [...OpSlot($, c, `ws-use-${k}`, [Btn(E, 'ws-start-offer', inPortfolio ? 'Work on this offer' : 'Start with this offer', () => wsUseOffer($, i.d.id, i.grow), true)])])]
  return [
    U2.Crumbs(E, 'wo-crumbs', [['Portfolio Garden', () => backToGarden($)], ['All ideas', async () => { await update($, uiA, (u) => ({ ...u, view: { ...(u.view || {}), offer: 'all' } })); await backToGarden($) }], [shortName(i.name, 60)]]),
    <E.Box key="wo-chips" flexDirection="row" flexWrap="wrap" gap={1}>{[i.lens ? U2.Chip(E, 'wo-lens', LENS[i.lens].name, `lens:${i.lens}`) : null, ideaChip(c, i, first)].filter(Boolean)}</E.Box>,
    U2.Col(E, 'wo-head', [ideaFormat(i) ? U2.Cap(E, 'wo-format', ideaFormat(i), V.accent) : null, StepTitle(c, i.name, c.px >= 420 ? 26 : 22), [buyers[0] ? `For ${lowerFirst(String(buyers[0]).replace(/\.$/, ''))}` : '', i.price].filter(Boolean).length ? U2.Meta(E, 'wo-for', [buyers[0] ? `For ${lowerFirst(String(buyers[0]).replace(/\.$/, ''))}` : '', i.price].filter(Boolean).join(' · ')) : null], S.none),
    change ? <E.Text key="wo-change" weight="semibold" color={V.heading} wrap="wrap">{change}</E.Text> : null,
    U2.Facts(E, 'wo-facts', [['Test price', i.price ? `${i.price}, an estimate to test` : ''], ['Your time', time], ['When they\'d look for it', i.trigger || i.why], ['Where your first test starts', i.grow == null ? d.startWith : ''], ['Kind of work', i.family]], wide),
    does || gets ? U2.Grid(E, 'wo-dg', [sec('wo-does', doHead, does), sec('wo-gets', "What they'd get", gets)].filter(Boolean), wide) : null,
    buyers.length > 1 ? sec('wo-buyers', 'Who might buy it', U2.Bullets(E, 'wo-b', buyers, '•')) : null,
    i.credible || i.proof ? U2.SpineCard(E, 'wo-fits', V.spineGreen, [U2.Cap(E, 'wo-fits-l', 'Why it fits you'), i.credible ? U2.Body(E, 'wo-fits-c', i.credible) : null, i.proof ? U2.Meta(E, 'wo-fits-p', i.proof) : null].filter(Boolean), 'washGreen') : null,
    i.grow == null && String(d.whyThisScope || '').trim() ? U2.SpineCard(E, 'wo-scope', V.accent, [U2.Cap(E, 'wo-scope-l', 'Why this size'), U2.Body(E, 'wo-scope-b', d.whyThisScope)]) : null,
    i.test ? U2.Callout(E, 'wo-test', '?', U2.Col(E, 'wo-test-c', [U2.Strong(E, 'wo-test-h', 'How to test it'), U2.Body(E, 'wo-test-t', i.test), i.learn ? U2.Meta(E, 'wo-test-l', i.learn) : null], S.none)) : null,
    i.needs || i.next || i.volume ? U2.Col(E, 'wo-more', [U2.H2(E, 'wo-more-h', 'More to consider'), U2.Facts(E, 'wo-more-f', [["What you'd need", i.needs], ['What this could lead to', i.next], ['The numbers', i.volume]], wide, false)], S.none) : null,
    U2.Panel(E, 'wo-foot', 'surface', startRow),
    <E.Box key="wo-nav" flexDirection="row" flexWrap="wrap" gap={2} justifyContent="space-between">
      {Btn(E, 'wo-back-2', '← Back to Garden', () => backToGarden($), 'plain', { dimColor: true })}
      {Btn(E, 'wo-skill', `See this skill: ${shortName(cleanShort(d), 30)} →`, () => go($, { view: 'discover', stage: 'direction', id: d.id }), 'plain')}
    </E.Box>,
  ].filter(Boolean)
}

// ---- one skill (S3): the same skill, the ways it could earn
// ---- one direction (S3): the same skill, the ways it could earn
const SOURCE_CHIP = (src) => (/buyer said|demonstrated/i.test(String(src)) ? ['A buyer said it', 'working'] : /you|person|own/i.test(String(src)) ? ['Your own thought', 'pick'] : ['My guess', 'yours'])
function WsDirection($, c) {
  const { E, work, nav } = c
  const d = (work.discover.early?.directions || []).find((x) => x.id === nav.id)
  if (!d) return WsGarden($, c)
  const ideas = gardenIdeas(work).filter((i) => i.d === d).sort((a, z) => lensRank(a) - lensRank(z))
  const first = startList(work, gardenIdeas(work))[0]?.i || null
  const opp = (String(d.opportunity || '').match(/[^.!?]+[.!?]+(\s|$)/g) || []).slice(0, 2).join('').trim()
  const back = () => go($, { view: 'discover', stage: 'garden' })
  const wide = (c.colPx || c.px) >= 480
  const srcLine = (a, n) => { const [w] = SOURCE_CHIP(a.source); return `${a.belief || a.text} (${lowerFirst(w)})` }
  return [
    U2.Crumbs(E, 'ws-dir-crumbs', [['Portfolio Garden', back], [cleanShort(d)]]),
    U2.Col(E, 'ws-dir-head', [U2.Cap(E, 'ws-eyebrow', 'A skill of yours', V.accent), StepTitle(c, cleanShort(d))], S.none),
    opp ? U2.Body(E, 'ws-dir-opp', opp) : null,
    ArtOf(E, 'ws-skill-ladder', skillLadderSvg({ px: c.px, fonts: FONTS, ideas: ideas.map((i) => ({ lens: i.lens, name: shortName(i.name, 60), price: i.price })) })),
    d.together ? Note(c, firstSentence(d.together)) : null,
    U2.SectionHead(E, 'ws-dir-ideas-h', { title: 'The ideas', right: U2.Meta(E, 'ws-dir-n', String(ideas.length)) }),
    U2.Grid(E, 'ws-dir-grid', ideas.map((i) => IdeaCard2($, c, i, ideaChip(c, i, first))), wide),
    U2.Grid(E, 'ws-dir-split', [
      d.whyYou || d.demand?.evidence || d.whyThisScope ? U2.SummaryCard(E, `ws-why-${d.id}`, 'Why this could fit you', [d.whyYou ? U2.Body(E, 'ws-why-y', d.whyYou) : null, d.demand?.evidence ? U2.Facts(E, `ws-dem-${d.id}`, [['What you told me', d.demand.evidence], ['Why it starts here', d.whyThisScope]], false, false) : d.whyThisScope ? U2.Facts(E, `ws-scope-${d.id}`, [['Why it starts here', d.whyThisScope]], false, false) : null].filter(Boolean)) : null,
      d.toTest || d.priceWhy || (d.assumptions || []).length ? U2.SummaryCard(E, `ws-test-${d.id}`, 'What still needs testing', [d.toTest ? U2.Body(E, 'ws-tt', d.toTest) : null, d.priceWhy ? U2.Facts(E, `ws-pw-${d.id}`, [['About the price', d.priceWhy]], false, false) : null, U2.Bullets(E, `ws-as-${d.id}`, (d.assumptions || []).map(srcLine), '•')].filter(Boolean)) : null,
    ].filter(Boolean), wide),
    Btn(E, 'ws-dirs', '← Back to your garden', back, 'plain', { dimColor: true }),
  ].filter(Boolean)
}

// Saves an idea as the working offer in one press: the direction's first offer
// (grow null) or one it could grow into. An idea from this garden that was
// chosen before is reused; anything else becomes a new offer, so each plan
// stays with the offer it was built for. Then straight on to First 10 Customers.
async function wsUseOffer($, id, grow = null) {
  const w = await getWork($)
  const g = w.discover.early
  const d = (g?.directions || []).find((x) => x.id === id)
  if (!d) return
  const drafts = draftsForDirection(d, grow != null ? (d.growInto || [])[grow] : null)
  const norm = (x) => String(x || '').trim().toLowerCase()
  // Already the working offer (a second press, say): show where it stands, start nothing again.
  const current = workingOffer(w)
  if (current && current.fromDirection === id && (current.fromGarden ? current.fromGarden === g.at && (current.fromGrow ?? null) === (grow ?? null) : norm(current.name) === norm(drafts['offer.name']))) {
    await go($, { view: 'builder', builder: 'sales', stage: 'result' })
    await setUi($, { notice: `This is already your working offer: ${current.name}.` })
    return
  }
  await mutate($, (w2) => {
    w2.discover.chosenId = id
    const same = (w2.offers || []).find((x) => x.status !== 'idea' && x.fromDirection === id && (x.fromGarden ? x.fromGarden === g.at && (x.fromGrow ?? null) === (grow ?? null) : norm(x.name) === norm(drafts['offer.name'])))
    if (same) activateOffer(w2, same.id)
    else {
      const o = offerFromDrafts(drafts, { id: `o${w2.offers.length + 1}`, rev: 1, status: 'confirmed', provisional: true, createdAt: now(), history: [], fromDirection: id, fromGarden: g.at, ...(grow != null ? { fromGrow: grow } : {}) })
      w2.offers.push(o)
      w2.activeOfferId = o.id
    }
    w2.discover.status = 'done'
    w2.events.unshift({ at: now(), text: `Chose the offer you're working on: ${activeOffer(w2)?.name}.` })
  }, ['discover', 'sales'])
  const w3 = await read($, workA)
  const o = activeOffer(w3)
  const many = chosenOffers(w3).length > 1
  const lead = many ? `Added to your portfolio: ${o.name}.` : `Working offer saved: ${o.name}.`
  // Your starting offer: the garden shows it with its two plans to build, ready when you are.
  await update($, uiA, (u) => ({ ...u, view: { ...(u.view || {}), offer: 'pick' } }))
  await go($, { view: 'discover', stage: 'garden' })
  await setUi($, { notice: lead, handoff: null })
  try { await $.ui.scroll({ to: { key: 'ws-starting' }, in: PANE, block: 'start' }) } catch (e) {}
}

// ---- 3 and 4. A plan: progress while it's built, the plan once it's saved
function WsPlan($, c, id) {
  const { E, work, nav } = c
  const n = id === 'sales' ? 3 : 4
  const eyebrow = `Step ${n} of 4 · ${WS_NAME[id]}`
  const o = workingOffer(work)
  if (!o) {
    return work.discover.early
      ? Signpost($, c, eyebrow, 'First, choose your working offer', `${WS_NAME[id]} is built around one offer. Choose the idea you want to test in Your offer, and this step picks it up straight away.`, 'go-offer', 'Go to Your offer', 'offer', id)
      : Signpost($, c, eyebrow, 'First, Discover', `${WS_NAME[id]} is built around the offer you choose after Discover.`, 'go-discover', 'Go to Discover', 'discover', id)
  }
  const b = work.builders?.[id] || {}
  const head = [StepHead(c, id), ContextLine($, c, o)]
  if (id === 'sales' && nav.stage === 'person' && planFor(work, 'sales', o)) return PersonScreen($, { ...v2kit($, c), head }, b, o, nav.slot)
  if (id === 'substack' && strategyState(b)) return StrategyProgress($, { ...v2kit($, c), head }, b, o, strategyState(b))
  if (fallbackFor(work, 'plans') && nav.stage === 'questions' && !planFor(work, id, o)) {
    return [...head, Card(E, [Label(E, 'Workshop fallback', C.espresso), T(E, 'Today, answer these questions here in the panel.')], { key: 'ws-fb-plans', tone: 'decide' }), ...BuilderView($, E, c.ui, work, nav, c)]
  }
  if (!b.output) {
    const what = id === 'sales'
      ? 'Claude asks you three quick questions in the chat beside this panel: who comes to mind, who you know around your buyer, and how many conversations fit your week. Then your plan appears here, in about two minutes.'
      : 'Claude asks you a few questions in the chat beside this panel: who you want to write for, what you want your Substack to do, the rhythm you could keep, and a few about your stories and views. Then Uncapped researches your field and writes your strategy, about 12 minutes, and it appears here complete.'
    return [
      ...head,
      o.toTest ? Small(E, `The main thing still to test: ${o.toTest}`, { color: C.ink }) : null,
      ...OpSlot($, c, `builder-${id}`, [fallbackFor(work, 'plans')
        ? FallbackCard(E, 'ws-fb-plans', 'Today, answer the questions here in the panel.', 'ws-plan-start', 'Answer the questions here', () => go($, { view: 'builder', builder: id, stage: 'questions', step: 0 }))
        : id === 'sales'
          ? NextMove(E, 'ws-plan-start', { title: 'Build your list of 10', body: 'Claude asks three quick questions in the chat, then your plan appears here in about two minutes.', actions: [Btn(E, 'ws-plan-chat', 'Build my plan in the chat', () => planInChat($, id), true)] })
          : NextMove(E, 'ws-plan-start', { title: 'Plan your Substack', body: what, actions: [Btn(E, 'ws-plan-chat', 'Start in the chat', () => planInChat($, id), true)] })]),
    ]
  }
  const other = id === 'sales' ? 'substack' : 'sales'
  const otherDone = planFor(work, other, o)
  const op = c.ui.op?.place === `builder-${id}` ? c.ui.op : null
  if (op?.status === 'done') c.places?.add(`builder-${id}`)
  if (id === 'sales') {
    const decide = b.basedOn?.offerId && b.basedOn.offerId !== o.id && b.keptFor !== o.id
    return [
      ...(op && op.status !== 'done' ? OpSlot($, c, `builder-${id}`, []) : []),
      ...F10Screen($, { ...v2kit($, c), head }, b, o, decide),
    ].filter(Boolean)
  }
  // While its posts are being written, the strategy waits behind one card: it's ready when they all are.
  const writing = c.ui.op?.status === 'running' && c.ui.op?.name === 'briefs'
  if (writing) return [...OpSlot($, c, c.ui.op.place || `builder-${id}`, [])]
  if (nav.stage === 'post' && nav.post != null) return PostScreen($, { ...v2kit($, c), head }, b, o, Number(nav.post))
  return [
    ...(op && op.status !== 'done' ? OpSlot($, c, `builder-${id}`, []) : []),
    ...SubstackScreen($, { ...v2kit($, c), head }, b, o),
  ]
}

// The context line (8.7): which offer this step is for, and a way to switch.
function ContextLine($, c, o) {
  const { E, work } = c
  return (
    <E.Box key="ws-context" flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
      <E.Text size="caption" weight="bold" color={C.taupeInk}>FOR YOUR OFFER</E.Text>
      <E.Text weight="semibold" color={C.espresso} wrap="wrap">{shortName(o.name)}</E.Text>
      {spacesOf(work).length > 1 && spaceOf(work, o) ? <E.Text size="footnote" color={C.ink} wrap="wrap">{`in ${spaceOf(work, o).name}`}</E.Text> : null}
      {Btn(E, 'ws-switch-offer', spacesOf(work).length > 1 ? 'Your spaces' : 'Switch offer', () => (chosenOffers(work).length > 1 ? goStep($, 'done') : goStep($, 'offer')), 'plain')}
    </E.Box>
  )
}

// Where a person stands (S5): not contacted, messaged, replied, talked.
const STOPS = ['Not contacted', 'Messaged', 'Replied', 'Talked']
function stopOf(t) { return t.talk === 'had it' ? 3 : t.reply === 'replied' ? 2 : t.sent && t.sent !== 'not sent yet' ? 1 : 0 }
function statusWord(t) { return t.reply === 'said not now' ? 'Not now' : t.outcome === 'not the right person' ? 'Not the right person' : STOPS[stopOf(t)] }
const STOP_NEXT = [['Mark as messaged', { sent: 'sent' }], ['They replied', { reply: 'replied' }], ['We talked', { talk: 'had it' }]]
const OTHER_OUTCOMES = [['Said not now', { reply: 'said not now' }], ['No reply after a week', { sent: 'followed up' }], ['Not the right person', { outcome: 'not the right person' }]]

// ---- First 10 Customers (S4)
function WsFirst10($, c, b, o, decide) {
  const { E, work, ui } = c
  const out = b.output || {}
  const list = (out.list || []).map((p, i) => ({ p, i, key: keyOf(p, i), slot: slotOf(p, i), t: contactOf(b, keyOf(p, i)) }))
  const cn = contactCounts(list.map((x) => x.t))
  const batch = firstBatch(b)
  const written = batch.filter((x) => x.draft).length
  const firstUp = batch.find((x) => x.draft && stopOf(contactOf(b, x.key)) === 0)
  const fm = out.firstMove || {}
  const known = list.filter((x) => !stillToFind(x.p, x.t))
  const toFind = list.filter((x) => stillToFind(x.p, x.t))
  const connectors = list.filter((x) => x.p.role === 'connector').length
  const report = Btn(E, 'ws-f10-report', 'Report back in the chat', () => reportOutreach($), 'plain')
  // One next move, by where the outreach stands.
  const next = decide ? null
    : cn.talked >= 10 ? NextMove(E, 'ws-f10-next', { title: 'Look for the pattern', body: `${cn.talked} conversations. Which pattern do you hear? Bring it to the chat and we'll read it together.`, actions: [Btn(E, 'ws-f10-report', 'Report back in the chat', () => reportOutreach($), true)] })
      : written < batch.length ? NextMove(E, 'ws-next-msgs', { title: `Write your first ${batch.length === 1 ? 'message' : `${batch.length} messages`}`, body: `${nameList(batch.map((x) => personName(x.p, contactOf(b, x.key))))}. Each one is saved on their card, ready to copy.`, extra: [Small(E, `First messages written: ${written} of ${batch.length}.`, { color: C.ink })], actions: [Btn(E, 'ws-write-msgs', 'Write them in the chat', () => planInChat($, 'sales', false, '', 'messages'), true)] })
        : firstUp ? NextMove(E, 'ws-f10-next', {
          title: `Message ${inSentence(personName(firstUp.p, contactOf(b, firstUp.key)))}`,
          body: firstSentence(firstUp.p.why || fm.why || ''),
          extra: [E.Code ? <E.Code key="ws-f10-msg" source={firstUp.draft} wrap="wrap" /> : T(E, firstUp.draft), Small(E, `First messages written: ${written} of ${batch.length}. Then come back and tell me what happened, even if nobody replied.`)],
          actions: [Btn(E, 'ws-f10-copy', 'Copy message', () => copyText($, firstUp.draft, 'Copied. Paste it into your own messages.'), true), Btn(E, 'ws-f10-sent', "I've sent it", () => saveContact($, firstUp.slot, { sent: 'sent' }, firstUp.key)), report],
        })
          : NextMove(E, 'ws-f10-next', { title: 'Tell me what happened', body: 'Show me what you sent and what came back, even if nobody replied. Bring the messy notes from any call.', actions: [Btn(E, 'ws-f10-report', 'Report back in the chat', () => reportOutreach($), true)] })
  const spine = (x) => { const st = stopOf(x.t); return st === 3 ? C.green : st >= 1 ? C.blue : firstUp && x.key === firstUp.key ? C.butter : C.white }
  // A contact card: the name, quiet labels for who they are, one status, and View message in the same place.
  const personCard = (x) => {
    const hasMsg = Boolean(String(x.t.draft || '').trim())
    const st = stopOf(x.t)
    const status = st === 0 ? (hasMsg && x.t.reply !== 'said not now' && x.t.outcome !== 'not the right person' ? 'Draft ready' : statusWord(x.t)) : st === 1 && statusWord(x.t) === 'Messaged' ? 'Sent' : statusWord(x.t)
    const who = [x.p.role === 'connector' ? 'Can introduce you' : 'Potential client', stillToFind(x.p, x.t) ? 'To find' : `Know them${WARMTH[x.p.temperature] ? ` · ${WARMTH[x.p.temperature]}` : ''}`].join(' · ')
    const msgOpen = ui.f10msg === x.slot
    return ItemCard(E, `f10-card-${x.slot}`, spine(x), [
      <E.Box key={`f10-ct-${x.slot}`} flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
        {Btn(E, `f10-open-${x.slot}`, `${x.slot}. ${personName(x.p, x.t)}`, () => go($, { view: 'builder', builder: 'sales', stage: 'person', slot: x.slot }), 'plain')}
      </E.Box>,
      <E.Text key={`f10-who-${x.slot}`} size="footnote" color={G.gray} wrap="wrap">{who}</E.Text>,
      <E.Box key={`f10-sr-${x.slot}`} flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
        {Chip(E, `f10-st-${x.slot}`, status, st === 3 ? 'done' : status === 'Draft ready' ? 'pick' : 'totest')}
        {hasMsg ? Btn(E, `f10-view-${x.slot}`, msgOpen ? 'Hide message' : 'View message', () => setUi($, { f10msg: msgOpen ? null : x.slot, f10edit: null }), 'plain') : null}
      </E.Box>,
      msgOpen && hasMsg ? MessageArea($, c, x) : null,
    ].filter(Boolean))
  }
  // The callout opens into the guide in its own place, above the list (see seeGuide).
  const guideTop = draftsSaved(b) >= 2 && Boolean(c.ui?.guideOpen) && c.ui?.guideAt === 'top'
  return [
    next,
    ArtOf(E, 'ws-funnel', funnelSvg({ px: c.px, fonts: FONTS, sent: cn.sent, replied: cn.replied, talked: cn.talked, intros: cn.encouraged })),
    out.summary ? T(E, out.summary) : null,
    out.expect ? Small(E, out.expect) : null,
    cn.talked >= 5 && cn.talked < 10 ? Card(E, [T(E, `${cn.talked} conversations: an early look`, { weight: 'semibold', color: C.espresso }), Small(E, 'Note what you keep hearing, but give it about ten before you change the offer or the buyer.', { color: C.ink })], { key: 'ws-f10-early', tone: 'summary' }) : null,
    SectionTitle(E, 'f10-list-h', `Your list of ${list.length}`),
    Small(E, `${known.length} you know · ${toFind.length} to find · ${list.length - connectors} possible buyers · ${connectors} who can introduce you`),
    // Two messages saved: show what they're inviting people into, before anything is sent.
    draftsSaved(b) >= 2 ? (guideTop ? CallGuide($, c, b, out, list, { at: 'top', noPilot: true })[0] : GuideCallout($, c)) : null,
    known.length ? <E.Text key="f10-known-h" size="caption" weight="bold" color={C.taupeInk}>PEOPLE YOU KNOW</E.Text> : null,
    ...known.map(personCard),
    toFind.length ? <E.Text key="f10-find-h" size="caption" weight="bold" color={C.taupeInk}>PEOPLE TO FIND</E.Text> : null,
    ...toFind.map(personCard),
    ...CallGuide($, c, b, out, list, { at: 'bottom', noGuide: guideTop }),
    SectionTitle(E, 'f10-tools-h', 'Your toolkit'),
    ...F10Toolkit($, c, b, out, list),
    Row(E, [Btn(E, 'ws-plan-change', 'Change this plan in the chat', () => planInChat($, 'sales', true), 'plain')]),
  ].filter(Boolean)
}

// The toolkit (S4 step 8): four disclosures in one group, each body built from
// lists, numbered items, one callout and cards (8.18), whatever shape the plan was saved in.
function F10Toolkit($, c, b, out, list) {
  const { E } = c
  const wide = c.colPx >= 560 || c.px >= 520
  const cv = out.conversation || {}
  const by = out.buyer || {}
  const routes = (out.routes || []).filter((r) => r?.route || r?.how)
  const qs = (cv.questions || []).map((q) => ({ q: qText(q).trim(), group: typeof q === 'object' ? String(q?.group || '').trim() : '' })).filter((x) => x.q).map((x, i) => ({ ...x, n: i + 1 }))
  const parts = []
  qs.forEach((x) => { const last = parts[parts.length - 1]; if (last && last.name === x.group) last.items.push(x); else parts.push({ name: x.group, items: [x] }) })
  const named = parts.filter((g) => g.name).length
  const close = closeSteps(cv)
  const qRow = (x) => (
    <E.Box key={`f10-q-${x.n}`} flexDirection="row" gap={1}>
      {Medal(E, `f10-qn-${x.n}`, x.n)}
      <E.Box flexDirection="column" flexGrow={1} flexShrink={1}><E.Text weight="semibold" color={C.espresso} wrap="wrap">{x.q}</E.Text></E.Box>
    </E.Box>
  )
  const copyQs = () => copyText($, qs.map((x) => `${x.n}. ${x.q}`).join('\n'), 'Copied all the questions. Paste them wherever you keep notes for the call.')
  // Pace: the first sentence is the summary, so the body starts after it.
  const cap = String(out.weeklyCap || '').trim()
  const capFirst = firstSentence(cap)
  const paceSummary = summaryOf(cap, 'your rhythm and what to write down')
  const capRest = paceSummary === capFirst.replace(/\.$/, '') ? cap.slice(capFirst.length).trim() : cap
  const batchNos = [...new Set(list.map((x) => Number(x.p.batch) || 1))].sort((m, n) => m - n)
  const rhythm = batchNos.length > 1 || list.length ? batchNos.map((n, i) => `Batch ${n}${i === 0 ? ', now' : ''}: ${list.filter((x) => (Number(x.p.batch) || 1) === n).map((x) => personName(x.p, x.t)).join(', ')}`) : []
  const record = (out.tracker?.record || []).map(String).filter(Boolean)
  const rv = out.tracker?.review
  const ms = rv && typeof rv === 'object' && (rv.milestones || []).some((m) => m?.what) ? rv.milestones.filter((m) => m?.what).map((m) => (m.when ? `${m.when}: ${m.what}` : m.what))
    : typeof rv === 'string' && rv.trim() ? sentencesOf(rv).filter((x) => !/^name (it|the pattern)\b|re-aim before/i.test(x))
      : ['About 5 conversations: an early look. Note what you keep hearing.', 'About 10 conversations: look for the pattern, then decide.']
  const patterns = rv && typeof rv === 'object' && (rv.patterns || []).some((x) => x?.name) ? rv.patterns.filter((x) => x?.name) : PATTERNS
  return [
    Disclosure($, c, 'f10-buyer', 'Who to look for', 'what makes someone relevant now', [
      by.description ? LeadText(E, 'f10-by-d', by.description) : null,
      (by.lookFor || []).length ? SubLabel(E, 'f10-look-l', 'Look for') : null,
      ...ListRows(E, 'f10-look', by.lookFor, '✓'),
      (by.relevantNow || []).length ? SubLabel(E, 'f10-now-l', 'Signs they need it now') : null,
      ...ListRows(E, 'f10-now', by.relevantNow, '→'),
      by.hasProblem || by.champion || by.approves ? SubLabel(E, 'f10-who-l', "Who's involved in deciding") : null,
      KeyFacts(E, 'f10-who', [['Who feels the problem', by.hasProblem], ["Who'd push for it inside the business", by.champion], ['Who approves the spend', by.approves]], c.px >= 420),
    ].filter(Boolean), { group: 'toolkit' }),
    Disclosure($, c, 'f10-routes', 'Where to find them', routes.length ? `${routes.length} place${routes.length === 1 ? '' : 's'} to look, ${lowerFirst(sentenceCase(routes[0].route || 'the first'))} first` : 'places to look', routes.map((r, i) => (
      <E.Box key={`f10-r-${i}`} flexDirection="row" gap={1}>
        {Medal(E, `f10-rn-${i}`, i + 1, i === 0 ? C.butter : C.white)}
        <E.Box flexDirection="column" flexGrow={1} flexShrink={1} gap={0}>
          <E.Box key={`f10-rh-${i}`} flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
            <E.Text weight="semibold" color={C.espresso} wrap="wrap">{sentenceCase(r.route)}</E.Text>
            {r.when ? Chip(E, `f10-rw-${i}`, sentenceCase(r.when), i === 0 ? 'pick' : 'next') : null}
          </E.Box>
          {r.how ? <E.Text color={C.ink} wrap="wrap">{r.how}</E.Text> : null}
          {r.fit ? <E.Text size="footnote" color={C.taupeInk} wrap="wrap">{r.fit}</E.Text> : null}
        </E.Box>
      </E.Box>
    )), { group: 'toolkit' }),
    Disclosure($, c, 'f10-track', 'Pace and tracking', paceSummary, [
      capRest ? T(E, capRest) : null,
      rhythm.length ? SubLabel(E, 'f10-rh-l', 'Your rhythm') : null,
      ...ListRows(E, 'f10-rh', rhythm, '→'),
      record.length ? SubLabel(E, 'f10-tr-l', 'After each conversation, note') : null,
      ...ListRows(E, 'f10-tr', record, '•'),
      record.length ? Small(E, "Most of this saves on each person's card in your list.") : null,
      SubLabel(E, 'f10-ms-l', 'When to look back'),
      ...ListRows(E, 'f10-ms', ms, '◆'),
      SubLabel(E, 'f10-pt-l', `The ${patterns.length === 4 ? 'four ' : ''}patterns to look for`),
      MiniCards(E, 'f10-pt', patterns.map((x) => ({ title: PATTERN_NAME[String(x.name).trim().toLowerCase()] || sentenceCase(x.name), meta: x.looksLike, takeaway: x.then })), wide),
      Small(E, 'Change who you ask or what you say before you rebuild anything.'),
    ].filter(Boolean), { group: 'toolkit' }),
  ]
}

// ---- The research call guide (10 Nov): written with the plan, or on its own for
// a plan made before it existed; shown once the first two messages are saved.
async function writeCallGuide($, place = 'chat') {
  const w = await getWork($)
  const o = workingOffer(w)
  const plan = o ? planFor(w, 'sales', o) : null
  if (!plan?.output) return null
  const out = await ask($, callGuidePrompt(w, plan, METHODS), {
    label: 'Writing your call guide',
    explain: 'What to say on your first calls: an opener, a few questions and how to close, for each kind of person on your list.',
    builder: 'sales', kind: 'guide', name: 'guide', maxTokens: 6000, effort: 'medium', place,
  })
  if (!out) return null
  await mutate($, (w2) => { const b = w2.builders.sales; if (b?.output) b.output.callGuide = { client: out.client || null, knows: out.knows || null, at: now() } }, ['sales'])
  return out
}
// The brief behind one post (10 Nov): written the first time it's opened, or
// when the chat is asked for it, and kept on the post. Older strategies get
// their briefs the same way, without losing anything already saved.
async function writePostBrief($, i, place = 'chat', fresh = false) {
  const w = await getWork($)
  const o = workingOffer(w)
  const plan = o ? planFor(w, 'substack', o) : null
  const pieces = plan?.output ? subPieces(plan.output) : []
  if (!pieces[i]) return null
  const today = new Date(await $.clock.now()).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
  const out = await ask($, briefPrompt(w, { ...plan, output: { ...plan.output, pieces } }, i, METHODS, today), {
    label: `Writing the brief for post ${i + 1}`,
    explain: 'The idea, where to open, the story beat by beat, what makes it sound like you, and where to land it.',
    builder: 'substack', kind: 'brief', name: 'brief', target: `post-${i + 1}`, args: { i }, maxTokens: 12000, effort: 'medium', place, fresh,
  })
  if (out) {
    // Kept beside the plan, by post number, so a plan saved in any format keeps every field it had.
    await mutate($, (w2) => { const so = w2.builders.substack?.output; if (so) so.briefs = { ...(so.briefs || {}), [i]: { ...out, at: now() } } }, ['substack'])
  }
  // A post opened while this one was being written goes next.
  const want = (await read($, uiA))?.briefWant
  if (want != null && want !== i) {
    await setUi($, { briefWant: null })
    const w3 = await read($, workA)
    if (!briefOf(planFor(w3, 'substack', workingOffer(w3))?.output, want)) void writePostBrief($, want, `ss-brief-${want}`)
  }
  return out
}
// Every post's brief, as part of building the strategy (10 Nov): the strategy
// isn't shown as ready until each post has one. Posts that already have a
// brief keep it. A post whose brief couldn't be written says so on the post.
async function writeAllBriefs($, place = 'chat') {
  const w = await getWork($)
  const o = workingOffer(w)
  const plan = o ? planFor(w, 'substack', o) : null
  if (!plan?.output) return null
  const pieces = subPieces(plan.output)
  const todo = pieces.map((_, i) => i).filter((i) => !briefOf(plan.output, i))
  if (!todo.length) return { done: [], failed: [] }
  const today = new Date(await $.clock.now()).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
  const full = { ...plan, output: { ...plan.output, pieces } }
  await mutate($, (w2) => { const so = w2.builders.substack?.output; if (so) so.briefsPending = true })
  const r = await askMany($, todo.map((i) => ({ i, prompt: briefPrompt(w, full, i, METHODS, today) })), {
    label: `Writing your ${pieces.length} posts`,
    explain: 'Each post gets its full brief: the idea, where to open, the story beat by beat, what makes it sound like you, and where to land it.',
    builder: 'substack', kind: 'brief', name: 'briefs', target: 'substack', place, maxTokens: 12000, effort: 'medium', concurrency: 3,
    onEach: (item, v) => mutate($, (w2) => { const so = w2.builders.substack?.output; if (so) so.briefs = { ...(so.briefs || {}), [item.i]: { ...v, at: now() } } }, ['substack']),
  })
  await mutate($, (w2) => { const so = w2.builders.substack?.output; if (so) delete so.briefsPending })
  return r
}
// ---- Substack v3 (12 Nov): the whole strategy is written in a holding place ----
// (builders.substack.next) and becomes their strategy in one step, only when
// all ten cards are written and checked. Until then the Substack screen shows
// progress, or one button to finish it if it stopped. A run is found by its id
// wherever its space is kept, so switching space never sends its work elsewhere.
const subOut = (w) => w?.builders?.substack?.output || null
const normLink = (u) => String(u || '').trim().replace(/[#?].*$/, '').replace(/\/+$/, '').replace(/^https?:\/\/(www\.)?/i, '').toLowerCase()
const todayLong = async ($) => new Date(await $.clock.now()).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
const runningHere = new Set() // strategy runs working in this Claude window
let runSeq = 0

function holderOf(w, runId) {
  const b = w?.builders?.substack
  if (!b || !runId) return null
  if (b.next?.runId === runId) return b
  for (const sid of Object.keys(b.bySpace || {})) if (b.bySpace[sid]?.next?.runId === runId) return b.bySpace[sid]
  return null
}
// A finished strategy's home (for changing one post): the open one, or the one kept for its space.
function outputHolder(w, sid) {
  const b = w?.builders?.substack
  if (!b) return null
  if (!sid || !b.spaceId || b.spaceId === sid) return b
  return b.bySpace?.[sid] || null
}
// The work as a run sees it: its own offer and its own Substack, whichever space is open now.
// ref: { runId } for a strategy being written, { space } for a finished one.
function runWork(w, ref) {
  const h = ref.runId ? holderOf(w, ref.runId) : outputHolder(w, ref.space)
  const s = h ? (ref.runId ? h.next : h.output) : null
  if (!s) return null
  const offerId = (ref.runId ? s.offerId : h.basedOn?.offerId) || w.activeOfferId
  return { w: { ...w, activeOfferId: offerId, builders: { ...w.builders, substack: h } }, h, s }
}
async function saveTo($, ref, fn) {
  return mutate($, (w2) => { const r = runWork(w2, ref); if (!r) return false; fn(r.s, r.h, w2); return true }, [])
}
const runParent = (ref) => (ref.runId ? `strategy:${ref.runId}` : undefined)

// What the Substack screen shows while a strategy is being written (or stopped).
function strategyState(b) {
  const n = b?.next
  if (!n?.runId) return null
  const pieces = Array.isArray(n.pieces) ? n.pieces : []
  return { live: runningHere.has(n.runId), stage: n.stage || 'field', startedAt: n.startedAt || '', total: pieces.length || 10, chosen: pieces.length, researched: pieces.filter((p) => p && p.research).length, cards: pieces.filter(cardWritten).length, error: n.error || '', hadOutput: Boolean(b.output), field: (n.field?.findings || []).length }
}

// The strategy's own "still working" signal in the request record, every 20 seconds.
function heartbeat($, opId) {
  let on = true
  void (async () => {
    while (on) {
      try { await $.clock.sleep(20000) } catch (e) { break }
      if (!on) break
      try { await beatOp($, opId, await $.clock.now()) } catch (e) {}
    }
  })()
  return () => { on = false }
}

// From build_plan: a new strategy, or the stopped one carried on when nothing it was built from has changed.
async function startStrategy($, fresh = false) {
  const w = await getWork($)
  const b = w.builders?.substack || {}
  const basis = fingerprint(JSON.stringify({ a: b.answers || {}, m: (b.material || []).map((x) => [x.answer, x.endorsed]), e: b.examples || [] }))
  if (b.next && runningHere.has(b.next.runId)) return { state: 'running' }
  if (b.next && !fresh && b.next.basis === basis) return { state: (await finishStrategy($)).state === 'started' ? 'resumed' : 'elsewhere' }
  const o = activeOffer(w)
  const runId = `r${(await $.clock.now()).toString(36)}${(++runSeq).toString(36)}`
  await mutate($, (w2) => { const h = (w2.builders.substack = w2.builders.substack || { answers: {} }); h.next = { runId, basis, startedAt: now(), stage: 'field', offerId: o?.id || '', basedOn: basedOnNow(w2) }; if (!h.status || h.status === 'not_started') h.status = 'in_progress' }, [])
  const c = await claimStrategy($, runId)
  if (c !== 'started') return { state: c }
  driveStrategy($, runId).catch(() => {})
  return { state: 'started', runId }
}
// "Finish my strategy" (and write_post_cards): only what's missing, never beside a run that's still going.
async function finishStrategy($) {
  const w = await getWork($)
  const n = w.builders?.substack?.next
  if (!n?.runId) return { state: 'none' }
  if (runningHere.has(n.runId)) return { state: 'running' }
  const c = await claimStrategy($, n.runId)
  if (c !== 'started') {
    await setUi($, { opNote: { place: 'ss-progress', state: c, text: c === 'elsewhere' ? 'Your strategy is still being written in another Claude window, or it stopped less than two minutes ago. Nothing new was started. Try again in a minute or two.' : notSent() || "It didn't start. Try again in a minute." } })
    return { state: c }
  }
  driveStrategy($, n.runId).catch(() => {})
  return { state: 'started' }
}
async function claimStrategy($, runId) {
  const t0 = await $.clock.now()
  const claim = await claimOp($, { id: `strategy:${runId}`, name: 'strategy', label: 'Writing your Substack strategy', place: 'ss-progress', target: 'substack', beats: true }, t0)
  lastClaim = claim
  if (claim.state === 'started') { runningHere.add(runId); await setUi($, { opNote: null }); return 'started' }
  return claim.state === 'running' ? 'elsewhere' : claim.state
}

// The steps, each done only if it isn't saved yet: field research, the ten
// posts, the editor's read, research for each post, the research review, the
// cards, then the strategy appears.
async function driveStrategy($, runId) {
  const ref = { runId }
  const umbrella = `strategy:${runId}`
  const stopBeat = heartbeat($, umbrella)
  let ok = false
  let why = ''
  const cur = async () => { const r = runWork(await getWork($), ref); if (!r) throw new Error('gone'); return r }
  const halt = () => { if (stopped) { stopped = false; throw new Error('You stopped it.') } }
  try {
    await saveTo($, ref, (n) => { n.stoppedAt = 0; n.error = '' })
    const step = (stage) => saveTo($, ref, (n) => { n.stage = stage })
    let r = await cur()
    if (!r.s.field) { await step('field'); await researchField($, ref); halt() }
    r = await cur()
    if (!r.s.field) throw new Error("The research into your field didn't finish.")
    if (!(r.s.pieces || []).length) {
      await step('choose')
      if (!(await chooseTen($, ref))) { halt(); throw new Error(failNote("Your ten posts couldn't be chosen just now.")) }
    }
    r = await cur()
    if (!r.s.reviewed) { await step('review'); await reviewTen($, ref); halt() }
    r = await cur()
    const need = r.s.pieces.map((_, i) => i).filter((i) => !r.s.pieces[i].research)
    if (need.length) { await step('research'); await researchPosts($, ref, need); halt() }
    r = await cur()
    if (!r.s.refsReviewed) { await step('refs'); await reviewRefs($, ref); halt() }
    r = await cur()
    const todo = r.s.pieces.map((_, i) => i).filter((i) => !cardWritten(r.s.pieces[i]))
    if (todo.length) { await step('cards'); await writeCards($, ref, todo); halt() }
    r = await cur()
    const left = r.s.pieces.filter((p) => !cardWritten(p)).length
    if (left) throw new Error(failNote(`${left} of ${r.s.pieces.length} cards couldn't be written just now.`))
    ok = await promote($, ref)
    if (!ok) throw new Error('It could not be saved.')
  } catch (e) {
    why = String(e?.message || e)
  } finally {
    stopBeat()
    runningHere.delete(runId)
    stopped = false
    try {
      await finishOp($, umbrella, ok ? 'done' : 'stopped', ok ? {} : { error: why }, await $.clock.now())
      if (!ok && why !== 'gone') await saveTo($, ref, (n) => { n.stoppedAt = now(); n.error = why || 'It stopped before it finished.' })
    } catch (e) {}
  }
  return ok
}
const failNote = (lead) => { const u = lastOpError; return u ? `${lead} ${u}` : lead }
let lastOpError = ''

// The strategy becomes theirs in one step, where its space keeps it.
async function promote($, ref) {
  return mutate($, (w2) => {
    const h = holderOf(w2, ref.runId)
    const n = h?.next
    if (!n || !(n.pieces || []).length || !n.pieces.every(cardWritten)) return false
    if (h.output) pushHistory(h, 'before rebuilding')
    const { runId, basis, stage, startedAt, stoppedAt, error, offerId, basedOn, ...out } = n
    h.output = { ...out, v: 3, builtAt: now() }
    delete h.next
    h.basedOn = basedOn || h.basedOn
    h.review = null
    h.edited = {}
    h.updatedAt = now()
    if (h.status !== 'done') h.status = 'in_progress'
    w2.events.unshift({ at: now(), text: 'Built your Substack strategy.' })
    return true
  }, ['substack'])
}

async function chooseTen($, ref) {
  const r = runWork(await getWork($), ref)
  const out = await ask($, substackChoosePrompt(r.w, r.h.answers || {}, METHODS, await todayLong($), { field: r.s.field }), {
    label: 'Choosing your ten posts', explain: "Reading everything you've told Uncapped and what research found in your field, then choosing your publication and ten posts.",
    builder: 'substack', kind: 'substack', name: 'build', target: 'substack', maxTokens: 24000, effort: 'medium', place: 'ss-progress', fresh: true, parent: runParent(ref),
  })
  if (!out || !out.publication || !(out.pieces || []).length) return false
  return saveTo($, ref, (n) => { const keep = { runId: n.runId, basis: n.basis, stage: n.stage, startedAt: n.startedAt, offerId: n.offerId, basedOn: n.basedOn, field: n.field }; for (const k of Object.keys(n)) delete n[k]; Object.assign(n, out, keep) })
}

// The editor's read of the ten posts: judgment, not counts. A revision only when it asks for one.
async function reviewTen($, ref) {
  let r = runWork(await getWork($), ref)
  const rv = await ask($, stubReviewPrompt(r.w, r.s, r.h.answers || {}), { label: 'Reading your ten posts as an editor', builder: 'substack', kind: 'stubReview', name: 'review', target: 'substack', maxTokens: 6000, effort: 'medium', place: 'ss-progress', fresh: true, parent: runParent(ref) })
  if (!rv) return saveTo($, ref, (n) => { n.reviewed = { skipped: true, at: now() } })
  const notes = (rv.notes || []).filter((x) => x && (String(x.issue || '').trim() || String(x.change || '').trim()))
  let revised = false
  if (String(rv.verdict || '').toLowerCase().trim() === 'revise' && notes.length) {
    r = runWork(await getWork($), ref)
    const v = await ask($, reviseStubsPrompt(r.w, r.h.answers || {}, METHODS, await todayLong($), r.s.field, r.s, { ...rv, notes }), { label: 'Making the editor\'s changes', builder: 'substack', kind: 'stubRevise', name: 'build', target: 'substack', maxTokens: 12000, effort: 'medium', place: 'ss-progress', fresh: true, parent: runParent(ref) })
    if (v && (v.pieces || []).length === (r.s.pieces || []).length) {
      revised = true
      await saveTo($, ref, (n) => { n.pieces = v.pieces.map((p) => ({ ...p })); if (String(v.orderNote || '').trim()) n.orderNote = v.orderNote })
    }
  }
  return saveTo($, ref, (n) => { n.reviewed = { verdict: rv.verdict, overall: String(rv.overall || ''), notes, revised, at: now() } })
}

// One review of every post's references together; posts left thin get one more search.
async function reviewRefs($, ref) {
  const r = runWork(await getWork($), ref)
  const rv = await ask($, refsReviewPrompt(r.s, r.s.field), { label: 'Checking what research adds to each post', builder: 'substack', kind: 'refsReview', name: 'review', target: 'substack', maxTokens: 8000, effort: 'medium', place: 'ss-progress', fresh: true, parent: runParent(ref) })
  if (!rv) return saveTo($, ref, (n) => { n.refsReviewed = { skipped: true, at: now() } })
  const by = new Map((rv.posts || []).map((x) => [Number(x.post) - 1, x]))
  await saveTo($, ref, (n) => { n.pieces = n.pieces.map((p, i) => (by.has(i) ? { ...p, research: keepReviewed(p, i, by.get(i), n.field) } : p)) })
  const thin = [...by.entries()].filter(([i, x]) => x.thin && String(x.lookFor || '').trim() && r.s.pieces[i]).map(([i, x]) => ({ i, lookFor: String(x.lookFor).trim() }))
  if (thin.length) {
    const r2 = runWork(await getWork($), ref)
    const used = [...new Set(r2.s.pieces.flatMap((p) => [...(p.research?.makeItFun || []), ...(p.research?.inspiration || [])].map((x) => x.url)).filter(Boolean))]
    await researchPosts($, ref, thin.map((x) => x.i), { gap: thin, avoid: used })
  }
  return saveTo($, ref, (n) => { n.refsReviewed = { at: now(), thin: thin.map((x) => x.i + 1) } })
}

async function findAgent($, type, description) {
  try {
    const list = await $.agent.list()
    const mine = (list || []).filter((a) => a.type === type && (!description || a.description === description) && !postRuns.has(a.id) && !researchRuns.has(a.id))
    return mine[mine.length - 1]?.id || null
  } catch (e) { return null }
}

// The research run a tool call or finish belongs to, adopting a pending one.
async function postRunFor($, agentId) {
  if (!agentId) return null
  if (postRuns.has(agentId)) return postRuns.get(agentId)
  if (!pendingPostRuns.length) return null
  // A known agent of another type is never adopted; one the list doesn't know is (the run's own helper, not yet listed).
  try { const a = (await $.agent.list()).find((x) => x.id === agentId); if (a && a.type !== POST_RESEARCHER) return null } catch (e) { return null }
  const run = pendingPostRuns.shift()
  postRuns.set(agentId, run)
  return run
}

// A research helper on the customer's own Claude. It replies with JSON when
// it's done (11 Nov, tested: a helper's own tool calls aren't answered by the panel).
async function spawnResearcher($, prompt, description, caps) {
  let r = null
  try { r = await $.agent.spawn({ subagentType: POST_RESEARCHER, prompt, description }) } catch (e) { r = { deny: String(e?.message || e) } }
  if (r?.deny) return null
  const run = { done: false, answer: null, searches: 0, fetches: 0, fetched: new Set(), caps, description }
  const agentId = r?.agentId || (await findAgent($, POST_RESEARCHER, description))
  if (agentId) postRuns.set(agentId, run)
  else pendingPostRuns.push(run)
  return run
}
async function waitRuns($, runs, maxMs) {
  const t0 = await $.clock.now()
  for (let spins = 0; runs.some((x) => !x.done) && (await $.clock.now()) - t0 < maxMs && !stopped && spins < Math.ceil(maxMs / 1500); spins++) await $.clock.sleep(1500)
  for (const x of runs) x.done = true
}
// Every link is opened again here before it's kept; the rest are left out.
async function linkOpens($, url) {
  if (!/^https?:\/\/\S+$/i.test(String(url || '').trim())) return false
  try {
    const r = await Promise.race([$.http.fetch(String(url).trim(), { method: 'GET', headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Uncapped link check' } }), $.clock.sleep(10000).then(() => null)])
    return Boolean(r && Number(r.status) >= 200 && Number(r.status) < 400)
  } catch (e) { return false }
}
async function linksThatOpen($, urls) {
  const list = [...new Set(urls.map((u) => String(u || '').trim()).filter(Boolean))]
  const ok = new Set()
  for (let k = 0; k < list.length; k += 6) {
    const batch = list.slice(k, k + 6)
    const res = await Promise.all(batch.map((u) => linkOpens($, u)))
    batch.forEach((u, n) => { if (res[n]) ok.add(u) })
  }
  return ok
}
const readAnswer = (answer) => { try { return parseJson(String(answer || '')) } catch (e) { return null } }

// Step 1: their field, before any post is chosen.
async function researchField($, ref) {
  const r = runWork(await getWork($), ref)
  const t0 = await $.clock.now()
  const reqId = requestId('field-research', 'substack', ref.runId, `t${t0}`)
  const claim = await claimOp($, { id: reqId, name: 'cards', label: 'Researching your field', place: 'ss-progress', target: 'substack', parent: runParent(ref) }, t0)
  if (claim.state !== 'started') { lastOpError = refusalText(claim); return }
  const run = await spawnResearcher($, fieldResearchPrompt(r.w, r.h.answers || {}, await todayLong($)), 'Uncapped field research', { searches: 10, fetches: 14 })
  if (run) await waitRuns($, [run], 420000)
  const got = run ? readAnswer(run.answer) : null
  const raw = (got?.findings || []).filter((f) => f && String(f.title || f.what || '').trim())
  const ok = await linksThatOpen($, raw.map((f) => f.url))
  const findings = raw.filter((f) => ok.has(String(f.url || '').trim())).slice(0, 16).map((f, k) => ({ id: `f${k + 1}`, gives: String(f.gives || 'finding').toLowerCase().slice(0, 30), title: String(f.title || '').slice(0, 160), what: String(f.what || '').slice(0, 700), use: String(f.use || '').slice(0, 700), relates: String(f.relates || '').slice(0, 500), url: String(f.url).trim(), source: String(f.source || '').slice(0, 60), date: String(f.date || '').slice(0, 40) }))
  const couldnt = [...(got?.couldntRead || []).map(String), ...raw.filter((f) => !ok.has(String(f.url || '').trim())).map((f) => String(f.url || f.title || ''))].slice(0, 10)
  // Saved when the helper answered, or couldn't start or answer in time (the strategy goes on from their own answers).
  // Claude closed mid-way saves nothing, so Finish does it again; Stop saves nothing either.
  if (!stopped) await saveTo($, ref, (n) => { n.field = { findings, couldntRead: couldnt, at: now(), ...(!run ? { failed: "The research helper couldn't start." } : run.answer == null ? { failed: 'The research helper did not answer in time.' } : got ? {} : { unreadable: true }) } })
  await finishOp($, reqId, run?.answer != null ? 'done' : 'failed', { outcome: `${findings.length} findings kept` }, await $.clock.now())
}

// Research for a group of posts: two helpers when there are several. With
// gap, one more search for posts the review found thin, added to what's kept.
async function researchPosts($, ref, idx, opts = {}) {
  if (!idx.length) return
  const r = runWork(await getWork($), ref)
  const t0 = await $.clock.now()
  const label = opts.gap ? `Looking further for ${idx.length === 1 ? `post ${idx[0] + 1}` : `${idx.length} posts`}` : idx.length === 1 ? `Researching post ${idx[0] + 1}` : `Researching your ${idx.length} posts`
  const reqId = requestId('post-research', 'substack', `${ref.runId || ref.space || ''}:${idx.join(',')}${opts.gap ? ':gap' : ''}`, `t${t0}`)
  const claim = await claimOp($, { id: reqId, name: 'cards', label, place: ref.runId ? 'ss-progress' : 'ss-cards', target: 'substack', parent: runParent(ref) }, t0)
  if (claim.state !== 'started') { lastOpError = refusalText(claim); return }
  await setUi($, { op: { id: reqId, name: 'cards', label, explain: 'Finding what would make each post better to write, and opening every page before it is kept.', steps: [], place: ref.runId ? 'ss-progress' : 'ss-cards', nav: await read($, navA), builder: 'substack', target: 'substack', status: 'running', startedAt: t0, elapsed: 0, typical: 300, attempt: claim.op.attempt, progress: { done: 0, total: idx.length } }, opNote: null, error: null })
  const today = await todayLong($)
  const posts = opts.gap ? opts.gap : idx
  const half = Math.ceil(posts.length / 2)
  const groups = posts.length > 3 && !opts.gap ? [posts.slice(0, half), posts.slice(half)] : [posts]
  const runs = []
  for (const g of groups) {
    const nums = g.map((x) => (typeof x === 'object' ? x.i : x))
    const run = await spawnResearcher($, postResearchPrompt(r.w, r.s, g, today, r.s.field, opts.avoid || []), `Uncapped post research: posts ${nums.map((n) => n + 1).join(', ')}`, { searches: 4 * g.length, fetches: 6 * g.length })
    if (run) { run.posts = nums; runs.push(run) }
  }
  await waitRuns($, runs, 480000)
  let saved = 0
  for (const run of runs) {
    if (run.answer == null) continue
    const got = readAnswer(run.answer)
    const items = (Array.isArray(got?.posts) ? got.posts : []).map((x) => ({ i: Number(x?.post) - 1, x })).filter(({ i }) => run.posts.includes(i))
    const ok = await linksThatOpen($, items.flatMap(({ x }) => [...(x.items || []), ...(x.reads || [])].map((y) => y?.url)))
    const has = (y) => y && ok.has(String(y.url || '').trim())
    const fieldIds = new Set((r.s.field?.findings || []).map((f) => f.id))
    for (const i of run.posts) {
      const x = items.find((y) => y.i === i)?.x || {}
      const fun = (x.items || []).filter((y) => y && String(y.name || y.what || '').trim()).filter(has).slice(0, 4).map((y) => ({ kind: String(y.gives || 'example').toLowerCase().slice(0, 30), name: String(y.name || '').slice(0, 160), use: [y.what, y.use].map((t) => String(t || '').trim()).filter(Boolean).join(' ').slice(0, 900), url: String(y.url).trim(), source: String(y.source || '').slice(0, 60), date: String(y.date || '').slice(0, 40) }))
      const read = (x.reads || []).filter((y) => y && String(y.borrow || y.title || '').trim()).filter(has).slice(0, 3).map((y) => ({ author: String(y.author || '').slice(0, 100), title: String(y.title || '').slice(0, 200), borrow: String(y.borrow || '').slice(0, 700), url: String(y.url).trim(), source: String(y.source || '').slice(0, 60) }))
      const dropped = [...(x.items || []), ...(x.reads || [])].filter((y) => y && y.url && !has(y)).map((y) => String(y.url)).slice(0, 6)
      const fids = (x.fieldIds || []).map(String).filter((id) => fieldIds.has(id))
      await saveTo($, ref, (n) => {
        const p = n.pieces?.[i]
        if (!p) return
        if (opts.gap && p.research) p.research = { ...p.research, makeItFun: [...(p.research.makeItFun || []), ...fun].slice(0, 4), inspiration: [...(p.research.inspiration || []), ...read].slice(0, 3), gapAt: now() }
        else if (!p.research || !ref.runId) p.research = { makeItFun: fun, inspiration: read, field: fids, couldntRead: [...(x.couldntRead || []).map(String), ...dropped].slice(0, 8), at: now() }
      })
      saved++
      await update($, uiA, (u) => (u.op?.id === reqId ? { ...u, op: { ...u.op, progress: { done: Math.min(saved, idx.length), total: idx.length } } } : u))
    }
  }
  await finishOp($, reqId, 'done', { outcome: `researched ${saved} of ${idx.length} posts`, calls: runs.map((x) => ({ role: 'post research', model: 'sonnet', searches: x.searches, fetches: x.fetches })) }, await $.clock.now())
}

// The cards, three at a time, each checked and rewritten once if it falls
// short, saved the moment it's ready. A card already saved is never written over.
async function writeCards($, ref, idx) {
  const r = runWork(await getWork($), ref)
  if (!r) return null
  const todo = idx.filter((i) => r.s.pieces[i] && !cardWritten(r.s.pieces[i]))
  if (!todo.length) return { done: [], failed: [] }
  const today = await todayLong($)
  const res = await askMany($, todo.map((i) => ({ i, prompt: postCardPrompt(r.w, r.s, i, METHODS, r.s.pieces[i].research || null, today, r.s.field) })), {
    label: todo.length === 1 ? `Writing the card for post ${todo[0] + 1}` : `Writing and checking your ${todo.length} post cards`,
    explain: "Each card: who it's for, what they're stuck on, where your offer comes in, the idea, how it unfolds, what research adds, what you'll need to add, and how it ends.",
    builder: 'substack', kind: 'card', name: 'cards', target: 'substack', place: ref.runId ? 'ss-progress' : 'ss-cards', maxTokens: 16000, effort: 'high', concurrency: 3, timeoutMs: 420000, parent: runParent(ref),
    quality: (v) => cardProblems(v),
    onEach: (item, v) => saveTo($, ref, (n) => { const p = n.pieces?.[item.i]; if (p && !cardWritten(p)) n.pieces[item.i] = { ...cleanCard(p, v, p.research, []), cardAt: now() } }),
  })
  if (!res && !ref.runId) await update($, uiA, (u) => (u.op?.name === 'cards' && u.op?.status === 'running' ? { ...u, op: { ...u.op, status: 'failed', error: "The cards couldn't be written just now. Press Write the rest to try again." } } : u))
  if (!res) lastOpError = notSent() || ''
  return res
}

// One post changed in a finished strategy ("Change this idea"), or the cards an
// older strategy is still missing: research, then the card, where it's kept.
async function runSubstackCards($, only = null) {
  if (cardsRunning) return
  cardsRunning = true
  try {
    const w = await getWork($)
    const ref = { space: w.builders?.substack?.spaceId || '' }
    const r = runWork(w, ref)
    if (!r || !isV3Strategy(r.s)) return
    const todo = (only || (r.s.pieces || []).map((_, i) => i)).filter((i) => r.s.pieces[i] && !cardWritten(r.s.pieces[i]))
    if (!todo.length) return
    await researchPosts($, ref, todo.filter((i) => !r.s.pieces[i].research))
    await writeCards($, ref, todo)
  } catch (e) {} finally { cardsRunning = false }
}

// "Change this idea": talk it through in the chat; the chat saves the new idea with change_post_idea.
async function changePostIdea($, i) {
  const w = await read($, workA)
  const p = subOut(w)?.pieces?.[i]
  if (!p) return
  const o = workingOffer(w)
  await toChat($, 'plan', `${WS_NAME.substack}${o ? ` for my working offer: ${o.name}` : ''} (change post ${i + 1}: "${p.headline}")`, `Tell Claude in the chat beside this panel what you'd like instead for post ${i + 1}. The new card is written here.`)
}

// Two first messages saved (drafts on the plan's people): time to see what to ask.
const draftsSaved = (b) => (b?.output?.list || []).filter((p, i) => String(contactOf(b, keyOf(p, i)).draft || '').trim()).length
const GUIDE_COPY = "I've drafted the questions for you. These first calls are for research. Find out when the problem last came up, what they did about it, and whether they've already spent time or money trying to fix it. You can leave the sales pitch for another day."
// The guide's two views: written for this plan, or made from an older plan's questions.
function guideViews(out) {
  const g = out?.callGuide || {}
  const cv = out?.conversation || {}
  const ok = (v) => v && (v.questions || []).some((q) => String(q?.q || '').trim())
  const qs = (cv.questions || []).map((q) => ({ label: typeof q === 'object' ? String(q.group || '').trim() : '', q: qText(q).trim() })).filter((x) => x.q)
  const fromPlan = qs.length ? { purpose: 'Ask about the last time it happened. Follow the story from there.', opener: '', questions: qs.slice(0, 4), more: qs.slice(4), close: closeSteps(cv).join(' '), intro: '' } : null
  return { client: ok(g.client) ? g.client : fromPlan, knows: ok(g.knows) ? g.knows : null, fresh: ok(g.client) }
}
// Opens the call guide right where it was asked for (under the callout, or on
// a person's page). It never relies on a jump: Desktop can refuse a scroll, and
// a guide opened further down the page then looks like nothing happened.
async function seeGuide($, view, at = 'top') {
  await setUi($, { guideOpen: true, guideAt: at, ...(view ? { guideView: view } : {}) })
  try { await $.ui.scroll({ to: { key: 'f10-guide' }, in: PANE, block: 'nearest' }) } catch (e) {}
}
function GuideCallout($, c) {
  const { E } = c
  return (
    <E.Box key="f10-guide-callout" flexDirection="column" gap={S.tight} paddingX={2} paddingY={1} borderStyle="round" borderColor={G.marigold} backgroundColor={G.paleYellow}>
      <E.Text weight="semibold" color={G.ink} wrap="wrap">Wondering what to say on the call?</E.Text>
      <E.Text color={G.ink} wrap="wrap">{GUIDE_COPY}</E.Text>
      <E.Box flexDirection="row">{Btn(E, 'f10-see-guide', 'See what to ask', () => seeGuide($, null, 'top'))}</E.Box>
    </E.Box>
  )
}
function CallGuide($, c, b, out, list, opts = {}) {
  const { E, ui } = c
  const { client, knows, fresh } = guideViews(out)
  if (!client && !knows) return []
  const at = opts.at || 'bottom'
  const open = opts.open != null ? Boolean(opts.open) : Boolean(ui.guideOpen) && (ui.guideAt || 'bottom') === at
  const both = Boolean(client && knows)
  const view = both ? (ui.guideView === 'knows' ? 'knows' : 'client') : client ? 'client' : 'knows'
  const g = view === 'knows' ? knows : client
  const line = (k) => <E.Text key={k} color={G.stone}>────────────</E.Text>
  const head = (k, t) => <E.Text key={k} weight="semibold" color={G.ink}>{t}</E.Text>
  const said = (k, t) => (String(t || '').trim() ? <E.Text key={k} color={G.ink} wrap="wrap">{t}</E.Text> : null)
  const qBlock = (q, n, pre) => (
    <E.Box key={`${pre}-${n}`} flexDirection="column" gap={0}>
      {q.label ? <E.Text size="footnote" weight="semibold" color={G.gray} wrap="wrap">{`${n + 1}. ${q.label}`}</E.Text> : null}
      <E.Text color={G.ink} wrap="wrap">{q.label ? q.q : `${n + 1}. ${q.q}`}</E.Text>
    </E.Box>
  )
  const more = (g.more || []).filter((q) => String(q?.q || '').trim())
  const body = [
    both ? Tabs(E, 'guide-view', [{ id: 'client', label: 'Talking to a potential client' }, { id: 'knows', label: 'Someone who knows your clients' }], view, (id) => setUi($, { guideView: id })) : null,
    said('g-purpose', g.purpose),
    g.opener ? line('g-l1') : null,
    g.opener ? head('g-start-h', 'Start the call') : null,
    said('g-opener', g.opener),
    line('g-l2'),
    head('g-qs-h', 'Questions to ask'),
    ...(g.questions || []).filter((q) => String(q?.q || '').trim()).slice(0, 4).map((q, n) => qBlock(q, n, 'g-q')),
    more.length ? <E.Box key="g-more-row" flexDirection="row">{Btn(E, 'g-more', ui.guideMore ? 'More questions if useful ⌃' : 'More questions if useful ›', () => setUi($, { guideMore: !ui.guideMore }), 'plain')}</E.Box> : null,
    ...(ui.guideMore ? more.map((q, n) => qBlock(q, n, 'g-mq')) : []),
    g.close ? line('g-l3') : null,
    g.close ? head('g-close-h', 'Close the call') : null,
    said('g-close', g.close),
    // Gabriela's rule: every call ends with an ask for two introductions.
    g.intro ? said('g-intro', `Then ask for two introductions: ${g.intro}`) : null,
    fresh ? null : <E.Box key="g-fresh" flexDirection="column" gap={0}>
      <E.Text size="footnote" color={G.gray} wrap="wrap">These are your plan's questions. I can write a guide for each kind of call, with an opener and a close.</E.Text>
      {Row(E, [...OpSlot($, c, 'f10-guide-write', [Btn(E, 'f10-guide-write', 'Write my call guide', () => writeCallGuide($, 'f10-guide-write'), 'plain')])])}
    </E.Box>,
  ].filter(Boolean)
  const pilot = out?.conversation?.pilot
  return [
    opts.noGuide ? null : <E.Box key="f10-guide" flexDirection="column" gap={S.tight} paddingX={2} paddingY={1} borderStyle="round" borderColor={G.stone} backgroundColor={G.card}>
      <E.Box flexDirection="row" flexWrap="wrap" gap={1} alignItems="center" justifyContent="space-between">
        <E.Text size="heading" weight="semibold" color={G.ink}>Your research call guide</E.Text>
        {Btn(E, 'f10-guide-toggle', open ? 'Close ⌃' : 'Open ⌄', () => setUi($, open ? { guideOpen: false } : { guideOpen: true, guideAt: at }), 'plain')}
      </E.Box>
      {open ? body : [<E.Text key="g-closed" size="footnote" color={G.gray} wrap="wrap">{g.purpose || 'Ask about the last time it happened. Follow the story from there.'}</E.Text>]}
    </E.Box>,
    !opts.noPilot && pilot && Object.values(pilot).some((v) => String(v || '').trim()) ? (
      <E.Box key="f10-pilot-sec" flexDirection="column" gap={S.tight} paddingX={2} paddingY={1} borderStyle="round" borderColor={G.stone} backgroundColor={G.sand}>
        <E.Box flexDirection="row">{Btn(E, 'f10-pilot-toggle', ui.pilotOpen ? 'Considering a paid pilot? ⌃' : 'Considering a paid pilot? ›', () => setUi($, { pilotOpen: !ui.pilotOpen }), 'plain')}</E.Box>
        {ui.pilotOpen ? PilotCheck($, c, b, pilot, { checklist: true }) : null}
      </E.Box>
    ) : null,
  ].filter(Boolean)
}
// One saved message on a contact's card: open it, copy it, edit it; never its status.
async function saveMessageEdit($, slot, key) {
  const u = await read($, uiA)
  const text = String(u.drafts?.[`f10.${slot}.msgedit`] ?? '').trim()
  if (!text) return setUi($, { error: 'The message is empty. Write it, or press Cancel.' })
  await mutate($, (w) => {
    const b = w.builders.sales
    const prev = contactRecord((b.tracker || {})[key])
    if (text === String(prev.draft || '').trim()) return
    const sent = stopOf(prev) >= 1 && !msgIsNewer(prev)
    const old = String(prev.draft || '').trim() ? [{ text: prev.draft, at: prev.draftAt || '', sentAt: sent ? (prev.sentAt || prev.at || '') : '' }] : []
    // A sent message stays as it was: the edit is a new draft, newer than the send.
    const sentAt = sent ? (prev.sentAt || prev.draftAt || '2000-01-01T00:00:00.000Z') : prev.sentAt
    b.tracker = { ...(b.tracker || {}), [key]: { ...prev, draft: text, draftAt: now(), ...(sentAt ? { sentAt, sentDateKnown: Boolean(prev.sentAt) || prev.sentDateKnown } : {}), drafts: [...old, ...(prev.drafts || [])].slice(0, 12) } }
  }, ['sales'])
  await update($, uiA, (x) => ({ ...x, f10edit: null, drafts: Object.fromEntries(Object.entries(x.drafts || {}).filter(([k]) => k !== `f10.${slot}.msgedit`)), notice: 'Saved. Your message is updated; where it stands has not changed.' }))
}
function MessageArea($, c, x) {
  const { E, ui } = c
  const t = x.t
  const k = `f10.${x.slot}.msgedit`
  const sent = stopOf(t) >= 1
  const newer = msgIsNewer(t)
  const label = !sent ? 'Saved message, ready to send' : newer ? 'New draft, ready to send' : `Saved message, marked sent${t.sentAt && t.sentDateKnown !== false && !/^2000-/.test(t.sentAt) ? ` ${dayText(t.sentAt)}` : ''}`
  const sentVersion = newer ? (t.drafts || []).find((m) => m.sentAt) : null
  const area = (key, text) => <E.Box key={key} paddingX={2} paddingY={1} backgroundColor="#FAF7F0"><E.Text color={G.ink} wrap="wrap">{String(text)}</E.Text></E.Box>
  if (ui.f10edit === x.slot) {
    return (
      <E.Box key={`f10-msg-${x.slot}`} flexDirection="column" gap={S.tight}>
        <E.Text size="caption" weight="bold" color={G.gray}>EDIT YOUR MESSAGE</E.Text>
        <E.Input key={k} value={String(ui.drafts?.[k] ?? t.draft ?? '')} rows={6} onInput={(v) => setDraft($, k, v)} onSubmit={(v) => setDraft($, k, v)} />
        {Row(E, [Btn(E, `f10-save-msg-${x.slot}`, 'Save changes', () => saveMessageEdit($, x.slot, x.key), true), Btn(E, `f10-cancel-msg-${x.slot}`, 'Cancel', () => update($, uiA, (u) => ({ ...u, f10edit: null, drafts: Object.fromEntries(Object.entries(u.drafts || {}).filter(([kk]) => kk !== k)) })), 'plain')])}
        {sent && !newer ? <E.Text size="footnote" color={G.gray} wrap="wrap">Your edit is saved as a new draft. The version marked sent stays here too.</E.Text> : null}
      </E.Box>
    )
  }
  return (
    <E.Box key={`f10-msg-${x.slot}`} flexDirection="column" gap={S.tight}>
      <E.Text size="caption" weight="bold" color={G.gray}>{label.toUpperCase()}</E.Text>
      {area(`f10-msg-t-${x.slot}`, t.draft)}
      {Row(E, [
        Btn(E, `f10-copy-msg-${x.slot}`, ui.copiedMsg === x.slot ? 'Copied' : 'Copy message', async () => { await copyText($, t.draft, 'Copied. Paste it into your own messages.'); await setUi($, { copiedMsg: x.slot }) }),
        Btn(E, `f10-edit-msg-${x.slot}`, 'Edit message', async () => { await setDraft($, k, t.draft); await setUi($, { f10edit: x.slot }) }, 'plain'),
      ])}
      {sentVersion ? <E.Text key={`f10-msg-sl-${x.slot}`} size="caption" weight="bold" color={G.gray}>THE VERSION MARKED SENT</E.Text> : null}
      {sentVersion ? area(`f10-msg-s-${x.slot}`, sentVersion.text) : null}
      {sentVersion ? Row(E, [Btn(E, `f10-copy-sent-${x.slot}`, 'Copy this version', () => copyText($, sentVersion.text, 'Copied. Paste it into your own messages.'), 'plain')]) : null}
    </E.Box>
  )
}

// ---- One person (S5): who and why, the message, where it stands, what you learned
// The message on a person's record: ready to send, the one they sent, or a newer one written since.
const msgIsNewer = (t) => Boolean(t.sentAt && t.draftAt && t.draftAt > t.sentAt)
function msgLabel(t) {
  if (stopOf(t) < 1) return 'Your first message, ready to send'
  if (msgIsNewer(t)) return 'Your next message, ready to send'
  // Uncapped keeps the wording you saved; you may have changed it before sending.
  return t.sentAt && t.sentDateKnown !== false && !/^2000-/.test(t.sentAt) ? `Saved message, marked sent ${dayText(t.sentAt)}` : 'Saved message, marked sent'
}
const dayText = (iso) => { try { return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) } catch (e) { return '' } }
function WsPerson($, c, b, o, slot) {
  const { E, ui } = c
  const out = b.output || {}
  const list = (out.list || []).map((p, i) => ({ p, i, key: keyOf(p, i), slot: slotOf(p, i) }))
  const ix = list.findIndex((x) => String(x.slot) === String(slot))
  if (ix < 0) return [BackLink(E, 'f10-back', 'Back to your list', () => go($, { view: 'builder', builder: 'sales', stage: 'result' }))]
  const { p, key } = list[ix]
  const t = contactOf(b, key)
  const d = (f) => ui.drafts[`f10.${slot}.${f}`] ?? t[f] ?? ''
  const finding = stillToFind(p, t)
  const at = stopOf(t)
  const back = () => go($, { view: 'builder', builder: 'sales', stage: 'result' })
  const prev = list[ix - 1]
  const nxt = list[ix + 1]
  const wide = c.px >= 420
  return [
    BackLink(E, 'f10-back', 'Back to your list', back),
    SectionTitle(E, 'f10-p-title', `${slot}. ${personName(p, t)}`),
    Chips(E, 'f10-p-chips', [Chip(E, 'f10-p-role', p.role === 'connector' ? 'Can introduce you' : 'Possible buyer', 'next'), finding ? Chip(E, 'f10-p-warm', 'To find', 'totest') : Chip(E, 'f10-p-warm', `Know them${WARMTH[p.temperature] ? ` · ${WARMTH[p.temperature]}` : ''}`, 'next'), Chip(E, 'f10-p-st', statusWord(t), at === 3 ? 'done' : 'totest')]),
    Card(E, [
      KeyFacts(E, 'f10-p-facts', finding ? [['Who', p.who], ['How to find one', p.findBy || p.reach]] : [['Who', p.who], [p.role === 'connector' ? 'Who they could introduce you to' : 'Why them', p.why], ['How to reach them', p.reach]], wide),
      finding || p.kind === 'prospect to find' ? <E.Text key={`f10-found-l-${slot}`} size="caption" weight="bold" color={C.taupeInk}>FOUND SOMEONE? THEIR NAME OR INITIALS</E.Text> : null,
      finding || p.kind === 'prospect to find' ? <E.Input key={`f10.${slot}.found`} placeholder="Once you know who it is, they stop being someone to find" value={String(d('found'))} rows={1} onInput={(v) => setDraft($, `f10.${slot}.found`, v)} onSubmit={(v) => setDraft($, `f10.${slot}.found`, v)} /> : null,
      finding || p.kind === 'prospect to find' ? Row(E, [Btn(E, `f10-save-${slot}`, 'Save', () => saveContact($, slot, null, key))]) : null,
    ].filter(Boolean), { key: 'f10-p-who', tone: 'summary' }),
    t.draft
      ? CopyBlock($, E, `f10-draft-${slot}`, msgLabel(t), t.draft)
      : p.message ? <E.Box key={`f10-adapt-${slot}`} flexDirection="column" gap={S.tight}>
        <E.Text size="caption" weight="bold" color={C.blue}>A MESSAGE TO ADAPT</E.Text>
        <E.Text color={C.ink} wrap="wrap">{p.message}</E.Text>
        {Row(E, [Btn(E, `f10-write-${slot}`, 'Write it with Claude in the chat', () => planInChat($, 'sales', false, '', 'messages'))])}
      </E.Box> : null,
    (t.drafts || []).length ? Disclosure($, c, `f10-earlier-${slot}`, 'Earlier messages', `${t.drafts.length} saved`, t.drafts.flatMap((m, i) => [
      Small(E, [m.sentAt ? `Sent ${dayText(m.sentAt)}` : 'Not sent', m.at ? `written ${dayText(m.at)}` : ''].filter(Boolean).join(' · '), { key: `f10-earlier-d-${slot}-${i}` }),
      E.Code ? <E.Code key={`f10-earlier-m-${slot}-${i}`} source={String(m.text)} wrap="wrap" /> : T(E, m.text, { key: `f10-earlier-m-${slot}-${i}` }),
      Row(E, [Btn(E, `f10-earlier-copy-${slot}-${i}`, 'Copy message', () => copyText($, m.text, 'Copied. Paste it into your own messages.'))]),
    ])) : null,
    p.followUp ? Disclosure($, c, `f10-fu-${slot}`, "If there's no reply after a week", 'a shorter follow-up', [T(E, p.followUp)]) : null,
    // What to ask opens here, on their page (see seeGuide).
    guideViews(out).client || guideViews(out).knows ? Row(E, [Btn(E, `f10-p-guide-${slot}`, ui.guideOpen && ui.guideAt === `person-${slot}` ? 'Hide what to ask ⌃' : 'See what to ask ⌄', () => (ui.guideOpen && ui.guideAt === `person-${slot}` ? setUi($, { guideOpen: false }) : seeGuide($, p.role === 'connector' && guideViews(out).knows ? 'knows' : 'client', `person-${slot}`)), 'plain')]) : null,
    ui.guideOpen && ui.guideAt === `person-${slot}` ? CallGuide($, c, b, out, list, { at: `person-${slot}`, open: true, noPilot: true })[0] : null,
    <E.Text key="f10-where-h" size="caption" weight="bold" color={C.taupeInk}>WHERE IT STANDS</E.Text>,
    StatusStepper(E, `f10-stepper-${slot}`, STOPS, at, [
      at < 3 ? Btn(E, `f10-step-${slot}`, STOP_NEXT[at][0], () => saveContact($, slot, STOP_NEXT[at][1], key)) : null,
      Btn(E, `f10-other-${slot}`, '+ Other outcome', () => update($, uiA, (u) => ({ ...u, f10other: u.f10other === slot ? null : slot })), 'plain'),
    ].filter(Boolean)),
    ui.f10other === slot ? ChoiceRow(E, `f10-exit-${slot}`, 'Other outcome', OTHER_OUTCOMES.map(([l]) => l), OTHER_OUTCOMES.find(([, v]) => Object.entries(v).every(([k2, v2]) => t[k2] === v2))?.[0], (l) => saveContact($, slot, OTHER_OUTCOMES.find(([x]) => x === l)[1], key)) : null,
    <E.Text key="f10-learn-h" size="caption" weight="bold" color={C.taupeInk}>WHAT YOU LEARNED</E.Text>,
    <E.Input key={`f10.${slot}.learned`} placeholder="What did they say? Who did they mention?" value={String(d('learned'))} rows={3} onInput={(v) => setDraft($, `f10.${slot}.learned`, v)} onSubmit={(v) => setDraft($, `f10.${slot}.learned`, v)} />,
    Row(E, [Btn(E, `f10-save-notes-${slot}`, 'Save notes', () => saveContact($, slot, null, key))]),
    ChoiceRow(E, `f10-sg-${slot}`, 'Their strongest response so far', SIGNALS, t.signal || 'none yet', (v) => saveContact($, slot, { signal: v }, key)),
    <E.Box key="f10-pn" flexDirection="row" flexWrap="wrap" gap={2} justifyContent="space-between">
      {prev ? Btn(E, 'f10-prev', `← ${prev.slot}. ${personName(prev.p, contactOf(b, prev.key))}`, () => go($, { view: 'builder', builder: 'sales', stage: 'person', slot: prev.slot }), 'plain') : <E.Text key="f10-prev-none"> </E.Text>}
      {nxt ? Btn(E, 'f10-next', `${nxt.slot}. ${personName(nxt.p, contactOf(b, nxt.key))} →`, () => go($, { view: 'builder', builder: 'sales', stage: 'person', slot: nxt.slot }), 'plain') : null}
    </E.Box>,
  ].filter(Boolean)
}

// ---- Substack strategy (S6): one publication for all their offers
async function keepSubstackFocus($) {
  await mutate($, (w) => { const b = w.builders.substack; if (b) b.focusKept = true }, ['substack'])
  await setUi($, { notice: 'Kept: your Substack stays focused as it is.' })
}
// Ten pieces in the new shape; an older strategy's issues read the same way.
function subPieces(out) {
  if ((out.pieces || []).length) return out.pieces
  // The older first-issue outline becomes the first piece's arc.
  const fi = out.firstIssue || {}
  const fiArc = [fi.opening && `Open: ${fi.opening}`, fi.point && `The point: ${fi.point}`, ...(fi.prompts || []), fi.ending && `End: ${fi.ending}`, fi.needsFromYou && `Check first: ${fi.needsFromYou}`].filter(Boolean)
  return (out.issues || []).map((x, i) => ({ headline: x.title, whyOpen: x.whyReaderCares || (x.headlines || [])[0]?.whyOpen || '', type: x.type, story: x.drawOn || x.angle || '', needsFromYou: '', arc: (x.beats || []).length ? x.beats : i === 0 ? fiArc : [], cta: x.cta?.ask ? { kind: '', wording: x.cta.ask, purpose: x.cta.why } : null }))
}
const firstPost = (out) => subPieces(out)[Math.max(0, (Number(out.first?.piece) || 1) - 1)]?.headline || out.firstIssue?.workingTitle || ''
// A line's natural lead (8.20): the text before its first comma or colon,
// four words or fewer. A list bolds every lead or none (ListRows).
function naturalLead(t) {
  const m = /^([^,:]+)([,:])\s+(.*)$/s.exec(String(t || ''))
  if (!m) return null
  const n = m[1].trim().split(/\s+/).filter(Boolean).length
  return n >= 1 && n <= 4 ? { lead: m[1].trim(), sep: m[2], rest: m[3] } : null
}
// A line with its lead in semibold, without the comma; bold false draws it plain.
function LeadText(E, key, text, bold = true) {
  const t = String(text || '')
  const l = bold ? naturalLead(t) : null
  return l ? <E.Text key={key} color={C.ink} wrap="wrap">{[<E.Text key={`${key}-b`} weight="semibold">{l.lead}</E.Text>, `${l.sep} ${l.rest}`]}</E.Text> : <E.Text key={key} color={C.ink} wrap="wrap">{t}</E.Text>
}
const allLed = (xs) => xs.length > 0 && xs.every((x) => naturalLead(x))
// A list (8.18): one row per item, its glyph saying what kind of list it is;
// '#' numbers it (an ordered list, strongest first). Bold leads only if every item has one.
function ListRows(E, key, items, glyph = '•') {
  const xs = (items || []).map((x) => String(x ?? '').trim()).filter(Boolean)
  const bold = allLed(xs)
  const color = glyph === '✓' ? C.green : glyph === '•' ? C.taupe : C.espresso
  return xs.map((x, i) => (
    <E.Box key={`${key}-${i}`} flexDirection="row" gap={1}>
      <E.Box flexShrink={0}><E.Text color={color} weight={glyph === '#' ? 'semibold' : undefined}>{glyph === '#' ? `${i + 1}.` : glyph}</E.Text></E.Box>
      <E.Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>{LeadText(E, `${key}-t-${i}`, x, bold)}</E.Box>
    </E.Box>
  ))
}
// A ranked list of signals (8.20): numbered, strongest first; likes and
// follower counts, when they come last, move into one framing note.
function RankedRows(E, key, items) {
  const xs = (items || []).map((x) => String(x ?? '').trim()).filter(Boolean)
  const tail = xs.length > 1 && /\blikes?\b|follower/i.test(xs[xs.length - 1]) ? xs.pop() : ''
  return [...ListRows(E, key, xs, '#'), tail ? Callout(E, `${key}-ignore`, 'i', '', `${sentenceCase(tail).replace(/\.?$/, '.')} They feel busy but mean least.`) : null]
}
// Builder data, read whichever shape it was saved in (8.18 data changes).
const qText = (q) => (typeof q === 'string' ? q : String(q?.q || ''))
// A paragraph saved before 9 November reads as one row per sentence.
const sentencesOf = (t) => String(t || '').replace(/\.\s+(?=[A-Z])/g, '.\n').split('\n').map((x) => x.trim()).filter(Boolean)
const closeSteps = (cv) => (Array.isArray(cv?.close) ? cv.close.map((x) => String(x || '').trim()) : sentencesOf(cv?.close)).filter(Boolean)
const sentenceCase = (v) => { const t = String(v || '').trim(); return t ? t[0].toUpperCase() + t.slice(1) : '' }
// A disclosure summary in words: a short first sentence, else the fallback. Never cut.
const summaryOf = (text, fallback, max = 70) => { const f = firstSentence(String(text || '').trim()).replace(/\.$/, ''); return f && f.length <= max ? f : fallback }
// A number medallion (8.18, 8.20): a 24 px SVG circle, white with an espresso
// ring. Never a bordered Box around a Text, which Desktop stretches into a pill.
function numberSvg(n, fill = C.white, size = 24) {
  const r = size / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><circle cx="${r}" cy="${r}" r="${r - 1}" fill="${fill}" stroke="${C.espresso}" stroke-width="1.5"/><text x="${r}" y="${r + 5}" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, serif" font-weight="700" font-size="${String(n).length > 1 ? 12 : 15}" fill="${C.espresso}">${n}</text></svg>`
}
const Medal = (E, key, n, fill) => (E.Svg ? <E.Svg key={key} source={numberSvg(n, fill || C.white)} alt={`${n}.`} /> : <E.Text key={key} weight="bold" color={C.espresso}>{`${n}.`}</E.Text>)
// A callout (8.18): one caution (!) or framing note (i), its point in semibold.
function Callout(E, key, glyph, lead, rest) {
  return (
    <E.Box key={key} flexDirection="row" gap={1} paddingX={1} backgroundColor={C.paper}>
      <E.Text weight="bold" color={C.espresso}>{glyph}</E.Text>
      <E.Box flexDirection="column" flexGrow={1} flexShrink={1}><E.Text color={C.ink} wrap="wrap">{[lead ? <E.Text key={`${key}-b`} weight="semibold">{lead}</E.Text> : null, rest ? `${lead ? ' ' : ''}${rest}` : null].filter(Boolean)}</E.Text></E.Box>
    </E.Box>
  )
}
// Mini cards (8.18): side-by-side options, two per row when the panel is wide.
function MiniCards(E, key, cards, wide) {
  return (
    <E.Box key={key} flexDirection="row" flexWrap="wrap" gap={1}>
      {cards.map((x, i) => (
        <E.Box key={`${key}-${i}`} flexDirection="column" gap={0} paddingX={1} width={wide ? '48%' : '100%'} borderStyle="round" borderColor={C.line} backgroundColor={C.cream}>
          <E.Text weight="semibold" color={C.espresso} wrap="wrap">{x.title}</E.Text>
          {x.meta ? <E.Text size="footnote" color={C.taupeInk} wrap="wrap">{x.meta}</E.Text> : null}
          {x.takeaway ? <E.Text weight="semibold" color={C.ink} wrap="wrap">{x.takeaway}</E.Text> : null}
        </E.Box>
      ))}
    </E.Box>
  )
}
// The four patterns to name after about ten conversations, from the method.
const PATTERNS = [
  { name: "It's working", looksLike: 'They describe the problem with more heat than you did, and ask how to start.', then: 'Build and price it.' },
  { name: 'Right offer, wrong buyer', looksLike: 'Polite interest, with no urgency or budget.', then: 'Keep the offer, change the buyer.' },
  { name: 'Wrong offer', looksLike: 'Every conversation drifts to a different problem.', then: 'Rebuild around that problem.' },
  { name: 'Right offer, wrong words', looksLike: "They need it, but your description didn't land.", then: 'Change your words, keep the substance.' },
]
const SIGNAL_WORDS = { compliment: 'Kind words, not evidence', 'past behavior': "Something they've done", commitment: 'Something they gave time, money or reputation to', advancement: 'A next step they took' }
const QUESTION_ISSUE = { 'leading wording': 'The wording suggests the answer. ', 'an assumption built in': 'It assumes the answer. ', 'a hypothetical': "It asks about the future, so it's easy to say yes. ", 'a pitch mixed in': "It pitches while you're trying to learn. " }
const PATTERN_NAME = { validated: "It's working", 'right offer, wrong framing': 'Right offer, wrong words' }
const WARMTH = { hot: 'knows you well', warm: 'knows you a bit', cold: 'new to you' }
const CONVERSATION_LEAD = { research: 'This is research, not a pitch.', sales: 'This is a buying conversation.', pilot: 'This is a conversation about a small paid pilot.' }
const SubLabel = (E, key, text) => <E.Text key={key} size="caption" weight="bold" color={C.taupeInk}>{String(text).toUpperCase()}</E.Text>
// A tile's answer (8.20): the saved gist, else the first fallback that has
// text, as its first sentence in full. Never cut at a character count.
function gistOf(part, ...fallbacks) {
  const g = String(part?.gist || '').trim()
  if (g) return g
  for (const f of fallbacks) { const t = firstSentence(String(f || '').trim()); if (t) return t }
  return ''
}
// "Where do your offers come in?" for a plan saved without a gist (8.20):
// "In [issue], [where]", naming the piece by its number, never cut mid-title.
function offerWhere(om) {
  const issue = String(om?.issue || '').trim()
  if (!issue) return ''
  const m = /^((?:issue|piece|post)\s+\S+?)\s*:/i.exec(issue)
  const name = m ? lowerFirst(m[1]) : `"${issue}"`
  const where = firstSentence(String(om.where || '').trim()).replace(/\.$/, '')
  return `In ${name}${where ? `, ${lowerFirst(where)}` : ''}.`
}
// The rest of a text after its first sentence, when that sentence is already the gist.
const afterGist = (gist, text) => { const t = String(text || '').trim(); return gist && t.startsWith(gist) ? t.slice(gist.length).trim() : t }
// Answer tiles (8.20): the answer first, the detail one press away; one open at
// a time. A tile is a Box: the question with a short right-aligned "Open +" on
// one row, the gist under it. The open tile's detail goes in a full-width box
// under its row, so the tiles stay where they are.
function Tiles($, c, groups) {
  const { E, ui } = c
  const wide = c.colPx >= 560 || c.px >= 520
  const open = ui.grp?.strat
  const tile = (t, full) => {
    const isOpen = open === t.key
    return (
      <E.Box key={`tile-${t.key}`} flexDirection="column" gap={0} paddingX={2} paddingY={1} width={full ? '100%' : '49%'} flexShrink={1} borderStyle="round" borderColor={isOpen ? C.espresso : C.line} backgroundColor={C.white} hover={DESKTOP.hover ? { backgroundColor: C.hoverWhite, borderColor: C.espresso } : undefined}>
        <E.Box key={`tile-q-${t.key}`} flexDirection="row" justifyContent="space-between" alignItems="center" gap={1}>
          <E.Box flexShrink={1} minWidth={0}><E.Text size="footnote" color={C.taupeInk} wrap="wrap">{t.label}</E.Text></E.Box>
          <E.Box flexShrink={0}><E.Button key={`tile-btn-${t.key}`} variant="secondary" dimColor label={isOpen ? 'Close −' : 'Open +'} onPress={later(() => toggleSection($, t.key, 'strat'))} /></E.Box>
        </E.Box>
        <E.Text key={`tile-g-${t.key}`} weight="semibold" color={C.espresso} wrap="wrap">{t.gist || 'Open it to read this part.'}</E.Text>
      </E.Box>
    )
  }
  return groups.map((g, gi) => {
    const tiles = g.tiles.filter(Boolean)
    if (!tiles.length) return null
    const rows = []
    if (wide) for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2))
    else tiles.forEach((t) => rows.push([t]))
    return (
      <E.Box key={`grp-${gi}`} flexDirection="column" gap={1}>
        <E.Box key={`grp-h-${gi}`} flexDirection="column" gap={0}>
          <E.Box flexDirection="row" gap={1} alignItems="center">
            {Medal(E, `tg-n-${gi}`, gi + 1)}
            <E.Box flexShrink={1} minWidth={0}><E.Text size="heading" weight="semibold" color={C.espresso} wrap="wrap">{g.label}</E.Text></E.Box>
          </E.Box>
          {g.explain ? <E.Text size="footnote" color={C.taupeInk} wrap="wrap">{g.explain}</E.Text> : null}
        </E.Box>
        {rows.flatMap((r, ri) => {
          const o = r.find((t) => t.key === open)
          return [
            <E.Box key={`grp-r-${gi}-${ri}`} flexDirection="row" gap={1}>{r.map((t) => tile(t, r.length === 1))}</E.Box>,
            o ? <E.Box key={`sec-${o.key}`} flexDirection="column" gap={S.tight} paddingX={2} paddingY={1} borderStyle="round" borderColor={C.espresso} backgroundColor={C.white}>{o.body.filter(Boolean)}</E.Box> : null,
          ].filter(Boolean)
        })}
      </E.Box>
    )
  }).filter(Boolean)
}

// What each piece's call to action does, as its row says it. Every one leads
// to the calendar; "reply" survives only in strategies saved before 10 November.
const CTA_META = { 'how i can help': 'how you can help', 'a resource': 'offers a resource', reply: 'asks for replies' }
const CTA_LINE = { 'book a call': 'Ends by inviting readers to book a call.', 'how i can help': 'Ends with how you can help, and your booking link.', 'a resource': 'Ends with a resource that leads to a call.' }
const SOURCE_LINE = { told: 'You told me', suspects: 'You suspect this', guess: 'My guess' }
// Under each problem: where it came from, who said it if the plan names them, and what to check.
const sourceLine = (x) => {
  const src = String(x?.source || '').toLowerCase()
  const from = String(x?.from || '').trim()
  // Skip the label when the plan's own words already say it ("My guess from…", "You said…").
  const said = /^(my guess|you told me|you said|you suspect)/i.test(from)
  const parts = [said ? '' : SOURCE_LINE[src], sentenceCase(from), (src === 'suspects' || src === 'guess') && !/check it/i.test(from) ? 'Check it on your calls' : ''].map((t) => String(t || '').replace(/[.\s]+$/, '')).filter(Boolean)
  return parts.length ? `${parts.join('. ')}.` : ''
}
// ---- The Substack strategy (10 Nov redesign): one reading order, six colored
// sections that open on their own, posts and Notes you can publish.
const SS = {
  reader: { color: '#3452D1', tint: '#E8EDF6', btn: "Who you're writing for" },
  write: { color: '#FFD45C', tint: '#FFF3C7', btn: "What you'll write about" },
  sound: { color: '#69469A', tint: '#F0E8FA', btn: "How you'll sound" },
  find: { color: '#28664A', tint: '#E8EDE2', btn: "How you'll find readers" },
  call: { color: '#963D30', tint: '#F9E5DE', btn: 'How readers book a call' },
  notes: { color: '#176A69', tint: '#E2F2EF', btn: 'Your Substack Notes' },
}
const PROBLEM_FROM = { told: 'From you', suspects: 'From you, to check on your calls', guess: 'Suggested for you to explore' }
// The three kinds of post from the workshop, as the plan names them.
const POST_TYPE = (x) => { const t = String(x?.type || '').toLowerCase(); const v = String(x?.variant || '').trim(); const n = t.includes('intro') ? 'Intro story' : t.includes('audience') ? 'Audience builder' : t.includes('method') || t.includes('case') || t.includes('dream') ? 'Methodology' : ''; return n && v && n === 'Methodology' ? `${n} · ${v}` : n }
const NEXT_NAME = { subscribe: 'Subscribe', reply: 'Reply', share: 'Share it', 'read next': 'Read next', resource: 'A resource', 'book a call': 'Book a call' }
// "piece 3" becomes "Post 3"; otherwise the word keeps its own case ("each piece" becomes "each post").
const postWord = (t) => String(t || '')
  .replace(/\bpiece(?=\s+\d)/gi, 'Post')
  .replace(/\b(p)iece(s?)\b/gi, (w, p, s) => `${p === 'P' ? 'P' : 'p'}ost${s}`)
  .replace(/^./, (ch) => ch.toUpperCase())
const briefOf = (out, i) => (out?.briefs || {})[i] || (out?.briefs || {})[String(i)] || null
async function openPost($, i) {
  await setUi($, { ssFrom: i })
  await go($, { view: 'builder', builder: 'substack', stage: 'post', post: i })
  // A post without its brief gets one now, shown being written on the post itself.
  const w = await read($, workA)
  const o = w && workingOffer(w)
  const so = o && planFor(w, 'substack', o)?.output
  if (!(so && subPieces(so)[i] && !briefOf(so, i))) return
  if ((await read($, uiA))?.op?.status === 'running') await setUi($, { briefWant: i })
  else await writePostBrief($, i, `ss-brief-${i}`)
}
async function backToStrategy($) {
  const u = await read($, uiA)
  await update($, uiA, (x) => ({ ...x, ssOpen: { ...(x.ssOpen || {}), write: true } }))
  await go($, { view: 'builder', builder: 'substack', stage: 'result' })
  if (u.ssFrom != null) { try { await $.ui.scroll({ to: { key: `ss-post-row-${u.ssFrom}` }, in: PANE, block: 'center' }) } catch (e) {} }
}
// A block of text to copy: readable prose, a Copy button that says Copied.
function CopyArea($, c, key, text, label, bg) {
  const { E, ui } = c
  return (
    <E.Box key={key} flexDirection="column" gap={S.tight}>
      <E.Box paddingX={2} paddingY={1} backgroundColor={bg || '#FAF7F0'}><E.Text color={G.ink} wrap="wrap">{String(text)}</E.Text></E.Box>
      <E.Box flexDirection="row">{Btn(E, `${key}-copy`, ui.ssCopied === key ? 'Copied' : label, async () => { await copyText($, text, 'Copied. Paste it where you write.'); await setUi($, { ssCopied: key }) })}</E.Box>
    </E.Box>
  )
}
function SsSection($, c, id, preview, body) {
  const { E, ui } = c
  const s = SS[id]
  const open = Boolean(ui.ssOpen?.[id])
  return (
    <E.Box key={`ss-sec-${id}`} flexDirection="row" borderStyle="round" borderColor={G.stone} backgroundColor={G.card}>
      <E.Box width={1} flexShrink={0} backgroundColor={s.color} />
      <E.Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
        <E.Box flexDirection="column" gap={0} paddingX={2} paddingY={1} backgroundColor={open ? s.tint : G.card}>
          <E.Box flexDirection="row">{Btn(E, `ss-sec-btn-${id}`, `${s.btn} ${open ? '⌄' : '›'}`, () => update($, uiA, (u) => ({ ...u, ssOpen: { ...(u.ssOpen || {}), [id]: !open } })), 'plain')}</E.Box>
          {preview ? <E.Text size="footnote" color={G.gray} wrap="wrap">{preview}</E.Text> : null}
        </E.Box>
        {open ? <E.Box key={`ss-sec-body-${id}`} flexDirection="column" gap={S.tight} paddingX={2} paddingY={1}>{body.filter(Boolean)}</E.Box> : null}
      </E.Box>
    </E.Box>
  )
}
function WsSubstack($, c, b, o) {
  const { E, work, ui } = c
  const out = b.output || {}
  // With more than one space, this Substack is for the working offer's space only.
  const sp = spacesOf(work).length > 1 ? spaceOf(work, o) : null
  const offers = sp ? offersIn(work, sp.id) : chosenOffers(work)
  const otherSpaces = sp ? spacesOf(work).filter((x) => x.id !== sp.id) : []
  const yes = offers.filter((x) => substackSupports(work, x))
  const no = offers.filter((x) => !substackSupports(work, x))
  const names = (xs) => nameList(xs.map((x) => `"${shortName(x.name)}"`))
  const decide = no.length && !b.focusKept
  const rd = out.reader || {}
  const kf = out.knownFor || {}
  const om = out.offerMention || {}
  const di = out.distribution || {}
  const cad = out.cadence || {}
  const ov = out.overview || {}
  const voice = out.voice || {}
  const pieces = subPieces(out)
  const firstIx = Math.max(0, Math.min(pieces.length - 1, (Number(out.first?.piece) || 1) - 1))
  const fp = pieces[firstIx]
  const promise = String(rd.promise || firstSentence(rd.getsEachTime) || '').trim()
  const H = (k, t) => <E.Text key={k} weight="semibold" color={G.ink} wrap="wrap">{t}</E.Text>
  // Paragraphs read as one sentence per line, as in the post briefs.
  const P = (k, t) => (String(t || '').trim() ? <E.Box key={k} flexDirection="column" gap={0}>{BriefText(c, k, t, null)}</E.Box> : null)
  const Q = (k, t) => (String(t || '').trim() ? <E.Text key={k} size="footnote" color={G.gray} wrap="wrap">{t}</E.Text> : null)
  const reader = String(rd.gist || '').trim() || String(ov.writingFor || '').trim() || firstSentence(rd.who)
  const rhythm = String(cad.start || '').trim() || firstSentence(cad.rhythm || di.cadence)
  const goal = postWord(String(out.job?.goal || '').trim())
  // who you're writing for: the reader, their moment, the problems and where each came from
  const ovProblems = (Array.isArray(ov.problems) ? ov.problems : []).map((x) => (typeof x === 'string' ? { text: x } : x || {})).filter((x) => String(x.text || '').trim())
  const problems = ovProblems.length ? ovProblems : [rd.workingThrough].filter((x) => String(x || '').trim()).map((text) => ({ text }))
  const moment = String(out.forOffer?.moment || '').trim()
  // how you'll sound: an example in their own words
  const sample = String(b.answers?.sample || b.answers?.coffee || '').trim()
  const example = sample ? (sentencesOf(sample).slice(0, 2).join(' ') || sample).slice(0, 280) : ''
  // the call and its invitation
  const bookPiece = pieces.find((x) => (x.cta?.kind === 'book a call' && x.cta?.wording) || (x.next?.kind === 'book a call' && x.next?.wording))
  const invitation = String(om.invitation || bookPiece?.cta?.wording || bookPiece?.next?.wording || fp?.cta?.wording || '').trim()
  const notes = (out.notes || []).filter((n) => n?.text || n?.say)
  const world = out.world || {}
  const series = (out.series || []).filter((x) => String(x?.name || '').trim())
  // Strategies saved before 10 Nov have no reader's world or series; their posts get full briefs when opened.
  const older = !out.world && !series.length
  const missing = pieces.filter((_, i) => !briefOf(out, i)).length
  const examples = (b.examples || []).map((x) => ({ ...x, ...((out.studied || []).find((y) => String(y.name || '').trim().toLowerCase() === String(x.name).toLowerCase()) || {}) }))
  const sections = [
    SsSection($, c, 'reader', reader, [
      H('r-who', String(ov.writingFor || '').trim() || rd.who),
      moment ? Q('r-mom-l', "The moment they're in") : null,
      P('r-mom', moment || rd.workingThrough),
      problems.length ? H('r-prob-h', "What they're trying to solve") : null,
      ...problems.map((x, i) => {
        const src = String(x.source || '').toLowerCase()
        const why = String(x.from || '').trim()
        return (
          <E.Box key={`r-p-${i}`} flexDirection="column" gap={0}>
            <E.Text color={G.ink} wrap="wrap">{`• ${x.text}`}</E.Text>
            <E.Box flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
              {PROBLEM_FROM[src] ? <E.Text size="caption" weight="semibold" color={SS.reader.color}>{PROBLEM_FROM[src]}</E.Text> : null}
              {why ? Btn(E, `r-why-${i}`, ui.ssWhy === i ? 'Hide why' : 'See why', () => setUi($, { ssWhy: ui.ssWhy === i ? null : i }), 'plain') : null}
            </E.Box>
            {why && ui.ssWhy === i ? <E.Text size="footnote" color={G.gray} wrap="wrap">{sentenceCase(why)}</E.Text> : null}
          </E.Box>
        )
      }),
      ov.whySubscribe ? H('r-sub-h', "Why they'd subscribe now") : null,
      P('r-sub', ov.whySubscribe),
      world.week || (world.complaints || []).length ? H('r-world-h', 'Their week') : null,
      P('r-week', world.week),
      (world.complaints || []).length ? Q('r-comp-l', 'What they complain about to a friend') : null,
      ...ListRows(E, 'r-comp', world.complaints, '•'),
      (world.putOff || []).length ? Q('r-off-l', 'What they keep putting off until Friday') : null,
      ...ListRows(E, 'r-off', world.putOff, '•'),
      (world.notice || []).length ? Q('r-notice-l', 'What you notice that others miss') : null,
      ...ListRows(E, 'r-notice', world.notice, '•'),
      <E.Box key="r-change" flexDirection="row">{Btn(E, 'ss-change-reader', 'Change who you write for', () => toChat($, 'plan', `Substack strategy for my working offer: ${o.name} (change who I write for)`, 'Tell Claude who you would rather write for, in the chat beside this panel.'), 'plain')}</E.Box>,
    ]),
    SsSection($, c, 'write', String(ov.writeAbout || '').trim() ? firstSentence(ov.writeAbout) : `${pieces.length} posts, in the order to publish them`, [
      P('w-idea', String(ov.writeAbout || '').trim() || kf.belief || kf.lane),
      kf.belief && ov.writeAbout ? Q('w-belief', `The idea to repeat: ${kf.belief}`) : null,
      series.length ? H('w-series-h', 'Series you can come back to') : null,
      ...series.map((x, i) => (
        <E.Box key={`ss-series-${i}`} flexDirection="column" gap={S.tight} paddingX={2} paddingY={1} borderStyle="round" borderColor={G.stone} backgroundColor={SS.write.tint}>
          <E.Text weight="semibold" color={G.ink} wrap="wrap">{x.name}</E.Text>
          {x.what ? BriefText(c, `ss-series-${i}-w`, x.what, null) : null}
          {x.example ? <E.Text size="footnote" color={G.gray} wrap="wrap">{`For example: ${x.example}`}</E.Text> : null}
        </E.Box>
      )),
      H('w-posts-h', `Your ${pieces.length} posts, in order`),
      older ? Q('w-older', 'To add the reader\'s week and series to this plan, rebuild it in the chat; this version stays saved.') : Q('w-types', 'Your intro story comes first. Then methodology posts show how you think, and audience builders bring the right readers to you.'),
      missing ? Card(E, [
        T(E, missing === pieces.length ? `Your ${pieces.length} posts don't have their full briefs yet: the idea, where to open, the story beat by beat and where to land it.` : `${missing} of your ${pieces.length} posts ${missing === 1 ? "doesn't" : "don't"} have ${missing === 1 ? 'its' : 'their'} full brief yet.`),
        Row(E, [...OpSlot($, c, 'ss-all-briefs', [Btn(E, 'ss-all-briefs', missing === pieces.length ? 'Write every brief' : 'Write the rest', () => writeAllBriefs($, 'ss-all-briefs'), true)])]),
      ], { key: 'ss-missing-briefs', tone: 'next' }) : null,
      ...pieces.map((x, i) => (
        <E.Box key={`ss-post-row-${i}`} flexDirection="row" gap={1} alignItems="flex-start" paddingX={1} borderStyle="round" borderColor={G.stone} backgroundColor={i === firstIx ? G.paleYellow : G.card}>
          <E.Box flexDirection="column" gap={0} flexGrow={1} flexShrink={1} minWidth={0}>
            {POST_TYPE(x) ? <E.Text size="caption" weight="bold" color={G.gray} wrap="wrap">{POST_TYPE(x).toUpperCase()}</E.Text> : null}
            <E.Text weight="semibold" color={G.ink} wrap="wrap">{`${i + 1}. ${x.headline}`}</E.Text>
            {firstSentence(x.idea || x.whyOpen || x.covers) ? <E.Text size="footnote" color={G.gray} wrap="wrap">{firstSentence(x.idea || x.whyOpen || x.covers)}</E.Text> : null}
            {briefOf(out, i) ? <E.Text size="caption" weight="semibold" color={SS.find.color}>Brief ready</E.Text> : null}
          </E.Box>
          <E.Box flexShrink={0}>{Btn(E, `ss-post-open-${i}`, 'Open ›', () => openPost($, i), 'plain')}</E.Box>
        </E.Box>
      )),
    ]),
    voice.profile || example ? SsSection($, c, 'sound', String(voice.gist || '').trim() || firstSentence(voice.profile), [
      P('s-prof', voice.profile),
      (voice.words || []).length ? Q('s-words', `Words you use: ${(voice.words || []).map((w) => `"${String(w).replace(/^"|"$/g, '')}"`).join(', ')}`) : null,
      voice.pov ? Q('s-pov', `Your point of view: ${voice.pov}`) : null,
      example ? <E.Box key="s-ex" flexDirection="column" gap={0} paddingX={2} paddingY={1} backgroundColor={SS.sound.tint}>
        <E.Text size="caption" weight="semibold" color={SS.sound.color}>In your own words</E.Text>
        <E.Text color={G.ink} wrap="wrap">{`“${example}”`}</E.Text>
      </E.Box> : null,
    ]) : null,
    SsSection($, c, 'find', String(di.gist || '').trim() || firstSentence(di.start), [
      (di.shareWith || []).length ? H('f-send-h', 'Send your first post to') : null,
      ...ListRows(E, 'f-send', di.shareWith, '→'),
      (di.aroundEachIssue || []).length || di.start ? H('f-share-h', 'Where to share it') : null,
      P('f-start', di.start && (di.shareWith || []).length ? null : di.start),
      ...ListRows(E, 'f-share', di.aroundEachIssue, '•'),
      (out.signals?.watch || []).length ? H('f-watch-h', 'What to pay attention to afterward') : null,
      ...ListRows(E, 'f-watch', out.signals?.watch, '◆'),
      Q('f-use', out.signals?.useThem),
      (out.names || []).length || out.branding?.direction || examples.length ? <E.Box key="f-setup-row" flexDirection="row">{Btn(E, 'ss-setup', ui.ssSetup ? 'Optional setup ideas ⌄' : 'Optional setup ideas ›', () => setUi($, { ssSetup: !ui.ssSetup }), 'plain')}</E.Box> : null,
      ...(ui.ssSetup ? [
        (out.names || []).length ? H('f-names-h', 'Names you could use') : null,
        ...ListRows(E, 'f-names', (out.names || []).map((x) => `${x.name}${x.why ? `: ${x.why}` : ''}`), '•'),
        out.branding?.direction ? H('f-brand-h', 'A look to start with') : null,
        P('f-brand', out.branding?.direction),
        examples.length ? H('f-study-h', 'Suggested reading') : null,
        ...examples.map((x, i) => (
          <E.Box key={`f-st-${i}`} flexDirection="column" gap={0}>
            {E.Link ? <E.Link key={`f-st-l-${i}`} href={x.url} label={x.name} /> : <E.Text weight="semibold" color={G.ink} wrap="wrap">{x.name}</E.Text>}
            {x.takeaway || x.study ? <E.Text size="footnote" color={G.gray} wrap="wrap">{`Study: ${x.takeaway || x.study}`}</E.Text> : null}
          </E.Box>
        )),
      ] : []),
    ]),
    SsSection($, c, 'call', out.call?.forWho ? `For ${lowerFirst(String(out.call.forWho).replace(/\.$/, ''))}.` : firstSentence(ov.toCalls), [
      // The section's summary line already says who the call is for, so the body starts with what happens on it.
      out.call?.expect ? H('c-exp-h', 'What they can expect') : null,
      P('c-exp', out.call?.expect),
      // The overview's call line says the same as the call itself: show it only when the call has no detail.
      ov.toCalls && !out.call?.expect ? H('c-bring-h', 'What to bring, and what they leave with') : null,
      out.call?.expect ? null : P('c-bring', ov.toCalls),
      Q('c-paid', `This call is a short introduction, not your paid offer. The offer you're testing is ${o.name}.`),
      invitation ? H('c-inv-h', 'The invitation to copy') : null,
      invitation ? CopyArea($, c, 'ss-inv', invitation, 'Copy invitation', SS.call.tint) : null,
    ]),
    notes.length ? SsSection($, c, 'notes', `${notes.length} Note${notes.length === 1 ? '' : 's'}, ready to copy, in the order to post them`, [
      Q('n-what', 'A Note is a short post on Substack, like a tweet. Copy it, post it, and change any word.'),
      ...notes.map((n, i) => (
        <E.Box key={`ss-note-${i}`} flexDirection="column" gap={S.tight} paddingX={2} paddingY={1} borderStyle="round" borderColor={G.stone} backgroundColor={G.card}>
          <E.Text size="caption" weight="semibold" color={SS.notes.color} wrap="wrap">{postWord(n.when || (n.forPiece ? `for post ${n.forPiece}` : 'Anytime'))}</E.Text>
          {n.text ? CopyArea($, c, `ss-note-${i}`, n.text, 'Copy Note', G.card) : P(`n-say-${i}`, n.say)}
          {n.why ? Q(`n-why-${i}`, firstSentence(n.why)) : null}
        </E.Box>
      )),
      cad.notes ? Q('n-cad', `Around every post: ${lowerFirst(postWord(cad.notes))}`) : null,
    ]) : null,
  ]
  return [
    Title(c, 'Your Substack strategy', 32),
    <E.Box key="ss-built" flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
      <E.Text size="footnote" color={G.gray}>Built around</E.Text>
      <E.Text weight="semibold" color={G.ink} wrap="wrap">{sp && offers.length > 1 ? `${sp.name}: ${offers.map((x) => shortName(x.name)).join(', ')}` : shortName(o.name, 80)}</E.Text>
    </E.Box>,
    otherSpaces.length ? (
      <E.Box key="ss-other-spaces" flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
        <E.Text size="footnote" color={G.gray} wrap="wrap">{`${otherSpaces.length === 1 ? `Your other space, "${otherSpaces[0].name}", has` : 'Your other spaces have'} ${otherSpaces.length === 1 ? 'its' : 'their'} own Substack.`}</E.Text>
        {otherSpaces.length === 1 ? Btn(E, 'ss-other-open', 'Open it', () => openSpaceStep($, otherSpaces[0].id, substackFor(work, otherSpaces[0].id)?.output ? 'substack' : 'space'), 'plain') : Btn(E, 'ss-other-open', 'Your spaces', () => goStep($, 'done'), 'plain')}
      </E.Box>
    ) : null,
    promise ? ArtOf(E, 'ss-promise', promiseSvg({ px: c.px, fonts: FONTS, text: promise, fill: G.paleYellow })) : null,
    reader || rhythm || goal ? (
      <E.Box key="ss-glance" flexDirection="column" gap={S.tight} paddingX={2} paddingY={1} borderStyle="round" borderColor={G.stone} backgroundColor={G.card}>
        <E.Text size="caption" weight="bold" color={G.gray}>AT A GLANCE</E.Text>
        {[['Starting reader', reader], ['Publishing rhythm', rhythm], ['First goal', goal]].filter(([, v]) => String(v || '').trim()).map(([l, v]) => (
          <E.Box key={`ss-g-${l}`} flexDirection="column" gap={0}>
            <E.Text size="footnote" weight="semibold" color={G.gray}>{l}</E.Text>
            <E.Text color={G.ink} wrap="wrap">{v}</E.Text>
          </E.Box>
        ))}
      </E.Box>
    ) : null,
    fp ? (
      <E.Box key="ss-first" flexDirection="row" borderStyle="round" borderColor={G.marigold} backgroundColor={G.paleYellow}>
        <E.Box width={1} flexShrink={0} backgroundColor={G.marigold} />
        <E.Box flexDirection="column" gap={S.tight} paddingX={2} paddingY={1} flexGrow={1} flexShrink={1}>
          <E.Text size="caption" weight="bold" color={G.ink}>START WITH YOUR FIRST POST</E.Text>
          <E.Text weight="semibold" color={G.ink} wrap="wrap">{fp.headline}</E.Text>
          {String(out.nextAction || '').trim() ? <E.Text size="footnote" color={G.ink} wrap="wrap">{postWord(out.nextAction)}</E.Text> : null}
          <E.Box flexDirection="row">{Btn(E, 'ss-open-first', 'Open your first post', () => openPost($, firstIx), true)}</E.Box>
        </E.Box>
      </E.Box>
    ) : null,
    decide ? Card(E, [
      Label(E, sp ? 'One Substack for this space' : 'One Substack for all your offers', C.espresso),
      T(E, `Your Substack talks about ${names(yes) || 'your first offer'}, but not ${names(no)} yet.`),
      Row(E, [Btn(E, 'ws-sub-update', 'Update for all offers in the chat', () => planInChat($, 'substack', false, '', 'portfolio')), Btn(E, 'ws-sub-keep', 'Keep it focused', () => keepSubstackFocus($), 'plain')]),
    ], { key: 'ws-sub-offers', tone: 'decide' }) : null,
    <E.Text key="ss-plan-h" size="heading" weight="semibold" color={G.ink}>Your plan</E.Text>,
    ...sections.filter(Boolean),
    Row(E, [Btn(E, 'ws-plan-change', 'Change this strategy in the chat', () => planInChat($, 'substack', true), 'plain')]),
  ].filter(Boolean)
}
// Brief text (10 Nov, her review of a beat that read as one block): the same
// patterns as the call guide and the garden. One sentence or step per row,
// words said out loud in their own quote box, an inline "1) … 2) …" list as
// numbered rows, a sample written over several lines kept on its own lines.
function sentencesIn(t) {
  const s = String(t || '')
  const out = []
  let cur = ''
  let inQ = false
  for (let k = 0; k < s.length; k++) {
    const ch = s[k]
    cur += ch
    if (ch === '“') inQ = true
    else if (ch === '”') inQ = false
    else if (ch === '"') inQ = !inQ
    const ends = /[.!?]/.test(ch) || (/[”"]/.test(ch) && /[.!?]/.test(s[k - 1] || ''))
    if (!inQ && ends && /\s/.test(s[k + 1] || '') && /[A-Z“"(→]/.test(s[k + 2] || '') && !/\b(e\.g|i\.e|vs|etc|Dr|St|Mr|Mrs|Ms)\.$/i.test(cur)) { out.push(cur.trim()); cur = '' }
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}
function briefItems(t) {
  if (Array.isArray(t)) return t.flatMap((x) => briefItems(String(x ?? '')))
  const s = String(t || '').trim()
  if (!s) return []
  const items = []
  for (const para of s.split(/\n\s*\n/)) {
    if (para.includes('\n')) { items.push({ kind: 'sample', lines: para.split('\n').map((l) => l.trim()).filter(Boolean) }); continue }
    for (const sen of sentencesIn(para)) {
      const m = sen.match(/^(.*?)\b1\)\s(.*)$/s)
      if (m && (sen.match(/\b\d\)\s/g) || []).length >= 2) {
        const parts = `1) ${m[2]}`.split(/[,;]?\s*(?:and\s+)?\b\d\)\s/).map((x) => x.trim().replace(/[.,;]+$/, '')).filter(Boolean)
        items.push({ kind: 'list', lead: m[1].trim(), items: parts })
        continue
      }
      // Only words introduced as said (after a colon, or "ask", "say", "types"…) leave the sentence;
      // a short quote in the middle of a sentence stays where it is.
      const segs = []
      const re = /[“"]([^”"]{12,})[”"]/g
      let last = 0
      let q
      while ((q = re.exec(sen))) {
        const before = sen.slice(last, q.index).trim()
        const afterSay = segs.length && segs[segs.length - 1].kind === 'say' && before.split(/\s+/).filter(Boolean).length <= 2
        const said = !before || /[:—–]$/.test(before) || /\b(ask|asks|asked|say|says|said|reply|replies|write|writes|type|types|text|texts|try|instead|line|question|questions|opening|with)$/i.test(before) || afterSay
        if (!said) continue
        segs.push({ kind: 'text', text: before })
        segs.push({ kind: 'say', text: q[1].trim() })
        last = q.index + q[0].length
      }
      if (segs.length) {
        segs.push({ kind: 'text', text: sen.slice(last) })
        for (const g of segs) {
          const tx = g.text.trim().replace(/^[,;:.]\s*/, '')
          if (g.kind === 'say' || tx.split(/\s+/).filter((w) => /\w/.test(w)).length > 2) items.push({ kind: g.kind, text: tx })
        }
        continue
      }
      items.push({ kind: 'text', text: sen })
    }
  }
  return items
}
// One line of a brief: a short label before a colon ("Input:", "Morning:") in bold,
// on every line that has one.
function BriefLine(E, k, text, glyph) {
  const m = /^([^:]{1,40}):\s+(.+)$/s.exec(String(text || ''))
  const lead = m && m[1].trim().split(/\s+/).length <= 4 ? m : null
  const body = lead
    ? <E.Text key={`${k}-t`} color={G.ink} wrap="wrap">{[<E.Text key={`${k}-b`} weight="bold">{`${lead[1].trim()}:`}</E.Text>, ` ${lead[2]}`]}</E.Text>
    : <E.Text key={`${k}-t`} color={G.ink} wrap="wrap">{String(text)}</E.Text>
  if (!glyph) return <E.Box key={k} flexDirection="column">{body}</E.Box>
  return (
    <E.Box key={k} flexDirection="row" gap={1}>
      <E.Box flexShrink={0}><E.Text color={/\d/.test(glyph) ? G.ink : C.taupe} weight={/\d/.test(glyph) ? 'semibold' : undefined}>{glyph}</E.Text></E.Box>
      <E.Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>{body}</E.Box>
    </E.Box>
  )
}
function BriefText(c, key, t, glyph = '•') {
  const { E } = c
  const out = briefItems(t).map((x, n) => {
    const k = `${key}-${n}`
    if (x.kind === 'say') {
      return (
        <E.Box key={k} flexDirection="row" gap={1}>
          <E.Box width={1} flexShrink={0} backgroundColor={G.marigold} />
          <E.Box flexGrow={1} flexShrink={1} minWidth={0}><E.Text color={G.ink} wrap="wrap" italic>{`“${x.text}”`}</E.Text></E.Box>
        </E.Box>
      )
    }
    if (x.kind === 'list') {
      return (
        <E.Box key={k} flexDirection="column" gap={S.tight}>
          {x.lead ? BriefLine(E, `${k}-lead`, x.lead, glyph) : null}
          <E.Box flexDirection="column" gap={S.tight} paddingLeft={glyph ? 2 : 0}>{x.items.map((it, m) => BriefLine(E, `${k}-i${m}`, it, `${m + 1}.`))}</E.Box>
        </E.Box>
      )
    }
    if (x.kind === 'sample') {
      return (
        <E.Box key={k} flexDirection="column" gap={S.tight} paddingX={2} paddingY={1} backgroundColor="#FAF7F0">
          {x.lines.map((l, m) => BriefLine(E, `${k}-${m}`, l, null))}
        </E.Box>
      )
    }
    return BriefLine(E, k, x.text, glyph)
  })
  // Breathing room between lines (her review, 10 Nov): every line, quote and list sits clearly apart.
  return out.length ? [<E.Box key={`${key}-box`} flexDirection="column" gap={glyph ? S.section : S.tight}>{out}</E.Box>] : []
}
// One post, to write from (10 Nov): the full brief in the order a writer needs
// it. A post without its brief shows its outline while the brief is written.
function WsPost($, c, b, o, i) {
  const { E, ui } = c
  const out = b.output || {}
  const pieces = subPieces(out)
  const x = pieces[i]
  if (!x) return WsSubstack($, c, b, o)
  const br = briefOf(out, i)
  const title = String(br?.title || x.headline || '').trim()
  const work1 = () => toChat($, 'plan', `Substack strategy for my working offer: ${o.name} (work on post ${i + 1}: "${title}")`, 'Work on this post with Claude in the chat. The words stay yours.')
  const block = (k, label, kids, gap = S.tight) => (
    <E.Box key={k} flexDirection="column" gap={S.tight} paddingTop={1}>
      <E.Text size="heading" weight="bold" color={G.ink}>{label}</E.Text>
      <E.Box flexDirection="column" gap={gap}>{kids.filter(Boolean)}</E.Box>
    </E.Box>
  )
  const P = (k, t, props = {}) => (String(t || '').trim() ? <E.Text key={k} color={G.ink} wrap="wrap" {...props}>{String(t)}</E.Text> : null)
  const Q = (k, t) => (String(t || '').trim() ? <E.Text key={k} size="footnote" color={G.gray} wrap="wrap">{String(t)}</E.Text> : null)
  const said = (k, label, t) => (String(t || '').trim() ? (
    <E.Box key={k} flexDirection="column" gap={0} paddingX={2} paddingY={1} backgroundColor={SS.write.tint}>
      <E.Text size="caption" weight="semibold" color={G.gray}>{label}</E.Text>
      <E.Text color={G.ink} wrap="wrap">{`“${String(t).replace(/^[“"]|[”"]$/g, '')}”`}</E.Text>
    </E.Box>
  ) : null)
  const head = [
    BackLink(E, 'ss-back', 'Back to strategy', () => backToStrategy($)),
    <E.Text key="ss-p-n" size="caption" weight="bold" color={G.gray}>{[`POST ${i + 1} OF ${pieces.length}`, POST_TYPE(x).toUpperCase()].filter(Boolean).join(' · ')}</E.Text>,
    <E.Text key="ss-p-t" size="title" weight="semibold" color={G.ink} wrap="wrap">{title}</E.Text>,
    br?.subtitle ? <E.Text key="ss-p-sub" color={G.gray} wrap="wrap">{br.subtitle}</E.Text> : null,
    x.job ? Q('ss-p-job', `This post's job: ${lowerFirst(x.job)}`) : null,
  ]
  const nav = [
    Row(E, [Btn(E, `ws-sub-work-${i}`, 'Work on it in the chat', work1), br ? Btn(E, `ss-p-fresh-${i}`, 'Write a fresh brief', () => writePostBrief($, i, `ss-brief-${i}`, true), 'plain') : null, Btn(E, 'ss-back-2', 'Back to strategy', () => backToStrategy($), 'plain')].filter(Boolean)),
    <E.Box key="ss-p-nav" flexDirection="row" flexWrap="wrap" gap={2} justifyContent="space-between">
      {i > 0 ? Btn(E, 'ss-p-prev', `← Post ${i}`, () => openPost($, i - 1), 'plain') : <E.Text key="ss-p-prev-none"> </E.Text>}
      {i < pieces.length - 1 ? Btn(E, 'ss-p-next', `Post ${i + 2} →`, () => openPost($, i + 1), 'plain') : null}
    </E.Box>,
  ]
  const why = [x.whyHere, x.leadsTo || x.cta?.purpose, x.series ? `It's part of your series "${x.series}".` : ''].filter((t) => String(t || '').trim())
  const whyHere = why.length ? Disclosure($, c, `ss-p-whyworks-${i}`, 'Why this post is in your plan', 'where it fits and what it leads to', why.map((t, n) => T(E, t, { key: `ss-p-ww-${n}` }))) : null
  if (!br) {
    // The outline saved with the plan, while the full brief is written (or if it couldn't be).
    const idle = [Card(E, [
      T(E, ui.briefWant === i && ui.op?.status === 'running' ? "Another brief is being written. This post's brief starts as soon as it's done." : 'Get the full brief for this post: the idea, where to open, the story beat by beat, what makes it sound like you, and where to land it.'),
      Row(E, [Btn(E, `ss-p-brief-${i}`, 'Write the full brief', () => writePostBrief($, i, `ss-brief-${i}`), true)]),
    ], { key: `ss-p-brief-card-${i}`, tone: 'next' })]
    return [
      ...head,
      ...OpSlot($, c, `ss-brief-${i}`, idle),
      x.whyOpen ? Q('ss-p-why', x.whyOpen) : null,
      x.opensWith || x.story || x.needsFromYou ? block('ss-p-open', 'Open with this', [
        P('ss-p-ow', x.opensWith || x.story),
        x.needsFromYou ? Q('ss-p-need', `The moment to look for: ${x.needsFromYou}`) : null,
      ]) : null,
      (x.arc || []).length ? block('ss-p-cover', 'Cover these points', (x.arc || []).map((beat, n) => P(`ss-p-b-${n}`, `${n + 1}. ${beat}`))) : null,
      x.cta?.wording || x.next?.wording ? block('ss-p-cta', 'Invite the reader to take the next step', [CopyArea($, c, `ss-p-inv-${i}`, x.cta?.wording || x.next?.wording, 'Copy invitation', SS.call.tint)]) : null,
      String(x.commentQuestion || '').trim() ? Q('ss-p-cq', `Then ask in the comments: ${x.commentQuestion}`) : null,
      whyHere,
      ...nav,
    ].filter(Boolean)
  }
  const angles = (br.angles || []).filter((a) => String(a?.angle || '').trim())
  const beats = (br.arc || []).filter((a) => briefItems(a?.onPage).length)
  const use = (br.yours?.use || []).filter((u) => String(u?.what || '').trim())
  const lines = (br.open?.lines || []).filter((l) => String(l || '').trim()).slice(0, 2)
  const next = br.land?.next || x.next?.kind
  return [
    ...head,
    ...OpSlot($, c, `ss-brief-${i}`),
    block('ss-p-idea', 'The idea', [
      ...BriefText(c, 'ss-p-hook', br.hook, null),
      angles.length > 1 ? Q('ss-p-ang-l', 'Two ways in') : null,
      ...(angles.length > 1 ? angles.map((a, n) => (
        <E.Box key={`ss-p-ang-${n}`} flexDirection="column" gap={0}>
          <E.Text color={G.ink} wrap="wrap">{`• ${a.angle}`}</E.Text>
          {a.why ? <E.Text size="footnote" color={G.gray} wrap="wrap">{a.why}</E.Text> : null}
        </E.Box>
      )) : []),
      br.pick ? P('ss-p-pick', `I'd pick: ${br.pick}`, { weight: 'semibold' }) : null,
    ]),
    block('ss-p-open', "Where I'd open", [
      ...BriefText(c, 'ss-p-where', br.open?.where, null),
      br.open?.detail ? Q('ss-p-detail', `The detail that makes it: ${br.open.detail}`) : null,
      ...lines.map((l, n) => said(`ss-p-line-${n}`, n === 0 ? 'A line you could start with (change it)' : 'Or', l)),
      br.open?.imagined ? Q('ss-p-imag', `Imagined: ${br.open.imagined}`) : null,
    ]),
    block('ss-p-arc', "How I'd tell it", beats.map((a, n) => (
      <E.Box key={`ss-p-beat-${n}`} flexDirection="column" gap={S.tight} paddingX={2} paddingY={1} borderStyle="round" borderColor={G.stone} backgroundColor={G.card}>
        <E.Text weight="bold" color={G.ink} wrap="wrap">{`${n + 1}. ${a.beat || ''}`}</E.Text>
        {BriefText(c, `ss-p-beat-${n}-p`, a.onPage)}
        {a.reader ? <E.Text size="footnote" color={G.gray} wrap="wrap">{`The reader: ${lowerFirst(a.reader)}`}</E.Text> : null}
        {a.leadsInto && n < beats.length - 1 ? <E.Text size="footnote" color={SS.find.color} wrap="wrap">{`→ ${a.leadsInto}`}</E.Text> : null}
      </E.Box>
    )), S.section),
    use.length || br.yours?.question || br.yours?.check ? block('ss-p-yours', 'What would make it sound like you', [
      ...use.map((u, n) => (
        <E.Box key={`ss-p-use-${n}`} flexDirection="column" gap={0}>
          <E.Text color={G.ink} wrap="wrap">{`• ${u.what}`}</E.Text>
          {u.from ? <E.Text size="footnote" color={G.gray} wrap="wrap">{`From ${lowerFirst(String(u.from).replace(/^from\s+/i, ''))}`}</E.Text> : null}
        </E.Box>
      )),
      br.yours?.question ? (
        <E.Box key="ss-p-q" flexDirection="column" gap={0} paddingX={2} paddingY={1} borderStyle="round" borderColor={G.marigold} backgroundColor={G.paleYellow}>
          <E.Text size="caption" weight="bold" color={G.ink}>ONE QUESTION FOR YOU</E.Text>
          <E.Text color={G.ink} wrap="wrap">{br.yours.question}</E.Text>
          {br.yours.meanwhile ? <E.Text size="footnote" weight="semibold" color={G.ink} wrap="wrap">Until you answer it</E.Text> : null}
          {br.yours.meanwhile ? BriefText(c, 'ss-p-meanwhile', br.yours.meanwhile, null) : null}
        </E.Box>
      ) : null,
      br.yours?.check ? Q('ss-p-check-h', 'Before you publish, check these are labeled as suggestions:') : null,
      ...(br.yours?.check ? BriefText(c, 'ss-p-check', br.yours.check) : []),
    ]) : null,
    block('ss-p-land', "Where I'd land it", [
      ...BriefText(c, 'ss-p-take', br.land?.takeaway, null),
      br.land?.line ? CopyArea($, c, `ss-p-inv-${i}`, br.land.line, 'Copy closing line', SS.call.tint) : null,
      next ? Q('ss-p-next', `Next step for the reader: ${NEXT_NAME[String(next).toLowerCase()] || next}.${br.land?.why ? ` ${br.land.why}` : ''}`) : null,
    ]),
    whyHere,
    ...nav,
  ].filter(Boolean)
}

function WhatNextPlan($, c, id, b, o, otherDone) {
  const { E, work } = c
  const change = fallbackFor(work, 'plans') ? null : Btn(E, 'ws-plan-change', 'Change this plan in the chat', () => planInChat($, id, true))
  if (id === 'sales') {
    const batch = firstBatch(b)
    const written = batch.filter((x) => x.draft).length
    if (written < batch.length) {
      return [Card(E, [
        Label(E, 'Next: your first messages', C.blue),
        T(E, `Write your first ${batch.length === 1 ? 'message' : `${batch.length} messages`} with Claude in the chat: ${nameList(batch.map((x) => personName(x.p, contactOf(b, x.key))))}. Each one is saved on that person's record here, ready to copy and send.`),
        Small(E, `First messages written: ${written} of ${batch.length}.`, { color: C.ink }),
        Row(E, [Btn(E, 'ws-write-msgs', 'Write my first messages in the chat', () => planInChat($, 'sales', false, '', 'messages'), true), change].filter(Boolean)),
      ], { key: 'ws-next-msgs', tone: 'next' })]
    }
    return [
      Small(E, `First messages written: ${written} of ${batch.length}. They're on each person's record, ready to copy.`, { color: C.ink }),
      Card(E, [
        Label(E, 'Then come back', C.blue),
        T(E, "Send the first few messages, then tell me what happened. Show me what you sent and what came back, even if nobody replied. If you've had a call, bring the messy notes. We'll work out what you learned and what I'd change before your next message or call."),
        Row(E, [Btn(E, 'ws-f10-report', 'Report what happened in the chat', () => reportOutreach($))]),
      ], { key: 'ws-f10-back', tone: 'summary' }),
      Label(E, 'What next'),
      Row(E, [otherDone ? Btn(E, 'ws-other', `Open ${WS_NAME[other(id)]}`, () => goStep($, 'substack')) : Btn(E, 'ws-other', 'Next: your Substack strategy', () => planInChat($, 'substack'), true), change].filter(Boolean)),
    ]
  }
  return [
    Label(E, 'What next'),
    Row(E, [wsStage(work) === 5 ? Btn(E, 'ws-to-done', "See what you're ready to test", () => goStep($, 'done'), true) : Btn(E, 'ws-other', `Open ${WS_NAME.sales}`, () => goStep($, 'sales')), change].filter(Boolean)),
  ]
}
const other = (id) => (id === 'sales' ? 'substack' : 'sales')

// ---- a test: one action for where it stands; the rest one press away
function WsTest($, c) {
  const { E, work, nav } = c
  const x = (work.experiments || []).find((e) => e.id === nav.id)
  if (!x) return Signpost($, c, 'Your test', 'No test yet', 'Build a test from your working offer, in Your offer.', 'go-offer', 'Go to Your offer', 'offer')
  const reading = (x.readings || [])[(x.readings || []).length - 1]
  const decided = (x.decisions || [])[(x.decisions || []).length - 1]
  const lastFinding = (x.findings || [])[(x.findings || []).length - 1]
  const stage = decided ? 'decided' : x.findings?.length ? 'findings' : x.status === 'running' ? 'underway' : 'planned'
  const STAGE_WORD = { planned: 'Planned', underway: 'Underway', findings: 'Findings in', decided: 'Decided' }
  const g = x.guide || {}
  const fb = fallbackFor(work, 'debrief')
  const wide = (c.colPx || c.px) >= 480
  const nFound = (x.findings || []).length
  const view = ['this', 'guide', 'look', 'happened'].includes(c.ui?.view?.[`test-${x.id}`]) ? c.ui.view[`test-${x.id}`] : 'this'
  const setView = (id) => update($, uiA, (u) => ({ ...u, view: { ...(u.view || {}), [`test-${x.id}`]: id } }))
  const report = fb ? null : Btn(E, 'ws-x-report', 'Report what happened in the chat', () => debriefInChat($, x), true)
  // A step marked for its fallback shows only the signposted panel route.
  const fbCard = fb && stage !== 'planned' ? FallbackCard(E, 'ws-fb-debrief', 'Today, report what happened here in the panel.', 'ws-x-report', 'Report what happened here', () => go($, { view: 'report', id: x.id })) : null
  const move = stage === 'planned'
    ? NextMove(E, 'ws-x-first', {
      label: 'Your first move',
      title: (x.outreach || [])[0]?.to ? `Start with ${lowerFirst(x.outreach[0].to)}` : x.who ? firstSentence(x.who) : 'Send your first message',
      body: 'Open your first message, make it sound like you, and send it from your own email or phone.',
      foot: 'Then come back and tell me what happened, even if nobody replied.',
      actions: [Btn(E, 'ws-x-msg', 'Open your first message', () => setView('guide'), true), Btn(E, 'x-start', "I've sent it", () => setExperimentStatus($, x.id, 'running'))],
    })
    : stage === 'underway'
      ? NextMove(E, 'ws-x-first', { label: 'When you hear back, or nobody does', title: 'Tell me what happened', body: "Show me what you sent and what came back, even if nobody replied. Bring the messy notes from any call.", actions: [report] })
      : stage === 'findings'
        ? NextMove(E, 'ws-x-first', {
          label: 'What your notes suggest (a first read)',
          title: reading?.recommended?.choice ? `My suggestion: ${lowerFirst(DECISIONS[reading.recommended.choice] || reading.recommended.choice)}` : 'Decide your next move',
          body: reading?.learned ? firstSentence(reading.learned) : 'Your findings are saved. Claude reads them with you in the chat.',
          foot: 'A tentative reading, not a decision.',
          actions: [fb ? null : Btn(E, 'ws-x-decide', 'Decide your next move in the chat', () => debriefInChat($, x), true), Btn(E, 'ws-x-see-read', 'See the full read', () => setView('happened'), 'plain')],
        })
        : NextMove(E, 'ws-x-first', { label: 'You decided', title: decided.label, body: decided.why ? `Because ${lowerFirst(decided.why)}.` : '', actions: [report] })
  const told = (x.assumptions || []).filter((a) => /buyer said|demonstrated/i.test(String(a.source)))
  const toFind = (x.assumptions || []).filter((a) => !/buyer said|demonstrated/i.test(String(a.source)))
  const txt = (xs) => (xs || []).map((t) => (typeof t === 'string' ? t : t?.text || '')).filter(Boolean)
  const head = [
    PageHead(c, `Your test · ${STAGE_WORD[stage]}`, /^First 10 Customers:/.test(x.title || '') ? 'First 10 Customers' : x.title, x.reviewOn ? `Review on ${x.reviewOn}.` : '', U2.Chip(E, 'ws-x-chip', STAGE_WORD[stage], stage === 'decided' ? 'done' : stage === 'findings' ? 'pick' : 'here')),
    x.sourceName ? U2.Line(E, 'ws-x-ctx', [U2.Cap(E, 'ws-x-ctx-l', 'For your offer'), U2.Chip(E, 'ws-x-ctx-c', 'Working offer', 'accent'), U2.Strong(E, 'ws-x-ctx-n', shortName(x.sourceName, 60))]) : null,
    U2.ViewSwitch(E, 'ws-xview', [{ id: 'this', label: 'This test' }, { id: 'guide', label: 'Messages' }, { id: 'look', label: 'What to look for' }, { id: 'happened', label: `What happened · ${nFound}` }], view, setView),
  ]
  if (view === 'guide') {
    return [
      ...head,
      (x.outreach || []).length ? U2.SectionHead(E, 'ws-x-msgs-h', { title: 'Messages to send', sub: `${(x.outreach || []).length} message${(x.outreach || []).length === 1 ? '' : 's'}, ready to copy. Uncapped never sends anything.` }) : null,
      ...(x.outreach || []).map((m, i) => U2.CopyBox(E, `ws-x-m-${i}`, { label: m.to ? `To ${m.to}` : 'Message to send', text: m.message, onCopy: () => copyText($, m.message, 'Copied. Paste it into your own messages.') })),
      U2.SectionHead(E, 'ws-x-guide-h', { title: 'Conversation guide', sub: 'Questions to ask' }),
      ...[['ws-g-w', 'To warm up', g.warmups], ['ws-g-p', 'About the problem (what happened, not what they might do)', g.problem], ['ws-g-m', 'About money and buying', g.money], ['ws-g-c', 'To close', g.closers], ['ws-g-a', 'Avoid', x.avoid]]
        .filter(([, , v]) => txt(v).length).map(([key, label, v]) => U2.Col(E, key, [U2.Cap(E, `${key}-l`, label), U2.Bullets(E, `${key}-b`, txt(v), '→')], S.none)),
      txt(x.capture).length ? U2.Col(E, 'ws-x-cap', [U2.SectionHead(E, 'ws-x-cap-h', { title: 'After each conversation, write down' }), U2.Bullets(E, 'ws-x-cap-b', txt(x.capture), '□')], S.tight) : null,
    ].filter(Boolean)
  }
  if (view === 'look') {
    return [
      ...head,
    told.length || toFind.length ? U2.Grid(E, 'ws-x-know', [
      told.length ? U2.SpineCard(E, 'ws-x-told', V.spineGreen, [U2.Cap(E, 'ws-x-told-l', "What you've already seen"), U2.Bullets(E, 'ws-x-told-b', told.map((a) => a.text), '✓')]) : null,
      toFind.length ? U2.SpineCard(E, 'ws-x-tofind', V.spineButter, [U2.Cap(E, 'ws-x-tofind-l', 'What this test still needs to find out'), U2.Bullets(E, 'ws-x-tofind-b', toFind.map((a) => a.text), '?')]) : null,
    ].filter(Boolean), wide) : null,
    U2.Grid(E, 'ws-x-sig-g', [
      txt(x.signals?.support).length ? U2.SpineCard(E, 'ws-x-support', V.spineGreen, [U2.Cap(E, 'ws-x-support-l', 'Would support it'), U2.Bullets(E, 'ws-x-support-b', txt(x.signals.support), '✓')], 'washGreen') : null,
      txt(x.signals?.weaken).length ? U2.SpineCard(E, 'ws-x-weaken', V.spinePink, [U2.Cap(E, 'ws-x-weaken-l', 'Would weaken it'), U2.Bullets(E, 'ws-x-weaken-b', txt(x.signals.weaken), '•')], 'washPink') : null,
      txt(x.signals?.change).length ? U2.SpineCard(E, 'ws-x-change', V.accent, [U2.Cap(E, 'ws-x-change-l', 'Would change it'), U2.Bullets(E, 'ws-x-change-b', txt(x.signals.change), '→')], 'washBlue') : null,
    ].filter(Boolean), wide),
    ].filter(Boolean)
  }
  if (view === 'happened') {
    return [
      ...head,
      !fb && stage !== 'planned' ? U2.Line(E, 'ws-x-rep-row', [Btn(E, 'ws-x-report2', 'Report what happened in the chat', () => debriefInChat($, x))]) : null,
      reading ? U2.SummaryCard(E, 'ws-x-read', 'A tentative reading · not a decision', [
        ...[['What happened', lastFinding?.summary], ['What I take from it', reading.learned], ["What you still don't know", reading.limits],
          ['Before your next call', reading.adjust?.area !== 'none' && reading.adjust?.what ? sentenceCase(String(reading.adjust.what).replace(/^before (your|the) next (call|conversation),?\s*/i, '')) : ''],
          ['A better question to ask', (reading.questionFix || []).find((q) => q?.better)?.better ? `"${String(reading.questionFix.find((q) => q?.better).better).replace(/^"|"$/g, '')}"` : ''],
          ['My suggestion', reading.recommended?.choice ? `${DECISIONS[reading.recommended.choice] || reading.recommended.choice}.` : ''],
        ].filter(([, v]) => String(v || '').trim()).map(([h, v], n) => U2.Col(E, `ws-x-r-${n}`, [U2.Cap(E, `ws-x-r-${n}-l`, h), U2.Body(E, `ws-x-r-${n}-t`, v)], S.none)),
        reading.supports ? U2.Col(E, 'ws-x-sup', [U2.Cap(E, 'ws-x-sup-l', 'What their answers back up so far'), U2.Body(E, 'ws-x-sup-t', reading.supports)], S.none) : null,
        (reading.signals || []).some((s) => s?.what) ? U2.Col(E, 'ws-x-sig', [U2.Cap(E, 'ws-x-sig-l', 'What each person said or did'), ...(reading.signals || []).filter((s) => s?.what).map((s, i) => U2.Col(E, `ws-x-sig-${i}`, [U2.Body(E, `ws-x-sig-${i}-t`, `${s.who ? `${sentenceCase(String(s.who).trim())}: ` : ''}${s.what}`), s.kind ? U2.Meta(E, `ws-x-sig-${i}-k`, SIGNAL_WORDS[String(s.kind).toLowerCase()] || sentenceCase(String(s.kind))) : null], S.none))], S.none) : null,
        (reading.questionFix || []).some((q) => q?.better) ? U2.Col(E, 'ws-x-q', [U2.Cap(E, 'ws-x-q-l', 'Questions to ask differently'), ...(reading.questionFix || []).filter((q) => q?.better).map((q, i) => U2.Body(E, `ws-x-q-${i}`, `${q.asked ? `You asked "${String(q.asked).trim().replace(/^"|"$/g, '')}" ` : ''}${QUESTION_ISSUE[String(q.issue || '').toLowerCase()] || ''}Next time: "${String(q.better).trim().replace(/^"|"$/g, '')}"`))], S.none) : null,
        reading.adjust?.why ? U2.Meta(E, 'ws-x-adj', `Why that change: ${reading.adjust.why}`) : null,
        !fb ? U2.Line(E, 'ws-x-dec', [Btn(E, 'ws-x-decide2', 'Decide your next move in the chat', () => debriefInChat($, x))]) : null,
      ].filter(Boolean)) : null,
      decided ? U2.Panel(E, 'ws-x-decided', 'done', [U2.Cap(E, 'ws-x-decided-l', 'You decided'), U2.Body(E, 'ws-x-decided-t', `${decided.label}${decided.why ? `, because ${decided.why}` : ''}.`)]) : null,
      nFound ? U2.Col(E, 'ws-x-found', [U2.SectionHead(E, 'ws-x-found-h', { title: "What you've reported", sub: `${nFound} report${nFound === 1 ? '' : 's'}, newest first` }), ...x.findings.slice().reverse().map((f, i) => U2.Panel(E, `ws-x-f-${i}`, 'surface', [U2.Cap(E, `ws-x-f-${i}-d`, new Date(f.at).toLocaleString('en-US', { day: 'numeric', month: 'short' })), U2.Body(E, `ws-x-f-${i}-t`, f.summary || f.happened || f.text || '')]))], S.tight) : U2.Meta(E, 'ws-x-none', 'Nothing reported yet. When you hear back, or nobody does, tell Claude in the chat.'),
    ].filter(Boolean)
  }
  return [
    ...head,
    move,
    fbCard,
    U2.MetricStrip(E, 'ws-x-metrics', [{ label: 'Reports saved', value: nFound, context: lastFinding ? `Latest: ${new Date(lastFinding.at).toLocaleString('en-US', { day: 'numeric', month: 'short' })}` : '' }, { label: 'Messages ready', value: (x.outreach || []).length }], c.colPx || c.px),
    x.uncertaintyText || x.believe ? U2.SummaryCard(E, 'ws-x-what', "What you're testing", [x.uncertaintyText ? <E.Text key="ws-x-what-t" weight="semibold" color={V.body} wrap="wrap">{firstSentence(x.uncertaintyText)}</E.Text> : null, x.believe ? U2.Body(E, 'ws-x-believe', x.believe) : null].filter(Boolean)) : null,
    (x.steps || []).length ? U2.Col(E, 'ws-x-steps', [U2.SectionHead(E, 'ws-x-steps-h', { title: 'What to do' }), U2.Numbered(E, 'ws-x-step', txt(x.steps))], S.tight) : null,
  ].filter(Boolean)
}

// ---- 5. Ready to test (version 2)

// Every offer chosen from this garden, with where its plans stand; one press
// makes another the working offer, and its plans come with it.
function offerProgress(work, o) {
  const f = outreachFor(work, o)
  const ready = f.plan && f.batch.length > 0 && f.written === f.batch.length
  const sub = work.builders?.substack?.output
  return `First 10 Customers ${ready ? '✓' : f.plan ? 'plan ready, messages to write' : 'not started'} · Substack ${substackSupports(work, o) ? '✓' : sub ? 'to update for this offer' : 'not started'}`
}
function OffersList($, c) {
  const { E, work } = c
  const cur = workingOffer(work)
  const offers = (work.offers || []).filter((o) => o.status !== 'idea' && !offerStale(work, o))
  if (offers.length < 2 && !(cur && wsStage(work) === 5)) return null
  const older = (work.offers || []).filter((o) => o.status !== 'idea' && offerStale(work, o)).length
  return Card(E, [
    Label(E, 'Your offers', C.blue),
    ...offers.map((o) => (
      <E.Box key={`ws-offer-row-${o.id}`} flexDirection="column" gap={0}>
        <E.Text weight="semibold" color={C.espresso} wrap="wrap">{`${cur && cur.id === o.id ? '▸ ' : ''}${o.name}`}</E.Text>
        <E.Text size="footnote" color={C.ink} wrap="wrap">{`${cur && cur.id === o.id ? 'Working on now · ' : ''}${offerProgress(work, o)}`}</E.Text>
        {cur && cur.id === o.id ? null : Row(E, [Btn(E, `ws-offer-${o.id}`, 'Work on this offer', () => switchOffer($, o.id))])}
      </E.Box>
    )),
    older ? Small(E, `${older} offer${older === 1 ? '' : 's'} from an earlier garden ${older === 1 ? 'is' : 'are'} saved too.`) : null,
  ], { key: 'ws-offers', tone: 'plain' })
}
async function switchOffer($, id) {
  await mutate($, (w) => activateOffer(w, id), ['discover', 'sales'])
  const w = await read($, workA)
  await go($, landingFor(w))
  await setUi($, { notice: `Now working on: ${activeOffer(w)?.name}. Its plans are here, and your other offers keep theirs.` })
}
async function addAnotherOffer($) {
  await go($, { view: 'discover', stage: 'garden' })
  await setUi($, { notice: 'Open the idea you\'d like to add with "See this offer", then press "Start with this offer". Your current offer and its plans stay saved, and you can move between offers under Your portfolio.' })
}
// ---- Your portfolio: the offers they're focusing on, how they fit, and what's next
const LADDER = LENS_ORDER
const LENS_ROLE = Object.fromEntries(LENS_ORDER.map((id) => [id, `${LENS[id].name}: ${lowerFirst(LENS[id].line).replace(/\.$/, '')}`]))
async function openOfferStep($, id, step) {
  await mutate($, (w) => activateOffer(w, id), ['discover', 'sales'])
  const w = await read($, workA)
  const o = activeOffer(w)
  if (step === 'sales' && !planFor(w, 'sales', o)) return planInChat($, 'sales', false, `Now working on: ${o.name}.`)
  if (step === 'messages') return planInChat($, 'sales', false, `Now working on: ${o.name}.`, 'messages')
  await go($, { view: 'builder', builder: step, stage: 'result' })
  await setUi($, { notice: `Now working on: ${o.name}.` })
}
function WsPortfolio($, c) {
  const { E, work } = c
  if (spacesOf(work).length > 1) return WsSpaces($, c)
  const offers = chosenOffers(work)
  const cur = workingOffer(work)
  const rank = (o) => { const i = LADDER.indexOf(offerLens(work, o)); return i < 0 ? LADDER.length : i }
  const ordered = offers.slice().sort((a, z) => rank(a) - rank(z))
  const reach = offers.map((o) => ({ o, ...outreachFor(work, o) }))
  const sub = work.builders?.substack?.output ? work.builders.substack : null
  const notYet = sub ? offers.filter((o) => !substackSupports(work, o)) : []
  const names = (xs) => xs.map((o) => `"${shortName(o.name)}"`).join(' and ')
  // Where we're heading next: the outreach for the offer they're on, then the others, then the Substack.
  const queue = [...reach.filter((x) => cur && x.o.id === cur.id), ...reach.filter((x) => !cur || x.o.id !== cur.id)]
  const noPlan = queue.find((x) => !x.plan)
  const noMsgs = queue.find((x) => x.plan && x.written < x.batch.length)
  const next = noPlan
    ? { title: `Plan outreach for ${shortName(noPlan.o.name)}`, body: 'Who to approach first, what to say and what to learn.', label: 'Build its plan in the chat', act: () => openOfferStep($, noPlan.o.id, 'sales') }
    : noMsgs
      ? { title: `Write the first messages for ${shortName(noMsgs.o.name)}`, body: `${noMsgs.written} of ${noMsgs.batch.length} written. Each one is saved on that person's card.`, label: 'Write them in the chat', act: () => openOfferStep($, noMsgs.o.id, 'messages') }
      : !sub
        ? { title: 'Start your Substack', body: 'One publication that supports all your offers.', label: 'Start it in the chat', act: () => planInChat($, 'substack', false, '', '', { view: 'done' }) }
        : notYet.length
          ? { title: 'Update your Substack for every offer', body: `It doesn't mention ${names(notYet)} yet.`, label: 'Update it in the chat', act: () => planInChat($, 'substack', false, '', 'portfolio', { view: 'done' }) }
          : null
  const story = String(work.portfolio?.story || '').trim()
  const together = story || String((work.discover?.early?.directions || []).find((d) => d.id === ordered[0]?.fromDirection)?.together || '').trim()
  const ideas = gardenIdeas(work).length
  const f10chip = (x) => (!x.plan ? 'First 10: not started' : x.batch.length && x.written === x.batch.length ? 'First 10: messages written ✓' : 'First 10: plan ready')
  return [
    PageHead(c, 'Your portfolio', "What you're building"),
    T(E, `You've chosen ${offers.length} offers to focus on${ideas > offers.length ? `, out of the ${ideas} ideas in your garden` : ''}.`),
    next
      ? NextMove(E, 'ws-pf-next-card', { title: next.title, body: next.body, actions: [Btn(E, 'ws-pf-next', next.label, next.act, true)] })
      : Card(E, [ArtOf(E, 'ws-pf-celebrate', celebrateSvg({ px: Math.min(c.px - 40, 520), fonts: FONTS, line: "you're ready to test!" })), T(E, 'Every offer has its outreach plan and first messages, and your Substack supports them all. When someone replies or you have a call, tell Claude what happened in the chat.', { weight: 'semibold' })], { key: 'ws-pf-next-card', tone: 'done' }),
    ArtOf(E, 'ws-pf-ladder-art', portfolioLadderSvg({ px: c.px, fonts: FONTS, offers: ordered.map((o) => ({ name: shortName(o.name, 60), lens: offerLens(work, o) || null, price: priceText(o, curOf(work)) })) })),
    together ? Note(c, firstSentence(together)) : null,
    SectionTitle(E, 'ws-pf-offers-h', 'Your offers'),
    ...ordered.map((o) => {
      const x = reach.find((r) => r.o.id === o.id)
      const isCur = cur && cur.id === o.id
      const lens = offerLens(work, o)
      return U2.OfferCard(E, `ws-pf-o-${o.id}`, {
        lens, title: shortName(o.name, 60), chip: isCur ? U2.Chip(E, `ws-pf-ow-${o.id}`, 'Working offer', 'accent') : null,
        meta: [LENS[lens]?.name, priceText(o, curOf(work)), 'To test'].filter(Boolean).join(' · '),
        status: [f10chip(x), sub ? (substackSupports(work, o) ? 'Substack: covered ✓' : 'Substack: not yet') : '', x.who ? `First move: ${x.who}` : ''].filter(Boolean).join(' · '),
        actions: [isCur ? null : Btn(E, `ws-pf-work-${o.id}`, 'Work on this offer', () => switchOffer($, o.id), 'plain'), Btn(E, `ws-pf-f10-${o.id}`, x.plan ? 'Open its First 10' : 'Build its outreach plan', () => openOfferStep($, o.id, 'sales'), 'plain')],
      })
    }),
    Card(E, [
      T(E, `One Substack for all your offers · covers ${offers.filter((o) => substackSupports(work, o)).length} of ${offers.length}`, { weight: 'semibold', color: C.espresso }),
      sub ? null : Small(E, 'Not started yet.'),
      sub ? Row(E, [Btn(E, 'ws-pf-substack', 'Open your Substack strategy', () => goStep($, 'substack'), 'plain')]) : null,
    ].filter(Boolean), { key: 'ws-pf-substack-card', tone: 'summary' }),
    Card(E, [
      T(E, 'Want to add another offer? Choose another idea from your garden.'),
      Row(E, [Btn(E, 'ws-add-offer', 'Add another offer', () => addAnotherOffer($))]),
    ], { key: 'ws-done-next', tone: 'invite' }),
  ].filter(Boolean)
}

// ---- spaces: the offers for one kind of buyer, with their outreach, tests and own Substack
// Opens an offer in a space (the one they're on, if it's here), which brings back
// its First 10 plan and the space's Substack; every other plan stays where it is.
async function openSpaceStep($, sid, step) {
  const w0 = await read($, workA)
  const sp = (w0.spaces || []).find((x) => x.id === sid)
  const inSp = offersIn(w0, sid)
  const target = inSp.find((o) => o.id === w0.activeOfferId) || inSp[0]
  if (!target || !sp) return
  if (target.id !== w0.activeOfferId) await mutate($, (w) => activateOffer(w, target.id), ['discover', 'sales'])
  else if (w0.builders?.substack?.spaceId !== sid) await mutate($, (w) => activateSpace(w, sid), [])
  if (step === 'substack-start') return planInChat($, 'substack', false, `Now working on: ${sp.name}.`)
  if (step === 'substack-update') return planInChat($, 'substack', false, '', 'portfolio')
  if (step === 'space') return go($, { view: 'space', id: sid })
  return go($, { view: 'builder', builder: 'substack', stage: 'result' })
}
async function openPerson($, offerId, slot) {
  const w0 = await read($, workA)
  if (offerId !== w0.activeOfferId) await mutate($, (w) => activateOffer(w, offerId), ['discover', 'sales'])
  await go($, { view: 'builder', builder: 'sales', stage: 'person', slot })
}
// The one next move for a space: outreach first (the offer they're on, then the
// others), then its Substack.
function spaceNext($, work, sid) {
  const cur = workingOffer(work)
  const reach = offersIn(work, sid).map((o) => ({ o, ...outreachFor(work, o) }))
  const queue = [...reach.filter((x) => cur && x.o.id === cur.id), ...reach.filter((x) => !cur || x.o.id !== cur.id)]
  const noPlan = queue.find((x) => !x.plan)
  const noMsgs = queue.find((x) => x.plan && x.written < x.batch.length)
  const sub = substackFor(work, sid)
  const notYet = sub?.output ? reach.filter((x) => !substackSupports(work, x.o)).map((x) => x.o) : []
  if (noPlan) return { title: `Plan outreach for ${shortName(noPlan.o.name)}`, body: 'Who to approach first, what to say and what to learn.', label: 'Build its plan in the chat', act: () => openOfferStep($, noPlan.o.id, 'sales') }
  if (noMsgs) return { title: `Write the first messages for ${shortName(noMsgs.o.name)}`, body: `${noMsgs.written} of ${noMsgs.batch.length} written. Each one is saved on that person's card.`, label: 'Write them in the chat', act: () => openOfferStep($, noMsgs.o.id, 'messages') }
  if (!sub?.output) return { title: 'Start the Substack for this space', body: 'One publication for the people these offers are for. Your other spaces keep their own.', label: 'Start it in the chat', act: () => openSpaceStep($, sid, 'substack-start') }
  if (notYet.length) return { title: 'Update this Substack for every offer here', body: `It doesn't mention ${nameList(notYet.map((o) => `"${shortName(o.name)}"`))} yet.`, label: 'Update it in the chat', act: () => openSpaceStep($, sid, 'substack-update') }
  return null
}
// Everyone on their lists, across every offer: one row per person, with each offer they're on.
function peopleOf(work) {
  const rows = []
  const norm = (x) => String(x || '').trim().toLowerCase()
  for (const o of chosenOffers(work)) {
    const { plan } = outreachFor(work, o)
    if (!plan?.output) continue
    ;(plan.output.list || []).forEach((p, i) => {
      const key = keyOf(p, i)
      const t = contactOf(plan, key)
      if (stillToFind(p, t)) return
      const name = personName(p, t)
      const hit = rows.find((r) => norm(r.name) === norm(name))
      const on = { o, slot: slotOf(p, i), t }
      if (hit) hit.on.push(on)
      else rows.push({ name, on: [on] })
    })
  }
  return rows
}
function toFindCount(work) {
  let n = 0
  for (const o of chosenOffers(work)) {
    const { plan } = outreachFor(work, o)
    ;(plan?.output?.list || []).forEach((p, i) => { if (stillToFind(p, contactOf(plan, keyOf(p, i)))) n++ })
  }
  return n
}
function testsIn(work, sid) {
  const ids = offersIn(work, sid).map((o) => o.id)
  return (work.experiments || []).filter((x) => ids.includes(x.source?.offerId))
}
function WsSpaces($, c) {
  const { E, work } = c
  const spaces = spacesOf(work)
  const offers = chosenOffers(work)
  const people = peopleOf(work)
  // The next move starts with the space of the offer they're on.
  const here = workingOffer(work)?.spaceId
  const first = [...spaces.filter((sp) => sp.id === here), ...spaces.filter((sp) => sp.id !== here)].map((sp) => ({ sp, next: spaceNext($, work, sp.id) })).find((x) => x.next)
  const story = String(work.portfolio?.story || '').trim()
  return [
    PageHead(c, 'Your portfolio', "What you're building"),
    T(E, `You're working on ${offers.length} offers in ${spaces.length} spaces, one for each kind of buyer. Each space has its own outreach, tests and Substack.`),
    first
      ? NextMove(E, 'ws-pf-next-card', { title: first.next.title, body: `${first.sp.name}. ${first.next.body}`, actions: [Btn(E, 'ws-pf-next', first.next.label, first.next.act, true)] })
      : Card(E, [ArtOf(E, 'ws-pf-celebrate', celebrateSvg({ px: Math.min(c.px - 40, 520), fonts: FONTS, line: "you're ready to test!" })), T(E, 'Every offer has its outreach plan and first messages, and every space has its Substack. Send the messages, then come back and tell me what happened.')], { key: 'ws-pf-ready', tone: 'done' }),
    story ? Note(c, firstSentence(story)) : null,
    SectionTitle(E, 'ws-sp-h', 'Your spaces'),
    ...spaces.map((sp) => {
      const inSp = offersIn(work, sp.id)
      const nx = spaceNext($, work, sp.id)
      const sub = substackFor(work, sp.id)
      const n = people.filter((r) => r.on.some((x) => x.o.spaceId === sp.id)).length
      const tests = testsIn(work, sp.id).length
      const lens = offerLens(work, inSp[0] || {})
      return ItemCard(E, `ws-sp-${sp.id}`, LENS[lens]?.color, [
        T(E, sp.name, { weight: 'semibold', color: C.espresso }),
        Small(E, inSp.map((o) => shortName(o.name)).join(' · '), { color: C.ink }),
        Chips(E, `ws-sp-chips-${sp.id}`, [
          Chip(E, `ws-sp-pp-${sp.id}`, `${n} ${n === 1 ? 'person' : 'people'}`, n ? 'done' : 'totest'),
          Chip(E, `ws-sp-ts-${sp.id}`, tests ? `${tests} test${tests === 1 ? '' : 's'}` : 'No test yet', tests ? 'done' : 'totest'),
          Chip(E, `ws-sp-ss-${sp.id}`, sub?.output ? 'Substack ready' : 'No Substack yet', sub?.output ? 'done' : 'totest'),
        ]),
        nx ? Small(E, `Next: ${lowerFirst(nx.title)}.`, { color: C.ink }) : Small(E, 'Ready to test.', { color: C.ink }),
        Row(E, [Btn(E, `ws-sp-open-${sp.id}`, 'Open this space', () => go($, { view: 'space', id: sp.id }))]),
      ])
    }),
    Card(E, [
      T(E, "Everyone you're talking to", { weight: 'semibold', color: C.espresso }),
      Small(E, `${people.length} ${people.length === 1 ? 'person' : 'people'} across ${offers.length} offers, in one list.`),
      Row(E, [Btn(E, 'ws-people', 'See everyone', () => go($, { view: 'people' }), 'plain')]),
    ], { key: 'ws-pf-people', tone: 'summary' }),
    Card(E, [
      T(E, 'Want to add another offer? Choose another idea from your garden.'),
      Row(E, [Btn(E, 'ws-add-offer', 'Add another offer', () => addAnotherOffer($))]),
    ], { key: 'ws-done-next', tone: 'invite' }),
  ].filter(Boolean)
}
function WsSpace($, c) {
  const { E, work, nav } = c
  const sp = spacesOf(work).find((x) => x.id === nav.id)
  if (!sp) return WsPortfolio($, c)
  const LADDER_ORDER = LENS_ORDER
  const rank = (o) => { const i = LADDER_ORDER.indexOf(offerLens(work, o)); return i < 0 ? LADDER_ORDER.length : i }
  const inSp = offersIn(work, sp.id).slice().sort((a, z) => rank(a) - rank(z))
  const cur = workingOffer(work)
  const nx = spaceNext($, work, sp.id)
  const sub = substackFor(work, sp.id)
  const tests = testsIn(work, sp.id)
  const f10chip = (x) => (!x.plan ? 'First 10: not started' : x.batch.length && x.written === x.batch.length ? 'First 10: messages written ✓' : 'First 10: plan ready')
  return [
    PageHead(c, 'Your space', sp.name),
    U2.Meta(E, 'ws-sp-intro', inSp.length > 1 ? `${inSp.length} offers for the same people, with their outreach, tests and one Substack.` : 'One offer, with its outreach, tests and its own Substack.', { color: V.body }),
    nx ? NextMove(E, 'ws-sp-next-card', { title: nx.title, body: nx.body, actions: [Btn(E, 'ws-sp-next', nx.label, nx.act, true)] }) : null,
    inSp.length > 1 ? ArtOf(E, 'ws-sp-ladder-art', portfolioLadderSvg({ px: c.px, fonts: FONTS, offers: inSp.map((o) => ({ name: shortName(o.name, 60), lens: offerLens(work, o) || null, price: priceText(o, curOf(work)) })) })) : null,
    U2.Col(E, 'ws-sp-reach', [
      U2.SectionHead(E, 'ws-sp-reach-h', { title: 'Outreach', sub: 'One First 10 Customers plan for each offer.' }),
      ...inSp.map((o) => {
        const x = outreachFor(work, o)
        const lens = offerLens(work, o)
        return U2.OfferCard(E, `ws-sp-o-${o.id}`, {
          lens, title: shortName(o.name, 60), chip: cur && cur.id === o.id ? U2.Chip(E, `ws-sp-ow-${o.id}`, 'Open now', 'accent') : null,
          meta: [LENS[lens]?.name, priceText(o, curOf(work))].filter(Boolean).join(' · '),
          status: [f10chip(x), x.who ? `First move: ${x.who}` : ''].filter(Boolean).join(' · '),
          actions: [Btn(E, `ws-sp-f10-${o.id}`, x.plan ? 'Open its First 10' : 'Build its outreach plan', () => openOfferStep($, o.id, 'sales'), 'plain')],
        })
      }),
    ], S.tight),
    U2.RowList(E, 'ws-sp-tests', { label: 'Tests', rows: tests.map((x) => ({ key: `ws-sp-t-${x.id}`, name: x.title, meta: STATUS_WORD[x.status] || x.status, actions: [Btn(E, `ws-sp-topen-${x.id}`, 'Open', () => go($, { view: 'experiment', id: x.id }), 'plain')] })), empty: 'No test yet. One starts when you report back on your first messages.' }),
    U2.SectionHead(E, 'ws-sp-ss-h', { title: 'Substack' }),
    Card(E, sub?.output ? [
      T(E, `Write first: "${firstPost(sub.output)}"`, { weight: 'semibold', color: C.espresso }),
      Small(E, `Covers ${inSp.filter((o) => substackSupports(work, o)).length} of ${inSp.length} ${inSp.length === 1 ? 'offer' : 'offers'} in this space. Each space has its own Substack, so this one is only for these readers.`),
      Row(E, [Btn(E, `ws-sp-ssopen-${sp.id}`, 'Open its Substack', () => openSpaceStep($, sp.id, 'substack'), 'plain')]),
    ] : [
      T(E, 'No Substack for this space yet.'),
      Small(E, 'It would be written for these readers only, so it never mixes with your other spaces.'),
      Row(E, [Btn(E, `ws-sp-ssstart-${sp.id}`, 'Start it in the chat', () => openSpaceStep($, sp.id, 'substack-start'), 'plain')]),
    ], { key: `ws-sp-ss-${sp.id}`, tone: 'summary' }),
    Small(E, 'To rename this space or move an offer to another one, tell the chat.'),
  ].filter(Boolean)
}
function WsPeople($, c) {
  const { E, work } = c
  const rows = peopleOf(work)
  const spaces = spacesOf(work)
  const later = toFindCount(work)
  const row = (r, i) => {
    // Open opens the record that's furthest along (the message they sent, say).
    const first = r.on.slice().sort((a, z) => (stopOf(z.t) - stopOf(a.t)) || (Number(Boolean(z.t.draft)) - Number(Boolean(a.t.draft))))[0]
    // Name the offer when it isn't obvious: they're on two lists, or their space holds more than one offer.
    const showOffer = r.on.length > 1 || offersIn(work, first.o.spaceId).length > 1 || (spaces.length < 2 && chosenOffers(work).length > 1)
    return ItemCard(E, `pp-${i}`, C.white, [
      <E.Box key={`pp-h-${i}`} flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
        <E.Text weight="semibold" color={C.espresso} wrap="wrap">{r.name}</E.Text>
        {Btn(E, `pp-open-${i}`, 'Open', () => openPerson($, first.o.id, first.slot), 'plain')}
      </E.Box>,
      Chips(E, `pp-c-${i}`, r.on.flatMap((x, k) => [
        showOffer ? Chip(E, `pp-o-${i}-${k}`, shortName(x.o.name, 28), 'next') : null,
        Chip(E, `pp-s-${i}-${k}`, statusWord(x.t), stopOf(x.t) === 3 ? 'done' : 'totest'),
        String(x.t.draft || '').trim() ? Chip(E, `pp-d-${i}-${k}`, stopOf(x.t) >= 1 ? 'Message sent' : 'Message ready', 'pick') : null,
      ].filter(Boolean))),
    ])
  }
  const bySpace = spaces.length > 1
    ? spaces.flatMap((sp) => {
      const here = rows.filter((r) => r.on.some((x) => x.o.spaceId === sp.id))
      return here.length ? [SubLabel(E, `pp-sp-${sp.id}`, sp.name), ...here.map((r) => row(r, rows.indexOf(r)))] : []
    })
    : rows.map(row)
  return [
    Eyebrow(E, 'ws-eyebrow', "Everyone you're talking to"),
    Title(c, "Everyone you're talking to", 27, { highlight: true }),
    T(E, rows.length ? `${rows.length} ${rows.length === 1 ? 'person' : 'people'} across your offers. Open anyone to see their messages, where things stand and your notes.` : 'Nobody yet. Your First 10 Customers plans add people here.'),
    ...bySpace,
    later ? Small(E, `${later} more ${later === 1 ? 'place' : 'places'} on your lists are people still to find.`) : null,
  ].filter(Boolean)
}

function WsFinish($, c) {
  const { E, work } = c
  if (chosenOffers(work).length > 1) return WsPortfolio($, c)
  const o = workingOffer(work)
  if (!o || wsStage(work) !== 5) return WsGarden($, c)
  const sales = planFor(work, 'sales', o)
  const sub = planFor(work, 'substack', o)
  const batch = firstBatch(sales)
  const who = sales.output.firstMove?.who || (batch[0] ? personName(batch[0].p, contactOf(sales, batch[0].key)) : '')
  const first = !work.celebrated?.ready
  return [
    PageHead(c, 'Ready to test', "You're ready to test your offer", `${shortName(o.name, 60)} has its list of 10 and its Substack strategy.`, U2.Chip(E, 'ws-done-chip', 'Done ✓', 'done')),
    first ? ArtOf(E, 'ws-done-celebrate', celebrateSvg({ px: Math.min(c.px, 560), fonts: FONTS, line: "you're ready to test!" })) : null,
    NextMove(E, 'ws-done-week', {
      label: 'This week',
      title: `Test ${shortName(o.name)}`,
      extra: [U2.Numbered(E, 'ws-done-steps', [
        `Send your first ${batch.length === 1 ? 'message' : 'messages'}${who ? `, starting with ${who}` : ''}.`,
        `Write your first post${firstPost(sub.output) ? `: "${firstPost(sub.output)}"` : ''}.`,
        'When someone replies or you have a call, tell me what happened in the chat.',
      ])],
      actions: [Btn(E, 'ws-done-first10', 'Open First 10 Customers', async () => { await mutate($, (w) => { w.celebrated = { ...(w.celebrated || {}), ready: true } }, ['discover']); await goStep($, 'sales') }, true), Btn(E, 'ws-done-substack', 'Open your Substack', () => goStep($, 'substack'), 'plain')],
    }),
    U2.Panel(E, 'ws-done-next', 'invite', [U2.Strong(E, 'ws-done-next-t', 'Build another offer alongside this one?'), U2.Line(E, 'ws-done-next-a', [Btn(E, 'ws-add-offer', 'Add another offer', () => addAnotherOffer($))])]),
  ].filter(Boolean)
}

// ---- Your map (version 2): native tiles by phase, every live step pressable.

function DesignCheck($, c) {
  const { E } = c
  const q = (key, n, title, ask, body, fallback) => (
    <E.Box key={key} flexDirection="column" gap={1} paddingX={2} paddingY={1} borderStyle="round" borderColor={C.espresso} backgroundColor={C.white}>
      <E.Text weight="semibold" color={C.espresso} wrap="wrap">{`${n}. ${title}`}</E.Text>
      <E.Text color={C.ink} wrap="wrap">{ask}</E.Text>
      {body}
      <E.Text size="footnote" color={C.taupeInk} wrap="wrap">{`If not: ${fallback}`}</E.Text>
    </E.Box>
  )
  const twinkle = thinkingSvg('do these stars twinkle?')
  return [
    Eyebrow(E, 'dc-eyebrow', 'Preview only · not for customers'),
    Title(c, 'Design check', 27),
    T(E, 'Four things the new design relies on. Look at each one here in Claude Desktop, then tell Claude in the chat which look right, by number.'),
    q('dc-1', 1, 'Highlighter', 'Do you see a yellow highlight behind the words "these words"?',
      <E.Text key="dc-1-t" color={C.ink} wrap="wrap">{'Do you see '}<E.Text key="dc-1-h" backgroundColor={C.butter}>these words</E.Text>{' highlighted?'}</E.Text>,
      'highlights become semibold, like this: these words.'),
    q('dc-2', 2, 'Card hover', 'Point at the card below. Does it turn off-white with a dark border, and does "Open →" appear?',
      <E.Box key="dc-2-card" flexDirection="column" gap={0} paddingX={2} paddingY={1} borderStyle="round" borderColor={C.line} backgroundColor={C.white} hover={{ backgroundColor: C.hoverWhite, borderColor: C.espresso }}>
        <E.Text key="dc-2-t" weight="semibold" color={C.espresso}>An idea card</E.Text>
        {/* unkeyed: a keyed Box would be its own hover scope, which the pointer can't reach while hidden */}<E.Box display="none" hover={{ display: 'flex' }}><E.Text key="dc-2-o" color={C.blue}>Open →</E.Text></E.Box>
      </E.Box>,
      'cards stay as they are. The buttons inside still look pressable.'),
    q('dc-3', 3, 'Card spine', 'Is there a pink stripe down the left edge of the card below?',
      <E.Box key="dc-3-card" flexDirection="row" borderStyle="round" borderColor={C.line} backgroundColor={C.white}>
        <E.Box key="dc-3-spine" width={1} backgroundColor={C.pink} />
        <E.Box key="dc-3-body" flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}><E.Text key="dc-3-t" weight="semibold" color={C.espresso}>Do it with them</E.Text></E.Box>
      </E.Box>,
      'the card border takes the lens color instead.'),
    q('dc-4', 4, 'Animation', 'Do the stars twinkle in A? In B?',
      <E.Box key="dc-4-art" flexDirection="column" gap={1}>
        <E.Text key="dc-4-a" size="caption" weight="bold" color={C.taupeInk}>A · DRAWN AS AN IMAGE</E.Text>
        {E.Svg ? <E.Svg key="dc-4-img" source={twinkle} alt="Three stars, blue, pink and butter, which should twinkle." /> : null}
        <E.Text key="dc-4-b" size="caption" weight="bold" color={C.taupeInk}>B · DRAWN INTERACTIVE</E.Text>
        {E.Svg ? <E.Svg key="dc-4-int" source={twinkle} isInteractive alt="Three stars, blue, pink and butter, which should twinkle." /> : null}
      </E.Box>,
      'the stars sit still at full size, which still reads.'),
    Row(E, [Btn(E, 'dc-art', 'See the artwork', () => go($, { view: 'designart' }))]),
  ]
}

// Every new piece of artwork, drawn with this person's own saved work, for the
// founder to look at before the screens use them (preview only).
function ArtworkGallery($, c) {
  const { E, work } = c
  if (!E.Svg) return []
  const px = c.px
  const ideas = gardenIdeas(work)
  const counts = Object.fromEntries(LENS_ORDER.map((id) => [id, ideas.filter((i) => i.lens === id).length]))
  const tf = testFirstIdea(work, ideas)
  const d0 = (work.discover?.early?.directions || [])[0]
  const sales = work.builders?.sales
  const cn = sales?.output ? contactCounts((sales.output.list || []).map((p, i) => contactOf(sales, keyOf(p, i)))) : { sent: 0, replied: 0, talked: 0, encouraged: 0 }
  const sub = work.builders?.substack?.output
  const offers = chosenOffers(work)
  const rank = (o) => { const i = LENS_ORDER.indexOf(offerLens(work, o)); return i < 0 ? 9 : i }
  const states = Object.fromEntries(LIVE_STEPS.map((st) => [st.id, st.pos < wsStage(work) ? 'done' : st.pos === wsStage(work) ? 'here' : 'todo']))
  const o = workingOffer(work)
  const pieces = [
    ['7.2 Step header band', stepHeadSvg({ px, fonts: FONTS, num: 3, total: 4, title: 'First 10 Customers', promise: 'ten real conversations, starting with people who know you', phase: 'sell', phaseName: 'Sell it', status: 'here' })],
    ['7.4 Ways to earn', lensLadderSvg({ px, fonts: FONTS, counts, pick: tf?.lens || null })],
    d0 ? ['7.5 One skill, five ways', skillLadderSvg({ px, fonts: FONTS, ideas: ideas.filter((i) => i.d.id === d0.id).map((i) => ({ lens: i.lens, name: i.name, price: i.price })) })] : null,
    o ? ['7.6 Featured offer card', { source: offerCardSvg3({ name: o.name, buyer: o.buyer, problem: o.problem, priceText: priceText(o, curOf(work)), label: 'YOUR WORKING OFFER' }, { px, fonts: FONTS, sticker: 'my pick!' }), alt: `Your working offer: ${o.name}` }] : null,
    ['7.7 Outreach progress', funnelSvg({ px, fonts: FONTS, sent: cn.sent, replied: cn.replied, talked: cn.talked, intros: cn.encouraged })],
    sub?.reader?.promise ? ['7.8 Reader promise', promiseSvg({ px, fonts: FONTS, text: sub.reader.promise })] : null,
    sub && subPieces(sub).length ? ['7.9 Post arc', arcSvg({ px, fonts: FONTS, posts: subPieces(sub).slice(0, 4).map((x) => ({ title: x.headline, type: x.type })) })] : null,
    offers.length > 1 ? ['7.10 Offer ladder', portfolioLadderSvg({ px, fonts: FONTS, offers: offers.slice().sort((a, z) => rank(a) - rank(z)).map((x) => ({ name: x.name, lens: offerLens(work, x) || null, price: priceText(x, curOf(work)) })) })] : null,
    ['7.11 Your map', builderMapSvg2({ px, fonts: FONTS, states })],
    ['7.14 Step complete', celebrateSvg({ px, fonts: FONTS, line: 'you did the whole thing!' })],
  ].filter(Boolean)
  return [BackLink(E, 'dc-art-back', 'Back to the Design check', () => go($, { view: 'designcheck' })), Eyebrow(E, 'dc-art-eyebrow', 'Preview only · not for customers'), SectionTitle(E, 'dc-art-h', 'Artwork'), Small(E, 'Drawn with your saved work. The welcome letter is on the Welcome screen.'), ...pieces.flatMap(([label, a], i) => [Label(E, label), ArtOf(E, `dc-art-${i}`, a)])]
}

// Artwork never draws wider than this, however wide the panel: past it, lines
// get too long to read and drawings too big for the words around them.
const ART_MAX = 720
function WsRender($, c) {
  const { E, work } = c
  const full = pxFor(c.cols, 1600)
  const wide = full >= 560
  // The welcome is for someone who hasn't started. Discover started from the chat
  // (an answer saved, or the chat asking its first question) moves the panel on.
  if (!work.onboarding?.seen && c.nav.view !== 'discover' && !discoverStarted(work, c.ui)) {
    const body = WsWelcome($, c)
    return [...Header($, c), HandoffCard($, c), ...NoticeSlot($, c, ''), ...body, Footer(c)].filter(Boolean)
  }
  const nav = (c.nav.view === 'builder' && !WS_PLANS.includes(c.nav.builder) && c.nav.builder !== 'discover') || ['tests', 'profile', 'plan', 'tour'].includes(c.nav.view) ? landingFor(work) : c.nav
  const cur = stepOf(nav)
  // Artwork in the content column is drawn to the column's width (4.2).
  const colPx = wide ? Math.max(240, Math.floor(full * 0.72) - 16) : full
  const cc = { ...c, nav, px: Math.min(colPx, ART_MAX), colPx }
  let body
  if (nav.view === 'home') body = WsHome($, cc)
  else if (nav.view === 'discover' && nav.stage === 'theme') body = WsTheme($, cc)
  else if (nav.view === 'discover' || (nav.view === 'builder' && nav.builder === 'discover')) {
    body = fallbackFor(work, 'discover') && ['question', 'start', 'followups', 'week', 'energy'].includes(nav.stage) ? DiscoverView($, cc)
      : ['garden', 'offer', 'done'].includes(nav.stage) ? WsGarden($, cc) : nav.stage === 'idea' ? WsOffer($, cc) : nav.stage === 'direction' ? WsDirection($, cc) : WsDiscover($, cc)
  } else if (nav.view === 'builder' && WS_PLANS.includes(nav.builder)) body = WsPlan($, cc, nav.builder)
  else if (nav.view === 'experiment') body = WsTest($, cc)
  else if (nav.view === 'done') body = WsFinish($, cc)
  else if (nav.view === 'space') body = WsSpace($, cc)
  else if (nav.view === 'people') body = PeopleScreen($, v2kit($, cc))
  else if (nav.view === 'map') body = WsMap($, cc)
  else if (nav.view === 'report' && fallbackFor(work, 'debrief')) body = ReportView($, cc)
  else if (nav.view === 'settings') body = SettingsView($, cc)
  else if (nav.view === 'feedback') body = FeedbackView($, cc)
  else if (nav.view === 'designcheck') body = DesignCheck($, cc)
  else if (nav.view === 'designart') body = ArtworkGallery($, cc)
  else body = WsDiscover($, cc)
  c.places = cc.places
  const content = [HandoffCard($, cc), ...NoticeSlot($, cc, cur), ...body].filter(Boolean)
  const footer = StepFooter($, cc, cur)
  const hc = { ...c, px: Math.min(full, 1600) }
  if (wide) {
    return [
      ...Header($, hc),
      <E.Box key="ws-layout" flexDirection="row" gap={S.section} alignItems="flex-start">
        <E.Box key="ws-steps" flexDirection="column" gap={0} width="28%" flexShrink={0}>{railItems($, c, cur)}</E.Box>
        <E.Box key="ws-content" flexDirection="column" gap={S.section} flexGrow={1} flexShrink={1} minWidth={0}>{[...content, footer]}</E.Box>
      </E.Box>,
      Footer(c),
    ].filter(Boolean)
  }
  return [...Header($, hc), ...StepBar($, c, cur), <E.Box key="ws-content" flexDirection="column" gap={S.section}>{[...content, footer]}</E.Box>, Footer(c)].filter(Boolean)
}

function render($, c) {
  const { ui, work, nav } = c
  if (ui.ws !== 'ready' || nav.view === 'setup') return [...Header($, c), ...SetupView($, c)]
  if (!work) return [T(c.E, 'Loading your work...')]
  c.places = new Set()
  DRAW = c
  if (isWorkshop(work)) return WsRender($, c)
  let body
  if (!work.onboarding?.seen && !['tour', 'discover'].includes(nav.view)) body = WelcomeView($, c)
  else if (nav.view === 'tour') body = TourView($, c)
  else if (nav.view === 'discover') body = DiscoverView($, c)
  else if (nav.view === 'builder') body = nav.builder === 'discover' ? DiscoverView($, c) : BuilderView($, c.E, ui, work, nav, c)
  else if (nav.view === 'profile') body = ProfileView($, c)
  else if (nav.view === 'settings') body = SettingsView($, c)
  else if (nav.view === 'feedback') body = FeedbackView($, c)
  else if (nav.view === 'experiment') body = ExperimentView($, c)
  else if (nav.view === 'tests') body = TestsView($, c)
  else if (nav.view === 'plan') body = PlanView($, c)
  else if (nav.view === 'report') body = ReportView($, c)
  else body = HomeView($, c)
  return [...Header($, c), ...Banners($, c), ...body, Footer(c)]
}

function homeNumbers(work) {
  const o = workingOffer(work)
  const b = o ? planFor(work, 'sales', o) : null
  const list = (b?.output?.list || []).map((p, i) => contactOf(b, keyOf(p, i)))
  const cn = contactCounts(list)
  const s = o ? planFor(work, 'substack', o) : null
  const pieces = (s?.output?.pieces || []).length
  const briefs = s?.output?.briefs ? Object.values(s.output.briefs).filter((x) => x && x.title).length : 0
  const first = String(s?.output?.cadence?.firstOut || s?.output?.first?.when || '').trim()
  return { cn, total: list.length || 10, pieces, briefs, first, hasPlan: Boolean(b), hasSub: Boolean(s) }
}

function homeMove($, c) {
  const { E, work } = c
  const stage = wsStage(work)
  if (stage === 1) return discoverMove($, c)
  const o = workingOffer(work)
  if (stage === 2) {
    const ideas = gardenIdeas(work)
    const pick = startList(work, ideas)[0]?.i
    return NextMove(E, 'home-next', { title: 'Choose the offer to test first', body: pick ? `My pick for you: ${pick.name}.` : `Your garden has ${ideas.length} ideas to choose from.`, actions: [pick ? Btn(E, 'home-see-pick', 'See this offer', () => openIdea($, ideaKey(pick)), true) : Btn(E, 'go-offer', 'See your ideas', () => goStep($, 'offer'), true), pick ? Btn(E, 'home-all', 'See all ideas', () => goStep($, 'offer')) : null] })
  }
  if (stage === 3) {
    const b = planFor(work, 'sales', o)
    if (!b) return NextMove(E, 'home-next', { title: 'Build your list of 10', body: 'Claude asks three quick questions in the chat, then your plan appears here in about two minutes.', foot: `First 10 · ${shortName(o.name)}`, actions: [Btn(E, 'ws-plan-chat', 'Build my plan in the chat', () => planInChat($, 'sales'), true)] })
    const k = first10Next($, v2kit($, c), b, o)
    if (k) return k
    return NextMove(E, 'home-next', { title: 'Write your first messages', body: 'Each one is saved on that person\'s card, ready to copy.', foot: `First 10 · ${shortName(o.name)}`, actions: [Btn(E, 'ws-write-msgs', 'Write them in the chat', () => planInChat($, 'sales', false, '', 'messages'), true), Btn(E, 'home-open-f10', 'Open First 10', () => goStep($, 'sales'))] })
  }
  if (stage === 4) return NextMove(E, 'home-next', { title: 'Plan your Substack', body: 'A few quick questions in the chat, then your strategy and ten posts appear here.', foot: `Substack · ${shortName(o.name)}`, actions: [Btn(E, 'ws-start-ss', 'Build your Substack strategy', () => planInChat($, 'substack'), true), Btn(E, 'home-open-f10', 'Open First 10', () => goStep($, 'sales'))] })
  const b = planFor(work, 'sales', o)
  const k = b ? first10Next($, v2kit($, c), b, o) : null
  return k || NextMove(E, 'home-next', { title: "You're ready to test your offer", body: 'Send your first messages, write your first post, and report back after each conversation.', actions: [Btn(E, 'ws-done-first10', 'Open First 10 Customers', () => goStep($, 'sales'), true), Btn(E, 'ws-done-substack', 'Open your Substack', () => goStep($, 'substack'))] })
}

// The first post's date for a tile ("First post Tue, Nov 24"), only when the saved words hold a date.
function firstPostDate(t) {
  const m = String(t || '').match(/((?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day,?\s+)?((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2})/)
  return m ? `First post ${m[1] ? `${m[1].slice(0, 3)} ` : ''}${m[2].replace(/^(\w{3})\w*/, '$1')}` : ''
}
function WsHome($, c) {
  const { E, work } = c
  const stage = wsStage(work)
  const name = String(work.profile?.name || '').trim()
  const offers = chosenOffers(work)
  const p = discoverProgress(work)
  const n = homeNumbers(work)
  const cur = workingOffer(work)
  const note = stage === 1 ? (p.done ? "You've started. Let's keep going." : "Let's find what you could get paid for.")
    : stage === 2 ? 'Your ideas are ready. Pick one to test first.'
      : offers.length > 1 ? `${offers.length} offers on the go. Nice work.` : stage === 5 ? 'Both plans are built. Nice work.' : 'One offer on the go. Here\'s where it stands.'
  const tiles = stage <= 2
    ? [{ label: 'Themes covered', value: p.done, suffix: `of ${p.total}`, bar: { n: p.done, total: p.total, alt: `${p.done} of ${p.total} themes covered` } }, { label: 'Ideas in your garden', value: work.discover?.early ? gardenIdeas(work).length : 0, context: work.discover?.early ? '' : 'They grow once Discover has enough.' }]
    : [
      { label: 'Messaged', value: n.cn.sent },
      { label: 'Replies', value: n.cn.replied },
      { label: 'Talked', value: n.cn.talked, suffix: `of ${n.total}`, bar: { n: n.cn.talked, total: n.total, alt: `${n.cn.talked} of ${n.total} conversations` } },
      { label: 'Briefs ready', value: n.briefs, suffix: n.pieces ? `of ${n.pieces}` : '', context: n.hasSub ? firstPostDate(n.first) : 'Substack not started' },
    ]
  const metricNote = stage >= 3 && !n.cn.sent && !n.cn.replied && !n.cn.talked ? 'These count up as you mark people on your list.' : ''
  return [
    U2.Col(E, 'home-hello', [StepTitle(c, name ? `Hello, ${name}` : 'Hello'), Note(c, note)], S.none),
    ...[].concat(homeMove($, c)).filter(Boolean),
    U2.MetricStrip(E, 'home-metrics', tiles, c.colPx || c.px, metricNote),
    offers.length ? U2.Col(E, 'home-offers', [
      U2.SectionHead(E, 'home-offers-h', { title: offers.length > 1 ? 'Your offers' : 'Your offer', right: U2.Meta(E, 'home-offers-n', `${offers.length} offer${offers.length === 1 ? '' : 's'}`) }),
      ...offers.map((o) => {
        const lens = offerLens(work, o)
        const live = cur && cur.id === o.id
        return U2.OfferCard(E, `home-offer-${o.id}`, {
          lens, title: shortName(o.name, 60), chip: live ? U2.Chip(E, `home-offer-${o.id}-c`, 'Working offer', 'accent') : null,
          meta: [LENS[lens]?.name, priceText(o, curOf(work)), 'To test'].filter(Boolean).join(' · '),
          status: offerProgress(work, o),
          actions: [Btn(E, `home-open-${o.id}`, 'Open', () => (live ? goStep($, planFor(work, 'sales', o) ? 'sales' : 'offer') : switchOffer($, o.id)), 'plain')],
        })
      }),
    ], S.tight) : null,
    U2.Col(E, 'home-path', [
      U2.SectionHead(E, 'home-path-h', { title: 'Your path', right: U2.Meta(E, 'home-path-n', `${LIVE_STEPS.filter((x) => stepState(work, x.id, 'home') === 'done').length} of ${LIVE_STEPS.length} done`) }),
      <E.Box key="home-path-row" flexDirection="row" flexWrap="wrap" gap={1}>
        {LIVE_STEPS.map((st) => { const s = stepState(work, st.id, 'home'); return <E.Button key={`home-step-${st.id}`} label={`${s === 'done' ? '✓ ' : s === 'next' ? '● ' : ''}${st.short || st.name}`} variant="secondary" dimColor={s === 'later'} onPress={later(() => goStep($, st.id))} /> })}
      </E.Box>,
    ], S.tight),
  ].filter(Boolean)
}

// ---- 1. Discover (S1, version 2 9.3): what's saved, never an answer box
// The one Next move, by where Discover stands. While the garden grows, from here or the chat, that's the move.

function discoverMove($, c) {
  const { E, work } = c
  const p = discoverProgress(work)
  const fb = fallbackFor(work, 'discover')
  if (gardenGrowing(c.ui)) return GardenGrowing($, c, 'ws-d-growing')
  if (work.discover.early) {
    const ideas = gardenIdeas(work).length
    if (!work.celebrated?.discover) {
      return U2.Panel(E, 'ws-d-done', 'done', [
        ArtOf(E, 'ws-d-celebrate', celebrateSvg({ px: Math.min(c.px - 40, 520), fonts: FONTS, line: 'your garden has grown!' })),
        U2.Strong(E, 'ws-d-done-t', `Your garden has ${ideas} ideas, grouped by the ways you could earn from what you know.`),
        U2.Line(E, 'ws-d-done-a', [Btn(E, 'go-offer', 'See your ideas', () => seeIdeas($), true)]),
      ])
    }
    return NextMove(E, 'ws-d-next', { title: `Your garden has ${ideas} ideas`, body: "They're grouped by the ways you could earn from what you know.", actions: [Btn(E, 'go-offer', 'See your ideas', () => goStep($, 'offer'), true)] })
  }
  if (p.ready) return OpSlot($, c, 'ws-grow', [NextMove(E, 'ws-d-next', { title: 'Grow your portfolio garden', body: "That's enough to suggest your first ideas.", actions: [Btn(E, 'ws-grow', 'Grow my garden', () => runEarlyRead($, 'ws-grow'), true)] })])
  if (fb) return FallbackCard(E, 'ws-fb-discover', 'Today, answer the Discover questions here in the panel.', 'ws-discover', p.done ? 'Carry on here' : 'Start here', () => answerNext($))
  if (c.ui?.discoverLive && !p.done) return NextMove(E, 'ws-d-next', { label: 'Claude is working', title: 'Discover is underway', body: 'Answer the first question in the chat beside this panel. Your answers appear here as you go.', tone: 'working' })
  return NextMove(E, 'ws-d-next', { title: p.done ? 'Discover is underway' : 'Start Discover', body: p.done ? `${questionsLeft(p) || 'A few more questions in the chat.'} If you've stepped away, Claude picks up where you left off.` : 'About 20 minutes of questions about your work, your life and what people already ask you for.', actions: [Btn(E, 'ws-discover', p.done ? 'Carry on in the chat' : 'Start Discover in the chat', () => discoverInChat($), true)] })
}
// What a theme holds, in words, and whether it's saved.

function themeValue(work, t) {
  const a = work.profile?.answers || {}
  const L = work.profile?.limits || {}
  const En = work.profile?.energy || {}
  const v = (t.id === 'start' ? STARTING_POINTS[work.discover.startingPoint] || a.idea || ''
    : t.id === 'week' ? [L.hours && (/week/i.test(L.hours) ? L.hours : `${L.hours} a week`), L.income && `${L.currency || ''}${L.income} a month`, L.goal].filter(Boolean).join(' · ')
      : t.id === 'energy' ? [En.more && `More: ${En.more}`, En.less && `Less: ${En.less}`, En.never && `Never: ${En.never}`].filter(Boolean).join(' · ')
        : String(a[t.id] || '')).trim()
  const st = discoverProgress(work).states[t.id]
  return { v, st, saved: ['answered', 'enough'].includes(st), skipped: st === 'skipped' }
}

function WsTheme($, c) {
  const { E, work, nav } = c
  const i = Math.max(0, THEMES.findIndex((t) => t.id === nav.theme))
  const t = THEMES[i]
  const { v, saved } = themeValue(work, t)
  const prev = THEMES[i - 1]
  const next = THEMES[i + 1]
  const L = work.profile?.limits || {}
  const En = work.profile?.energy || {}
  const body = t.id === 'week'
    ? U2.Facts(E, 'th-facts', [['Hours a week', L.hours], ['Income goal', L.income && `${L.currency || ''}${L.income} a month`], ['Longer term', L.goal]], (c.colPx || c.px) >= 420)
    : t.id === 'energy'
      ? U2.Facts(E, 'th-facts', [['More of', En.more], ['Less of', En.less], ['Never again', En.never]], (c.colPx || c.px) >= 420)
      : U2.Panel(E, 'th-words', 'surface', [U2.Cap(E, 'th-words-l', 'In your words'), ...(v ? String(v).split(/\n{2,}/).map((para, n) => U2.Body(E, `th-p-${n}`, para)) : [U2.Meta(E, 'th-none', 'Not answered yet.')])])
  return [
    U2.Crumbs(E, 'th-crumbs', [['Discover', () => go($, { view: 'discover', stage: 'overview' })], ['What you\'ve told me']]),
    U2.Col(E, 'th-head', [U2.Cap(E, 'th-n', `Theme ${i + 1} of ${THEMES.length}`), <E.Text key="th-t" size="heading" weight="semibold" color={V.heading} wrap="wrap">{t.label}</E.Text>], S.none),
    body,
    fallbackFor(work, 'discover') ? null : U2.Line(E, 'th-acts', [Btn(E, `ws-add-${t.id}`, saved ? 'Change this in the chat' : 'Answer in the chat', () => toChat($, 'discover', `add to: ${t.label}`, 'Tell Claude what to add or change in the chat. It\'s saved here, and Claude tells you if it changes your ideas.'))]),
    <E.Box key="th-foot" flexDirection="row" flexWrap="wrap" gap={2} justifyContent="space-between">
      {prev ? Btn(E, 'th-prev', '← Previous answer', () => go($, { view: 'discover', stage: 'theme', theme: prev.id }), 'plain', { dimColor: true }) : Btn(E, 'th-back', '← Discover', () => go($, { view: 'discover', stage: 'overview' }), 'plain', { dimColor: true })}
      {next ? Btn(E, 'th-next', 'Next answer →', () => go($, { view: 'discover', stage: 'theme', theme: next.id }), 'plain') : Btn(E, 'th-offer', 'Your offer →', () => goStep($, 'offer'), 'plain')}
    </E.Box>,
  ].filter(Boolean)
}

function IdeaCard2($, c, i, chip) {
  const { E, work } = c
  const k = ideaKey(i)
  const cur = isCurrentIdea(work, i)
  const [amount, unit] = U2.splitPrice(i.price)
  const one = ideaChange(i)
  return (
    <E.Box key={`gp-${k}`} flexDirection="column" backgroundColor={V.surface} borderStyle="round" borderColor={cur ? V.accent : V.line}>
      {U2.LensBand(E, `gp-band-${k}`, i.lens)}
      <E.Box key={`gp-body-${k}`} flexDirection="column" gap={S.none} paddingX={2} paddingY={1}>
        <E.Text key={`gp-t-${k}`} weight="semibold" color={V.heading} wrap="wrap">{shortName(i.name, 70)}</E.Text>
        {amount ? (
          <E.Box key={`gp-p-${k}`} flexDirection="row" flexWrap="wrap" gap={1} alignItems="flex-end">
            <E.Text size="heading" weight="semibold" color={V.heading} wrap="wrap">{amount}</E.Text>
            {unit ? <E.Text size="footnote" color={V.meta} wrap="wrap">{unit}</E.Text> : null}
          </E.Box>
        ) : null}
        {one ? U2.Body(E, `gp-o-${k}`, one, { size: 'footnote' }) : null}
        {i.buyer ? U2.Meta(E, `gp-b-${k}`, `For ${lowerFirst(String(i.buyer).replace(/\.$/, ''))}`) : null}
      </E.Box>
      <E.Box key={`gp-foot-${k}`} flexDirection="row" flexWrap="wrap" gap={1} alignItems="center" justifyContent="space-between" paddingX={2} paddingBottom={1}>
        {chip}
        {Btn(E, `ws-see-${k}`, 'See this offer', () => openIdea($, k), 'plain')}
      </E.Box>
    </E.Box>
  )
}

function ideaChip(c, i, first) {
  const { E, work } = c
  const k = ideaKey(i)
  const inPortfolio = !isCurrentIdea(work, i) && chosenOffers(work).some((o) => !offerStale(work, o) && o.fromDirection === i.d.id && (o.fromGrow ?? null) === (i.grow ?? null))
  return isCurrentIdea(work, i) ? U2.Chip(E, `gp-c-${k}`, 'Working offer', 'accent')
    : i === first ? U2.Chip(E, `gp-c-${k}`, '★ My pick', 'pick')
      : inPortfolio ? U2.Chip(E, `gp-c-${k}`, 'In your portfolio', 'quiet')
        : i.own ? U2.Chip(E, `gp-c-${k}`, 'Your idea', 'quiet') : U2.Chip(E, `gp-c-${k}`, 'To test', 'quiet')
}
const lensRank = (i) => { const r = LENS_ORDER.indexOf(i.lens); return r < 0 ? 9 : r }

// ---- 2. Your offer (S2, version 2): the Portfolio Garden in three views

function PageHead(c, eyebrow, title, promise, chip) {
  return U2.TitleBlock(c.E, 'ws-pagehead', { eyebrow, title: StepTitle(c, title), promise, chip })
}

// ---- a test (version 2): This test, Messages and guide, What happened

// ======================================================================
// Version 2 (DESIGN.md, 11 Nov 2026): screens kept in their own files
// (lib/v2-first10.tsx, lib/v2-substack.tsx) reach the panel's helpers
// through this kit, so they need no import back into this file.
let V2FN = null
function v2fn() {
  return V2FN || (V2FN = { PANE, PLUGIN, RESEARCHER, SAVE_RESEARCH, INITIAL_UI, navA, uiA, workA, researchRuns, RESEARCH_LIMITS, HOURS, CURRENCIES, METHOD_IDS, boot, loadInto, getWork, mutate, go, setUi, setDraft, TYPICAL_SECONDS, ask, askMany, notSent, opResult, showPlace, stopAsking, saveTheme, saveName, saveStartingPoint, saveWeek, skipTheme, followKey, runFollowUps, clearFollowDrafts, saveFollowUpAnswers, freshGardenMarks, keepEarlierGarden, runEarlyRead, react, setExcitement, sharpen, workOutNumbers, draftsForDirection, chooseDirection, keepAsStream, offerFromDrafts, confirmFirstOffer, makeActive, confirmOfferEdits, clearOfferDrafts, setPositioning, saveBuilderAnswer, quickOffer, RESULT_NAME, build, markDone, startEdit, saveEdit, chooseOption, useBios, restore, previewRevision, approveRevision, deferReview, dismissReview, contentFeedback, saveDraft, setPersonStatus, toggleCheck, writeSite, previewSite, talkItThrough, setUpHere, backup, MANUAL_UPDATE, claudeExe, checkForUpdates, RELEASES, isNewer, noteLatest, installsToUpdate, pluginId, Small, Label, Head, Margin, Art, Title, Note, DESKTOP, TONE, toneOf, Card, Row, later, Btn, Hl, SectionTitle, NextMove, ItemCard, CopyBlock, KeyFacts, Tabs, ChoiceRow, StatusStepper, BackLink, statusLabel, savedWhen, Header, Banners, curOf, lowerFirst, inSentence, nameList, shortTitle, Crumbs, elapsedText, gardenGrowing, GardenGrowing, PlanComing, OpSlot, Footer, SetupView, MAKES, WelcomeView, TOUR, TourView, finishOnboarding, ReviewSummary, ResumeCard, HomeView, PlansCard, continueInChat, answerNext, openBuilder, BuilderTop, Question, STATE_MARK, STATE_WORD, themePreview, DiscoverOverview, EnergyForm, WeekForm, saveQuestion, DiscoverQuestion, DiscoverFollowups, FollowupsBlock, DiscoverNext, BASIS, KIND_WORDS, DiscoverGarden, OFFER_LABELS, OfferForm, DiscoverOffer, DiscoverDone, TONES, BODY, CHIP, Chip, Chips, Eyebrow, Fact, Section, SOURCE_TONE, SOURCE_WORDS, LINKED, cleanShort, firstSentence, directionView, directionStatus, Disclosure, Rule, DirectionView, linkedTests, linkedAssets, toggleSection, chooseLink, rewriteDirection, toggleShortlist, researchInChat, refineInChat, themeName, RepairNotice, ReviewBadge, reviewWhy, DiscoverRepair, setRepairPick, settleCopy, markReviewed, DiscoverView, LABELS, labelFor, Fields, NeedsCard, UsingCard, ReviewCard, BuilderQuestions, ResultTop, contactOf, slotOf, keyOf, stillToFind, personName, saveContact, PlanOfferCard, archivePlan, newPlanForOffer, revisePlanForOffer, keepPlanFor, swapPlan, PlanIntroCard, SalesResult, BLANK, blanksIn, fillBlanks, saveDecision, PilotCheck, SubstackResult, BuilderResult, OfferEdit, BuilderView, ProfileView, SettingsView, planExperiment, savePlan, saveAgain, setExperimentStatus, organiseFindings, saveFindings, readingExtras, outreachTest, reportOutreach, readFindings, decide, openWithContext, saveResearch, startResearch, findResearcher, researchRunFor, finishResearch, STATUS_WORD, TestsCard, PlanView, List, SignpostCard, TestsView, ExperimentView, ReportView, organiseReport, saveReport, CAN_RERUN, rerun, LABELS_FOR_FEEDBACK, mark, feedbackContext, openFeedback, setFeedback, saveFeedbackFile, openEmailDraft, copyText, copyReport, FB_STATUS, FeedbackView, planQuestions, isWorkshop, WORKSHOP_FALLBACK, fallbackFor, WS_PLANS, WS_NAME, LENSES, lensOf, wasCombined, gardenIdeas, ideaKey, pickIdea, testFirstIdea, startList, offerStale, isCurrentIdea, planFor, workingOffer, chosenOffers, substackSupports, activateOffer, offerNamed, spaceNamed, offerLens, outreachFor, firstBatch, first10Ready, wsStage, testFor, stepOf, landingFor, goStep, STEP_KEY, stepState, railItems, stepDots, StepBar, NoticeSlot, StepFooter, WsMap, toChat, copyHandoff, HandoffCard, discoverInChat, planInChat, debriefInChat, openSection, FallbackCard, StepHead, ArtOf, Signpost, discoverStarted, WsWelcome, themeLine, seeIdeas, WsDiscover, shortName, SIZE_WORDS, PICKS, LENS_EXPLAIN, IdeaCard, keepOffer, GARDEN_COPY, NEXT_COPY, G, LENS_TINT, DO_HEADING, ideaFormat, ideaChange, ideaTime, priceTimeLine, FormatTag, openIdea, backToGarden, OfferPreview, WsGarden, WsOffer, SOURCE_CHIP, WsDirection, wsUseOffer, WsPlan, ContextLine, STOPS, stopOf, statusWord, STOP_NEXT, OTHER_OUTCOMES, WsFirst10, F10Toolkit, writeCallGuide, writePostBrief, writeAllBriefs, draftsSaved, GUIDE_COPY, guideViews, seeGuide, GuideCallout, CallGuide, saveMessageEdit, MessageArea, msgIsNewer, msgLabel, dayText, WsPerson, keepSubstackFocus, subPieces, firstPost, naturalLead, LeadText, allLed, ListRows, RankedRows, qText, sentencesOf, closeSteps, sentenceCase, summaryOf, numberSvg, Medal, Callout, MiniCards, PATTERNS, SIGNAL_WORDS, QUESTION_ISSUE, PATTERN_NAME, WARMTH, CONVERSATION_LEAD, SubLabel, gistOf, offerWhere, afterGist, Tiles, CTA_META, CTA_LINE, SOURCE_LINE, sourceLine, SS, PROBLEM_FROM, POST_TYPE, NEXT_NAME, postWord, briefOf, openPost, backToStrategy, CopyArea, SsSection, WsSubstack, sentencesIn, briefItems, BriefLine, BriefText, WsPost, WhatNextPlan, other, WsTest, offerProgress, OffersList, switchOffer, addAnotherOffer, LADDER, LENS_ROLE, openOfferStep, WsPortfolio, openSpaceStep, openPerson, spaceNext, peopleOf, toFindCount, testsIn, WsSpaces, WsSpace, WsPeople, WsFinish, DesignCheck, ArtworkGallery, ART_MAX, WsRender, render, bandSummary, CUSTOMER_GUIDE, openedNote, isCustomerWorkspace, productPath, methodPath, NOT_PRODUCT, NOT_DIRECT, supportReport, questionsLeft, statusText, withLeft, reply, failed, guardFile, guardRead, passOn, Txt: T })
}
// The same helpers that need $, ready to call without it (a screen module
// never passes $ on: the engine only allows it at its own call sites).
function v2act($) {
  return {
    boot: () => boot($),
    loadInto: () => loadInto($),
    getWork: () => getWork($),
    mutate: (fn, kitIds) => mutate($, fn, kitIds),
    go: (patch) => go($, patch),
    setUi: (patch) => setUi($, patch),
    setDraft: (key, value) => setDraft($, key, value),
    ask: (a0, opts) => ask($, a0, opts),
    askMany: (items, opts) => askMany($, items, opts),
    opResult: (patch) => opResult($, patch),
    showPlace: (place) => showPlace($, place),
    stopAsking: () => stopAsking($),
    saveTheme: (theme, text, how, depth, source) => saveTheme($, theme, text, how, depth, source),
    saveName: (name) => saveName($, name),
    saveStartingPoint: (kind, details, source) => saveStartingPoint($, kind, details, source),
    saveWeek: (input, source) => saveWeek($, input, source),
    skipTheme: (theme) => skipTheme($, theme),
    runFollowUps: (place, fresh) => runFollowUps($, place, fresh),
    clearFollowDrafts: () => clearFollowDrafts($),
    saveFollowUpAnswers: () => saveFollowUpAnswers($),
    runEarlyRead: (place, fresh) => runEarlyRead($, place, fresh),
    react: (id, value) => react($, id, value),
    setExcitement: (id, n) => setExcitement($, id, n),
    sharpen: (place, fresh) => sharpen($, place, fresh),
    workOutNumbers: (id, place, fresh) => workOutNumbers($, id, place, fresh),
    chooseDirection: (id, grow) => chooseDirection($, id, grow),
    keepAsStream: (id) => keepAsStream($, id),
    confirmFirstOffer: () => confirmFirstOffer($),
    makeActive: (id) => makeActive($, id),
    confirmOfferEdits: () => confirmOfferEdits($),
    clearOfferDrafts: () => clearOfferDrafts($),
    setPositioning: (fields, origin) => setPositioning($, fields, origin),
    saveBuilderAnswer: (id, q) => saveBuilderAnswer($, id, q),
    quickOffer: () => quickOffer($),
    build: (id, place, fresh) => build($, id, place, fresh),
    markDone: (id) => markDone($, id),
    startEdit: (id, path, value, asks) => startEdit($, id, path, value, asks),
    saveEdit: (scope) => saveEdit($, scope),
    chooseOption: (id, key, index) => chooseOption($, id, key, index),
    useBios: () => useBios($),
    restore: (id, i) => restore($, id, i),
    previewRevision: (id, place, fresh) => previewRevision($, id, place, fresh),
    approveRevision: (id) => approveRevision($, id),
    deferReview: (id) => deferReview($, id),
    dismissReview: (id) => dismissReview($, id),
    contentFeedback: (i, place, fresh) => contentFeedback($, i, place, fresh),
    saveDraft: (i) => saveDraft($, i),
    setPersonStatus: (i, status) => setPersonStatus($, i, status),
    toggleCheck: (i) => toggleCheck($, i),
    writeSite: () => writeSite($),
    previewSite: () => previewSite($),
    talkItThrough: (id) => talkItThrough($, id),
    setUpHere: () => setUpHere($),
    backup: () => backup($),
    claudeExe: () => claudeExe($),
    checkForUpdates: () => checkForUpdates($),
    noteLatest: () => noteLatest($),
    installsToUpdate: (exe) => installsToUpdate($, exe),
    pluginId: () => pluginId($),
    CopyBlock: (E, key, label, text, note) => CopyBlock($, E, key, label, text, note),
    Header: (c) => Header($, c),
    Banners: (c) => Banners($, c),
    Crumbs: (c, items) => Crumbs($, c, items),
    GardenGrowing: (c, key) => GardenGrowing($, c, key),
    PlanComing: (c, key) => PlanComing($, c, key),
    OpSlot: (c, place, idle) => OpSlot($, c, place, idle),
    SetupView: (c) => SetupView($, c),
    WelcomeView: (c) => WelcomeView($, c),
    TourView: (c) => TourView($, c),
    finishOnboarding: (where) => finishOnboarding($, where),
    ReviewSummary: (c) => ReviewSummary($, c),
    ResumeCard: (c) => ResumeCard($, c),
    HomeView: (c) => HomeView($, c),
    PlansCard: (c, o) => PlansCard($, c, o),
    continueInChat: () => continueInChat($),
    answerNext: () => answerNext($),
    openBuilder: (id) => openBuilder($, id),
    BuilderTop: (E, ui, def, work, c) => BuilderTop($, E, ui, def, work, c),
    Question: (E, ui, key, q, saved) => Question($, E, ui, key, q, saved),
    DiscoverOverview: (c) => DiscoverOverview($, c),
    EnergyForm: (c, q) => EnergyForm($, c, q),
    WeekForm: (c) => WeekForm($, c),
    saveQuestion: (theme) => saveQuestion($, theme),
    DiscoverQuestion: (c) => DiscoverQuestion($, c),
    DiscoverFollowups: (c) => DiscoverFollowups($, c),
    FollowupsBlock: (c, place) => FollowupsBlock($, c, place),
    DiscoverNext: (c, p) => DiscoverNext($, c, p),
    DiscoverGarden: (c) => DiscoverGarden($, c),
    OfferForm: (E, ui, base, confirmLabel, onConfirm) => OfferForm($, E, ui, base, confirmLabel, onConfirm),
    DiscoverOffer: (c) => DiscoverOffer($, c),
    DiscoverDone: (c) => DiscoverDone($, c),
    Disclosure: (c, key, title, summary, body, opts) => Disclosure($, c, key, title, summary, body, opts),
    DirectionView: (c) => DirectionView($, c),
    toggleSection: (key, group) => toggleSection($, key, group),
    chooseLink: (id) => chooseLink($, id),
    rewriteDirection: (id, place, fresh, why) => rewriteDirection($, id, place, fresh, why),
    toggleShortlist: (id) => toggleShortlist($, id),
    researchInChat: (x) => researchInChat($, x),
    refineInChat: (x) => refineInChat($, x),
    RepairNotice: (c) => RepairNotice($, c),
    ReviewBadge: (c, key, why) => ReviewBadge($, c, key, why),
    DiscoverRepair: (c) => DiscoverRepair($, c),
    setRepairPick: (key, pick) => setRepairPick($, key, pick),
    settleCopy: (key, keepWith) => settleCopy($, key, keepWith),
    markReviewed: (key) => markReviewed($, key),
    DiscoverView: (c) => DiscoverView($, c),
    Fields: (E, ui, id, value, path, depth) => Fields($, E, ui, id, value, path, depth),
    NeedsCard: (E, ui, def, work) => NeedsCard($, E, ui, def, work),
    UsingCard: (E, def, work) => UsingCard($, E, def, work),
    ReviewCard: (E, ui, id, b) => ReviewCard($, E, ui, id, b),
    BuilderQuestions: (E, ui, def, work, nav) => BuilderQuestions($, E, ui, def, work, nav),
    ResultTop: (E, ui, def, work, b) => ResultTop($, E, ui, def, work, b),
    saveContact: (slot, patch, who) => saveContact($, slot, patch, who),
    PlanOfferCard: (c, id, b) => PlanOfferCard($, c, id, b),
    newPlanForOffer: (id) => newPlanForOffer($, id),
    revisePlanForOffer: (id) => revisePlanForOffer($, id),
    keepPlanFor: (id) => keepPlanFor($, id),
    swapPlan: (id) => swapPlan($, id),
    PlanIntroCard: (c, id) => PlanIntroCard($, c, id),
    SalesResult: (c, b) => SalesResult($, c, b),
    saveDecision: (key) => saveDecision($, key),
    PilotCheck: (c, b, p, opts) => PilotCheck($, c, b, p, opts),
    SubstackResult: (c, b) => SubstackResult($, c, b),
    BuilderResult: (E, ui, def, work) => BuilderResult($, E, ui, def, work),
    OfferEdit: (E, ui, work) => OfferEdit($, E, ui, work),
    BuilderView: (E, ui, work, nav, c) => BuilderView($, E, ui, work, nav, c),
    ProfileView: (c) => ProfileView($, c),
    SettingsView: (c) => SettingsView($, c),
    planExperiment: (ref, focus, place, fresh) => planExperiment($, ref, focus, place, fresh),
    savePlan: (x, place) => savePlan($, x, place),
    saveAgain: (place) => saveAgain($, place),
    setExperimentStatus: (id, status) => setExperimentStatus($, id, status),
    organiseFindings: (id, notes, who, place, fresh) => organiseFindings($, id, notes, who, place, fresh),
    saveFindings: (id, organised, notes, who, source, extra) => saveFindings($, id, organised, notes, who, source, extra),
    outreachTest: (o) => outreachTest($, o),
    reportOutreach: () => reportOutreach($),
    readFindings: (id, place, fresh) => readFindings($, id, place, fresh),
    decide: (id, choice, why, applyChange) => decide($, id, choice, why, applyChange),
    openWithContext: (builderId, note, prefill) => openWithContext($, builderId, note, prefill),
    saveResearch: (id, topic, items, implication, extra) => saveResearch($, id, topic, items, implication, extra),
    startResearch: (id, place, fresh) => startResearch($, id, place, fresh),
    findResearcher: (description) => findResearcher($, description),
    researchRunFor: (agentId, checkType) => researchRunFor($, agentId, checkType),
    finishResearch: (run, entry) => finishResearch($, run, entry),
    TestsCard: (c) => TestsCard($, c),
    PlanView: (c) => PlanView($, c),
    SignpostCard: (c, sp) => SignpostCard($, c, sp),
    TestsView: (c) => TestsView($, c),
    ExperimentView: (c) => ExperimentView($, c),
    ReportView: (c) => ReportView($, c),
    organiseReport: (id, place, fresh) => organiseReport($, id, place, fresh),
    saveReport: (id, o) => saveReport($, id, o),
    rerun: (name, a, place, fresh) => rerun($, name, a, place, fresh),
    mark: (action) => mark($, action),
    feedbackContext: () => feedbackContext($),
    openFeedback: (kind) => openFeedback($, kind),
    setFeedback: (patch) => setFeedback($, patch),
    saveFeedbackFile: (fb) => saveFeedbackFile($, fb),
    openEmailDraft: () => openEmailDraft($),
    copyText: (text, done) => copyText($, text, done),
    copyReport: (surface) => copyReport($, surface),
    FeedbackView: (c) => FeedbackView($, c),
    goStep: (id) => goStep($, id),
    railItems: (c, cur) => railItems($, c, cur),
    StepBar: (c, cur) => StepBar($, c, cur),
    NoticeSlot: (c, cur) => NoticeSlot($, c, cur),
    StepFooter: (c, cur) => StepFooter($, c, cur),
    WsMap: (c) => WsMap($, c),
    toChat: (skill, args, note, lead) => toChat($, skill, args, note, lead),
    copyHandoff: () => copyHandoff($),
    HandoffCard: (c) => HandoffCard($, c),
    discoverInChat: () => discoverInChat($),
    planInChat: (id, revise, lead, mode, where) => planInChat($, id, revise, lead, mode, where),
    debriefInChat: (x) => debriefInChat($, x),
    openSection: (key, group) => openSection($, key, group),
    Signpost: (c, eyebrow, title, text, key, label, step, forStep) => Signpost($, c, eyebrow, title, text, key, label, step, forStep),
    WsWelcome: (c) => WsWelcome($, c),
    seeIdeas: () => seeIdeas($),
    WsDiscover: (c) => WsDiscover($, c),
    IdeaCard: (c, i, opts) => IdeaCard($, c, i, opts),
    keepOffer: () => keepOffer($),
    openIdea: (k) => openIdea($, k),
    backToGarden: () => backToGarden($),
    OfferPreview: (c, i, half, tags) => OfferPreview($, c, i, half, tags),
    WsGarden: (c) => WsGarden($, c),
    WsOffer: (c) => WsOffer($, c),
    WsDirection: (c) => WsDirection($, c),
    wsUseOffer: (id, grow) => wsUseOffer($, id, grow),
    WsPlan: (c, id) => WsPlan($, c, id),
    ContextLine: (c, o) => ContextLine($, c, o),
    WsFirst10: (c, b, o, decide) => WsFirst10($, c, b, o, decide),
    F10Toolkit: (c, b, out, list) => F10Toolkit($, c, b, out, list),
    writeCallGuide: (place) => writeCallGuide($, place),
    writePostBrief: (i, place, fresh) => writePostBrief($, i, place, fresh),
    writeAllBriefs: (place) => writeAllBriefs($, place),
    writeCards: () => runSubstackCards($),
    finishStrategy: () => finishStrategy($),
    changePostIdea: (i) => changePostIdea($, i),
    seeGuide: (view, at) => seeGuide($, view, at),
    GuideCallout: (c) => GuideCallout($, c),
    CallGuide: (c, b, out, list, opts) => CallGuide($, c, b, out, list, opts),
    saveMessageEdit: (slot, key) => saveMessageEdit($, slot, key),
    MessageArea: (c, x) => MessageArea($, c, x),
    WsPerson: (c, b, o, slot) => WsPerson($, c, b, o, slot),
    keepSubstackFocus: () => keepSubstackFocus($),
    Tiles: (c, groups) => Tiles($, c, groups),
    openPost: (i) => openPost($, i),
    backToStrategy: () => backToStrategy($),
    CopyArea: (c, key, text, label, bg) => CopyArea($, c, key, text, label, bg),
    SsSection: (c, id, preview, body) => SsSection($, c, id, preview, body),
    WsSubstack: (c, b, o) => WsSubstack($, c, b, o),
    WsPost: (c, b, o, i) => WsPost($, c, b, o, i),
    WhatNextPlan: (c, id, b, o, otherDone) => WhatNextPlan($, c, id, b, o, otherDone),
    WsTest: (c) => WsTest($, c),
    OffersList: (c) => OffersList($, c),
    switchOffer: (id) => switchOffer($, id),
    addAnotherOffer: () => addAnotherOffer($),
    openOfferStep: (id, step) => openOfferStep($, id, step),
    WsPortfolio: (c) => WsPortfolio($, c),
    openSpaceStep: (sid, step) => openSpaceStep($, sid, step),
    openPerson: (offerId, slot) => openPerson($, offerId, slot),
    spaceNext: (work, sid) => spaceNext($, work, sid),
    WsSpaces: (c) => WsSpaces($, c),
    WsSpace: (c) => WsSpace($, c),
    WsPeople: (c) => WsPeople($, c),
    WsFinish: (c) => WsFinish($, c),
    DesignCheck: (c) => DesignCheck($, c),
    ArtworkGallery: (c) => ArtworkGallery($, c),
    WsRender: (c) => WsRender($, c),
    render: (c) => render($, c),
    homeMove: (c) => homeMove($, c),
    WsHome: (c) => WsHome($, c),
    discoverMove: (c) => discoverMove($, c),
    WsTheme: (c) => WsTheme($, c),
    useSubstackName: (name) => useSubstackName($, name),
    isCustomerWorkspace: () => isCustomerWorkspace($),
    supportReport: () => supportReport($),
    withLeft: (out) => withLeft($, out),
    guardFile: (e, next) => guardFile($, e, next),
    guardRead: (e, next) => guardRead($, e, next),
    passOn: (e, next) => passOn($, e, next),
  }
}
function v2kit($, c) {
  return {
    c, E: c.E, work: c.work, ui: c.ui, nav: c.nav, px: c.px, colPx: c.colPx || c.px, wide: (c.colPx || c.px) >= 480,
    fn: v2fn(), act: v2act($), FONTS, PHOTO, U: U2, T: U2.T, strategy: (b) => strategyState(b),
    // the step title in Cormorant, and Gabriela's margin note in Cormorant italic
    title: (text, size) => StepTitle(c, text, size),
    note: (text) => Note(c, text),
    // which view of a step is showing (7.4), remembered across visits
    view: (step, first) => c.ui?.view?.[step] || first,
    setView: (step, id) => update($, uiA, (u) => ({ ...u, view: { ...(u.view || {}), [step]: id } })),
    // a "Show all" or open-in-place switch, kept in ui
    flag: (key) => Boolean(c.ui?.flags?.[key]),
    toggle: (key) => update($, uiA, (u) => ({ ...u, flags: { ...(u.flags || {}), [key]: !u.flags?.[key] } })),
    scrollTo: async (key) => { try { await $.ui.scroll({ to: { key }, in: PANE, block: 'start' }) } catch (e) {} },
  }
}
// The step title (7.1) in Cormorant, falling back to native text without Svg.
function StepTitle(c, text, size) {
  const sz = size || (c.px >= 420 ? 28 : 24)
  if (!c.E.Svg) return <c.E.Text key="ws-title-native" size="title" weight="semibold" color={V.heading} wrap="wrap">{String(text)}</c.E.Text>
  const w = Math.min(c.px, 640)
  return <c.E.Svg key="ws-title" source={serifTitleSvg(text, { px: w, fonts: FONTS, size: sz })} alt={String(text)} />
}
// "Use this name" (Substack masthead): the chosen name, saved on the Substack.
async function useSubstackName($, name) {
  const n = String(name || '').trim()
  if (!n) return
  await mutate($, (w) => {
    const b = w.builders?.substack
    if (!b) return
    b.chosenName = n
    w.events.unshift({ at: now(), text: `Chose a name for your Substack: ${n}.` })
  }, [])
  await setUi($, { notice: `Saved: your Substack is called ${n}${/[.!?]$/.test(n) ? '' : '.'}` })
}

// ---------- the bar above the message box ----------
function bandSummary(work) {
  if (!work) return 'Open your workspace'
  if (work.discover?.status !== 'done') {
    const p = discoverProgress(work)
    if (p.hasDirections) return 'Discover: your portfolio garden is ready'
    const n = THEMES.find((t) => t.id === p.next)
    return `Discover: ${p.done} of ${p.total} saved${n ? ` · next: ${n.short}` : ''}`
  }
  const flagged = Object.values(work.builders || {}).filter((b) => b?.review?.state === 'suggested').length
  if (flagged) return `${flagged} suggested update${flagged === 1 ? '' : 's'} to review`
  const done = BUILDERS.filter((b) => builderStatus(work, b.id) === 'done').length
  return `${done} of 10 builders done`
}

// ======================================================================
// what the assistant knows in a customer's session
// ======================================================================

const CUSTOMER_GUIDE = `This session is a customer's Uncapped workspace (Uncapped by Pivot School, a portfolio career builder). The person is a customer building their career and income streams, not a developer.

Where things are:
- The Uncapped panel sits beside this chat. The person opens it with the "Open Uncapped" button in the bar above the message box, or by typing /uncapped, or by sending "Open Uncapped" as a message. In a brand-new chat nothing from Uncapped appears until a first message is sent. You can't open or click it for them; if they can't see it, tell them those ways.
- Panel screens: Home opens first once Discover has started, with their next move, their numbers and their offers. The steps are listed down the left (or under "All steps" when the panel is narrow): 1 Discover (each saved answer, with Open for the full answer; no answer boxes), 2 Your offer (their Portfolio Garden in three views, Your pick, All ideas and Ways to earn, grouped by five ways to earn; "See this offer" on each idea, "Start with this offer" on its page, then "Build your First 10 plan" and "Build your Substack strategy" under Your starting offer, and "Not quite right?"), 3 First 10 Customers (their list of ten, each person's page with their message, and a Toolkit with the call guide) and 4 Substack (while a new strategy is being written, about 12 minutes, only its progress, or Finish my strategy if it stopped; once all ten cards are done: Next post; Posts, where each of the ten posts is a card they open for who it's for, what they're stuck on, where the offer comes in, the idea, how it unfolds, what research adds, what's from them, what they'll need to add, and how it ends, with Plan this post for a line-by-line writing plan and Change this idea to change it with you; Strategy, with their publication and the footer for every post; and Growth), Your test (first move, messages, conversation guide, what happened), Your map, and Updates & help. Updates & help and Feedback are also at the bottom of every screen. Choosing an offer shows it as their starting offer, with its two plans to build.
- The chat is the one place to answer questions: the Discover interview and its follow-ups (/uncapped:discover), each plan's questions (/uncapped:plan), refining the garden when no idea fits (/uncapped:refine), adding an idea of their own (/uncapped:idea), writing their first messages to the people on their list (/uncapped:plan … (write my first messages)), and the debrief of a test (/uncapped:debrief). The panel shows what's saved, where they are and what's next, and holds their decisions (choosing a working offer, marking a contact).
- Corrections belong to the shared record: whenever they correct something already saved (who they can work with, a contract restriction, hours, what they want), save it at once with save_discover_answer (how "add", or "replace" if the old answer is wrong), keep anything they still describe as unresolved, and confirm in plain words ("I've updated your answer. Schools are in scope."). If it changes their ideas, offer to regrow the garden with build_directions; their working offer and plans stay until they choose another idea in the panel.
- Speak as Gabriela coaches: American English, warm and direct, with an opinion. Notice the detail they nearly skipped over and say why it caught your attention, then give them one next move small enough for this week. In chat, give your read and ask one useful question. Every claim about demand is tied to evidence.
- Plain words: start with what they need to know or do, one idea per sentence, and say who does what, when and why, in words they'd use out loud. Name the actual action instead of a marketing phrase ("invite trainers to bring the emails they already send to a 20-minute call", never "position your offer" or "build a pipeline"). Say which parts they told you, which are your guess, and which they still need to test. If a sentence needs a paragraph to explain it, rewrite the sentence.
- Their portfolio: once they choose a second offer, the panel shows Your portfolio (the offers they're focusing on, how they work together, and the outreach for each). Offers are grouped into spaces by who they're for: each space has its own outreach, tests and Substack, and the panel lists everyone they're talking to across all their offers. When they add an offer, say in two or three sentences how it fits with the others and save it with save_portfolio, and say which space it belongs in (save_space moves it or starts a new one). Every plan has its own place: building one never replaces or mixes with another.
- After their first messages, tell them what to bring back: what they sent and what came back (silence too), and the messy notes from any call. "Report back in the chat" on First 10 Customers and "Report what happened in the chat" on their test bring them to you (/uncapped:debrief).
- Never tell the person to find a field or button that isn't in that list.

Saving:
- Their work is saved only through the uncapped tools: get_status, save_discover_answer, save_week, save_starting_point, build_directions, build_plan, save_writing_material, build_post_brief, change_post_idea, write_post_cards, save_first_message, add_idea, save_portfolio, get_work, list_tests, plan_test, record_findings, decide, save_research, support_report, check_for_updates, prepare_feedback, open_feedback_draft.

Tests and findings:
- Every offer is a guess to test until buyers confirm it. Packaging or launching it doesn't prove demand; never call anything "validated".
- When they mention what happened with buyers ("I've had three calls", "someone bought it", "nobody replied"), use record_findings with their words. If it's unclear which test, ask. Then share the tentative reading and ask what they want to decide; only then use decide. A reading is never a decision.
- Findings go in here in the chat, with record_findings. The panel shows their test under Your test, with its first move, messages and conversation guide.
- For research on comparable offers, creators or businesses: search public sources, link every source, separate what a page says from what you infer, say when a site couldn't be read (LinkedIn and Instagram often need a login), never treat followers or engagement as proof of sales, and save what's useful with save_research. Never publish anything or change their external profiles or websites. The panel uses the same save path, so whatever you save appears there straight away.
- Tell them exactly what each tool returned. "Saved: ..." means saved. "Needs clarification" means ask the question it gives you, naturally, then save again. "Couldn't save" means say so plainly; their work is unchanged. Never say something was saved unless a tool said so.
- Never edit files in my-work yourself, and never edit, inspect or run Uncapped's own files, tools or code.

When they ask you to fix, change or update something: it means their answers, offers or generated assets. If it's ambiguous, ask which. If Uncapped itself seems broken (a screen missing, a tool failing), don't investigate or patch it: keep their work safe, explain what happened in plain words, and offer to make a support report with support_report. Fixes arrive only as official updates from Pivot School: when one is ready, an "Update to" button shows in the bar above the message box. They can also press Updates & help in the panel, then Check for updates, type /uncapped-update, or ask you and you use check_for_updates.

When they say "I need help" or "I'm stuck": ask, briefly and warmly, whether they want help with their own work (their answers, offer, buyers, an asset) or want to tell Gabriela about a problem with Uncapped. For their work, help directly. For Uncapped, use prepare_feedback, show them the report, and only after they confirm use open_feedback_draft. A draft is never "sent": they send it from their email app. The panel's "Feedback" button, at the bottom of every screen, does the same.`

// What Claude reads beside "Open Uncapped": answer in a line or two, pointing
// at the panel's next step, and start nothing.
function openedNote(work) {
  const fresh = !(discoverProgress(work).done > 0)
  const step = fresh
    ? 'They haven\'t started yet: the next step is the "Start Discover" card in the panel. Its button is "Start Discover in the chat", or they can simply say "start" here.'
    : 'Point them to the yellow "Your next move" card in the panel.'
  return `The Uncapped panel has just opened beside this chat, because they sent "Open Uncapped". Reply with one or two short, warm sentences and nothing else: say the panel is open beside the chat and name the next step. ${step} Don't call any tools, and don't start Discover or ask a question until they say so.`
}

async function isCustomerWorkspace($) {
  try { return await $.fs.exists(FILES.marker) } catch (e) { return false }
}

function productPath(p) {
  const s = String(p || '')
  if (!s) return false
  return s.startsWith(String($root)) || /\/\.claude\/plugins\//.test(s) || /\/plugins\/(cache|marketplaces)\//.test(s)
}
let $root = ''

function methodPath(p) {
  return $root && String(p || '').startsWith(`${$root}/method/`)
}

const NOT_PRODUCT = "That file is part of Uncapped itself, not your work, so I can't change or inspect it from here. If something isn't working, I can make a support report for Pivot School, and fixes arrive as official updates."
const NOT_DIRECT = "Your Uncapped work is saved through Uncapped's own save tools, so the old version is kept and anything that depends on it gets flagged. I'll use those instead of editing the file directly."

// ---------- support report ----------
async function supportReport($) {
  const w = await read($, workA)
  const ui = await read($, uiA)
  const v = await $.session.version().catch(() => ({}))
  const t = now()
  const lines = [
    '# Uncapped support report',
    `Made: ${t}`,
    `Uncapped: ${ui.version}`,
    `Claude Code: ${v?.version || 'unknown'}`,
    `Saved work format: ${w?.schema ?? 'none'}, last saved with Uncapped ${w?.updatedWith || 'unknown'}`,
    `Read-only: ${ui.readOnly ? 'yes' : 'no'}`,
    `Discover: ${w ? JSON.stringify(discoverProgress(w).states) : 'no work'}`,
    `Builders: ${w ? BUILDERS.map((b) => `${b.id}=${builderStatus(w, b.id)}`).join(', ') : ''}`,
    `Last error shown: ${ui.error || 'none'}`,
    `Recent errors: ${(w?.errors || []).slice(0, 10).map((x) => `${x.at} ${x.text}`).join(' | ') || 'none'}`,
    '',
    'This report contains no answers or results. Send it to Pivot School with a note on what you were doing.',
  ]
  const path = `my-work/support/uncapped-support-${t.replace(/[:.]/g, '-').slice(0, 19)}.md`
  await $.fs.write(path, lines.join('\n'))
  await setUi($, { support: `Saved as ${path}. Send it to Pivot School with a note on what you were doing.`, supportPath: path, supportText: lines.join('\n') })
  return path
}
// The support report, as an email draft to Gabriela in their own email app. Nothing is sent until they press Send.
async function emailSupport($) {
  const u = await read($, uiA)
  const body = `${u.supportText || ''}\n\nWhat I was doing when it went wrong:\n\n`
  const url = `mailto:${FEEDBACK_TO}?subject=${encodeURIComponent('Uncapped support report')}&body=${encodeURIComponent(body)}`
  try {
    const r = await $.process.run(['/usr/bin/open', url], { timeoutMs: 15000 })
    await setUi($, { notice: r.exitCode === 0 ? 'Your email draft is open. Add a line on what you were doing, then press Send. Nothing is sent until you do.' : `Couldn't open your email app. Email ${FEEDBACK_TO} and attach the report from your Uncapped folder (my-work, then support).` })
  } catch (e) {
    await setUi($, { notice: `Couldn't open your email app. Email ${FEEDBACK_TO} and attach the report from your Uncapped folder (my-work, then support).` })
  }
}
// Shows the saved report in Finder, selected.
async function revealSupport($) {
  const u = await read($, uiA)
  const abs = `${String(u.cwd || '').replace(/\/+$/, '')}/${u.supportPath || 'my-work/support'}`
  try {
    const r = await $.process.run(['/usr/bin/open', '-R', abs], { timeoutMs: 15000 })
    if (r.exitCode !== 0) throw new Error(r.stderr || 'open failed')
  } catch (e) {
    await setUi($, { notice: 'Open your Uncapped folder, then my-work, then support: the report is the newest file there.' })
  }
}

// How much of Discover is left, in words a person would use.
function questionsLeft(p) {
  if (p.hasDirections) return ''
  if (p.ready) return 'No questions left: you have enough for your first ideas.'
  if (p.left > 0) return `About ${p.left} ${p.left === 1 ? 'question' : 'questions'} to go, then maybe a follow-up or two before your first ideas.`
  return 'A follow-up or two, then your first ideas.'
}
function statusText(w) {
  if (!w) return 'There is no Uncapped work in this folder yet. Ask the person to press "Open Uncapped" above the message box (or type /uncapped) and choose "Use this folder for Uncapped".'
  const p = discoverProgress(w)
  const cur = w.profile?.limits?.currency || '$'
  const lines = [`Name: ${w.profile?.name || '(not saved)'}`, `Discover: ${p.done} of ${p.total} themes saved. Directions grown: ${p.hasDirections ? 'yes' : 'no'}. Discover status: ${w.discover?.status}.`]
  for (const t of THEMES) {
    const prev = themePreview(w, t.id)
    lines.push(`- ${t.id} (${t.label}): ${p.states[t.id]}${prev ? ` | "${prev.slice(0, 160)}"` : ''}`)
  }
  lines.push(`Next to ask: ${p.next ? `${p.next} (${THEMES.find((t) => t.id === p.next).label})` : 'nothing missing'}`)
  if (questionsLeft(p)) lines.push(`Questions left (tell them, in a few words): ${questionsLeft(p)}`)
  lines.push(`Ready for the portfolio garden: ${p.ready ? (p.provisional ? `yes. The interview has not judged that it knows enough about them${p.aboutYou.length ? `; only they can tell: ${p.aboutYou.join('; ')}` : ''}. Offer to call build_directions, and say the garden will name anything about them that could still change it. Never call the directions provisional because demand is unproven: testing buyers comes after` : 'yes, offer to call build_directions') : `no${p.missing.length ? `, missing: ${p.missing.join(', ')}` : ''}${p.thin.length ? `, thin: ${p.thin.join(', ')}` : ''}${p.coreDone && !p.thin.length ? ', ask one or two follow-ups where answers sounded promising, saving each with how="add" and depth="enough"' : ''}`}`)
  const o = activeOffer(w)
  if (o) lines.push(`Offer the builders use: ${o.name} (${priceText(o, cur)})`)
  lines.push(`Builders: ${BUILDERS.map((b) => `${b.num} ${b.id} ${builderStatus(w, b.id)}`).join('; ')}`)
  return lines.join('\n')
}

// A save in Discover ends with how many questions are left, so the chat can tell them.
async function withLeft($, out) {
  const w = await read($, workA)
  const left = w && /^Saved/.test(String(out?.result || '')) ? questionsLeft(discoverProgress(w)) : ''
  return left ? { result: `${out.result} Questions left: ${left}` } : out
}
function reply(r) {
  return { result: r.status === 'needs_clarification' ? `Needs clarification: ${r.message}` : r.status === 'saved_partly' ? `${r.message} Needs clarification: ${r.asks.join(' ')}` : r.status === 'saved' ? r.message : r.status === 'empty' ? `Nothing saved: ${r.message}` : `Couldn't save: ${r.message}` }
}

function failed() {
  return { result: "Couldn't save: Uncapped hit a problem, and nothing was changed. You can offer a support report." }
}

async function guardFile($, e, next) {
  if (!(await isCustomerWorkspace($))) return next(e)
  const p = e.file_path || e.notebook_path || e.path
  if (productPath(p)) return { deny: NOT_PRODUCT }
  if (/my-work\/(uncapped\.json|\.uncapped\.previous\.json)$/.test(String(p || ''))) return { deny: NOT_DIRECT }
  return next(e)
}

async function guardRead($, e, next) {
  if (!(await isCustomerWorkspace($))) return next(e)
  const p = e.file_path || e.path
  if (productPath(p) && !methodPath(p)) return { deny: NOT_PRODUCT }
  return next(e)
}

function passOn($, e, next) {
  return next(e)
}

// ======================================================================
// register
// ======================================================================

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    $root = $.plugin.root
    // A failure here is shown in the panel, never a blank panel.
    try { await boot($) } catch (err) { await update($, uiA, (u) => ({ ...INITIAL_UI, ...(u || {}), ws: 'error', bootError: String(err?.message || err).slice(0, 300) })) }
    void $.ui.open({ id: PANE, title: 'Uncapped', backgroundColor: C.cream, columns: 120 })
    try { await $.agent.register({ name: 'researcher', description: 'Researches one Uncapped portfolio-garden direction from public sources. Started by the Uncapped panel only.', prompt: researchSystem(SAVE_RESEARCH), tools: ['WebSearch', 'WebFetch', SAVE_RESEARCH], model: 'sonnet', effort: 'medium', maxTurns: 16 }) } catch (err) {}
    try { await $.agent.register({ name: 'post-researcher', description: "Finds cultural moments and real pieces to read for an Uncapped customer's Substack posts. Started by the Uncapped panel only.", prompt: postResearchSystem(), tools: ['WebSearch', 'WebFetch'], model: 'sonnet', effort: 'medium', maxTurns: 60 }) } catch (err) {}
    // The planting stop-motion: one frame a second, only while the garden grows.
    $.clock.every(1000, async () => {
      const u = await read($, uiA)
      if (gardenGrowing(u)) await update($, uiA, (x) => (gardenGrowing(x) ? { ...x, plantFrame: ((x.plantFrame || 0) + 1) % 4 } : x))
    })
    // Every 5 seconds, and only while a request runs: fewer redraws under the cursor.
    $.clock.every(5000, async () => {
      const u = await read($, uiA)
      if (u?.op?.status === 'running') {
        const t = await $.clock.now()
        await update($, uiA, (x) => (x.op?.status === 'running' ? { ...x, op: { ...x.op, elapsed: Math.round((t - x.op.startedAt) / 1000) } } : x))
      }
    })
    const tools = [
      { name: 'get_status', description: "Returns where the person is in Uncapped: every Discover theme with its state and a preview of what they said, the next theme to ask about, whether there's enough for their portfolio garden, and the builders' progress. Call it first in any Discover conversation, and whenever you need to know what's saved.", inputSchema: { type: 'object', properties: {} } },
      { name: 'save_discover_answer', description: "Saves the person's answer to one Discover theme, in their own words, exactly as the panel does. theme is one of: now, led, askedFor, know, outside, try, buyers. Use how='add' to add a follow-up detail to what's already saved, how='replace' when they give a new answer. depth='enough' when the answer gives enough to work with, 'thin' when it needs a follow-up. summary: the whole of what's saved for this theme, after this answer, in 90 characters or fewer and in their words where you can (for example 'Marketer at a gym group, across organic, paid and email'); the panel shows it as the theme's one-line summary. Returns 'Saved: ...' or why not.", inputSchema: { type: 'object', properties: { theme: { type: 'string', enum: ['now', 'led', 'askedFor', 'know', 'outside', 'try', 'buyers'] }, answer: { type: 'string' }, how: { type: 'string', enum: ['replace', 'add'] }, depth: { type: 'string', enum: ['enough', 'thin'] }, summary: { type: 'string' }, name: { type: 'string', description: 'Their first name, if they told you.' } }, required: ['theme', 'answer'] } },
      { name: 'save_starting_point', description: "Saves where the person is starting from: none (no business idea yet), several (a few possibilities), existing (already sells something), explore (wants to explore something they haven't done professionally). details: anything they already have in mind, in their words.", inputSchema: { type: 'object', properties: { kind: { type: 'string', enum: ['none', 'several', 'existing', 'explore'] }, details: { type: 'string' }, name: { type: 'string' } }, required: ['kind'] } },
      { name: 'save_week', description: "Saves the practical part of Discover in the person's own words: hours ('about eight', '8-10', '20 a month'), income ('£3k a month', '3000 GBP', '36000 a year'), currency ('GBP', 'pounds', '$'), goal ('adding to my salary', 'replace it one day'), and energy lists more, less, never (comma-separated). Send only what they said. It saves what is clear and returns a natural question for anything that isn't, which you should ask. Tell them the 'Saved: ...' lines it returns.", inputSchema: { type: 'object', properties: { hours: { type: 'string' }, income: { type: 'string' }, currency: { type: 'string' }, goal: { type: 'string' }, more: { type: 'string' }, less: { type: 'string' }, never: { type: 'string' } } } },
      { name: 'build_plan', description: `Builds and saves the person's First 10 Customers plan (builder "first10") or Substack strategy (builder "substack") for their working offer, from answers they gave you in this chat, and shows it in the Uncapped panel. First 10 Customers takes about two minutes. A Substack strategy is written in the panel in about 12 minutes (research into their field, ten posts, research for each post, then every card written and checked) and appears there complete; nothing is shown before. Before building a Substack strategy, follow the plan skill's story and perspective step and save what they tell you with save_writing_material. Ask the plan's questions first, one per message, skipping any already saved (get_work shows builders.sales.answers and builders.substack.answers). First 10 Customers asks: ${planQuestions('sales')}. Substack asks: ${planQuestions('substack')}. Pass their answers in their own words, keyed by those ids. For Substack, voice is the short voice profile you reflected back, as they corrected it; examples are up to three public Substacks you opened and read with them in this chat ({name, url, study: what's worth studying in it for them, angle: where they could take a different angle}), never a guessed link. fresh=true makes a new version when the answers are unchanged. offer: for First 10 Customers, the offer it's for (its name), when it isn't the one they're on now. space: for Substack, the space it's for (its name, from get_work's spaces), when it isn't the space of the offer they're on now. Each space has its own Substack strategy and its own answers: building one never changes another.`, inputSchema: { type: 'object', properties: { builder: { type: 'string', enum: ['first10', 'substack'] }, offer: { type: 'string' }, space: { type: 'string' }, answers: { type: 'object', additionalProperties: { type: 'string' } }, examples: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, url: { type: 'string' }, study: { type: 'string' }, angle: { type: 'string' } } } }, fresh: { type: 'boolean' } }, required: ['builder', 'answers'] } },
      { name: 'save_first_message', description: "Saves the first message the person will send to one person on their First 10 Customers list, once you've drafted it with them and they're happy with the words. person: the name, initials or label on their list; or slot: the person's number on the list. message: the whole message, exactly as they'll send it. name: if that person is only described on their list (\"the first client who asked about pricing\") and they've told you who it is, their name or initials, so the panel shows it from now on. offer: the offer whose list this person is on, when it isn't the one they're on now. Use it for a follow-up or any later message to someone on their list too: earlier messages stay on that person's record, marked sent or not. It's shown on that person's record in the panel, ready to copy. Returns 'Saved: ...' with how many first messages are written, or what to ask.", inputSchema: { type: 'object', properties: { person: { type: 'string' }, slot: { type: 'number' }, offer: { type: 'string' }, message: { type: 'string' }, name: { type: 'string' } }, required: ['message'] } },
      { name: 'add_idea', description: "Adds the person's own idea to their portfolio garden as a possibility to test, marked as theirs, without regrowing anything else. Shape it with them first. name: a recognizable offer in a line. lens: do it for them | do it with them | teach them how | publish or package it. buyer: who might buy it. how: one sentence on how it would work. price: a rough price to test, said as a hypothesis, or empty. direction: the id of the existing direction it belongs to (from get_work), or empty for a new area, then area: 2 to 4 words naming the kind of work. Returns 'Added: ...'.", inputSchema: { type: 'object', properties: { name: { type: 'string' }, lens: { type: 'string', enum: ['do it for them', 'do it with them', 'teach them how', 'package it', 'publish it', 'publish or package it'] }, buyer: { type: 'string' }, how: { type: 'string' }, price: { type: 'string' }, direction: { type: 'string' }, area: { type: 'string' } }, required: ['name', 'lens'] } },
      { name: 'save_portfolio', description: "Saves your read on how the offers they're focusing on work together, shown in the panel under Your portfolio: two or three sentences in Gabriela's voice saying which offer people would start with, which is for those who want more, and why the order makes sense for this person. Call it when they add a second offer, or when the fit changes. Returns 'Saved: ...'.", inputSchema: { type: 'object', properties: { story: { type: 'string' } }, required: ['story'] } },
      { name: 'build_post_brief', description: "Writes the full brief for one post in their Substack strategy and shows it in the panel: the idea and why someone would click, where to open, the story beat by beat with the material written out, what would make it sound like them, and where to land it. The panel also writes a post's brief the first time they open it. post: the post's number in their plan (1 for the first). fresh=true writes a new version of a brief they already have. Takes about a minute.", inputSchema: { type: 'object', properties: { post: { type: 'number' }, fresh: { type: 'boolean' } }, required: ['post'] } },
      { name: 'build_call_guide', description: "Writes the research call guide for the First 10 Customers plan of the offer they're on: an opener, up to four questions and a close for talking to a potential client, and the same for someone who knows their clients, shown in the panel under See what to ask. Call it when save_first_message says their first two messages are saved, or when they ask how to prepare for their calls. Takes about a minute. Returns 'Saved: ...'.", inputSchema: { type: 'object', properties: {} } },
      { name: 'save_space', description: "Names or regroups the person's spaces. A space holds the offers for one kind of buyer (all their offers for personal trainers, say), shown in the panel under Your portfolio, and each space has its own Substack strategy. When they add an offer, say in one sentence which space you'd put it in and why, then call this if it should move: offer + space to move it in with offers for the same buyer, or offer + new_space (a short name for who it's for, e.g. 'Balcony growers in London') when it's for a very different buyer. space + name renames a space. Moving an offer never deletes a plan. Returns 'Saved: ...'.", inputSchema: { type: 'object', properties: { offer: { type: 'string' }, space: { type: 'string' }, new_space: { type: 'string' }, name: { type: 'string' } } } },
      { name: 'build_directions', description: "Grows the person's portfolio garden from everything saved: several directions with buyers, problems, prices to test and first steps, shown in the panel under Your offer. Takes up to 6 minutes. Call it only when get_status says they're ready, or they ask for directions anyway. Returns a short summary.", inputSchema: { type: 'object', properties: {} } },
      { name: 'get_work', description: "Returns a summary of the person's saved Uncapped work as JSON: profile, Discover answers and garden ideas, their offers (focus: the ones they're working on), their portfolio, each plan's saved answers, their First 10 list (who, which batch, whether a first message is written), their Substack in brief, and their tests. part: \"sales\" or \"substack\" (or another builder) returns that plan in full, with its answers and record; with part \"substack\", space picks which space's strategy. spaces lists their spaces: the offers in each, and whether it has a Substack yet. Use it before answering questions about their offer, buyers, pricing or next steps. Never read their files directly.", inputSchema: { type: 'object', properties: { part: { type: 'string' }, space: { type: 'string' } } } },
      { name: 'check_for_updates', description: "Gets the newest version of Uncapped from Pivot School and installs it, backing up their work first. Use it when they ask to update Uncapped or get the latest version. Afterwards tell them in plain words what it said; a new version is used from the next new chat in this folder.", inputSchema: { type: 'object', properties: {} } },
      { name: 'support_report', description: "Writes a support report (Uncapped version, what's broken, no answers) into my-work/support for the person to send to Pivot School. Use it when Uncapped itself isn't working.", inputSchema: { type: 'object', properties: {} } },
      { name: 'list_tests', description: "Lists the person's tests (experiments) with their status, findings count and review date.", inputSchema: { type: 'object', properties: {} } },
      { name: 'plan_test', description: "Plans a small experiment for an offer or a Discover direction: the key uncertainty, a test that fits their week and buyer access, outreach messages, a conversation guide, what to record, and what would support or weaken it. Shown in the panel under Your test. what: the offer or direction name (blank for their current offer). unsure_about: what they're least sure of, in their words, if they said.", inputSchema: { type: 'object', properties: { what: { type: 'string' }, unsure_about: { type: 'string' } } } },
      { name: 'record_findings', description: "Saves what happened in a test from the person's rough words (\"I've had three calls\", \"someone bought it\", \"nobody replied\", pasted replies), organized into what happened, their exact words, their interpretation and what's unknown, then reads it carefully. test: which test, if they said; if it's unclear you get a question to ask. Returns what was saved and a tentative reading. Nothing about their offer changes until they decide.", inputSchema: { type: 'object', properties: { test: { type: 'string' }, notes: { type: 'string' }, who: { type: 'string' } }, required: ['notes'] } },
      { name: 'decide', description: "Records the person's decision about a test after they've seen the reading: continue, revise_buyer, revise_problem, change_offer, pilot or pause, with their reason. apply_change=true applies the reading's proposed change to their offer, which saves the old version and flags only the assets that described it. Only call it once they've clearly decided.", inputSchema: { type: 'object', properties: { test: { type: 'string' }, choice: { type: 'string', enum: ['continue', 'revise_buyer', 'revise_problem', 'change_offer', 'pilot', 'pause'] }, why: { type: 'string' }, apply_change: { type: 'boolean' } }, required: ['choice'] } },
      { name: 'save_research', description: "Saves research about one portfolio-garden direction (or a test): each source with its link, what the page says (fact), the kind of evidence, and the page's date if shown; plus what you infer and what still needs talking to buyers or a paid test. direction: the direction's id or title. Never save a source you didn't read.", inputSchema: { type: 'object', properties: { direction: { type: 'string' }, test: { type: 'string' }, topic: { type: 'string' }, items: { type: 'array', items: { type: 'object', properties: { kind: { type: 'string', enum: ['comparable', 'price', 'buyer-language', 'alternative', 'obstacle'] }, title: { type: 'string' }, url: { type: 'string' }, fact: { type: 'string' }, inference: { type: 'string' }, date: { type: 'string' } }, required: ['url', 'fact'] } }, inferences: { type: 'array', items: { type: 'string' } }, stillNeeds: { type: 'array', items: { type: 'string' } }, couldntRead: { type: 'array', items: { type: 'string' } }, implication: { type: 'string' } }, required: ['topic', 'items'] } },
      { name: 'save_writing_material', description: "Saves one story, observation or view the person gave you in the chat for their Substack strategy, in their own words, so it's never asked again and the strategy builds on it. Use it while you ask the plan skill's story and perspective questions, once for each answer worth keeping, before build_plan. kind: story | observation | opinion | disagreement | prediction | changed mind | why it matters. asked: the question you asked, as you asked it. answer: what they said, in their words. developed: what they added when you followed up: why (what led them to believe it), seen (what they've seen), disagree (who would disagree), limits (when it wouldn't apply). endorsed: true when it's something they said or confirmed as their own view or experience; false for an angle you proposed that they didn't confirm (the strategy won't treat it as theirs). item: the number of a saved item to update instead of adding one. Returns 'Saved: ...'.", inputSchema: { type: 'object', properties: { kind: { type: 'string', enum: ['story', 'observation', 'opinion', 'disagreement', 'prediction', 'changed mind', 'why it matters'] }, asked: { type: 'string' }, answer: { type: 'string' }, developed: { type: 'object', properties: { why: { type: 'string' }, seen: { type: 'string' }, disagree: { type: 'string' }, limits: { type: 'string' } } }, endorsed: { type: 'boolean' }, item: { type: 'number' } }, required: ['kind', 'answer'] } },
      { name: 'write_post_cards', description: "Finishes the person's Substack strategy if it stopped before all ten cards were written (the same as pressing Finish my strategy in the panel): does only what's missing, and the strategy appears in the panel when it's complete. Use it only when they say their strategy stopped or didn't finish.", inputSchema: { type: 'object', properties: {} } },
      { name: 'change_post_idea', description: "Changes the idea for one post in the person's Substack strategy, once they've agreed the new idea with you in the chat, then researches and writes its new card in the panel (about 3 minutes). post: the post's number. headline, subtitle: the new ones (a number, a confession, a name or a mild provocation; the subtitle adds the stakes). move: one of the twelve moves. angle: two to four flowing sentences, what the post is, the story or material at its centre and why a reader will care. type, status (ready | needs a detail | do this first) and needsFirst only if they change. Their other posts stay as they are.", inputSchema: { type: 'object', properties: { post: { type: 'number' }, headline: { type: 'string' }, subtitle: { type: 'string' }, move: { type: 'string' }, angle: { type: 'string' }, type: { type: 'string', enum: ['intro story', 'methodology', 'audience builder'] }, status: { type: 'string', enum: ['ready', 'needs a detail', 'do this first'] }, needsFirst: { type: 'string' } }, required: ['post', 'headline', 'angle'] } },
      { name: 'prepare_feedback', description: "Prepares a feedback report for Gabriela when the person wants to report a problem, says they're confused, or has an idea for Uncapped. Captures where they were in the panel and recent steps automatically (no answers). kind: broken, confused or idea. Send what they said in their words. Returns the full report: show it to them and ask them to confirm or edit before calling open_feedback_draft.", inputSchema: { type: 'object', properties: { kind: { type: 'string', enum: ['broken', 'confused', 'idea'] }, trying: { type: 'string' }, expected: { type: 'string' }, actual: { type: 'string' }, details: { type: 'string' }, reply_to: { type: 'string' } }, required: ['kind'] } },
      { name: 'open_feedback_draft', description: "Opens the prepared feedback report as a draft email to Gabriela in the person's own email app. Only call it after they've reviewed the report and said yes. The email is NOT sent until they press Send in their email app: say so.", inputSchema: { type: 'object', properties: {} } },
      { name: 'save_answer', description: 'Older name for save_discover_answer, kept so earlier conversations still work. question is one of: name, now, led, askedFor, outside, try, idea.', inputSchema: { type: 'object', properties: { question: { type: 'string', enum: ['name', 'now', 'led', 'askedFor', 'outside', 'try', 'idea'] }, answer: { type: 'string' } }, required: ['question', 'answer'] } },
    ]
    for (const t of tools) { try { await $.tool.register({ ...t, isDeferred: false }) } catch (err) {} }
    try {
      await $.command.register({ name: 'uncapped', description: 'Open your Uncapped workspace', immediate: true })
      await $.command.register({ name: 'uncapped-update', description: 'Check for a newer version of Uncapped from Pivot School' })
    } catch (err) {}
    // Is a newer Uncapped ready? Looked up in the background, never holding up the start.
    void Promise.resolve().then(() => noteLatest($)).catch(() => {})
    return next(e)
  })

  // ---- chat tools: every save goes through the same functions as the panel

  on('tool.call', { tool: 'mcp__uncapped__get_status' }, async ($) => {
    const w = await read($, workA)
    // The chat is starting or resuming Discover: the panel shows it as underway, wherever it was started.
    if (w && !w.discover?.early && !(await read($, uiA)).discoverLive) {
      await setUi($, { discoverLive: true })
      const n = await read($, navA)
      if (!w.onboarding?.seen || n.view === 'home') await go($, { view: 'discover', stage: 'overview' })
    }
    return { result: statusText(w) }
  }).catch(() => ({ result: "Couldn't read the saved work just now." }))

  on('tool.call', { tool: 'mcp__uncapped__save_discover_answer' }, async ($, e) => {
    if (e.name) await saveName($, e.name)
    const r = await saveTheme($, String(e.theme), e.answer, e.how === 'add' ? 'add' : 'replace', e.depth, 'chat')
    // The theme's one-line summary for the panel (hub design system 10.3).
    const sum = String(e.summary || '').trim().replace(/\s+/g, ' ')
    if (sum && r?.status !== 'empty') await mutate($, (w) => { w.profile.summaries = { ...(w.profile.summaries || {}), [String(e.theme)]: sum.slice(0, 120) } }, ['discover'])
    return withLeft($, reply(r))
  }).catch(failed)

  on('tool.call', { tool: 'mcp__uncapped__save_answer' }, async ($, e) => {
    if (e.question === 'name') return reply(await saveName($, e.answer))
    return reply(await saveTheme($, String(e.question), e.answer, 'replace', undefined, 'chat'))
  }).catch(failed)

  on('tool.call', { tool: 'mcp__uncapped__save_starting_point' }, async ($, e) => {
    if (e.name) await saveName($, e.name)
    return withLeft($, reply(await saveStartingPoint($, String(e.kind), e.details, 'chat')))
  }).catch(failed)

  on('tool.call', { tool: 'mcp__uncapped__save_week' }, async ($, e) => withLeft($, reply(await saveWeek($, e, 'chat')))).catch(failed)

  on('tool.call', { tool: 'mcp__uncapped__build_plan' }, async ($, e) => {
    const id = e.builder === 'substack' ? 'substack' : 'sales'
    // The offer (First 10) or space (Substack) it's for: opening it keeps every other plan where it is.
    const w0 = await read($, workA)
    const ask = id === 'sales' ? String(e.offer || '').trim() : String(e.space || '').trim()
    if (ask) {
      const sp = id === 'substack' ? spaceNamed(w0, ask) : null
      const want = id === 'sales' ? offerNamed(w0, ask) : sp ? (offersIn(w0, sp.id).find((x) => x.id === w0.activeOfferId) || offersIn(w0, sp.id)[0]) : null
      if (!want) return { result: `Needs clarification: which ${id === 'sales' ? 'offer' : 'space'}? ${id === 'sales' ? chosenOffers(w0).map((x) => `"${x.name}"`).join('; ') : spacesOf(w0).map((x) => `"${x.name}"`).join('; ')}` }
      if (want.id !== w0.activeOfferId) await mutate($, (w2) => activateOffer(w2, want.id), ['sales'])
    }
    const w = await read($, workA)
    const o = activeOffer(w)
    if (!o || o.status === 'idea') return { result: "There's no working offer yet, so there's nothing to plan for. Discover comes first, then they choose one offer in the panel's portfolio garden: \"See this offer\" on an idea, then \"Start with this offer\"." }
    const qs = BY_ID[id].questions || []
    const given = Object.fromEntries(Object.entries(e.answers || {}).map(([k, v]) => [k, String(v ?? '').trim()]).filter(([k, v]) => v && qs.some((q) => q.id === k)))
    const saved = w.builders?.[id]?.answers || {}
    const missing = qs.filter((q) => !q.optional && !(given[q.id] || String(saved[q.id] || '').trim()))
    if (missing.length) return { result: `Needs clarification: ask ${missing.map((q) => `"${q.q}"${q.options ? ` (${q.options.join(' / ')})` : ''}`).join(' and ')} first, then call build_plan again.` }
    await mutate($, (w2) => {
      // A Substack belongs to the working offer's space: open that space's strategy, keeping any other where it is.
      if (id === 'substack') { placeOffers(w2); activateSpace(w2, activeOffer(w2)?.spaceId) }
      const b = (w2.builders[id] = w2.builders[id] || { answers: {} })
      // A plan built for another offer is kept under that offer, never overwritten.
      if (id === 'sales' && b.output && b.basedOn?.offerId && b.basedOn.offerId !== o.id && b.keptFor !== o.id) { archivePlan(b, w2); b.output = null; b.tracker = {}; b.reviseFrom = null; b.keptFor = null }
      b.answers = { ...(b.answers || {}), ...given }
      if (id === 'substack' && Array.isArray(e.examples)) b.examples = e.examples.filter((x) => x && String(x.name || '').trim() && /^https?:\/\/\S+$/.test(String(x.url || '').trim())).slice(0, 4).map((x) => ({ name: String(x.name).trim(), url: String(x.url).trim(), study: String(x.study || '').trim(), angle: String(x.angle || '').trim() }))
      if (!b.status || b.status === 'not_started') b.status = 'in_progress'
    }, [id])
    await go($, { view: 'builder', builder: id, stage: 'result' })
    // A Substack strategy (12 Nov): written in the panel and shown only when all ten cards are checked.
    if (id === 'substack') {
      lastClaim = null
      const st = await startStrategy($, Boolean(e.fresh))
      const w4 = await read($, workA)
      const sp = spaceOf(w4, o)
      const inSp = sp ? offersIn(w4, sp.id) : [o]
      const others = spacesOf(w4).filter((x) => !sp || x.id !== sp.id)
      const forWhat = sp && spacesOf(w4).length > 1 ? `the space "${sp.name}" (${inSp.map((x) => `"${x.name}"`).join(', ')})` : inSp.length > 1 ? `all their offers (${inSp.map((x) => `"${x.name}"`).join(', ')})` : `"${o.name}"`
      if (st.state === 'running') return { result: `Their Substack strategy for ${forWhat} is already being written in the panel. Nothing new was started. It appears there, complete, when all ten cards are finished.` }
      if (st.state !== 'started' && st.state !== 'resumed') return { result: `Nothing new was started. ${notSent() || 'Uncapped is busy with something else just now.'} Their answers are saved; they can ask you again in a few minutes.` }
      return { result: `${st.state === 'resumed' ? 'Carrying on' : 'Started'}: the panel is now writing their Substack strategy for ${forWhat}. It researches their field, chooses ten posts with an editor's read, researches each post, then writes and checks every card: about 12 minutes${st.state === 'resumed' ? ' at most, doing only what was missing' : ''}. The panel shows its progress, and the whole strategy appears together when all ten cards are finished; nothing is shown before then. Tell them that in a sentence or two, without describing any posts: they can keep chatting here or close this chat, nothing is lost, and if it ever stops the panel shows one button, Finish my strategy.${others.length ? ` Their other space${others.length === 1 ? '' : 's'} (${others.map((x) => `"${x.name}"`).join(', ')}) keep${others.length === 1 ? 's' : ''} its own Substack, unchanged.` : ''}` }
    }
    const before = (await read($, workA)).builders?.[id]?.updatedAt || ''
    lastClaim = null
    await build($, id, `builder-${id}`, Boolean(e.fresh))
    const after = (await read($, workA)).builders?.[id]
    if (!after?.output || (after.updatedAt || '') === before) {
      if (notSent()) return { result: `Nothing new was sent to Claude. ${notSent()} If they want a new version from the same answers, call build_plan again with fresh: true.` }
      const u = await read($, uiA)
      return { result: `Couldn't build the plan: ${u.op?.error || u.error || 'something went wrong'}. Their answers are saved; they can ask you again.` }
    }
    const out = after.output
    const postsN = id === 'substack' ? subPieces(out).length : 0
    const briefsN = id === 'substack' ? subPieces(out).filter((_, k) => briefOf(out, k)).length : 0
    const briefLine = id !== 'substack' ? '' : isV3Strategy(out) ? ` The ten posts are chosen and showing in the panel under Posts. The panel is now researching each post and writing its full card, about 8 more minutes; each card appears as it's ready, and nothing is needed from them meanwhile. Tell them they can read the headlines now, that "Change this idea" on a card brings a post back here, and that a post's full brief is written when they press "Plan this post".` : briefsN === postsN ? ` Every one of the ${postsN} posts has its full brief.` : ` ${briefsN} of ${postsN} posts have their full brief; the others say so in the panel and can be written there.`
    return { result: id === 'sales'
      ? `Saved: their First 10 Customers plan for "${o.name}", in the panel. First move: ${out.firstMove?.who || 'the first person on their list'}. Their list has ${(out.list || []).length} places.`
      : (() => { const w4 = (after && w) || w; const sp = spaceOf(w4, o); const inSp = sp ? offersIn(w4, sp.id) : [o]; const others = spacesOf(w4).filter((x) => !sp || x.id !== sp.id); return `Saved: their Substack strategy for ${sp && spacesOf(w4).length > 1 ? `the space "${sp.name}" (${inSp.map((x) => `"${x.name}"`).join(', ')})` : inSp.length > 1 ? `all their offers (${inSp.map((x) => `"${x.name}"`).join(', ')})` : `"${o.name}"`}, in the panel. Write first: ${firstPost(out)}.${others.length ? ` Their other space${others.length === 1 ? '' : 's'} (${others.map((x) => `"${x.name}"`).join(', ')}) keep${others.length === 1 ? 's' : ''} its own Substack, unchanged.` : ''}${briefLine}` })() }
  }).catch(() => ({ result: "Couldn't build the plan just now. Their answers are saved." }))

  on('tool.call', { tool: 'mcp__uncapped__save_first_message' }, async ($, e) => {
    if (String(e.offer || '').trim()) {
      const w0 = await read($, workA)
      const want = offerNamed(w0, e.offer)
      if (!want) return { result: `Needs clarification: which offer's list? ${chosenOffers(w0).map((x) => `"${x.name}"`).join('; ')}` }
      if (want.id !== w0.activeOfferId) await mutate($, (w2) => activateOffer(w2, want.id), ['sales'])
    }
    const w = await read($, workA)
    const o = workingOffer(w)
    const b = o ? planFor(w, 'sales', o) : null
    if (!b) return { result: "There's no First 10 Customers plan for their working offer yet, so there's nowhere to save a message. Build the plan first." }
    const msg = String(e.message || '').trim()
    if (!msg) return { result: 'Needs clarification: the message is empty. Draft it with them first.' }
    const list = (b.output.list || []).map((p, i) => ({ p, i, key: keyOf(p, i), slot: slotOf(p, i) }))
    const savedBefore = draftsSaved(b)
    const norm = (x) => String(x || '').trim().toLowerCase()
    const q = norm(e.person)
    const hit = e.slot != null ? list.find((x) => Number(x.slot) === Number(e.slot)) : list.find((x) => [x.p.name, x.p.label, contactOf(b, x.key).found].some((n) => n && (norm(n) === q || norm(n).startsWith(q) || q.startsWith(norm(n)))))
    if (!hit) return { result: `Needs clarification: which person on their list? ${list.map((x) => `${x.slot}. ${personName(x.p, contactOf(b, x.key))}`).join('; ')}` }
    await mutate($, (w2) => {
      const b2 = w2.builders.sales
      const named = !hit.p.name && String(e.name || '').trim() ? { found: String(e.name).trim() } : {}
      const prev = contactRecord((b2.tracker || {})[hit.key])
      // A new message never replaces an earlier one: that stays on their record, with whether it was sent.
      const old = String(prev.draft || '').trim() && String(prev.draft).trim() !== msg ? [{ text: prev.draft, at: prev.draftAt || '', sentAt: prev.sent === 'sent' ? (prev.sentAt || prev.at || '') : '' }] : []
      b2.tracker = { ...(b2.tracker || {}), [hit.key]: { ...prev, ...named, draft: msg, draftAt: now(), drafts: [...old, ...(prev.drafts || [])].slice(0, 12) } }
    }, ['sales'])
    const w3 = await read($, workA)
    const batch = firstBatch(planFor(w3, 'sales', o))
    const done = batch.filter((x) => x.draft).length
    const next = batch.find((x) => !x.draft)
    await go($, { view: 'builder', builder: 'sales', stage: 'result' })
    // The second saved message is when they see what to ask on their calls.
    const saved = draftsSaved(w3.builders.sales)
    const guideNote = saved === 2 && savedBefore < 2
      ? (w3.builders.sales.output?.callGuide?.client
        ? ' Their call guide is in the plan. Tell them once, in these words: "Your first two messages are ready. I\'ve also put together the questions for your calls. Open See what to ask in your plan whenever you want to prep."'
        : ' Their first two messages are saved: call build_call_guide now, then tell them once, in these words: "Your first two messages are ready. I\'ve also put together the questions for your calls. Open See what to ask in your plan whenever you want to prep."')
      : ''
    return { result: `Saved: the first message for ${personName(hit.p, contactOf(w3.builders.sales, hit.key))}, on their record in the panel, ready to copy. First messages written: ${done} of ${batch.length}.${next ? ` Next: ${personName(next.p, contactOf(w3.builders.sales, next.key))}.` : ' That was the last of the first batch: the panel now points them to their Substack strategy.'}${guideNote}` }
  }).catch(() => ({ result: "Couldn't save the message just now. Nothing was changed." }))

  on('tool.call', { tool: 'mcp__uncapped__build_call_guide' }, async ($) => {
    const w = await read($, workA)
    const o = workingOffer(w)
    if (!o || !planFor(w, 'sales', o)?.output) return { result: "There's no First 10 Customers plan for the offer they're on yet, so there's nothing to write a call guide for. Build the plan first." }
    lastClaim = null
    const out = await writeCallGuide($, 'chat')
    if (!out) return { result: notSent() ? `Nothing new was sent to Claude. ${notSent()}` : "Couldn't write the call guide just now. Their plan and messages are saved; they can ask again." }
    await go($, { view: 'builder', builder: 'sales', stage: 'result' })
    await setUi($, { guideOpen: true })
    return { result: `Saved: their research call guide for "${o.name}", in the panel under See what to ask: ${out.client?.questions?.length || 0} questions for a potential client${out.knows?.questions?.length ? ` and ${out.knows.questions.length} for someone who knows their clients` : ''}.` }
  }).catch(() => ({ result: "Couldn't write the call guide just now. Their plan and messages are saved." }))

  on('tool.call', { tool: 'mcp__uncapped__build_post_brief' }, async ($, e) => {
    const w = await read($, workA)
    const o = workingOffer(w)
    const plan = o ? planFor(w, 'substack', o) : null
    const pieces = plan?.output ? subPieces(plan.output) : []
    const i = Math.round(Number(e.post)) - 1
    if (!pieces.length) return { result: "There's no Substack strategy for the offer they're on yet, so there's no post to brief. Build the strategy first." }
    if (!(i >= 0 && i < pieces.length)) return { result: `Their plan has ${pieces.length} posts: ask which one (1 to ${pieces.length}).` }
    if (briefOf(plan.output, i) && !e.fresh) {
      await go($, { view: 'builder', builder: 'substack', stage: 'post', post: i })
      return { result: `Post ${i + 1}, "${briefOf(plan.output, i).title || pieces[i].headline}", already has its full brief. It's open in the panel. Call again with fresh: true only if they want a new version.` }
    }
    lastClaim = null
    await go($, { view: 'builder', builder: 'substack', stage: 'post', post: i })
    const out = await writePostBrief($, i, 'chat', Boolean(e.fresh))
    if (!out) return { result: notSent() ? `Nothing new was sent to Claude. ${notSent()}` : "Couldn't write the brief just now. Their strategy is saved; they can open the post or ask again." }
    await go($, { view: 'builder', builder: 'substack', stage: 'post', post: i })
    const beats = (out.arc || []).length
    return { result: `Saved: the full brief for post ${i + 1}, "${out.title}", open in the panel: the idea, where to open${(out.open?.lines || []).length ? ' (with a line they could start with)' : ''}, ${beats} beats from opening to ending, what would make it sound like them${out.yours?.question ? `, one question for them ("${out.yours.question}")` : ''}, and where to land it (${out.land?.next || 'a next step'}). Tell them in a sentence or two what the post is about and the question, if there is one; the panel has the rest.` }
  }).catch(() => ({ result: "Couldn't write the brief just now. Their strategy is saved." }))

  on('tool.call', { tool: 'mcp__uncapped__save_space' }, async ($, e) => {
    const w = await read($, workA)
    if (!chosenOffers(w).length) return { result: 'There are no offers to group yet. They choose an offer in the panel first.' }
    const o = String(e.offer || '').trim() ? offerNamed(w, e.offer) : null
    if (String(e.offer || '').trim() && !o) return { result: `Needs clarification: which offer? ${chosenOffers(w).map((x) => `"${x.name}"`).join('; ')}` }
    const sp = String(e.space || '').trim() ? spaceNamed(w, e.space) : null
    if (String(e.space || '').trim() && !sp) return { result: `Needs clarification: which space? ${spacesOf(w).map((x) => `"${x.name}"`).join('; ')}` }
    const fresh = String(e.new_space || '').trim()
    const name = String(e.name || '').trim()
    if (o && (fresh || sp)) {
      const from = spaceOf(w, o)
      if (sp && o.spaceId === sp.id && !fresh) return { result: `"${o.name}" is already in "${sp.name}". Nothing changed.` }
      let to = sp?.id
      await mutate($, (w2) => {
        if (fresh) to = newSpace(w2, fresh)
        const x = w2.offers.find((y) => y.id === o.id)
        x.spaceId = to
        // The Substack open now follows the offer they're on.
        if (x.id === w2.activeOfferId && w2.builders?.substack) activateSpace(w2, to)
      }, ['discover'])
      const w3 = await read($, workA)
      const toSp = spaceOf(w3, w3.offers.find((y) => y.id === o.id))
      const left = from ? offersIn(w3, from.id) : []
      return { result: `Saved: "${o.name}" is now in "${toSp?.name}", shown in the panel under Your portfolio. Its First 10 plan stays with it.${from && !left.length && substackFor(w3, from.id)?.output ? ` The Substack strategy built for "${from.name}" stays saved.` : ''}${from && left.length ? ` "${from.name}" still holds ${left.map((y) => `"${y.name}"`).join(', ')}.` : ''}` }
    }
    if (sp && name) {
      await mutate($, (w2) => { const x = (w2.spaces || []).find((y) => y.id === sp.id); if (x) x.name = name.slice(0, 80) }, ['discover'])
      return { result: `Saved: the space "${sp.name}" is now called "${name.slice(0, 80)}".` }
    }
    return { result: `Needs clarification: say which offer to move and where (space, or new_space with a name), or which space to rename (space and name). Their spaces: ${spacesOf(w).map((x) => `"${x.name}" (${offersIn(w, x.id).map((y) => `"${y.name}"`).join(', ')})`).join('; ')}.` }
  }).catch(() => ({ result: "Couldn't save that just now. Nothing was changed." }))

  on('tool.call', { tool: 'mcp__uncapped__add_idea' }, async ($, e) => {
    const w = await read($, workA)
    if (!w.discover?.early) return { result: "There's no portfolio garden yet. Discover comes first; once the garden has grown, their own ideas can go in it." }
    const name = String(e.name || '').trim()
    if (!name) return { result: 'Needs clarification: what is the idea, as an offer in a line?' }
    const dirs = w.discover.early.directions || []
    const into = e.direction ? dirs.find((d) => d.id === e.direction) : null
    await mutate($, (w2) => {
      const g = w2.discover.early
      const idea = { name, lens: e.lens, buyer: String(e.buyer || ''), how: String(e.how || ''), price: String(e.price || ''), own: true }
      if (into) {
        const d = g.directions.find((x) => x.id === into.id)
        d.growInto = [...(d.growInto || []), idea]
      } else {
        const n = g.directions.filter((x) => String(x.id).startsWith('u')).length + 1
        g.directions.push({ id: `u${n}`, short: String(e.area || name).trim(), title: String(e.area || name).trim(), firstOffer: name, route: e.lens, buyer: idea.buyer, summary: idea.how, priceNote: idea.price, own: true, opportunity: '', growInto: [] })
      }
      w2.events.unshift({ at: now(), text: `Added your own idea to your garden: ${name}.` })
    }, ['discover'])
    await go($, { view: 'discover', stage: 'garden' })
    return { result: `Added: "${name}" (${e.lens}) to their garden${into ? `, under ${into.short || into.title}` : ''}, marked as their own idea and a possibility to test. It's in the panel under Your offer, where "See this offer", then "Start with this offer", makes it their working offer.` }
  }).catch(() => ({ result: "Couldn't add the idea just now. Nothing was changed." }))

  on('tool.call', { tool: 'mcp__uncapped__save_portfolio' }, async ($, e) => {
    const story = String(e.story || '').trim()
    if (!story) return { result: 'Needs clarification: say in two or three sentences how their offers work together, then call save_portfolio again.' }
    const w = await read($, workA)
    const offers = chosenOffers(w)
    if (offers.length < 2) return { result: `They're focusing on one offer${offers[0] ? ` ("${offers[0].name}")` : ''}, so there's no portfolio to describe yet. Once they add another offer in the panel, say how the two fit.` }
    await mutate($, (w2) => { w2.portfolio = { story: story.slice(0, 1200), offerIds: offers.map((o) => o.id), at: now() } }, ['discover'])
    return { result: `Saved: how their ${offers.length} offers work together (${offers.map((o) => o.name).join('; ')}), shown in the panel under Your portfolio.` }
  }).catch(() => ({ result: "Couldn't save that just now. Nothing was changed." }))

  on('tool.call', { tool: 'mcp__uncapped__build_directions' }, async ($) => {
    lastClaim = null
    // The panel shows the garden being planted, then opens it.
    await setUi($, { discoverLive: true })
    await go($, { view: 'discover', stage: 'overview' })
    const out = await runEarlyRead($, 'chat')
    if (out) await go($, { view: 'discover', stage: 'garden' })
    if (!out) {
      if (notSent()) return { result: `Nothing new was sent to Claude. ${notSent()} Tell them, and point them to the panel's Discover screen.` }
      const u = await read($, uiA)
      return { result: `Couldn't grow the garden: ${u.op?.error || u.error || 'something went wrong'}. Their answers are saved. They can press Try again in the panel, or ask you again.` }
    }
    return { result: `Grown. Shown in the panel under Your offer. ${out.read}\nDirections: ${out.directions.map((d, i) => `${i + 1}. ${d.title} (${d.basis || d.stage}, ${d.monthsToFirstIncome ? `about ${d.monthsToFirstIncome} months to first income` : 'timing unknown'})`).join('; ')}. Ask them to look through their ideas in the panel under Your offer, and remind them they can keep several as income streams.` }
  }).catch(() => ({ result: "Couldn't grow the garden just now. Their answers are saved." }))

  on('tool.call', { tool: 'mcp__uncapped__get_work' }, async ($, e) => {
    const w = await read($, workA)
    if (!w) return { result: 'There is no Uncapped work in this folder yet.' }
    // One builder's whole plan, on request; otherwise a summary that always fits.
    const part = String(e?.part || '').trim().toLowerCase().replace(/^first ?10.*$/, 'sales')
    if (part && part !== 'summary') {
      const sp = part === 'substack' && String(e?.space || '').trim() ? spaceNamed(w, e.space) : null
      if (part === 'substack' && String(e?.space || '').trim() && !sp) return { result: `There's no space called "${e.space}". Their spaces: ${spacesOf(w).map((x) => `"${x.name}"`).join(', ')}.` }
      const b = sp ? substackFor(w, sp.id) || { status: 'not_started', answers: {} } : w.builders?.[part]
      if (!b) return { result: `There's no "${part}" in their work. Parts: ${Object.keys(w.builders || {}).join(', ')}.` }
      const full = { builder: part, status: b.status, answers: b.answers || {}, material: b.material || undefined, beingWritten: b.next ? { stage: b.next.stage, cardsDone: (b.next.pieces || []).filter(cardWritten).length, stopped: !runningHere.has(b.next.runId) } : undefined, basedOn: b.basedOn || null, decisions: b.decisions || undefined, examples: b.examples || undefined, tracker: b.tracker || undefined, output: b.output || null }
      const txt = JSON.stringify(full)
      return { result: txt.length <= 60000 ? txt : `${JSON.stringify({ ...full, output: undefined, tracker: undefined })}\nThe plan itself is long; its sections: ${Object.keys(b.output || {}).join(', ')}.` }
    }
    const chosen = chosenOffers(w)
    const sales = w.builders?.sales
    const sub = w.builders?.substack
    const g = w.discover?.early
    const brief = {
      schema: w.schema, profile: w.profile, startingPoint: w.discover?.startingPoint,
      discover: { status: w.discover?.status, read: g?.read, mainTest: g?.mainTest, directions: (g?.directions || []).map((d) => ({ id: d.id, title: d.title, firstOffer: d.firstOffer, lens: d.lens || d.route, buyer: d.buyer, own: d.own || undefined, growInto: (d.growInto || []).map((x) => ({ name: x.name, lens: x.lens, own: x.own || undefined })) })), testFirst: g?.testFirst?.idea, thenTry: (g?.thenTry || []).map((x) => x.idea) },
      offers: (w.offers || []).map((o) => ({ id: o.id, name: o.name, status: o.status, provisional: o.provisional, buyer: o.buyer, problem: o.problem, priceLow: o.priceLow, priceHigh: o.priceHigh, priceUnit: o.priceUnit, toTest: o.toTest, fromDirection: o.fromDirection, focus: chosen.some((x) => x.id === o.id), space: spaceOf(w, o)?.name || undefined })),
      spaces: spacesOf(w).map((sp) => ({ name: sp.name, offers: offersIn(w, sp.id).map((o) => o.name), substack: substackFor(w, sp.id)?.output ? 'built' : 'not yet', openNow: w.builders?.substack?.spaceId === sp.id || undefined })),
      activeOfferId: w.activeOfferId, portfolio: w.portfolio || null, positioning: w.positioning,
      builders: Object.fromEntries(Object.entries(w.builders || {}).filter(([, b]) => b?.output || Object.keys(b?.answers || {}).length).map(([k, b]) => [k, { status: b.status, answers: b.answers || {}, forOffer: b.basedOn?.offerId || null, forOffers: b.basedOn?.offerIds || undefined, plansSetAsideFor: Object.keys(b.byOffer || {}).length ? Object.keys(b.byOffer) : undefined }])),
      first10: sales?.output ? {
        forOffer: sales.basedOn?.offerId || null, firstMove: sales.output.firstMove?.who || '',
        list: (sales.output.list || []).map((p, i) => { const t = contactOf(sales, keyOf(p, i)); return { slot: slotOf(p, i), name: personName(p, t), kind: p.kind, role: p.role, batch: p.batch, reach: p.reach, firstMessageWritten: Boolean(String(t.draft || '').trim()) } }),
      } : null,
      substackBeingWritten: sub?.next ? { stage: sub.next.stage, stopped: !runningHere.has(sub.next.runId), note: 'Shown in the panel only when all ten cards are finished; never describe its posts before then.' } : undefined,
      substack: sub?.output ? { space: (w.spaces || []).find((x) => x.id === sub.spaceId)?.name || undefined, forOffers: sub.basedOn?.offerIds || [sub.basedOn?.offerId].filter(Boolean), promise: sub.output.reader?.promise || '', voice: sub.output.voice?.profile || '', firstPost: firstPost(sub.output), pieces: subPieces(sub.output).map((x) => x.headline) } : null,
      tests: (w.experiments || []).map((x) => ({ title: x.title, kind: x.kind, status: x.status, offerId: x.source?.offerId, findings: (x.findings || []).length })),
      more: 'For one builder\'s whole plan (for example First 10 Customers or Substack), call get_work with part: "sales" or "substack".',
    }
    const txt = JSON.stringify(brief)
    return { result: txt.length <= 60000 ? txt : JSON.stringify({ ...brief, discover: { ...brief.discover, answers: undefined } }) }
  }).catch(() => ({ result: "Couldn't read the saved work just now." }))

  on('tool.call', { tool: 'mcp__uncapped__list_tests' }, async ($) => {
    const w = await read($, workA)
    const list = w?.experiments || []
    return { result: list.length ? list.map((x, i) => `${i + 1}. ${experimentLine(x)}`).join('\n') : 'No tests yet. Offer to plan one with plan_test.' }
  }).catch(() => ({ result: "Couldn't read the tests just now." }))

  on('tool.call', { tool: 'mcp__uncapped__plan_test' }, async ($, e) => {
    const w = await read($, workA)
    const q = String(e.what || '').toLowerCase()
    const o = q ? (w.offers || []).find((x) => String(x.name).toLowerCase().includes(q)) : null
    const d = q && !o ? (w.discover?.early?.directions || []).find((x) => String(x.title).toLowerCase().includes(q)) : null
    if (q && !o && !d) return { result: `Needs clarification: which offer or direction? Options: ${[...(w.offers || []).map((x) => x.name), ...(w.discover?.early?.directions || []).map((x) => x.title)].join(' | ') || 'none yet, so Discover comes first'}.` }
    lastClaim = null
    const x = await planExperiment($, o ? { offerId: o.id } : d ? { directionId: d.id } : null, e.unsure_about || '', 'chat')
    if (!x) {
      if (notSent()) return { result: `Nothing new was sent to Claude. ${notSent()}` }
      const u = await read($, uiA)
      return { result: `Couldn't plan the test: ${u.op?.error || u.error || 'something went wrong'}. Nothing was changed.` }
    }
    return { result: `Saved: a test called "${x.title}" (under Your test in the panel). It's for: ${x.uncertaintyText}. First: ${(x.steps || [])[0] || ''}. Review on ${x.reviewOn}. The panel has the messages, conversation guide and what to record. Tell them they can come back and say what happened in their own words, here or with Report what happened in the chat.` }
  }).catch(() => ({ result: "Couldn't plan the test just now. Nothing was changed." }))

  on('tool.call', { tool: 'mcp__uncapped__record_findings' }, async ($, e) => {
    let w = await read($, workA)
    let f = findExperiment(w, e.test)
    // Their First 10 outreach is the test when nothing else fits, kept with the offer it's about:
    // the one named, else the working offer, else the one whose messages are written.
    if (f.none || (e.test && /first 10/i.test(e.test) && !f.exp)) {
      const norm = (x) => String(x || '').trim().toLowerCase()
      const offers = chosenOffers(w).filter((o) => outreachFor(w, o).plan)
      const named = offers.find((o) => e.test && norm(e.test).includes(norm(o.name)))
      const wo = workingOffer(w)
      const o = named || offers.find((x) => wo && x.id === wo.id) || offers.find((x) => outreachFor(w, x).written > 0) || (offers.length === 1 ? offers[0] : null)
      if (o) {
        await outreachTest($, o)
        w = await read($, workA)
        f = findExperiment(w, `First 10 Customers: ${o.name}`)
      } else if (offers.length > 1) return { result: `Needs clarification: which offer are these notes about? ${offers.map((x, i) => `${i + 1}) ${x.name}`).join('; ')}.` }
    }
    if (f.none) return { result: "Needs clarification: there's no test saved yet. Ask what they were testing, then offer plan_test so their findings have somewhere to live." }
    if (f.ambiguous) return { result: `Needs clarification: which test is this about? ${f.ambiguous.map((x, i) => `${i + 1}) ${x.title}`).join('; ')}.` }
    lastClaim = null
    const o = await organiseFindings($, f.exp.id, e.notes, e.who, 'chat')
    if (!o) {
      if (notSent()) return { result: `Nothing new was sent to Claude and nothing was saved again. ${notSent()}` }
      return { result: `Couldn't organize those notes: ${(await read($, uiA)).op?.error || 'something went wrong'}. Nothing was saved; ask them to try again or use Report what happened in the panel.` }
    }
    const saved = await saveFindings($, f.exp.id, o, e.notes, e.who, 'chat')
    if (!saved) return { result: "Couldn't save the findings. Nothing was changed." }
    const r = await readFindings($, f.exp.id, 'chat')
    const ev = r ? Object.entries(EVIDENCE).map(([k, lab]) => `${lab}: ${LEVELS[r.evidence?.[k]?.level] || 'No evidence yet'}`).join('; ') : ''
    return { result: `Saved: findings for "${f.exp.title}" (${o.summary}).${o.missing?.length ? ` Worth asking: ${o.missing.map((m) => m.q).join(' ')}` : ''}${r ? `\nTentative reading: ${r.learned}${readingExtras(r)}\nEvidence: ${ev}.\nLimits: ${r.limits}\nSuggested: ${DECISIONS[r.recommended?.choice] || r.recommended?.choice}, because ${r.recommended?.why}.${r.proposedChange && r.proposedChange.field !== 'none' ? ` Possible change to the offer's ${r.proposedChange.field}: "${r.proposedChange.to}" (not applied).` : ''}\nNext useful action: ${r.next?.label}. Nothing about their offer has changed. Ask what they want to decide, then use decide.` : ' The reading failed, but the findings are saved.'}` }
  }).catch(() => ({ result: "Couldn't save the findings just now. Nothing was changed." }))

  on('tool.call', { tool: 'mcp__uncapped__decide' }, async ($, e) => {
    const w = await read($, workA)
    const f = findExperiment(w, e.test)
    if (f.none || f.ambiguous) return { result: `Needs clarification: which test? ${(f.ambiguous || []).map((x, i) => `${i + 1}) ${x.title}`).join('; ')}` }
    const r = await decide($, f.exp.id, e.choice, e.why, Boolean(e.apply_change))
    if (r.status !== 'saved') return { result: 'Needs clarification: choose continue, revise_buyer, revise_problem, change_offer, pilot or pause.' }
    const sp = (await read($, workA)).signpost
    return { result: `Saved: decided "${DECISIONS[e.choice]}" for "${f.exp.title}".${r.change ? ` Their offer's ${r.change.field} is now "${r.change.to}" (the old version is kept).` : ''}${r.flagged.length ? ` ${changeMessage([r.change?.field || 'buyer'], r.flagged)} They're marked Review suggested on the home screen: suggest reviewing them, and offer to draft a post exploring what they learned.` : ''}${sp?.contentIdea ? ` Post idea: ${sp.contentIdea}` : ''}` }
  }).catch(() => ({ result: "Couldn't save the decision just now. Nothing was changed." }))

  on('tool.call', { tool: SAVE_RESEARCH }, async ($, e) => {
    const w = await read($, workA)
    const run = await researchRunFor($, e.agentId)
    const dirs = w.discover?.early?.directions || []
    const q = String(e.direction || '').toLowerCase()
    const dir = run ? dirs.find((d) => d.id === run.directionId) : q ? dirs.find((d) => d.id === e.direction || String(d.title).toLowerCase().includes(q) || cleanShort(d).toLowerCase().includes(q)) : null
    const f = e.test ? findExperiment(w, e.test) : {}
    if (q && !dir && !f.exp) return { result: `Needs clarification: which direction? Options: ${dirs.map((d) => `${d.id} ${cleanShort(d)}`).join(' | ') || 'none yet'}.` }
    const entry = await saveResearch($, f.exp?.id, e.topic, e.items, e.implication, { directionId: dir?.id || null, inferences: e.inferences, stillNeeds: e.stillNeeds, couldntRead: e.couldntRead, by: run ? 'panel research' : 'chat', searches: run?.searches })
    if (!entry) return { result: "Couldn't save the research." }
    if (run && !run.saved) await finishResearch($, run, entry)
    return { result: `Saved: research on ${e.topic}${dir ? ` for "${cleanShort(dir)}"` : ''}${f.exp ? ` (with the test "${f.exp.title}")` : ''}: ${entry.items.length} source${entry.items.length === 1 ? '' : 's'}, dated today.${run ? ' You are done: reply with one line.' : ''}` }
  }).catch(() => ({ result: "Couldn't save the research just now." }))

  // Substack v3: finish any cards still missing, the same as "Write the rest" in the panel.
  // The stories and views they give the chat for their Substack (12 Nov): saved with that space's strategy, never asked twice.
  on('tool.call', { tool: 'mcp__uncapped__save_writing_material' }, async ($, e) => {
    const answer = String(e.answer ?? '').trim()
    if (!answer) return { result: 'Needs clarification: what did they say? Pass it as answer, in their words.' }
    const w0 = await read($, workA)
    const o = activeOffer(w0)
    if (!o || o.status === 'idea') return { result: "There's no working offer yet, so there's no Substack strategy to save this for." }
    const clean = (v) => String(v ?? '').trim().slice(0, 2000)
    const d = e.developed || {}
    const item = { kind: clean(e.kind) || 'story', asked: clean(e.asked), answer: clean(answer).slice(0, 4000), developed: Object.fromEntries(['why', 'seen', 'disagree', 'limits'].map((k) => [k, clean(d[k])]).filter(([, v]) => v)), endorsed: e.endorsed !== false, at: now() }
    let n = 0
    let where = 0
    await mutate($, (w2) => {
      placeOffers(w2)
      activateSpace(w2, activeOffer(w2)?.spaceId)
      const b = (w2.builders.substack = w2.builders.substack || { answers: {} })
      const list = Array.isArray(b.material) ? b.material : []
      const k = Number(e.item) - 1
      if (k >= 0 && list[k]) { list[k] = { ...list[k], ...item, developed: { ...(list[k].developed || {}), ...item.developed } }; where = k + 1 } else { list.push(item); where = list.length }
      b.material = list.slice(0, 30)
      if (!b.status || b.status === 'not_started') b.status = 'in_progress'
      n = b.material.length
    }, [])
    return { result: `Saved: item ${where}, ${item.kind}${item.endorsed ? '' : ' (not confirmed as their view, so the strategy won\'t treat it as theirs)'}. ${n} ${n === 1 ? 'item is' : 'items are'} saved for this Substack strategy.` }
  }).catch(() => ({ result: "Couldn't save that just now. Nothing was changed." }))

  on('tool.call', { tool: 'mcp__uncapped__write_post_cards' }, async ($, e) => {
    const nx = (await read($, workA))?.builders?.substack?.next
    if (nx?.runId) {
      await go($, { view: 'builder', builder: 'substack', stage: 'result' })
      const st = await finishStrategy($)
      if (st.state === 'running') return { result: 'Their Substack strategy is being written in the panel now. It appears there, complete, when all ten cards are finished.' }
      if (st.state !== 'started') return { result: `Nothing new was started: ${(await read($, uiA)).opNote?.text || notSent() || 'Uncapped is busy just now.'}` }
      return { result: 'The panel is finishing their Substack strategy, doing only what was missing. It appears there, complete, when all ten cards are finished. The same as pressing Finish my strategy in the panel.' }
    }
    const out = subOut(await read($, workA))
    if (!isV3Strategy(out)) return { result: 'Their Substack strategy is in the earlier format, without post cards, so there is nothing to finish.' }
    const todo = (out.pieces || []).filter((p) => !cardWritten(p)).length
    if (!todo) return { result: 'Every post already has its card. Nothing to write.' }
    if (cardsRunning) return { result: 'The panel is already writing their cards. Each appears in Posts when it is ready.' }
    await go($, { view: 'builder', builder: 'substack', stage: 'result' })
    void runSubstackCards($)
    return { result: `The panel is now researching and writing the ${todo} missing card${todo === 1 ? '' : 's'}, about ${Math.max(2, Math.round(todo * 0.8) + 2)} minutes. Each appears in Posts as soon as it is ready.` }
  }).catch(() => ({ result: "Couldn't start writing the cards just now. They can press Write the rest in the panel." }))

  // Substack v3: a new idea for one post, agreed in the chat. Its card is researched and written again.
  on('tool.call', { tool: 'mcp__uncapped__change_post_idea' }, async ($, e) => {
    const w = await read($, workA)
    const out = subOut(w)
    if (!isV3Strategy(out)) return { result: "Their Substack strategy is in the earlier format, without post cards. To change a post there, rebuild the strategy with build_plan (fresh: true) after agreeing what should change." }
    const i = Number(e.post) - 1
    if (!out.pieces?.[i]) return { result: `Needs clarification: which post? They have ${out.pieces?.length || 0}.` }
    const clean = (v) => String(v ?? '').trim()
    await mutate($, (w2) => {
      const so = w2.builders.substack?.output
      const old = so.pieces[i]
      so.pieces[i] = { headline: clean(e.headline) || old.headline, subtitle: clean(e.subtitle) || old.subtitle || '', type: clean(e.type) || old.type, move: clean(e.move) || old.move, status: clean(e.status) || old.status, angle: clean(e.angle), uses: [], needsFirst: clean(e.needsFirst), ask: old.ask || '', was: { headline: old.headline, at: now() } }
      if (so.briefs && so.briefs[i]) { const b = { ...so.briefs }; delete b[i]; so.briefs = b }
    }, ['substack'])
    await go($, { view: 'builder', builder: 'substack', stage: 'result' })
    void runSubstackCards($, [i])
    return { result: `Saved: post ${i + 1} is now "${clean(e.headline)}". The panel is researching it and writing its new card, about 3 minutes; it appears in Posts when it's ready. Their other posts are unchanged.` }
  }).catch(() => ({ result: "Couldn't change that post just now. Nothing was changed." }))

  // Research agents: searches and page reads are capped here, not by trust.
  for (const tool of ['WebSearch', 'WebFetch']) {
    on('tool.call', { tool }, async ($, e, next) => {
      const pr = await postRunFor($, e.agentId)
      if (pr) {
        const k = tool === 'WebSearch' ? 'searches' : 'fetches'
        const cap = pr.caps ? pr.caps[k] : POST_LIMITS[k] * (pr.posts || []).length
        if (pr[k] >= cap) return { deny: `Research limit reached (${cap} ${k}). Reply now with the JSON of what you have.` }
        pr[k]++
        if (tool === 'WebFetch' && e.url) pr.fetched.add(normLink(e.url))
        return next(e)
      }
      const run = await researchRunFor($, e.agentId)
      if (!run) return next(e)
      const key = tool === 'WebSearch' ? 'searches' : 'fetches'
      if (run[key] >= RESEARCH_LIMITS[key]) return { deny: `Research limit reached (${RESEARCH_LIMITS[key]} ${key}). Save what you have with ${SAVE_RESEARCH} now.` }
      run[key]++
      return next(e)
    }).catch(passOn)
  }

  // A research agent that ends without saving is a failure, said where it was started.
  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    const pr = e.agentId ? (postRuns.get(e.agentId) || (pendingPostRuns.length ? await postRunFor($, e.agentId) : null)) : null
    if (pr) { postRuns.delete(e.agentId); pr.answer = e.answer ?? ''; pr.done = true }
    const run = await researchRunFor($, e.agentId, true)
    if (run) {
      researchRuns.delete(e.agentId)
      if (!run.saved) {
        const t1 = await $.clock.now()
        await finishOp($, run.opId, 'failed', { error: 'The research ended without saving any sources.', outcome: e.isAborted ? 'stopped' : 'ended without saving' }, t1)
        await update($, uiA, (u) => (u.op?.id === run.opId ? { ...u, op: { ...u.op, status: 'failed', error: e.isAborted ? 'The research was stopped before it saved anything.' : 'The research ended without saving any sources.', why: 'research agent finished without calling save_research', unchanged: true, endedAt: t1 } } : u))
      }
    }
    return r
  }).catch(passOn)

  on('tool.call', { tool: 'mcp__uncapped__prepare_feedback' }, async ($, e) => {
    const f = await feedbackContext($)
    const fb = { kind: KINDS[e.kind] ? e.kind : 'broken', where: f.where, goal: e.trying || f.guess, goalGuessed: !e.trying && Boolean(f.guess), goalConfirmed: Boolean(e.trying), expected: e.expected || '', actual: e.actual || '', details: e.details || '', replyTo: e.reply_to || '', screenshot: false, excerpt: '', context: f.context, removed: {}, stage: 'review', status: null, savedAs: null, returnTo: f.nav }
    await setUi($, { feedback: fb })
    return { result: `Report ready (also shown in the panel under Feedback or help). Show it to them and ask them to confirm or change anything before opening the draft:\n\nTo: ${FEEDBACK_TO}\nSubject: ${subjectFor(fb)}\n\n${reportText(fb)}` }
  }).catch(() => ({ result: "Couldn't prepare the report. They can press Feedback at the bottom of the panel instead." }))

  on('tool.call', { tool: 'mcp__uncapped__open_feedback_draft' }, async ($) => {
    const r = await openEmailDraft($)
    if (r.status === 'opened') return { result: `A draft email to Gabriela is open in their email app. It is NOT sent until they press Send there. A copy is saved at ${r.savedAs}.` }
    if (r.status === 'bad_email') return { result: "Not opened: the reply address doesn't look like an email address. Ask them to fix it or leave it out." }
    if (r.status === 'none') return { result: 'No report is prepared yet. Use prepare_feedback first.' }
    return { result: `Couldn't open their email app. Nothing was sent. The report is saved at ${r.savedAs || 'my-work/support'}. Offer to try again, or they can press Copy report in the panel's Feedback or help screen and paste it into an email to ${FEEDBACK_TO}.` }
  }).catch(() => ({ result: "Couldn't open the email draft. Nothing was sent; the report is still in the panel's Feedback or help screen." }))

  on('tool.call', { tool: 'mcp__uncapped__check_for_updates' }, async ($) => {
    await checkForUpdates($)
    return { result: (await read($, uiA))?.update?.text || 'Checked for updates.' }
  }).catch(failed)

  on('tool.call', { tool: 'mcp__uncapped__support_report' }, async ($) => ({ result: `Support report saved as ${await supportReport($)}. It contains no answers. Ask them to send it to Pivot School with a note on what they were doing.` })).catch(() => ({ result: "Couldn't write the support report." }))

  // ---- keep product files out of the customer's session (customer workspaces only)
  for (const tool of ['Edit', 'Write', 'MultiEdit', 'NotebookEdit']) on('tool.call', { tool }, guardFile).catch(passOn)
  for (const tool of ['Read', 'Grep', 'Glob']) on('tool.call', { tool }, guardRead).catch(passOn)
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (!(await isCustomerWorkspace($))) return next(e)
    const cmd = String(e.command || '')
    if ((($root && cmd.includes($root)) || /\.claude\/plugins/.test(cmd) || /\bclaude\s+plugin\b/.test(cmd) || /\b(npm|pnpm|yarn|pip3?|brew|bun)\s+(i|install|add)\b/.test(cmd) || /my-work\/uncapped\.json/.test(cmd))) return { deny: NOT_PRODUCT }
    return next(e)
  }).catch(passOn)

  // ---- tell the assistant what Uncapped actually is, in customer workspaces
  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    if (!(await isCustomerWorkspace($))) return r
    return { sections: [...(r.sections || []), { id: 'uncapped-customer-guide', text: CUSTOMER_GUIDE, scope: 'session' }] }
  }).catch(passOn)

  on('command.run', { command: 'uncapped' }, async ($) => {
    if (!(await read($, workA))) await boot($)
    await $.ui.open({ id: PANE, title: 'Uncapped', backgroundColor: C.cream, focus: true, columns: 120 })
    return {}
  })

  on('command.run', { command: 'uncapped-update' }, async ($) => {
    await checkForUpdates($)
    const u = await read($, uiA)
    return { text: u.update?.text || 'Checked for updates.' }
  })


  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const E = $.ui.resolve(e)
    const ui = await read($, uiA)
    const work = await read($, workA)
    const nav = await read($, navA)
    const px = pxFor(e.props?.bodyColumns)
    if (PLUGIN !== 'uncapped') {
      try { const row = (await $.config.list()).find((r) => r.key === 'theme'); THEME_PROBE = row ? String(row.value ?? row.current ?? JSON.stringify(row)).slice(0, 80) : 'no theme row' } catch (err) { THEME_PROBE = `couldn't read: ${String(err?.message || err).slice(0, 60)}` }
    }
    let items
    try {
      if (ui?.ws === 'error') throw new Error(`Uncapped couldn't open your folder: ${ui.bootError || 'unknown error'}`)
      items = render($, { E, ui, work, nav, px, cols: e.props?.bodyColumns }).filter(Boolean)
    } catch (err) {
      // Never a blank panel: say what went wrong and offer a way back.
      items = [
        <E.Text key="draw-err-h" weight="bold" color={C.espresso} wrap="wrap">Uncapped couldn't draw this screen.</E.Text>,
        <E.Text key="draw-err-m" color={C.ink} wrap="wrap">{String(err?.message || err).slice(0, 300)}</E.Text>,
        <E.Text key="draw-err-s" color={C.ink} wrap="wrap">Your saved work isn't affected.</E.Text>,
        <E.Box key="draw-err-r" flexDirection="row" gap={1}><E.Button key="draw-err-home" label="Go to Home" onPress={later(() => go($, { view: 'home' }))} /><E.Button key="draw-err-fb" label="Tell Gabriela about this" onPress={later(() => openFeedback($, 'broken'))} /></E.Box>,
      ]
    }
    return (
      <E.Box flexDirection="column" gap={1} paddingX={1} paddingY={1} backgroundColor={V.bg} flexGrow={1}>
        {items}
      </E.Box>
    )
  })

  // "Open Uncapped" sent as a message (the natural first message in a new
  // chat, before the bar exists) opens the panel, then goes through with a
  // note so Claude answers in a line or two with the next step. Stopping the
  // message instead shows "Prompt blocked by a hook" in Claude Desktop, which
  // read as an error on the 10 Nov clean-account test.
  on('prompt.submit', async ($, e, next) => {
    if (!/^\s*(open\s+)?uncapped\s*[.!]?\s*$/i.test(String(e.text || '')) || !(await isCustomerWorkspace($))) return next(e)
    if (!(await read($, workA))) await boot($)
    await $.ui.open({ id: PANE, title: 'Uncapped', backgroundColor: C.cream, focus: true, columns: 120 })
    try { await $.ui.scroll({ to: { key: 'ws-start' }, in: PANE, block: 'nearest' }) } catch (err) {}
    return next({ ...e, context: [...(e.context ?? []), openedNote((await read($, workA)) || {})] })
  }).catch(passOn)

  // The research agent is the panel's own: the chat model isn't offered it.
  on('agent.offer', { agent: RESEARCHER }, () => ({ isOffered: false })).catch(passOn)

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const ui = await read($, uiA)
    if (ui.ws !== 'ready') return next(e)
    const work = await read($, workA)
    const { Box, Text, Button } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
        <Text weight="bold" color={C.blue}>Uncapped</Text>
        {isWorkshop(work) ? null : <Text color={C.taupeInk}>{bandSummary(work)}</Text>}
        <Button key="band-open" label="Open Uncapped" variant="primary" onPress={later(() => $.ui.open({ id: PANE, title: 'Uncapped', backgroundColor: C.cream, focus: true, columns: 120 }))} />
        {ui.latest && isNewer(ui.latest, VERSION) ? <Button key="band-update" label={`Update to ${ui.latest}`} onPress={later(async () => { await go($, { view: 'settings' }); await $.ui.open({ id: PANE, title: 'Uncapped', backgroundColor: C.cream, focus: true, columns: 120 }); await checkForUpdates($) })} /> : null}
      </Box>
    )
  }).catch(passOn)
}
