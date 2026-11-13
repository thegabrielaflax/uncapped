// Finding follow-up answers that 0.2.0 saved under the wrong question.
//
// In 0.2.0 the follow-up answer boxes kept their text between rounds, so a
// later round's questions could be saved with an earlier round's answers.
// The saved file doesn't record which question an answer was first typed
// for, so this never guesses: it finds follow-up questions that hold the
// identical answer, and the person says which question it belongs to.

import { fingerprint } from './ops.js'

// Follow-up parts of each theme's answer: "question\nanswer" blocks added
// after the person's first answer.
export function followupParts(work) {
  const out = []
  for (const [theme, text] of Object.entries(work?.profile?.answers || {})) {
    const parts = String(text || '').split('\n\n')
    parts.forEach((part, index) => {
      if (index === 0) return
      const nl = part.indexOf('\n')
      if (nl < 0) return
      const q = part.slice(0, nl).trim()
      const a = part.slice(nl + 1).trim()
      if (q.length < 25 || !a) return // a question line, then the answer
      out.push({ theme, index, q, a })
    })
  }
  return out
}

const norm = (t) => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim()

export function pairKey(x, y) {
  return fingerprint([x.q, y.q].sort().join('|') + '|' + norm(x.a))
}

// Pairs of different questions holding the same answer, not yet settled.
export function copiedAnswers(work) {
  const parts = followupParts(work)
  const settled = new Set((work?.discover?.answerRepair?.settled || []).map((s) => s.key))
  const pairs = []
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const x = parts[i]
      const y = parts[j]
      if (norm(x.a).length < 20 || norm(x.a) !== norm(y.a) || norm(x.q) === norm(y.q)) continue
      const key = pairKey(x, y)
      if (!settled.has(key)) pairs.push({ key, first: x, second: y, answer: x.a })
    }
  }
  return pairs
}

// Words in an answer distinctive enough to spot where a recommendation used
// it: names and longer uncommon words.
const COMMON = new Set('about after again also because before being could every first found going happened having helped other people really should their there these thing think those through where which while would years thought wanted women first party'.split(' '))
function distinctive(text) {
  const words = String(text || '').match(/[A-Za-z][A-Za-z'’-]{3,}/g) || []
  const names = words.filter((w) => /^[A-Z][a-z]/.test(w) && !COMMON.has(w.toLowerCase()) && !/^(I|I'm|The|This|That|They|She|He|We|And|But|So|My|It|In|On)$/.test(w))
  return [...new Set(names.map((w) => w.toLowerCase()))]
}

// Which saved recommendations relied on copied answers. A direction is
// marked when its text names something from a copied answer, or claims an
// answer was missing. The whole garden is marked when it was built while
// the copies were saved, because every direction was read from all answers.
// Marks found before a repair are kept (answerRepair.pending) until the
// person reviews them or rebuilds: fixing the answers doesn't fix what was
// already written from them.
export function needsReview(work) {
  const pairs = copiedAnswers(work)
  const early = work?.discover?.early
  const rep = work?.discover?.answerRepair || {}
  const reviewed = rep.reviewed || {}
  const pending = rep.pending || {}
  const words = new Set(pairs.flatMap((p) => distinctive(p.answer)))
  const directions = {}
  for (const d of early?.directions || []) {
    if (reviewed[d.id]) continue
    const text = JSON.stringify(d).toLowerCase()
    const hits = pairs.length ? [...words].filter((w) => text.includes(w)) : []
    const claimsMissing = /didn['’]t come through|did not come through|wasn['’]t saved|answer (?:is|was) missing/.test(text)
    const was = pending.directions?.[d.id]
    if (hits.length || claimsMissing || was) directions[d.id] = { hits: hits.length ? hits : was?.hits || [], claimsMissing: claimsMissing || Boolean(was?.claimsMissing) }
  }
  const offers = {}
  const chosen = work?.discover?.chosenId
  for (const o of work?.offers || []) {
    if (reviewed[`offer:${o.id}`]) continue
    const from = o.fromDirection || (o.status === 'confirmed' ? chosen : null)
    if ((from && directions[from]) || pending.offers?.[o.id]) offers[o.id] = directions[from] || pending.offers[o.id]
  }
  const garden = Boolean(early && !reviewed.garden && (pairs.length || pending.garden))
  return { pairs, garden, directions, offers }
}

// Removes one follow-up block ("question\nanswer") from a theme's answer,
// or replaces its answer. The person's first answer is never touched.
export function editFollowup(text, q, a, replacement) {
  const block = `\n\n${q}\n${a}`
  const s = String(text || '')
  const at = s.indexOf(block)
  if (at < 0) return null
  const next = replacement && replacement.trim() ? `\n\n${q}\n${replacement.trim()}` : ''
  return s.slice(0, at) + next + s.slice(at + block.length)
}
