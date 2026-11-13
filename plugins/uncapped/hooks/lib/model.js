// Pure data logic for Uncapped's saved work: the shape of the file, the
// migrations between versions of that shape, and the record of which saved
// assets depend on which shared facts. Nothing here touches the disk or the
// model, so it runs the same in the panel and in plain Node tests.

export const SCHEMA = 3

export const FILES = {
  marker: '.uncapped/workspace.json',
  work: 'my-work/uncapped.json',
  previous: 'my-work/.uncapped.previous.json',
  backups: 'my-work/backups',
  kit: 'my-work/kit',
  site: 'my-work/website/index.html',
}

export function now() {
  return new Date().toISOString()
}

export function freshWork(productVersion) {
  const t = now()
  return {
    schema: SCHEMA,
    createdWith: productVersion,
    updatedWith: productVersion,
    createdAt: t,
    updatedAt: t,
    profile: {
      name: '',
      answers: {},
      limits: { hours: '', hoursExact: '', income: '', currency: '$', goal: '' },
      energy: { more: '', less: '', never: '' },
    },
    onboarding: { seen: false, tourDone: false },
    discover: {
      status: 'not_started',
      step: 0,
      depth: {},
      startingPoint: '',
      early: null,
      reactions: {},
      notes: {},
      followAnswers: {},
      excitement: {},
      chosenId: null,
      rounds: 0,
    },
    offers: [],
    spaces: [],
    activeOfferId: null,
    positioning: null,
    builders: {},
    events: [],
  }
}

// ---------- migrations ----------
// Each entry upgrades the saved file from schema N to N+1. A release that
// changes the shape adds one entry and bumps SCHEMA. Old files are backed up
// before any migration runs (see store.js), and a failed migration leaves the
// original file untouched.
export const MIGRATIONS = {
  // 0.2.0: Discover becomes themes with depth, a starting point and an
  // onboarding flag. Every answer already saved is kept word for word.
  1: (w) => {
    w.discover = w.discover || {}
    w.discover.depth = w.discover.depth || {}
    w.discover.startingPoint = w.discover.startingPoint || ''
    w.profile = w.profile || {}
    w.profile.answers = w.profile.answers || {}
    w.profile.limits = { hours: '', income: '', currency: '$', goal: '', ...(w.profile.limits || {}) }
    if (w.profile.limits.hoursExact === undefined) w.profile.limits.hoursExact = ''
    w.onboarding = w.onboarding || { seen: Boolean(w.profile.name || Object.keys(w.profile.answers).length), tourDone: false }
    w.schema = 2
    return w
  },
  // 0.3.0: offers are grouped into spaces by who they're for, and each space
  // can have its own Substack strategy. The offers the existing Substack was
  // built for share one space; every other offer gets a space of its own (or
  // joins one from the same garden idea). Nothing is rewritten or dropped.
  2: (w) => {
    w.spaces = Array.isArray(w.spaces) ? w.spaces : []
    const b = w.builders?.substack
    const chosen = (w.offers || []).filter((o) => o.status !== 'idea')
    const covered = b ? [b.basedOn?.offerId, ...(b.basedOn?.offerIds || [])].filter(Boolean) : []
    const group = chosen.filter((o) => covered.includes(o.id) && !o.spaceId)
    if (group.length) {
      const sid = newSpace(w, spaceNameFrom(group[0]))
      for (const o of group) o.spaceId = sid
    }
    placeOffers(w)
    if (b && !b.spaceId) {
      const home = chosen.find((o) => o.id === b.basedOn?.offerId) || chosen.find((o) => o.id === w.activeOfferId) || chosen[0]
      b.spaceId = home?.spaceId || null
    }
    if (b && !b.bySpace) b.bySpace = {}
    w.schema = 3
    return w
  },
}

export function migrate(work, steps = MIGRATIONS, target = SCHEMA) {
  let w = structuredClone(work)
  const from = Number(w.schema || 0)
  if (from > target) {
    return { work: w, status: 'newer', from, to: target }
  }
  if (from === 0) {
    // Files written before versioning existed: treat as schema 1.
    w.schema = 1
  }
  for (let v = Number(w.schema); v < target; v++) {
    const step = steps[v]
    if (!step) throw new Error(`No migration from schema ${v} to ${v + 1}`)
    w = step(w)
    if (w.schema !== v + 1) throw new Error(`Migration ${v} did not set schema ${v + 1}`)
  }
  // Fill any key a newer default has and an older file lacks.
  const base = freshWork(w.createdWith || 'unknown')
  for (const k of Object.keys(base)) if (w[k] === undefined) w[k] = base[k]
  return { work: w, status: from < target ? 'migrated' : 'ok', from, to: target }
}

// ---------- paths ----------
export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

export function setPath(obj, path, value) {
  const keys = path.split('.')
  let o = obj
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]
    if (o[k] == null || typeof o[k] !== 'object') o[k] = /^\d+$/.test(keys[i + 1]) ? [] : {}
    o = o[k]
  }
  o[keys[keys.length - 1]] = value
  return obj
}

// Every string leaf of an object, as [path, value] pairs.
export function leaves(obj, prefix = '') {
  const out = []
  if (obj == null) return out
  if (typeof obj === 'string' || typeof obj === 'number') return [[prefix, String(obj)]]
  if (Array.isArray(obj)) obj.forEach((v, i) => out.push(...leaves(v, prefix ? `${prefix}.${i}` : String(i))))
  else if (typeof obj === 'object') for (const [k, v] of Object.entries(obj)) out.push(...leaves(v, prefix ? `${prefix}.${k}` : k))
  return out
}

export function changedPaths(before, after) {
  const a = new Map(leaves(before))
  const b = new Map(leaves(after))
  const keys = new Set([...a.keys(), ...b.keys()])
  return [...keys].filter((k) => (a.get(k) ?? '') !== (b.get(k) ?? ''))
}

// ---------- First 10 Customers: one record per person ----------
// Message, reply and conversation are kept apart, so a quiet week of replies
// never reads as failure. An introduction or an encouraging reply has its own
// place. The strongest signal follows the PCB ladder.
export const OUTREACH = ['not sent yet', 'sent', 'followed up']
export const REPLY = ['no reply yet', 'replied', 'said not now']
export const TALK = ['not yet', 'booked', 'had it']
export const SIGNALS = ['none yet', 'a compliment', 'an encouraging reply', 'an introduction or their time', 'mentioned money or a budget', 'asked to start or brought someone in']
const OLD_SIGNAL = { 'gave time or an introduction': 'an introduction or their time' }
// Reads a saved record, including the older one-status records from before
// these were kept apart, without changing what is on disk.
export function contactRecord(raw) {
  const t = typeof raw === 'string' ? { status: raw } : { ...(raw || {}) }
  if (t.status && !t.sent) {
    const s = t.status
    if (s !== 'not contacted') t.sent = 'sent'
    if (['replied', 'conversation booked', 'talked'].includes(s)) t.reply = 'replied'
    if (s === 'not now') t.reply = 'said not now'
    if (s === 'conversation booked') t.talk = 'booked'
    if (s === 'talked') t.talk = 'had it'
  }
  if (OLD_SIGNAL[t.signal]) t.signal = OLD_SIGNAL[t.signal]
  return { sent: t.sent || 'not sent yet', reply: t.reply || 'no reply yet', talk: t.talk || 'not yet', ...Object.fromEntries(Object.entries(t).filter(([k]) => !['sent', 'reply', 'talk', 'status'].includes(k))) }
}
// One line for where a person stands, the furthest step first.
export function contactStage(t) {
  if (t.talk === 'had it') return 'talked'
  if (t.talk === 'booked') return 'conversation booked'
  if (t.reply === 'said not now') return 'not now'
  if (t.reply === 'replied') return 'replied'
  if (t.sent === 'followed up') return 'followed up'
  if (t.sent === 'sent') return 'message sent'
  return 'not contacted'
}
// Counts for a plan's list: messages, replies, conversations and introductions, kept apart.
export function contactCounts(records) {
  const n = (f) => records.filter(f).length
  return {
    sent: n((t) => t.sent !== 'not sent yet'),
    replied: n((t) => t.reply !== 'no reply yet'),
    booked: n((t) => t.talk === 'booked'),
    talked: n((t) => t.talk === 'had it'),
    encouraged: n((t) => String(t.intro || '').trim() || ['an encouraging reply', 'an introduction or their time'].includes(t.signal)),
    committed: n((t) => SIGNALS.indexOf(t.signal) >= SIGNALS.indexOf('an introduction or their time')),
  }
}

// ---------- offers ----------
export const OFFER_FIELDS =['name', 'buyer', 'problem', 'whyNow', 'handover', 'priceLow', 'priceHigh', 'priceUnit', 'priceWhy', 'firstStep']

// The offers they've chosen to focus on: chosen (not just ideas) and from the
// garden they have now (an offer from an earlier garden stays saved, set aside).
export function focusOffers(work) {
  const g = work.discover?.early
  const norm = (x) => String(x || '').trim().toLowerCase()
  const names = new Set((g?.directions || []).flatMap((d) => [d.firstOffer || d.title, ...(d.growInto || []).map((x) => x.name)]).map(norm))
  // The same rule as the panel: an offer from an earlier garden is set aside.
  const stale = (o) => Boolean(g && o.fromDirection) && (o.fromGarden ? o.fromGarden !== g.at : !names.has(norm(o.name)))
  return (work.offers || []).filter((o) => o.status !== 'idea' && !stale(o))
}

export function activeOffer(work) {
  return work.offers.find((o) => o.id === work.activeOfferId) || work.offers[0] || null
}

// ---------- spaces ----------
// A space holds the offers for one kind of buyer: three offers for personal
// trainers share one, and a balcony growing offer has its own. Each space can have its
// own Substack strategy, so building one never touches another.

// A short name for a space, from who the offer is for: "Independent personal
// trainers who sign up new clients..." becomes "Independent personal trainers".
export function spaceNameFrom(o) {
  let t = String(o?.buyer || '').trim()
  const cut = t.search(/\s(who|whose|that|with|such as|so|because)\s|[,;(:.]/i)
  // Keep at least three words, so "Adult children whose parent is coming home" stays clear.
  if (cut > 3 && t.slice(0, cut).trim().split(/\s+/).length >= 3) t = t.slice(0, cut)
  t = t.trim()
  if (t.length > 44) t = t.slice(0, 44).replace(/\s+\S*$/, '')
  if (!t) t = String(o?.name || 'Your offer').split(/[:(,]/)[0].trim()
  return t ? t[0].toUpperCase() + t.slice(1) : 'Your offer'
}

export function newSpace(work, name) {
  work.spaces = Array.isArray(work.spaces) ? work.spaces : []
  let n = work.spaces.length + 1
  while (work.spaces.some((x) => x.id === `s${n}`)) n++
  const sp = { id: `s${n}`, name: String(name || 'Your offer').trim().slice(0, 80), at: now() }
  work.spaces.push(sp)
  return sp.id
}

// Gives every chosen offer a space. An offer from the same garden idea as one
// already placed joins it; anything else starts a space of its own, which the
// chat can rename or merge.
export function placeOffers(work) {
  work.spaces = Array.isArray(work.spaces) ? work.spaces : []
  const known = new Set(work.spaces.map((x) => x.id))
  // Only offers from the garden they have now are grouped by idea: an offer from an
  // earlier garden can share an idea id with a new one and still be for someone else.
  const current = new Set(focusOffers(work).map((x) => x.id))
  for (const o of work.offers || []) {
    if (o.status === 'idea') continue
    if (o.spaceId && known.has(o.spaceId)) continue
    const sib = current.has(o.id) && o.fromDirection ? (work.offers || []).find((x) => x !== o && current.has(x.id) && x.spaceId && known.has(x.spaceId) && x.fromDirection === o.fromDirection) : null
    o.spaceId = sib ? sib.spaceId : newSpace(work, spaceNameFrom(o))
    known.add(o.spaceId)
  }
  return work
}

// The spaces in use: those holding at least one offer they're focusing on, in order.
export function spacesOf(work) {
  const offers = focusOffers(work)
  return (work.spaces || []).filter((sp) => offers.some((o) => o.spaceId === sp.id))
}
export function spaceOf(work, o) {
  return (work.spaces || []).find((sp) => sp.id === o?.spaceId) || null
}
export function offersIn(work, sid) {
  return focusOffers(work).filter((o) => o.spaceId === sid)
}

// A space's Substack strategy, whether it's the one open now or kept for its space.
export function substackFor(work, sid) {
  const b = work.builders?.substack
  if (!b || !sid) return null
  if (b.spaceId === sid) return b
  // Saved before it knew its space: it belongs to the space of the offer it was built for.
  if (!b.spaceId && (work.offers || []).find((o) => o.id === (b.basedOn?.offerId || work.activeOfferId))?.spaceId === sid) return b
  const kept = b.bySpace?.[sid]
  return kept && (kept.output || Object.keys(kept.answers || {}).length) ? kept : null
}

// Opens a space's Substack strategy: the one open now is kept under its own
// space, word for word, and the chosen space's comes back (or a fresh one).
export function activateSpace(work, sid) {
  if (!sid) return
  work.builders = work.builders || {}
  const b = (work.builders.substack = work.builders.substack || { answers: {} })
  if (b.spaceId === sid) return
  const store = { ...(b.bySpace || {}) }
  const here = {}
  for (const k of Object.keys(b)) if (k !== 'bySpace' && k !== 'spaceId') here[k] = b[k]
  const full = Boolean(here.output || Object.keys(here.answers || {}).length)
  // A strategy saved before it knew its space belongs to the offer it was built for.
  const cur = b.spaceId || (full ? (work.offers || []).find((o) => o.id === b.basedOn?.offerId)?.spaceId || null : null)
  if (full && !cur) return
  if (full) store[cur] = here
  const next = store[sid] || { answers: {}, status: 'not_started' }
  delete store[sid]
  for (const k of Object.keys(b)) delete b[k]
  Object.assign(b, next, { spaceId: sid, bySpace: store })
}

export function priceText(o, currency = '$') {
  if (!o) return ''
  if (Number(o.priceLow) === 0 && Number(o.priceHigh || 0) === 0 && o.priceLow !== '' && o.priceLow != null) return o.priceUnit || 'not paid yet'
  const fmt = (n) => (n === '' || n == null || isNaN(Number(n)) ? '' : currency + Number(n).toLocaleString('en-US'))
  const lo = fmt(o.priceLow)
  const hi = fmt(o.priceHigh)
  const band = lo && hi && lo !== hi ? `${lo} to ${hi}` : lo || hi
  return band ? `${band}${o.priceUnit ? ' ' + o.priceUnit : ''}` : ''
}

// ---------- dependencies ----------
// Which shared facts each builder's saved work is built from. A confirmed
// change to one of these fields flags the asset for review; a change to any
// other field leaves it alone.
export const USES = {
  offer: { offer: ['name', 'buyer', 'problem', 'handover', 'priceLow', 'priceHigh', 'priceUnit', 'whyNow'] },
  brand: { offer: ['name', 'buyer', 'problem', 'handover'] },
  linkedin: { offer: ['name', 'buyer', 'problem', 'handover'], positioning: ['line', 'bioShort', 'bioLong'] },
  content: { offer: ['buyer', 'problem', 'name'], positioning: ['line'] },
  substack: { offer: ['buyer', 'problem'], positioning: ['line'] },
  website: { offer: ['name', 'buyer', 'problem', 'handover', 'priceLow', 'priceHigh', 'priceUnit'], positioning: ['line', 'bioShort', 'bioLong'], packages: true },
  sales: { offer: ['name', 'buyer', 'problem', 'priceLow', 'priceHigh'], packages: true },
  delivery: { offer: ['handover', 'name'], packages: true },
  operations: { offer: ['name', 'priceLow', 'priceHigh', 'priceUnit'], packages: true },
}

// What each asset is called when we tell someone it needs a look.
export const ASSET_NAME = {
  offer: 'packages',
  brand: 'positioning line and bio',
  linkedin: 'LinkedIn headline and About section',
  content: 'content ideas',
  substack: 'Substack plan',
  website: 'website copy',
  sales: 'buyer messages',
  delivery: 'onboarding kit',
  operations: 'booking page and basics',
}

const FIELD_WORDS = {
  buyer: { change: 'who this offer is for', old: 'the previous audience' },
  problem: { change: 'the problem this offer solves', old: 'the previous problem' },
  name: { change: "this offer's name", old: 'the previous name' },
  handover: { change: 'what the buyer gets at the end', old: 'the previous deliverable' },
  whyNow: { change: 'why buyers need it now', old: 'the previous reason to buy' },
  priceLow: { change: 'the price', old: 'the previous price' },
  priceHigh: { change: 'the price', old: 'the previous price' },
  priceUnit: { change: 'how the price is charged', old: 'the previous pricing' },
  line: { change: 'your positioning line', old: 'the previous positioning' },
  bioShort: { change: 'your bio', old: 'the previous bio' },
  bioLong: { change: 'your bio', old: 'the previous bio' },
  packages: { change: 'your packages', old: 'the previous packages' },
}

export function listNames(names) {
  if (names.length <= 1) return names.join('')
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]
}

// The sentence a person sees when a change affects saved work, e.g.
// "You've changed who this offer is for. Your LinkedIn headline and About
// section and website copy still describe the previous audience."
export function changeMessage(fields, assetIds) {
  const words = [...new Set(fields.map((f) => FIELD_WORDS[f]?.change).filter(Boolean))]
  const olds = [...new Set(fields.map((f) => FIELD_WORDS[f]?.old).filter(Boolean))]
  const assets = assetIds.map((id) => ASSET_NAME[id] || id)
  const head = words.length ? `You've changed ${listNames(words)}.` : "You've made a change."
  if (!assets.length) return head
  const verb = assets.length === 1 ? 'still describes' : 'still describe'
  return `${head} Your ${listNames(assets)} ${verb} ${listNames(olds) || 'the earlier version'}.`
}

// Returns the builder ids whose saved work used any of `changed` fields of
// `source` ('offer' | 'positioning' | 'packages'), for offer `offerId`.
export function affectedBy(work, source, changed, offerId) {
  const hits = []
  for (const [id, b] of Object.entries(work.builders || {})) {
    if (!b || !b.output) continue
    const uses = USES[id]
    if (!uses) continue
    if (source === 'offer') {
      if (!uses.offer) continue
      if (b.basedOn?.offerId && offerId && b.basedOn.offerId !== offerId) continue
      if (!changed.some((f) => uses.offer.includes(f))) continue
    } else if (source === 'positioning') {
      if (!uses.positioning || !changed.some((f) => uses.positioning.includes(f))) continue
      if (id === 'brand') continue
    } else if (source === 'packages') {
      if (!uses.packages || id === 'offer') continue
    }
    hits.push(id)
  }
  return hits
}

// Flags affected assets "Review suggested", without touching their content.
export function flagReviews(work, source, changed, offerId, revs) {
  const ids = affectedBy(work, source, changed, offerId)
  const fields = source === 'packages' ? ['packages'] : changed
  for (const id of ids) {
    const b = work.builders[id]
    const prev = b.review && b.review.state !== 'dismissed' ? b.review : null
    const allFields = [...new Set([...(prev?.fields || []), ...fields])]
    b.review = {
      state: 'suggested',
      source,
      fields: allFields,
      reason: changeMessage(allFields, [id]),
      at: now(),
      revs,
    }
  }
  return ids
}

export function reviewStatus(b) {
  if (!b || !b.output) return null
  if (b.review?.state === 'suggested') return 'Review suggested'
  if (b.review?.state === 'deferred') return 'Review later'
  return 'Up to date'
}

// Records which versions of the shared facts an asset was built from.
export function basedOnNow(work) {
  const o = activeOffer(work)
  return {
    offerId: o?.id || null,
    // the offers it was built for: every offer in the working offer's space
    offerIds: focusOffers(work).filter((x) => !o?.spaceId || x.spaceId === o.spaceId).map((x) => x.id),
    offerRev: o?.rev || 0,
    positioningRev: work.positioning?.rev || 0,
    packagesRev: work.builders?.offer?.rev || 0,
  }
}

// Keeps up to 20 earlier versions of an asset's output.
export function pushHistory(b, reason) {
  if (!b.output) return
  b.history = b.history || []
  b.history.unshift({ at: now(), reason, output: structuredClone(b.output) })
  b.history = b.history.slice(0, 20)
}

// ---------- progress ----------
export function builderStatus(work, id) {
  if (id === 'discover') return work.discover?.status || 'not_started'
  return work.builders?.[id]?.status || 'not_started'
}

// A confirmed change to an offer: saves the old values, bumps the version and
// flags only the saved assets that used a changed field. Returns their ids.
export function applyOfferChange(w, offer, next) {
  const changed = OFFER_FIELDS.filter((f) => String(offer[f] ?? '') !== String(next[f] ?? ''))
  if (!changed.length) return []
  const before = Object.fromEntries(changed.map((f) => [f, offer[f]]))
  const after = Object.fromEntries(changed.map((f) => [f, next[f]]))
  const { history: _h, rev: _r, id: _i, ...fields } = next
  offer.history = [{ rev: offer.rev, at: now(), changed, before }, ...(offer.history || [])].slice(0, 30)
  Object.assign(offer, fields)
  offer.rev = (offer.rev || 1) + 1
  offer.status = 'confirmed'
  const ids = flagReviews(w, 'offer', changed, offer.id, { offerRev: offer.rev })
  for (const id of ids) {
    w.builders[id].review.before = before
    w.builders[id].review.after = after
  }
  if (ids.length) w.events = [{ at: now(), text: changeMessage(changed, ids) }, ...(w.events || [])]
  return ids
}


// ---------- Discover themes and progress ----------
// The interview covers these themes in this order. The chat and the panel
// both save into profile.answers[theme] (or limits/energy), and both use
// discoverProgress() to agree on what is done, what is missing and what's next.
export const THEMES = [
  { id: 'start', label: 'Where you are starting from', short: 'starting point' },
  { id: 'now', label: 'Where you are now', short: 'your work and life now' },
  { id: 'led', label: 'Work you have led and what changed', short: 'work you led' },
  { id: 'askedFor', label: 'What people come to you for', short: 'what people ask you for' },
  { id: 'know', label: 'What you know that others find useful', short: 'useful knowledge' },
  { id: 'outside', label: 'Life outside work', short: 'life outside work' },
  { id: 'try', label: 'Something you would love to try', short: 'what you want to try' },
  { id: 'buyers', label: 'Who you know and could reach', short: 'who you could reach' },
  { id: 'week', label: 'Your normal week and income goal', short: 'your week and income goal' },
  { id: 'energy', label: 'What gives you energy and what is off the table', short: 'energy and never-again' },
]
export const CORE_THEMES = ['now', 'led', 'askedFor', 'outside', 'try', 'week']
export const STARTING_POINTS = {
  none: "I don't have a business idea yet",
  several: 'I have a few possibilities',
  existing: 'I already sell something',
  explore: "I want to explore something I haven't done professionally",
}

function filled(v) {
  return String(v ?? '').trim().length > 0
}

export function themeState(work, id) {
  const p = work.profile || {}
  const a = p.answers || {}
  const depth = work.discover?.depth?.[id]
  if (id === 'start') return work.discover?.startingPoint ? 'answered' : filled(a.idea) ? 'answered' : 'missing'
  if (id === 'week') {
    const L = p.limits || {}
    const n = [L.hours, L.goal, L.income].filter(filled).length
    return n === 3 ? 'answered' : n ? 'partial' : 'missing'
  }
  if (id === 'energy') {
    const E = p.energy || {}
    return [E.more, E.less, E.never].some(filled) ? 'answered' : depth === 'skipped' ? 'skipped' : 'missing'
  }
  if (!filled(a[id])) return depth === 'skipped' ? 'skipped' : 'missing'
  if (depth === 'enough') return 'enough'
  if (depth === 'thin') return 'thin'
  return 'answered'
}

// What both the chat and the panel use to decide where to resume.
export function discoverProgress(work) {
  const states = Object.fromEntries(THEMES.map((t) => [t.id, themeState(work, t.id)]))
  const missing = THEMES.filter((t) => ['missing', 'partial'].includes(states[t.id])).map((t) => t.id)
  const thin = THEMES.filter((t) => states[t.id] === 'thin').map((t) => t.id)
  const coreDone = CORE_THEMES.every((id) => !['missing', 'partial'].includes(states[id]))
  // Enough for directions: every core theme answered, nothing marked thin,
  // and either the interviewer judged the answers deep enough or the
  // follow-up round has happened. A count of fields is never enough alone.
  const rounds = work.discover?.followRound || 0
  const followed = rounds > 0 || CORE_THEMES.filter((id) => states[id] === 'enough').length >= 3
  // The interviewer's own judgment, once made, decides that it's time for
  // directions, naming anything only the person could still tell. Interviews
  // stop after two follow-up rounds whatever the fields say.
  const reading = work.discover?.reading || null
  const judged = reading?.readiness && reading.round === rounds && !(work.discover?.followups || []).length ? reading.readiness : null
  // A reading that asked nothing more means build now, with its unknowns named.
  const ready = coreDone && (judged ? true : rounds >= 2 || (thin.length === 0 && followed))
  const next = missing[0] || (ready ? null : thin[0]) || null
  const done = THEMES.filter((t) => ['answered', 'enough', 'skipped'].includes(states[t.id])).length
  // Ready is not the same as enough. Enough is about the person only: enough
  // to recommend directions. Unless the interviewer judged that, the garden
  // itself says what only they could still tell that would change it. What
  // buyers will do is for testing, never a shortfall of the interview.
  const enough = judged?.enough === true
  // Roughly how many questions are still to come: one per theme not yet covered,
  // and one per thin answer until the interview is ready.
  const left = missing.length + (ready ? 0 : thin.length)
  return { states, missing, thin, next, ready, left, provisional: ready && !enough, coreDone, done, total: THEMES.length, hasDirections: Boolean(work.discover?.early), rounds, unjudged: ready && !judged, aboutYou: judged && !enough ? judged.missing || [] : [], whyReady: judged?.why || '' }
}

// ---------- reading plain answers ----------
// Turns what people actually type into what the builders need, or says
// precisely what to ask. Never guesses a number that wasn't given.
const CURRENCY_WORDS = [
  ['£', /£|\bgbp\b|pound|sterling|\bquid\b/i],
  ['€', /€|\beur\b|euro/i],
  ['CA$', /ca\$|\bcad\b|canadian/i],
  ['A$', /a\$|\baud\b|australian/i],
  ['$', /\$|\busd\b|dollar/i],
]
export function parseCurrency(text) {
  const t = String(text ?? '').trim()
  if (!t) return { ok: false }
  for (const [sym, re] of CURRENCY_WORDS) if (re.test(t)) return { ok: true, value: sym }
  return { ok: false, ask: `Which currency do you earn in? Pounds, dollars, euros...` }
}

const WORD_NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, a: 1, an: 1, couple: 2, few: null }

export function hoursBand(h) {
  if (h <= 2) return '1 to 2'
  if (h <= 5) return '3 to 5'
  if (h <= 10) return '6 to 10'
  if (h <= 15) return '10 to 15'
  return '15 or more'
}

export function parseHours(text) {
  const t = String(text ?? '').toLowerCase().trim()
  if (!t) return { ok: false }
  const per = /month/.test(t) ? 'month' : /day|evening|night/.test(t) && !/week/.test(t) ? 'day' : 'week'
  let nums = (t.match(/\d+(?:\.\d+)?/g) || []).map(Number)
  if (!nums.length) {
    const w = t.split(/[^a-z]+/).map((x) => WORD_NUMBERS[x]).filter((x) => x !== undefined)
    if (w.includes(null) || !w.length) return { ok: false, ask: 'Roughly how many hours a week could you give this in a normal week? A number is perfect, even a rough one.' }
    nums = w
  }
  let h = nums.length >= 2 && /-|to|or/.test(t) ? (nums[0] + nums[1]) / 2 : nums[0]
  if (per === 'month') h = h / 4.33
  if (per === 'day') {
    return { ok: false, ask: 'How many hours would that add up to in a normal week? For example, two evenings of two hours is about four hours.' }
  }
  if (!(h > 0) || h > 80) return { ok: false, ask: 'How many hours in a normal week, roughly?' }
  const rounded = Math.round(h * 10) / 10
  return { ok: true, value: rounded, band: hoursBand(rounded), approx: /about|around|roughly|maybe|ish|~|-|to|or/.test(t) }
}

export function parseIncome(text, currencyHint) {
  const raw = String(text ?? '').trim()
  if (!raw) return { ok: false }
  const t = raw.toLowerCase().replace(/,/g, '')
  const cur = parseCurrency(raw)
  const m = t.match(/(\d+(?:\.\d+)?)\s*(k|thousand|grand)?/)
  if (!m) return { ok: false, ask: 'What amount a month would feel meaningful? A rough number is fine.' }
  let n = Number(m[1]) * (m[2] ? 1000 : 1)
  if (/year|annual|a yr|per yr|p\.?a\.?/.test(t)) n = Math.round(n / 12)
  if (/week/.test(t)) n = Math.round(n * 4.33)
  if (!(n > 0)) return { ok: false, ask: 'What amount a month would feel meaningful?' }
  return { ok: true, value: n, currency: cur.ok ? cur.value : currencyHint || null, converted: /year|annual|week/.test(t) }
}

export const GOALS = ['Adding to my salary', 'Replacing my salary one day', 'Replacing my salary soon', 'Not sure yet']
export function parseGoal(text) {
  const t = String(text ?? '').toLowerCase()
  if (!t.trim()) return { ok: false }
  if (/not sure|don.?t know|unsure/.test(t)) return { ok: true, value: GOALS[3] }
  if (/replac|quit|leave|full[- ]time/.test(t)) return { ok: true, value: /soon|this year|asap|next (few )?months/.test(t) ? GOALS[2] : GOALS[1] }
  if (/add|side|extra|alongside|top ?up|on top/.test(t)) return { ok: true, value: GOALS[0] }
  return { ok: false, ask: 'Is this about adding to your salary, or replacing it one day?' }
}

export function money(n, currency) {
  return `${currency || '$'}${Number(n).toLocaleString('en-US')}`
}
