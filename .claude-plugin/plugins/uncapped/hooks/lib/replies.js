// Reading Claude's structured replies safely.
//
// The panel's model call has no schema-constrained output (it takes a model,
// a prompt, a reply limit, an effort level and a timeout), so every reply is
// read here and checked in full before anything is saved:
//   - the JSON object is found by matching its braces, outside strings, not
//     by taking the first "{" to the last "}";
//   - a reply that stops before its object closes is "truncated" (cut off),
//     never patched into something that only looks complete;
//   - small mechanical faults (a code fence, trailing commas, raw line breaks
//     inside strings) are repaired locally, without another model call;
//   - a readable reply is then checked for every part the panel needs.

// Finds the first complete top-level JSON object. Returns { text } or
// { truncated: true } when the reply ends inside it.
export function findObject(raw) {
  const s = String(raw || '')
  const start = s.indexOf('{')
  if (start < 0) return { none: true }
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < s.length; i++) {
    const ch = s[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '{' || ch === '[') depth++
    else if (ch === '}' || ch === ']') {
      depth--
      if (depth === 0) return { text: s.slice(start, i + 1), end: i + 1 }
    }
  }
  return { truncated: true }
}

// Mechanical repairs only: nothing is invented or reordered.
function localRepair(t) {
  let out = ''
  let inStr = false
  let esc = false
  for (const ch of t) {
    if (inStr) {
      if (esc) { esc = false; out += ch; continue }
      if (ch === '\\') { esc = true; out += ch; continue }
      if (ch === '"') { inStr = false; out += ch; continue }
      if (ch === '\n') { out += '\\n'; continue }
      if (ch === '\r') continue
      if (ch === '\t') { out += '\\t'; continue }
      out += ch
      continue
    }
    if (ch === '"') inStr = true
    out += ch
  }
  return out.replace(/,(\s*[}\]])/g, '$1')
}

// One fault, repaired only where it can't mean anything else: an object
// closed too early. Seen in a real garden reply (4 Nov 2026): each direction
// ended `"researchQuestions": [...]}, "speedBasis": ...`, so the direction's
// remaining keys landed loose in the directions list.
//
// The rule: a "}" whose next tokens are `, "name":` while the container it
// returns to is a list, or nothing (the top level). A list item or the end of
// the reply can never be followed by `"name":`, so that "}" closed its object
// too soon; it is dropped and the object carries on. Nothing else is touched.
// The repair is refused (the reply is left unread) when:
//   - any other bracket is out of place (a "}" closing a list, or the reverse);
//   - a continued object would then hold the same key twice (that would mean
//     two objects ran together, not one closed early);
//   - the object never closes, or anything but white space follows it;
//   - more than 12 such braces would have to go.
// Returns { ok, text, repairs: [position...] } or { ok: false, why }.
export function repairEarlyClose(raw) {
  const s = String(raw || '')
  const start = s.indexOf('{')
  if (start < 0) return { ok: false, why: 'no object' }
  const stack = [] // { type: '{' | '[', keys: Set, continued: bool }
  const repairs = []
  let out = ''
  let i = start
  const skipWs = (j) => { while (j < s.length && /\s/.test(s[j])) j++; return j }
  const stringEnd = (j) => { // s[j] is '"': index just after its closing quote, or -1
    for (let k = j + 1; k < s.length; k++) {
      if (s[k] === '\\') { k++; continue }
      if (s[k] === '"') return k + 1
    }
    return -1
  }
  for (; i < s.length; i++) {
    const ch = s[i]
    if (ch === '"') {
      const e = stringEnd(i)
      if (e < 0) return { ok: false, why: 'a string never closes' }
      const top = stack[stack.length - 1]
      const after = skipWs(e)
      if (top?.type === '{' && s[after] === ':') {
        const key = s.slice(i, e)
        if (top.keys.has(key) && top.continued) return { ok: false, why: `a repaired object would hold ${key} twice` }
        top.keys.add(key)
      }
      out += s.slice(i, e)
      i = e - 1
      continue
    }
    if (ch === '{' || ch === '[') { stack.push({ type: ch, keys: new Set(), continued: false }); out += ch; continue }
    if (ch === '}' || ch === ']') {
      const top = stack[stack.length - 1]
      if (!top || (ch === '}') !== (top.type === '{')) return { ok: false, why: `a "${ch}" at character ${i} doesn't match what it closes` }
      if (ch === '}') {
        const below = stack[stack.length - 2]
        const c = skipWs(i + 1)
        if (s[c] === ',' && (!below || below.type === '[')) {
          const q = skipWs(c + 1)
          if (s[q] === '"') {
            const e = stringEnd(q)
            if (e > 0 && s[skipWs(e)] === ':') {
              repairs.push(i)
              if (repairs.length > 12) return { ok: false, why: 'too many braces would have to go' }
              top.continued = true
              continue // drop this "}": the object goes on
            }
          }
        }
      }
      stack.pop()
      out += ch
      if (!stack.length) {
        if (s.slice(i + 1).replace(/```\s*$/, '').trim()) return { ok: false, why: 'text continues after the object closes' }
        return repairs.length ? { ok: true, text: out, repairs } : { ok: false, why: 'nothing to repair' }
      }
      continue
    }
    out += ch
  }
  return { ok: false, why: 'the object never closes' }
}

// The words and numbers of a JSON text, in order, ignoring punctuation and
// escapes. Two texts with the same content give the same sequence, however
// their brackets, commas and quotes were fixed.
function contentOf(text) {
  const t = String(text || '')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\[nrtbf]/g, ' ')
  return (t.match(/[\p{L}\p{N}]+/gu) || []).join(' ')
}
function valueContent(v) {
  const out = []
  const walk = (x) => {
    if (x === null) out.push('null')
    else if (Array.isArray(x)) x.forEach(walk)
    else if (typeof x === 'object') for (const [k, y] of Object.entries(x)) { out.push(k); walk(y) }
    else out.push(String(x))
  }
  walk(v)
  return contentOf(out.join(' '))
}
// True when a value read from a repaired reply holds exactly the original
// reply's content: no word or number added, dropped, changed or moved.
// `raw` is the original reply; only its JSON (first "{" to last "}") counts.
export function sameContent(raw, value) {
  const s = String(raw || '')
  const a = s.indexOf('{')
  const b = s.lastIndexOf('}')
  if (a < 0 || b < a) return false
  return contentOf(s.slice(a, b + 1)) === valueContent(value)
}

// { ok, value, how, repairs? } or { ok: false, reason: 'empty' | 'no-json' | 'truncated' | 'malformed', detail }
export function readReply(raw) {
  let t = String(raw || '').trim()
  if (!t) return { ok: false, reason: 'empty', detail: 'the reply was empty' }
  const fence = /```(?:json)?\s*/i.exec(t)
  if (fence) t = t.slice(fence.index + fence[0].length).replace(/```\s*$/, '')
  const f = findObject(t)
  if (f.none) return { ok: false, reason: 'no-json', detail: 'no JSON object in the reply' }
  // Text before the object that is itself JSON means this is a fragment of
  // a longer reply (for example the tail end of one), not a whole answer.
  const before = t.slice(0, t.indexOf('{'))
  if (/"\s*:|",\s*$|^\s*[\]}]/m.test(before)) return { ok: false, reason: 'malformed', detail: 'the reply starts part-way through its JSON' }
  // An object closed too early: repaired only by the narrow rule above, and
  // only if the result keeps every word of the reply.
  const early = () => {
    const r = repairEarlyClose(t)
    if (!r.ok) return null
    try {
      const value = JSON.parse(localRepair(r.text))
      if (!sameContent(t, value)) return null
      return { ok: true, value, how: `repaired locally: ${r.repairs.length} closing brace${r.repairs.length === 1 ? '' : 's'} in the wrong place removed`, repairs: r.repairs }
    } catch (e) { return null }
  }
  if (f.truncated) return { ok: false, reason: 'truncated', detail: 'the reply ends before its JSON object closes' }
  // An object that closes and is followed by more keys was closed too early.
  const rest = t.slice(f.end).trim()
  if (/^,\s*"/.test(rest)) return early() || { ok: false, reason: 'malformed', detail: 'the reply continues after its JSON object closes' }
  try {
    return { ok: true, value: JSON.parse(f.text), how: fence ? 'clean (inside a code block)' : 'clean' }
  } catch (e1) {
    try {
      return { ok: true, value: JSON.parse(localRepair(f.text)), how: 'repaired locally' }
    } catch (e2) {
      return early() || { ok: false, reason: 'malformed', detail: e1.message }
    }
  }
}

// The panel's one way of reading a structured reply, with at most one bounded
// recovery. Shared with the developer's live check (tools/), so a check takes
// exactly the path a customer's request takes.
//   first: the first reply, { isAnswered: true, text, usage }
//   call(role, req): sends one more request, resolving to the same shape
//   keep(role, reply, verdict): saves a reply on this computer for diagnosis
//   check(value): the parts missing from a readable reply ([] when complete)
// Resolves to { value, how } or { failure: { what, why } }.
export async function readWithRecovery({ first, model, system, prompt, maxTokens, call, keep, check, stopped = () => false }) {
  let got = readReply(first.text)
  // A local repair succeeded: keep the original too, so the fault can be studied.
  if (got.ok && got.repairs) await keep('write', first, got.how)
  const cut = !got.ok && (got.reason === 'truncated' || Number(first.usage?.output_tokens || 0) >= maxTokens * 0.97)
  if (!got.ok) await keep('write', first, cut ? 'cut off' : got.reason)
  let failure = null
  if (!got.ok && cut && !stopped()) {
    const again = await call('rewrite, shorter thinking', { model, system, prompt, maxTokens: Math.min(Math.round(maxTokens * 1.5), 32000), effort: 'low' })
    got = again.isAnswered ? readReply(again.text) : { ok: false, reason: 'unanswered', detail: again.reason }
    if (!got.ok && again.isAnswered) await keep('rewrite', again, got.reason)
    if (!got.ok) failure = { what: "Claude's reply was longer than Uncapped allows and was cut off before the end. It tried once more, with less thinking, and that was cut off too.", why: `cut off at the reply limit (${maxTokens} tokens), then ${got.reason}` }
  } else if (!got.ok && (got.reason === 'malformed' || got.reason === 'no-json') && !stopped()) {
    const fixReq = repairPrompt(first.text)
    const fixed = await call('repair syntax', { model: 'haiku', system: fixReq.system, prompt: fixReq.prompt, maxTokens: Math.min(Math.ceil(first.text.length / 2.5) + 500, 24000), effort: 'low' })
    got = fixed.isAnswered ? readReply(fixed.text) : { ok: false, reason: 'unanswered', detail: fixed.reason }
    // A repair is only accepted if it kept every word of the original reply.
    if (got.ok && !sameContent(first.text, got.value)) got = { ok: false, reason: 'changed', detail: 'the repaired reply did not keep the original wording exactly' }
    if (!got.ok && fixed.isAnswered) await keep('repair', fixed, got.reason)
    if (!got.ok) failure = { what: "Claude's reply wasn't in a form Uncapped could read, and a quick automatic repair didn't fix it.", why: `${got.reason}: ${got.detail || ''}` }
  } else if (!got.ok) {
    failure = { what: "Claude's reply wasn't in a form Uncapped could read.", why: `${got.reason}: ${got.detail || ''}` }
  }
  if (got.ok) {
    const missing = check(got.value)
    if (missing.length) {
      await keep('check', { text: JSON.stringify(got.value), usage: null }, 'incomplete')
      return { failure: { what: `Claude's reply was missing parts Uncapped needs: ${missing.join(', ')}.`, why: `incomplete: ${missing.join('; ')}` } }
    }
    return { value: got.value, how: got.how }
  }
  return { failure }
}

const str = (v) => typeof v === 'string' && v.trim().length > 0
const list = (v, min = 1) => Array.isArray(v) && v.filter((x) => (typeof x === 'string' ? x.trim() : x)).length >= min
const num = (v) => v !== '' && v != null && !isNaN(Number(v))

// What each kind of reply must contain before it can be saved. Each check
// returns the parts that are missing or the wrong shape, in plain words.
export const REQUIRED = {
  // One post's brief (10 Nov): an idea, an opening, the full arc and a landing.
  brief: (v) => [
    !str(v.title) && 'a working title',
    !str(v.hook) && 'the idea and why someone would click',
    !(v.open && str(v.open.where)) && 'where it opens',
    !(list(v.arc) && v.arc.length >= 3 && v.arc.every((x) => str(x?.onPage) || (list(x?.onPage) && x.onPage.some(str)))) && 'the story arc, beat by beat',
    !(v.land && str(v.land.takeaway)) && 'where it lands',
  ].filter(Boolean),
  // A v3 Substack strategy, step 1 (11 Nov): a publication, a footer and ten outlined posts.
  // A complete reply in the earlier shape (posts with an idea) is saved as before and drawn as before.
  substack: (v) => (!v.publication && !(Array.isArray(v.pieces) && v.pieces.some((p) => p?.move || p?.angle)) ? [] : [
    !(v.publication && str(v.publication.whoFor)) && 'the publication: who you are writing for',
    !(v.footer && list(v.footer.items) && v.footer.items.every((x) => str(x?.text))) && 'the footer',
    !(list(v.pieces, 8) && v.pieces.every((p) => str(p?.headline) && str(p?.type) && str(p?.move) && str(p?.angle))) && 'ten posts, each with a headline, type, move and angle',
  ].filter(Boolean)),
  // One post's v3 card (11 Nov): the parts every card must have to be read.
  card: (v) => [
    !str(v.reader) && 'who it is for',
    !str(v.problem) && 'what they are stuck on',
    !str(v.offerFit) && 'where the offer comes in',
    !str(v.idea) && 'the idea',
    !(list(v.arc) && v.arc.length >= 2 && v.arc.every((b) => str(b?.text))) && 'the beats',
    !(v.cta && str(v.cta.wording)) && 'how it ends',
  ].filter(Boolean),
  // Substack v3 reviews (12 Nov): the editor's read of the ten posts, its revision, and the research review.
  stubReview: (v) => [!['keep', 'revise'].includes(String(v.verdict || '').toLowerCase().trim()) && 'a verdict (keep or revise)'].filter(Boolean),
  stubRevise: (v) => [!(list(v.pieces, 8) && v.pieces.every((p) => str(p?.headline) && str(p?.angle))) && 'the ten posts, each with a headline and angle'].filter(Boolean),
  refsReview: (v) => [!(Array.isArray(v.posts) && v.posts.every((x) => x && Number(x.post) > 0)) && 'a verdict for each post'].filter(Boolean),
  // The research call guide (10 Nov): a client version with questions and a close.
  guide: (v) => [
    !(v.client && str(v.client.opener)) && 'an opener for a client call',
    !(v.client && list(v.client.questions) && v.client.questions.every((q) => str(q?.q))) && 'the questions for a client call',
    !(v.client && str(v.client.close)) && 'a close for a client call',
  ].filter(Boolean),
  plan: (v) => [
    !str(v.title) && 'a title',
    !str(v.uncertaintyText) && 'what the test is for',
    !str(v.whyThisTest) && 'why this test',
    !list(v.steps) && 'the steps',
    !str(v.who) && 'who to approach',
    !(list(v.outreach) && v.outreach.every((o) => str(o?.message))) && 'the outreach messages',
    !(v.guide && list(v.guide.problem) && list(v.guide.money)) && 'the conversation guide',
    !list(v.capture) && 'what to record',
    !(v.signals && list(v.signals.support) && list(v.signals.weaken)) && 'what would support or weaken the idea',
    !num(v.reviewInDays) && 'a review date',
    !str(v.bringBack) && 'how to bring findings back',
  ].filter(Boolean),
  organise: (v) => [!str(v.summary) && 'a summary', !Array.isArray(v.observations) && 'what happened'].filter(Boolean),
  reading: (v) => [!str(v.learned) && 'what it suggests', !(v.evidence && typeof v.evidence === 'object') && 'the evidence levels', !(v.recommended && str(v.recommended.choice)) && 'a recommended decision'].filter(Boolean),
  early: (v) => [!(list(v.directions) && v.directions.every((d) => str(d?.title) && str(d?.buyer))) && 'the directions, each with a title and a buyer', !str(v.read) && 'the opening read'].filter(Boolean),
  numbers: (v) => [!str(v.model) && 'what kind of income it is', !num(v.priceLow) && 'a price'].filter(Boolean),
  direction: (v) => [!str(v.title) && 'a title', !str(v.buyer) && 'a buyer'].filter(Boolean),
  followups: (v) => [!Array.isArray(v.questions) && 'the questions'].filter(Boolean),
  research: (v) => [!Array.isArray(v.items) && 'the sources'].filter(Boolean),
}

// Text for a bounded repair request: the reply exactly as it came back, to
// be returned as valid JSON with nothing added, removed or reworded.
export function repairPrompt(raw) {
  return {
    system: 'You fix JSON syntax. You never change, add or remove content.',
    prompt: [
      'The text below was meant to be one JSON object but is not valid JSON. Return the same object as valid JSON: fix only syntax (quotes, escaping, commas, brackets). Do not add, remove, shorten or reword any value. Return only the JSON, with no code block and no comments.',
      '',
      String(raw),
    ].join('\n'),
  }
}
