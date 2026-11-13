// @ts-nocheck
// Substack, version 2 (DESIGN.md 4.3, 7.13, 7.15, 7.16). Drawn from ui2.tsx.
// k is the panel's kit (see v2kit in register.tsx). Nothing here takes $:
// every press goes through k.act, which already holds it.
import * as U from './ui2.tsx'
import { esc, wrapPx, svgOpen, fontsCss } from './brand.js'
import { spacesOf, spaceOf, offersIn, substackFor } from './model.js'

const T = U.T
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif"
const CORM = "'Cormorant Garamond', Baskerville, Georgia, serif"
const ITAL = "'Cormorant Italic', 'Cormorant Garamond', Georgia, serif"
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const NUM = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']
const numWord = (n) => NUM[n] || String(n)
const plural = (n, w) => `${numWord(n)} ${w}${n === 1 ? '' : 's'}`
const str = (v) => String(v ?? '').trim()
const arr = (v) => (Array.isArray(v) ? v : [])
const noDot = (t) => str(t).replace(/[.\s]+$/, '')
// Lowers a sentence's first word only when it's a common word, so names and
// places keep their capital ("London flat dwellers", "Mary, the granola founder").
const COMMON = /^(The|A|An|Your|Our|Their|Other|Some|Owners?|Founders?|People|Person|Solo|Adult|Small|Busy|New|Independent|Freelancers?|Parents?|Renters?|Anyone|Someone|Those|These|This|That|What|When|Where|From|In|On|At|Mostly|Most|Non-technical|First-time|One|Two|Three)\b/
const lowerLead = (t) => { const x = str(t); return COMMON.test(x) ? x[0].toLowerCase() + x.slice(1) : x }
// The evidence tags on a problem (7.15): the word always shows with its glyph.
const EV = { told: ['● Told you', 'doneText', 'spineGreen'], suspects: ['◐ You suspect', 'body', 'accent'], guess: ['○ A guess to test', 'meta', 'spinePink'] }

// ---------------------------------------------------------------- data
// Dates (her rule): only when the first date and the rhythm give one clean
// interval with no skipped weeks. Otherwise the first post's date and the rhythm in words.
const DATE_RE = /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})|(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december),?\s+(\d{4})/i
function parseDate(t) {
  const m = DATE_RE.exec(String(t || ''))
  if (!m) return null
  const mon = MONTHS.indexOf(String(m[1] || m[5]).toLowerCase())
  const d = Number(m[2] || m[4])
  const y = Number(m[3] || m[6])
  return mon >= 0 && d && y ? Date.UTC(y, mon, d) : null
}
function intervals(t) {
  const s = String(t || '').toLowerCase()
  const found = new Set()
  if (/\bevery\s+(?:two|2|other)\s+weeks?\b|\bfortnight(?:ly)?\b|\bbi-?weekly\b/.test(s)) found.add(14)
  if (/\bevery\s+(?:three|3)\s+weeks\b/.test(s)) found.add(21)
  if (/\bevery\s+week\b|\bonce\s+a\s+week\b|\bweekly\b|\b(?:one|an?|1)\s+(?:short\s+)?(?:post|issue|piece|newsletter)s?\s+(?:a|per|each)\s+week\b/.test(s)) found.add(7)
  if (/\bevery\s+month\b|\bmonthly\b|\bonce\s+a\s+month\b/.test(s)) found.add(30)
  return found
}
const short = (ms) => { const d = new Date(ms); return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}` }
const withDay = (ms) => { const d = new Date(ms); return `${DAY[d.getUTCDay()]}, ${MON[d.getUTCMonth()]} ${d.getUTCDate()}` }
function postDates(out, n, firstIx) {
  const cad = out.cadence || {}
  const di = out.distribution || {}
  const first = parseDate(out.first?.when) || parseDate(cad.firstOut)
  const texts = [cad.start, cad.rhythm, di.cadence].map(str).join(' \n ')
  const iv = intervals(texts)
  const skips = /\bskip|\bpause|\bbreak\b|\bholiday|\bexcept\b|\btime off\b/i.test(`${texts} ${str(cad.day)}`)
  if (!first || firstIx !== 0 || skips || iv.size !== 1 || iv.has(30)) return { first, dates: null }
  const step = [...iv][0] * 86400000
  return { first, dates: Array.from({ length: n }, (_, i) => first + i * step) }
}
// How often, in the reader's words, for the masthead ("every two weeks").
function howOften(out) {
  const t = [out.cadence?.start, out.cadence?.rhythm, out.distribution?.cadence].map(str).join(' ').toLowerCase()
  const m = /\bevery\s+(?:other|two|three|four|2|3)\s+weeks?\b|\bevery\s+(?:week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\bonce\s+a\s+(?:week|month)\b|\bweekly\b|\bfortnightly\b|\bmonthly\b|\b(?:one|an?)\s+(?:short\s+)?(?:post|issue)\s+a\s+(week|month)\b/.exec(t)
  if (!m) return ''
  return m[1] ? `once a ${m[1]}` : m[0]
}

function ssData(k, b, o) {
  const f = k.fn
  const work = k.work
  const out = b.output || {}
  const pieces = f.subPieces(out)
  const firstIx = Math.max(0, Math.min(pieces.length - 1, (Number(out.first?.piece) || 1) - 1))
  const cad = out.cadence || {}
  const di = out.distribution || {}
  const { first, dates } = postDates(out, pieces.length, firstIx)
  // With more than one space, this Substack is for the working offer's space only.
  const sp = spacesOf(work).length > 1 ? spaceOf(work, o) : null
  const offers = sp ? offersIn(work, sp.id) : f.chosenOffers(work)
  const firstWhen = str(out.first?.when) || (first ? new Date(first).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '')
  const callNums = arr(out.call?.pieces).map(Number).filter((n) => n >= 1 && n <= pieces.length)
  const om = /^(?:piece|post|issue)\s+(\d+)\s*:/i.exec(str(out.offerMention?.issue))
  const offerNum = om && Number(om[1]) >= 1 && Number(om[1]) <= pieces.length ? Number(om[1]) : null
  return {
    out, pieces, firstIx, dates, first, firstWhen, callNums, offerNum, sp, offers,
    rd: out.reader || {}, cad, di, ov: out.overview || {}, kf: out.knownFor || {}, job: out.job || {},
    voice: out.voice || {}, world: out.world || {}, call: out.call || {}, om: out.offerMention || {},
    rhythm: str(cad.start) || f.firstSentence(cad.rhythm || di.cadence),
    missing: pieces.filter((_, i) => !f.briefOf(out, i)).length,
  }
}
const dateOf = (d, i) => (d.dates ? d.dates[i] : i === d.firstIx && d.first ? d.first : null)

// ---------------------------------------------------------------- small parts
// A copy block whose button says Copied once pressed (as today's CopyArea).
function Copy(k, key, { label, text, copyLabel = 'Copy', note }) {
  const copied = k.ui?.ssCopied === key
  return U.CopyBox(k.E, key, { label, text, note, copyLabel: copied ? 'Copied' : copyLabel, onCopy: async () => { await k.act.copyText(text, 'Copied. Paste it where you write.'); await k.act.setUi({ ssCopied: key }) } })
}
const Italic = (E, key, text, props = {}) => <E.Text key={key} italic color={T.heading} wrap="wrap" {...props}>{`“${str(text).replace(/^[“"']|[”"']$/g, '')}”`}</E.Text>
const Group = (E, key, label, kids) => (kids.filter(Boolean).length ? U.Col(E, key, [label ? U.Cap(E, `${key}-l`, label) : null, ...kids], U.S.tight) : null)
const Card = (E, key, label, kids, tone = 'surface') => (kids.filter(Boolean).length ? U.Panel(E, key, tone, [label ? U.Cap(E, `${key}-l`, label) : null, ...kids]) : null)
// A card with a coloured left edge (ui2 SpineCard), only when it has something in it.
const Edge = (E, key, spine, label, kids, tone = 'surface') => (kids.filter(Boolean).length ? U.SpineCard(E, key, spine, [label ? U.Cap(E, `${key}-l`, label) : null, ...kids], tone) : null)
const ChangeRow = (k, o, extra) => U.Line(k.E, 'ss-change-row', [extra, U.Btn(k.E, 'ws-plan-change', 'Change this strategy in the chat', () => k.act.planInChat('substack', true), 'plain')].filter(Boolean))
// Each numbered section keeps one colour (the same order as ui2's NumHead pills),
// and echoes it on the left edge of its main card.
const SEC_SPINE = () => [T.accent, T.spinePink, T.spineButter, T.spineGreen, T.lensPackage, T.lensPublish]
const SEC_TONE = ['washBlue', 'washPink', 'washButter', 'washGreen', 'surface', 'surface']
const WASHES = ['washBlue', 'washPink', 'washButter', 'washGreen']
const MEDS = () => [[T.accentFill, T.onAccent], [T.lensWith, T.onLensWith], [T.lensTeach, T.onLensTeach], [T.spineGreen, T.surface], [T.lensPackage, T.onLensPackage], [T.lensPublish, T.onLensPublish]]
// A number medallion as a small SVG (never a bordered Box round a Text), filled in its colour.
const medSvg = (n, size = 26, colours) => { const [fill, fg] = colours || MEDS()[(Number(n) - 1) % 6] || MEDS()[0]; return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 0.5}" fill="${fill}"/><text x="${size / 2}" y="${size / 2 + 4.5}" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="${String(n).length > 1 ? 11 : 13}" fill="${fg}">${n}</text></svg>` }
const Med = (E, key, n, fill, fg) => (E.Svg ? <E.Svg key={key} source={medSvg(n, 26, fill ? [fill, fg] : null)} alt={`${n}.`} /> : <E.Text key={key} weight="bold" color={T.heading}>{`${n}.`}</E.Text>)
// A paragraph read at a glance: its first sentence in semibold, then the rest.
function LeadPara(k, key, text, props = {}) {
  const E = k.E
  const t = str(text)
  if (!t) return null
  const first = k.fn.firstSentence(t)
  const rest = t.slice(first.length).trim()
  if (!rest || first.length > 170) return U.Body(E, key, t, props)
  return <E.Text key={key} color={T.body} wrap="wrap" {...props}>{[<E.Text key="l" weight="semibold" color={T.heading}>{first}</E.Text>, ` ${rest}`]}</E.Text>
}
// Short related items side by side: a two-column grid of small cards, each
// with its glyph (or a coloured number), the washes cycling unless one is given.
function SmallCards(k, key, items, { glyph = '→', numbered = false, tone, wide = k.wide, width } = {}) {
  const E = k.E
  const xs = arr(items).map(str).filter(Boolean)
  if (!xs.length) return null
  return U.Grid(E, key, xs.map((t, i) => (
    <E.Box key={`${key}-${i}`} flexDirection="row" gap={1} paddingX={2} paddingY={1} backgroundColor={T[tone || WASHES[i % 4]]}>
      {numbered ? Med(E, `${key}-${i}-n`, i + 1) : <E.Text color={glyph === '✓' ? T.doneText : T.accent} weight="bold">{glyph}</E.Text>}
      <E.Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>{U.Body(E, null, t)}</E.Box>
    </E.Box>
  )), wide, width)
}
// The three kinds of post, each with its colour (spines, map and calendar).
const KIND = () => ({ intro: { spine: T.spinePink, wash: T.washPink, label: 'Intro story' }, method: { spine: T.accent, wash: T.washBlue, label: 'Methodology' }, aud: { spine: T.spineButter, wash: T.washButter, label: 'Audience builder' } })
function kindOf(x) {
  const t = String(x?.type || '').toLowerCase()
  return t.includes('intro') ? 'intro' : t.includes('audience') ? 'aud' : t.includes('method') || t.includes('case') || t.includes('dream') ? 'method' : null
}
// A small legend of those colours, for the kinds this plan has.
function KindLegend(k, key, pieces) {
  const E = k.E
  const kinds = ['intro', 'method', 'aud'].filter((id) => pieces.some((x) => kindOf(x) === id))
  if (!kinds.length) return null
  return U.Line(E, key, kinds.map((id) => (
    <E.Box key={`${key}-${id}`} flexDirection="row" gap={1}>
      <E.Box width={1} flexShrink={0} backgroundColor={KIND()[id].spine} />
      <E.Text size="footnote" color={T.meta}>{KIND()[id].label}</E.Text>
    </E.Box>
  )), { columnGap: 2 })
}

// Brief text (her 10 Nov review): one sentence or step per row, words said
// out loud on their own line, an inline "1) … 2) …" list as numbered rows,
// a sample written over several lines kept on its own lines.
function BriefLine(E, key, text, glyph, compact = false) {
  if (compact) return <E.Text key={key} color={T.body} wrap="wrap">{glyph ? [<E.Text key="g" color={T.accent} weight="semibold">{glyph}</E.Text>, ` ${String(text)}`] : String(text)}</E.Text>
  const m = /^([^:]{1,40}):\s+(.+)$/s.exec(String(text || ''))
  const lead = m && m[1].trim().split(/\s+/).length <= 4 ? m : null
  const body = lead
    ? <E.Text color={T.body} wrap="wrap">{[<E.Text key="b" weight="semibold">{`${lead[1].trim()}:`}</E.Text>, ` ${lead[2]}`]}</E.Text>
    : <E.Text color={T.body} wrap="wrap">{String(text)}</E.Text>
  if (!glyph) return <E.Box key={key} flexDirection="column">{body}</E.Box>
  return (
    <E.Box key={key} flexDirection="row" gap={1}>
      <E.Text color={T.accent} weight="semibold">{glyph}</E.Text>
      <E.Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>{body}</E.Box>
    </E.Box>
  )
}
// The size check (DESIGN 8): Claude Desktop refuses a panel tree over about
// 100,000 characters. This counts a tree the way it is sent (type, key, props,
// text), so a screen can draw a lighter version before it gets there.
export const LIMIT = 76000
export function sizeOf(el) {
  if (el == null || el === false || el === true) return 0
  if (typeof el === 'string' || typeof el === 'number') return String(el).length + 28
  if (Array.isArray(el)) return el.reduce((s, x) => s + sizeOf(x), 0)
  const p = el.props || {}
  const key = el.key ?? p.key
  let s = 40 + (key != null ? 2 * (String(key).length + 9) : 0)
  for (const [kk, v] of Object.entries(p)) {
    if (kk === 'children' || kk === 'key' || typeof v === 'function' || v === undefined) continue
    try { s += kk.length + 4 + (typeof v === 'string' ? v.length + 2 : String(JSON.stringify(v) || '').length) } catch (e) { s += 20 }
  }
  return s + sizeOf(el.children ?? p.children)
}
// Draws a screen at the first level that fits: 0 is the full design, each
// level after it lighter (fewer embedded fonts, then plainer text).
function fit(build, levels = 3) {
  let out = null
  for (let lvl = 0; lvl < levels; lvl++) {
    out = build(lvl)
    if (sizeOf(out) <= LIMIT) return out
  }
  return out
}

// A designed page (7.15): a jump bar, then numbered sections, each head
// giving its answer in semibold, with ↑ Top. Sections with nothing in them are left out.
function Sections(k, prefix, secs, lead) {
  const E = k.E
  const bodyOf = (sec, c) => (typeof sec.body === 'function' ? sec.body(c) : sec.body).filter(Boolean)
  const colour = (n) => ({ spine: SEC_SPINE()[n % 6], tone: SEC_TONE[n % 6], n: n + 1 })
  const live = secs.filter((sec) => sec && bodyOf(sec, colour(0)).length)
  const menu = `${prefix}-menu`
  const open = k.flag(menu)
  const top = () => k.scrollTo(menu)
  const hasLead = lead && bodyOf(lead, colour(0)).length
  // Pressing a section closes the menu, then scrolls there.
  const jumps = [...(hasLead ? [lead] : []), ...live].map((sec) => ({ id: sec.id, label: sec.jump, onPress: async () => { if (k.flag(menu)) await k.toggle(menu); await k.scrollTo(`${prefix}-${sec.id}`) } }))
  return [
    jumps.length > 1 ? U.Line(E, `${prefix}-menu-row`, [U.Btn(E, menu, open ? '☰ Close sections' : '☰ Sections', () => k.toggle(menu))]) : null,
    jumps.length > 1 && open ? U.JumpBar(E, `${prefix}-jump`, jumps) : null,
    hasLead ? U.Col(E, `${prefix}-${lead.id}-sec`, [U.SectionHead(E, `${prefix}-${lead.id}`, { title: lead.title, sub: lead.sub }), ...bodyOf(lead, colour(0))], U.S.tight) : null,
    ...live.map((sec, n) => U.Col(E, `${prefix}-${sec.id}-sec`, [U.NumHead(E, `${prefix}-${sec.id}`, { n: n + 1, title: sec.title, answer: sec.answer, onTop: jumps.length > 1 ? top : null }), ...bodyOf(sec, colour(n))], U.S.tight)),
  ].filter(Boolean)
}

// ---------------------------------------------------------------- art
// The publication masthead (7.13): the one hero drawing, the only place the
// scrapbook look lives here (tape, a hard offset shadow).
function mastheadArt(k, d, b, light = false) {
  const f = k.fn
  const W = Math.max(240, Math.min(k.px || 320, 640)) - 8
  const narrow = W < 400
  const chosen = str(b.chosenName)
  const names = arr(d.out.names).map((x) => str(x?.name)).filter(Boolean)
  const promise = str(d.rd.promise) || f.firstSentence(d.rd.getsEachTime)
  const who = str(d.out.forOffer?.buyer) || f.firstSentence(d.rd.who)
  const often = howOften(d.out)
  const foot = [who && `For ${lowerLead(noDot(who))}`, often].filter(Boolean).join(' · ')
  const inner = W - 56
  const cx = W / 2
  const nameSize = chosen ? (narrow ? 28 : 34) : (narrow ? 22 : 26)
  const nameLines = wrapPx(chosen || "Your name isn't chosen yet", inner, nameSize, 'cormorant')
  // Name ideas break between names, never inside one.
  const ideas = []
  if (!chosen && names.length) {
    const fits = (t) => t.length * 13 * 0.53 <= inner
    let line = 'Name ideas:'
    names.forEach((nm, i) => { const next = `${line}${i ? ' ·' : ''} ${nm}`; if (fits(next) || line === 'Name ideas:') line = next; else { ideas.push(`${line} ·`); line = nm } })
    ideas.push(line)
  }
  const promLines = promise ? wrapPx(promise, inner, narrow ? 14 : 15, 'sans') : []
  const footLines = foot ? wrapPx(foot, inner, 12.5, 'sans') : []
  const parts = []
  let y = 40
  parts.push(`<text x="${cx}" y="${y}" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="11" letter-spacing="1.1" fill="${T.meta}">${esc('YOUR SUBSTACK, AS READERS WILL SEE IT')}</text>`)
  y += 10
  nameLines.forEach((l) => { y += Math.round(nameSize * 1.08); parts.push(`<text x="${cx}" y="${y}" text-anchor="middle" font-family="${CORM}" font-weight="600" font-size="${nameSize}" fill="${chosen ? T.heading : T.meta}">${esc(l)}</text>`) })
  if (ideas.length) { y += 4; ideas.forEach((l) => { y += 19; parts.push(`<text x="${cx}" y="${y}" text-anchor="middle" font-family="${SANS}" font-size="13" fill="${T.body}">${esc(l)}</text>`) }) }
  if (promLines.length) { y += 8; promLines.forEach((l) => { y += 21; parts.push(`<text x="${cx}" y="${y}" text-anchor="middle" font-family="${SANS}" font-size="${narrow ? 14 : 15}" fill="${T.body}">${esc(l)}</text>`) }) }
  y += 18
  parts.push(`<line x1="${cx - 28}" y1="${y}" x2="${cx + 28}" y2="${y}" stroke="${T.artInk}" stroke-width="1.5"/>`)
  if (footLines.length) { y += 4; footLines.forEach((l) => { y += 18; parts.push(`<text x="${cx}" y="${y}" text-anchor="middle" font-family="${SANS}" font-size="12.5" fill="${T.meta}">${esc(l)}</text>`) }) }
  const H = y + 22
  const source = `${svgOpen(W + 6, H + 6, light ? '' : fontsCss(k.FONTS, 'c6'))}
  <rect x="6" y="12" width="${W - 6}" height="${H - 12}" rx="14" fill="${T.artShadow}"/>
  <rect x="1" y="7" width="${W - 6}" height="${H - 12}" rx="14" fill="${T.surface}" stroke="${T.artInk}" stroke-width="1.5"/>
  <g transform="rotate(-3 ${cx} 12)"><rect x="${cx - 48}" y="1" width="96" height="22" fill="${T.highlight}" opacity="0.85"/></g>
  ${parts.join('\n  ')}
</svg>`
  const alt = [`Your Substack's front page: ${chosen || "your name isn't chosen yet"}.`, ideas.length ? `Name ideas: ${names.join(', ')}.` : '', promise, foot ? `${foot}.` : ''].filter(Boolean).join(' ')
  return { source, alt }
}
// "In their words" (7.15): the reader's own sentence in Cormorant italic.
function quoteArt(k, text) {
  const W = Math.max(220, Math.min(k.px || 320, 640) - 48)
  const size = W < 360 ? 17 : 19
  const lines = wrapPx(`“${text}”`, W - 8, size, 'cormorant')
  const lh = Math.round(size * 1.25)
  const h = lines.length * lh + 8
  return { source: `${svgOpen(W, h, fontsCss(k.FONTS, 'cv'))}${lines.map((l, i) => `<text x="0" y="${(i + 1) * lh - 4}" font-family="${ITAL}" font-weight="500" font-style="italic" font-size="${size}" fill="${T.heading}">${esc(l)}</text>`).join('')}</svg>`, alt: `In their words: ${text}` }
}
const Art = (E, key, a) => (E.Svg && a ? <E.Svg key={key} source={a.source} alt={a.alt} /> : null)

// ---------------------------------------------------------------- rows
function postRow(k, d, x, i) {
  const E = k.E
  const kd = KIND()[kindOf(x)]
  const dt = dateOf(d, i)
  const brief = k.fn.briefOf(d.out, i)
  return {
    key: `ss-post-row-${i}`,
    spine: kd?.spine || T.line,
    name: `${i + 1}. ${str(x.headline)}`,
    meta: [kd?.label || String(k.fn.POST_TYPE(x)).split(' · ')[0], dt ? withDay(dt) : ''].filter(Boolean).join(' · '),
    status: brief ? { glyph: '✓', text: 'Brief ready', color: T.doneText } : { glyph: '○', text: 'Brief to write', color: T.meta },
    actions: [U.Btn(E, `ss-post-open-${i}`, 'Open', () => k.act.openPost(i), 'plain')],
  }
}

// ---------------------------------------------------------------- views
function NextView(k, b, o, d, lvl = 0) {
  const E = k.E
  const f = k.fn
  const work = k.work
  const fp = d.pieces[d.firstIx]
  const foot = [d.firstWhen ? `Goes out: ${d.firstWhen}` : '', k.wide && str(d.out.first?.ask) ? `Ends with: ${str(d.out.first.ask)}` : ''].filter(Boolean).join(' · ')
  const next = fp ? U.NextCard(E, 'ss-first', {
    title: 'Write your first post',
    extra: [U.Strong(E, 'ss-first-h', fp.headline), str(d.out.nextAction) ? U.Body(E, 'ss-first-b', f.postWord(d.out.nextAction)) : null],
    foot,
    actions: [U.Btn(E, 'ss-open-first', 'Open your first post', () => k.act.openPost(d.firstIx), true)],
  }) : null
  // The masthead, and the way to its name when none is chosen yet.
  const names = arr(d.out.names).filter((x) => str(x?.name))
  const chooseName = !str(b.chosenName) && names.length
    ? U.Btn(E, 'ss-choose-name', 'Choose a name', async () => { await k.setView('substack', 'strategy'); await k.scrollTo('ss-s-pub') }, 'plain')
    : null
  // Your Substack in one sentence (hub pack 8.19): glance if saved, else the recommendation, else a pointer. Always shows.
  const g = d.out.glance || {}
  const hl = (key, t) => <E.Text key={key} weight="semibold" backgroundColor={T.highlight}>{str(t)}</E.Text>
  const sentence = str(g.reader) && str(g.knownFor) && str(g.cadence) && str(g.goal)
    ? <E.Text key="ss-glance-t" color={T.body} wrap="wrap">{["You're writing ", hl('ss-g-r', g.reader), ', to become known for ', hl('ss-g-k', g.knownFor), ', ', hl('ss-g-c', g.cadence), ', so that ', hl('ss-g-g', noDot(g.goal)), '.']}</E.Text>
    : U.Body(E, 'ss-glance-t', str(d.job.recommendation) || 'Your strategy is in the Strategy and Growth views.')
  const glance = U.SpineCard(E, 'ss-glance', T.accent, [U.Cap(E, 'ss-glance-l', 'Your Substack in one sentence'), sentence, U.Meta(E, 'ss-glance-f', 'Each part is explained in Strategy and Growth. Change any of it in the chat.')], 'washBlue')
  // One Substack for all your offers (decide).
  const yes = d.offers.filter((x) => f.substackSupports(work, x))
  const no = d.offers.filter((x) => !f.substackSupports(work, x))
  const names2 = (xs) => f.nameList(xs.map((x) => `"${f.shortName(x.name)}"`))
  const decide = no.length && !b.focusKept ? U.Panel(E, 'ws-sub-offers', 'decide', [
    U.Cap(E, 'ws-sub-offers-l', d.sp ? 'One Substack for this space' : 'One Substack for all your offers', T.heading),
    U.Body(E, 'ws-sub-offers-b', `Your Substack talks about ${names2(yes) || 'your first offer'}, but not ${names2(no)} yet.`),
    U.Line(E, 'ws-sub-offers-a', [U.Btn(E, 'ws-sub-update', 'Update for all offers in the chat', () => k.act.planInChat('substack', false, '', 'portfolio')), U.Btn(E, 'ws-sub-keep', 'Keep it focused', () => k.act.keepSubstackFocus(), 'plain')]),
  ]) : null
  // Coming up: the three posts after the first.
  const up = d.pieces.map((x, i) => ({ x, i })).filter(({ i }) => i > d.firstIx).slice(0, 3)
  const coming = up.length ? U.Col(E, 'ss-up', [
    U.SectionHead(E, 'ss-up-h', { title: 'Coming up', sub: d.rhythm, right: U.Btn(E, 'ss-see-all', `See all ${d.pieces.length}`, () => k.setView('substack', 'posts'), 'plain') }),
    KindLegend(k, 'ss-up-kinds', up.map(({ x }) => x)),
    U.RowList(E, 'ss-up-list', { rows: up.map(({ x, i }) => postRow(k, d, x, i)), limit: 3 }),
  ], U.S.tight) : null
  // Built around, and the other spaces' Substacks.
  const otherSpaces = d.sp ? spacesOf(work).filter((x) => x.id !== d.sp.id) : []
  const built = <E.Box key="ss-built" flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
    {U.Meta(E, 'ss-built-l', 'Built around')}
    <E.Text key="ss-built-t" size="footnote" weight="semibold" color={T.heading} wrap="wrap">{d.sp && d.offers.length > 1 ? `${d.sp.name}: ${d.offers.map((x) => f.shortName(x.name)).join(', ')}` : f.shortName(o.name, 80)}</E.Text>
  </E.Box>
  const other = otherSpaces.length ? U.Line(E, 'ss-other-spaces', [
    U.Meta(E, 'ss-other-t', `${otherSpaces.length === 1 ? `Your other space, "${otherSpaces[0].name}", has its` : 'Your other spaces have their'} own Substack.`),
    otherSpaces.length === 1
      ? U.Btn(E, 'ss-other-open', 'Open it', () => k.act.openSpaceStep(otherSpaces[0].id, substackFor(work, otherSpaces[0].id)?.output ? 'substack' : 'space'), 'plain')
      : U.Btn(E, 'ss-other-open', 'Your spaces', () => k.act.goStep('done'), 'plain'),
  ]) : null
  return [
    next,
    Art(E, 'ss-masthead', mastheadArt(k, d, b, lvl > 0)),
    glance,
    decide,
    coming,
    U.Col(E, 'ss-foot', [built, other, ChangeRow(k, o, chooseName)], U.S.tight),
  ]
}

function PostsView(k, b, o, d) {
  const E = k.E
  const n = d.pieces.length
  const missing = d.missing
  const briefs = missing ? U.Panel(E, 'ss-missing-briefs', 'next', [
    U.Body(E, 'ss-missing-t', missing === n ? `Your ${n} posts don't have their full briefs yet: the idea, where to open, the story beat by beat and where to land it.` : `${missing} of your ${n} posts ${missing === 1 ? "doesn't" : "don't"} have ${missing === 1 ? 'its' : 'their'} full brief yet.`),
    U.Line(E, 'ss-missing-a', k.act.OpSlot(k.c, 'ss-all-briefs', [U.Btn(E, 'ss-all-briefs', missing === n ? 'Write every brief' : 'Write the rest', () => k.act.writeAllBriefs('ss-all-briefs'), true)])),
  ]) : null
  return [
    briefs,
    U.Col(E, 'ss-list', [
      U.SectionHead(E, 'ss-list-h', { title: 'In the order to publish them', sub: n ? 'Open any post for its full brief.' : '' }),
      KindLegend(k, 'ss-list-kinds', d.pieces),
      U.RowList(E, 'ss-posts', { rows: d.pieces.map((x, i) => postRow(k, d, x, i)), limit: Math.max(10, n), empty: 'No posts saved yet.' }),
    ], U.S.tight),
    ChangeRow(k, o),
  ]
}

function StrategyView(k, b, o, d, lvl = 0) {
  return [
    ...Sections(k, 'ss-s', strategySecs(k, b, o, d, lvl)),
    ChangeRow(k, o),
  ]
}
// Today's seven Strategy sections. A v3 strategy draws them inside "What this
// is built on"; noNames leaves the name cards out there while Your publication shows them.
function strategySecs(k, b, o, d, lvl = 0, opts = {}) {
  const E = k.E
  const f = k.fn
  const { out, rd, ov, kf, job, voice, world } = d
  const wide = k.wide
  // 1. Publication: names as choice cards (white, the chosen one with an accent edge), the look, what to avoid.
  const names = arr(out.names).filter((x) => str(x?.name))
  const chosen = str(b.chosenName)
  const promise = str(rd.promise) || f.firstSentence(rd.getsEachTime)
  const avoid = out.branding?.avoid
  const pub = {
    id: 'pub', jump: 'Publication', title: 'Your publication',
    answer: chosen ? `${chosen}${promise ? `: ${promise}` : ''}` : promise || (str(out.namesGist) ? `Name ideas: ${str(out.namesGist)}` : ''),
    body: (c) => [
      chosen && !names.some((x) => str(x.name) === chosen) ? Edge(E, 'ss-s-chosen', T.accent, 'Your name', [U.Strong(E, 'ss-s-chosen-n', chosen)]) : null,
      names.length && !opts.noNames ? Group(E, 'ss-s-names', chosen ? 'Name ideas' : 'Choose a name', [U.Grid(E, 'ss-s-names-g', names.map((x, i) => {
        const on = chosen === str(x.name)
        const kids = [
          <E.Box key={`ss-s-name-${i}-top`} flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" gap={1}>
            <E.Box flexShrink={1} minWidth={0}>{U.Strong(E, null, x.name)}</E.Box>
            {on ? U.Chip(E, `ss-s-name-${i}-c`, 'Chosen ✓', 'done') : U.Btn(E, `ss-name-use-${i}`, 'Use this name', () => k.act.useSubstackName(str(x.name)), 'plain')}
          </E.Box>,
          str(x.why) ? U.Meta(E, `ss-s-name-${i}-w`, x.why) : null,
        ]
        return on ? U.SpineCard(E, `ss-s-name-${i}`, T.accent, kids, 'washBlue') : U.Panel(E, `ss-s-name-${i}`, 'surface', kids)
      }), wide)]) : null,
      str(out.branding?.direction) || (Array.isArray(avoid) ? avoid.length : str(avoid)) ? U.Grid(E, 'ss-s-look', [
        Edge(E, 'ss-s-look-d', c.spine, 'The look', [str(out.branding?.direction) ? LeadPara(k, 'ss-s-look-t', out.branding.direction) : null], c.tone),
        Array.isArray(avoid) ? (avoid.length ? U.Callout(E, 'ss-s-avoid', '!', U.Col(E, 'ss-s-avoid-c', [U.Strong(E, null, 'Avoid'), U.Bullets(E, 'ss-s-avoid-l', avoid, '•')], U.S.none)) : null)
          : str(avoid) ? U.Callout(E, 'ss-s-avoid', '!', <E.Text key="ss-s-avoid-t" color={T.body} wrap="wrap">{[<E.Text key="b" weight="semibold" color={T.heading}>Avoid:</E.Text>, ` ${str(avoid)}`]}</E.Text>) : null,
      ], wide) : null,
    ],
  }
  // 2. Why: the job, the goal, the reasoning.
  const whyAnswer = str(job.gist) || f.firstSentence(job.recommendation)
  const rec = str(job.gist) ? str(job.recommendation) : f.afterGist(whyAnswer, job.recommendation)
  const why = {
    id: 'why', jump: 'Why', title: "Why you're writing", answer: whyAnswer,
    body: (c) => [
      rec ? U.Body(E, 'ss-s-rec', rec) : null,
      str(job.goal) ? Edge(E, 'ss-s-goal', c.spine, 'Your first goal', [U.Strong(E, 'ss-s-goal-t', f.postWord(job.goal))], c.tone) : null,
      str(job.why) ? U.Callout(E, 'ss-s-why-c', 'i', job.why) : null,
    ],
  }
  // 3. The reader: a profile card, their week, what they say and put off side by side, what you notice.
  const whoText = str(ov.writingFor) || str(rd.who)
  const quote = str(rd.workingThrough)
  const ownWords = /^(I|I'm|I've|I'd|I'll|My|We|We're|Our)\b/.test(quote.replace(/^[“"']/, ''))
  const moment = str(out.forOffer?.moment)
  const complaints = arr(world.complaints).map(str).filter(Boolean)
  const putOff = arr(world.putOff).map(str).filter(Boolean)
  const reader = {
    id: 'reader', jump: 'Reader', title: 'Your reader',
    answer: str(rd.gist) || f.firstSentence(ov.writingFor) || f.firstSentence(rd.who),
    body: (c) => [
      Edge(E, 'ss-s-profile', c.spine, null, [
        whoText ? U.Cap(E, 'ss-s-who-l', 'Who they are') : null,
        whoText ? LeadPara(k, 'ss-s-who', whoText) : null,
        quote && ownWords ? (
          <E.Box key="ss-s-words" flexDirection="column" gap={U.S.none} paddingX={2} paddingY={1} backgroundColor={T[c.tone] || T.washButter}>
            {U.Cap(E, 'ss-s-words-l', 'In their words')}
            {E.Svg && lvl === 0 ? Art(E, 'ss-s-words-a', quoteArt(k, quote.replace(/^[“"]|[”"]$/g, ''))) : Italic(E, 'ss-s-words-t', quote)}
          </E.Box>
        ) : null,
        moment ? U.Cap(E, 'ss-s-mom-l', "The moment they're in") : null,
        moment ? U.Body(E, 'ss-s-mom', moment) : null,
        quote && !ownWords ? U.Cap(E, 'ss-s-wt-l', "What they're working through") : null,
        quote && !ownWords ? LeadPara(k, 'ss-s-wt', quote) : null,
        U.Facts(E, 'ss-s-rfacts', [['Every issue gives them', rd.getsEachTime], ['Are they the buyer?', rd.relationToBuyer]], wide, false),
      ]),
      str(world.gist) || str(world.week) ? Edge(E, 'ss-s-week', T.spineGreen, 'Their week', [str(world.gist) ? U.Strong(E, 'ss-s-week-g', world.gist) : null, str(world.week) ? U.Body(E, 'ss-s-week-t', world.week) : null], 'washGreen') : null,
      complaints.length || putOff.length ? U.Grid(E, 'ss-s-say', [
        complaints.length ? Edge(E, 'ss-s-comp', T.spinePink, 'What they say', complaints.map((t, i) => Italic(E, `ss-s-comp-${i}`, t)), 'washPink') : null,
        putOff.length ? Edge(E, 'ss-s-off', T.spineButter, 'What they put off', [U.Bullets(E, 'ss-s-off-l', putOff, '•')], 'washButter') : null,
      ], wide) : null,
      arr(world.notice).length ? Group(E, 'ss-s-notice', "What you notice that they don't", [SmallCards(k, 'ss-s-notice-g', world.notice, { glyph: '✓', tone: 'washGreen' })]) : null,
      U.Line(E, 'ss-s-change', [U.Btn(E, 'ss-change-reader', 'Change who you write for', () => k.act.toChat('plan', `Substack strategy for my working offer: ${o.name} (change who I write for)`, 'Tell Claude who you would rather write for, in the chat beside this panel.'), 'plain')]),
    ],
  }
  // 4. The problems as cards, each edged and dotted by where it came from; then how the offer fits.
  const ovProblems = arr(ov.problems).map((x) => (typeof x === 'string' ? { text: x } : x || {})).filter((x) => str(x.text))
  const problems = ovProblems.length ? ovProblems : [rd.workingThrough].filter((x) => str(x)).map((text) => ({ text }))
  const sourced = problems.some((x) => EV[str(x.source).toLowerCase()])
  const present = Object.keys(EV).filter((src) => problems.some((x) => str(x.source).toLowerCase() === src))
  // The tag reads as one line ("● Told you"); its colour is repeated on the card's left edge.
  const evTag = (src, key) => <E.Text key={key} size="footnote" weight="bold" color={T[EV[src][1]]}>{EV[src][0]}</E.Text>
  const fits = [['How your offer fits', ov.offerFits], ["What you'll write about", ov.writeAbout], ['How posts lead to calls', ov.toCalls], ["Why they'll subscribe", ov.whySubscribe]].filter(([, v]) => str(v))
  const probs = {
    id: 'problems', jump: 'Problems', title: "The problems you'll write about",
    answer: problems.length ? `${plural(problems.length, 'problem')}${sourced ? ', each marked by where it came from.' : ' to write about.'}` : f.firstSentence(ov.writeAbout),
    body: (c) => [
      present.length ? U.Line(E, 'ss-s-ev', present.map((src) => evTag(src, `ss-s-ev-${src}`)), { columnGap: 2 }) : null,
      problems.length ? U.Grid(E, 'ss-s-probs', problems.map((x, i) => {
        const src = str(x.source).toLowerCase()
        const ev = EV[src]
        return U.SpineCard(E, `ss-s-p-${i}`, ev ? T[ev[2]] : T.line, [
          ev ? evTag(src, `ss-s-p-${i}-ev`) : null,
          U.Strong(E, `ss-s-p-${i}-t`, x.text),
          str(x.from) ? U.Meta(E, `ss-s-p-${i}-f`, `${f.sentenceCase(noDot(x.from))}.`) : null,
        ])
      }), wide) : null,
      fits.length ? U.Grid(E, 'ss-s-fits', fits.map(([l, v], i) => Edge(E, `ss-s-fit-${i}`, c.spine, l, [LeadPara(k, `ss-s-fit-${i}-t`, v)], i % 3 === 0 ? c.tone : 'surface')), wide) : null,
    ],
  }
  // 5. What you'll be known for.
  const known = {
    id: 'known', jump: 'Known for', title: "What you'll be known for", answer: str(kf.gist) || str(kf.lane),
    body: (c) => [
      Edge(E, 'ss-s-belief', c.spine, str(kf.belief) ? 'What you believe' : null, [str(kf.belief) ? Italic(E, 'ss-s-belief-t', kf.belief) : null, str(kf.gist) && str(kf.lane) ? U.Body(E, 'ss-s-lane', kf.lane) : null], 'washButter'),
      arr(kf.angles).length ? Group(E, 'ss-s-angles', 'Angles to write from', [SmallCards(k, 'ss-s-angles-g', kf.angles)]) : null,
      str(kf.howIssuesBuild) ? U.Callout(E, 'ss-s-build', '→', <E.Text key="ss-s-build-t" color={T.body} wrap="wrap">{[<E.Text key="b" weight="semibold" color={T.heading}>How issues build:</E.Text>, ` ${str(kf.howIssuesBuild)}`]}</E.Text>) : null,
    ],
  }
  // 6. Series, as butter-edged cards.
  const series = arr(out.series).filter((x) => str(x?.name))
  const ser = {
    id: 'series', jump: 'Series', title: 'Your series', answer: series.length ? `${numWord(series.length)} series you can come back to.` : '',
    body: () => [series.length ? U.Grid(E, 'ss-s-series', series.map((x, i) => U.SpineCard(E, `ss-series-${i}`, T.spineButter, [
      U.Strong(E, `ss-series-${i}-n`, x.name),
      str(x.what) ? U.Body(E, `ss-series-${i}-w`, x.what) : null,
      str(x.example) ? (
        <E.Box key={`ss-series-${i}-ex`} flexDirection="column" gap={U.S.none} paddingX={1} backgroundColor={T.washButter}>
          {U.Meta(E, null, 'For example')}
          {Italic(E, null, x.example, { color: T.body })}
        </E.Box>
      ) : null,
      str(x.fromYou) ? U.Meta(E, `ss-series-${i}-f`, `From you: ${x.fromYou}`) : null,
    ])), wide) : null],
  }
  // 7. Voice, with an example in their own words.
  const sample = str(b.answers?.sample || b.answers?.coffee)
  const example = sample ? (f.sentencesOf(sample).slice(0, 2).join(' ') || sample).slice(0, 280) : ''
  const words = arr(voice.words).map((w) => `"${String(w).replace(/^"|"$/g, '')}"`).join(', ')
  const voi = {
    id: 'voice', jump: 'Voice', title: 'Your voice', answer: str(voice.gist) || f.firstSentence(voice.profile),
    body: (c) => (str(voice.profile) || example || str(voice.pov) ? [
      U.Grid(E, 'ss-s-voice', [
        Edge(E, 'ss-s-sound', c.spine, str(voice.profile) || words ? 'How you sound' : null, [str(voice.profile) ? LeadPara(k, 'ss-s-sound-t', voice.profile) : null, words ? U.Meta(E, 'ss-s-words-u', `Words you use: ${words}`) : null]),
        Edge(E, 'ss-s-pov', T.spinePink, str(voice.pov) ? 'Your point of view' : null, [str(voice.pov) ? Italic(E, 'ss-s-pov-t', voice.pov) : null], 'washPink'),
      ], wide),
      example ? Edge(E, 'ss-s-example', T.spineButter, 'In your own words', [Italic(E, 'ss-s-example-t', example, { color: T.body })], 'washButter') : null,
    ] : []),
  }
  return [pub, why, reader, probs, known, ser, voi]
}

function GrowthView(k, b, o, d) {
  const E = k.E
  const f = k.fn
  const { out, cad, di, call, om } = d
  const wide = k.wide
  // 1. Rhythm: the facts, the calendar in each post's colour when dates can be worked out, around each issue.
  const around = arr(di.aroundEachIssue).map(str).filter(Boolean).map((t) => f.postWord(t))
  const firstLine = str(out.first?.when) ? `Post ${d.firstIx + 1} goes out ${noDot(out.first.when)}.` : str(cad.firstOut) ? f.postWord(cad.firstOut) : ''
  const rhythm = {
    id: 'rhythm', jump: 'Rhythm', title: 'Your rhythm', answer: d.rhythm,
    body: (c) => [
      str(cad.day) || str(cad.rhythm) || firstLine ? U.Grid(E, 'ss-g-rfacts', [
        Edge(E, 'ss-g-day', c.spine, 'Which day', [str(cad.day) ? LeadPara(k, 'ss-g-day-t', cad.day) : null], c.tone),
        Edge(E, 'ss-g-pace', c.spine, 'Why this pace', [str(cad.rhythm) ? LeadPara(k, 'ss-g-pace-t', cad.rhythm) : null]),
        Edge(E, 'ss-g-first', T.spinePink, 'First post', [firstLine ? U.Strong(E, 'ss-g-first-t', firstLine) : null], 'washPink'),
      ], wide) : null,
      d.dates ? Group(E, 'ss-g-cal', 'Your publishing calendar', [U.Line(E, 'ss-g-cal-r', d.dates.map((dt, i) => {
        const kd = KIND()[kindOf(d.pieces[i])]
        return (
          <E.Box key={`ss-g-day-${i}`} flexDirection="row" backgroundColor={kd ? kd.wash : T.surface}>
            <E.Box width={1} flexShrink={0} backgroundColor={kd ? kd.spine : T.line} />
            <E.Box flexDirection="column" alignItems="center" paddingX={1}>
              <E.Text size="caption" weight="semibold" color={T.meta}>{`Post ${i + 1}`}</E.Text>
              <E.Text size="footnote" weight="semibold" color={T.heading}>{short(dt)}</E.Text>
            </E.Box>
          </E.Box>
        )
      })), KindLegend(k, 'ss-g-cal-kinds', d.pieces)]) : null,
      around.length ? Group(E, 'ss-g-around', 'Around each issue', [U.Grid(E, 'ss-g-around-g', around.map((t, i) => {
        const l = f.naturalLead(t)
        return U.Panel(E, `ss-g-ar-${i}`, WASHES[i % 4], [
          <E.Box key={`ss-g-ar-${i}-h`} flexDirection="row" gap={1} alignItems="center">{[Med(E, `ss-g-ar-${i}-m`, i + 1), l ? <E.Box key={`ss-g-ar-${i}-lb`} flexShrink={1} minWidth={0}>{U.Strong(E, null, l.lead)}</E.Box> : null].filter(Boolean)}</E.Box>,
          U.Body(E, `ss-g-ar-${i}-t`, l ? f.sentenceCase(l.rest) : t),
        ])
      }), wide, around.length === 3 ? '31%' : '48%')]) : null,
    ],
  }
  // 2. Notes, each one ready to copy, on a card in the section's colour.
  const notes = arr(out.notes).filter((n) => n?.text || n?.say)
  const notesSec = {
    id: 'notes', jump: 'Notes', title: 'Notes, ready to post', answer: notes.length ? `${plural(notes.length, 'Note')}, ready to copy, in the order to post them.` : '',
    body: (c) => (notes.length ? [
      U.Callout(E, 'ss-g-n-what', 'i', 'A Note is a short post on Substack, like a tweet. Copy it, post it, and change any word.'),
      ...notes.map((n, i) => U.SpineCard(E, `ss-g-note-${i}`, c.spine, [
        <E.Text key={`ss-g-note-${i}-w`} size="footnote" weight="semibold" color={T.accent} wrap="wrap">{f.postWord(str(n.when) || (n.forPiece ? `for post ${n.forPiece}` : 'Anytime'))}</E.Text>,
        str(n.text) ? Copy(k, `ss-note-${i}`, { text: n.text, copyLabel: 'Copy Note' }) : U.Body(E, `ss-g-note-${i}-s`, n.say),
        str(n.action) || str(n.why) ? <E.Text key={`ss-g-note-${i}-y`} size="footnote" color={T.meta} wrap="wrap">{[str(n.action) ? <E.Text key="a" weight="semibold" color={T.body}>{`${f.sentenceCase(noDot(n.action))}. `}</E.Text> : null, f.firstSentence(n.why)].filter(Boolean)}</E.Text> : null,
      ])),
      str(cad.notes) ? U.Meta(E, 'ss-g-n-cad', `Around every post: ${f.lowerFirst(f.postWord(cad.notes))}`) : null,
    ] : []),
  }
  // The invitation: the offer's own wording, else a post's call to book.
  const pieces = d.pieces
  const fp = pieces[d.firstIx]
  const bookPiece = pieces.find((x) => (x.cta?.kind === 'book a call' && x.cta?.wording) || (x.next?.kind === 'book a call' && x.next?.wording))
  const fallbackInv = str(bookPiece?.cta?.wording || bookPiece?.next?.wording || fp?.cta?.wording)
  const offerInv = str(om.invitation)
  // 3. The call.
  const callSec = {
    id: 'call', jump: 'The call', title: 'The call you invite people to',
    answer: str(call.forWho) ? `For ${lowerLead(noDot(call.forWho))}.` : f.firstSentence(d.ov.toCalls),
    body: (c) => (str(call.forWho) || str(call.expect) || str(d.ov.toCalls) || d.callNums.length || (!offerInv && fallbackInv) ? [
      Edge(E, 'ss-g-call', c.spine, str(call.expect) ? 'What they can expect' : str(d.ov.toCalls) ? 'What to bring, and what they leave with' : null, [
        str(call.expect) || str(d.ov.toCalls) ? LeadPara(k, 'ss-g-call-e', str(call.expect) || d.ov.toCalls) : null,
        U.Meta(E, 'ss-g-call-paid', `This call is a short introduction, not your paid offer. The offer you're testing is ${o.name}.`),
        d.callNums.length ? U.Line(E, 'ss-g-call-in', [U.Cap(E, 'ss-g-call-in-l', 'Invited in'), ...d.callNums.map((n) => U.Btn(E, `ss-call-post-${n}`, `Post ${n}`, () => k.act.openPost(n - 1)))]) : null,
      ], c.tone),
      !offerInv && fallbackInv ? Copy(k, 'ss-inv', { label: 'The invitation to copy', text: fallbackInv, copyLabel: 'Copy invitation' }) : null,
    ] : []),
  }
  // 4. Where the offer comes in.
  const where = [f.postWord(str(om.issue)), str(om.where)].map(noDot).filter(Boolean).join('. ')
  const offerSec = {
    id: 'offer', jump: 'Your offer', title: 'Where your offer comes in', answer: str(om.gist) || f.offerWhere(om),
    body: (c) => [
      where || str(om.inviteType) ? U.Grid(E, 'ss-g-ofacts', [
        Edge(E, 'ss-g-where', c.spine, 'Where', [where ? U.Body(E, 'ss-g-where-t', `${where}.`) : null, d.offerNum ? U.Line(E, 'ss-g-o-open', [U.Btn(E, 'ss-offer-post', `Open post ${d.offerNum}`, () => k.act.openPost(d.offerNum - 1), 'plain')]) : null], c.tone),
        Edge(E, 'ss-g-how', c.spine, 'How you invite', [str(om.inviteType) ? U.Strong(E, 'ss-g-how-t', f.sentenceCase(str(om.inviteType))) : null]),
      ], wide) : null,
      offerInv ? Copy(k, 'ss-inv', { label: 'What to say', text: offerInv, copyLabel: 'Copy invitation' }) : null,
      str(om.why) ? U.Callout(E, 'ss-g-o-why', 'i', om.why) : null,
    ],
  }
  // 5. Finding readers: who to send it to as small cards, then what to do when someone replies.
  const shareAnswer = str(di.gist) || f.firstSentence(di.start)
  const startText = str(di.gist) ? str(di.start) : f.afterGist(shareAnswer, di.start)
  const share = {
    id: 'share', jump: 'Sharing', title: 'Finding your first readers', answer: shareAnswer,
    body: (c) => [
      startText || str(di.cadence) ? Edge(E, 'ss-g-start', c.spine, null, [startText ? LeadPara(k, 'ss-g-s-start', startText) : null, str(di.cadence) ? U.Meta(E, 'ss-g-s-cad', di.cadence) : null], 'washBlue') : null,
      arr(di.shareWith).length ? Group(E, 'ss-g-send', 'Send your first post to', [SmallCards(k, 'ss-g-send-g', di.shareWith, { tone: 'washBlue' })]) : null,
      str(di.toConversation) ? U.Callout(E, 'ss-g-reply', '✓', <E.Text key="ss-g-reply-t" color={T.body} wrap="wrap">{[<E.Text key="b" weight="semibold" color={T.heading}>When someone replies:</E.Text>, ` ${di.toConversation}`]}</E.Text>) : null,
    ],
  }
  // 6. Signals as numbered cards, strongest first; likes move into a framing note.
  const xs = arr(out.signals?.watch).map(str).filter(Boolean)
  const tail = xs.length > 1 && /\blikes?\b|follower/i.test(xs[xs.length - 1]) ? xs.pop() : ''
  const signals = {
    id: 'signals', jump: 'Signals', title: "What tells you it's working", answer: xs.length ? 'Strongest signs first.' : '',
    body: () => [
      xs.length ? SmallCards(k, 'ss-g-sig', xs, { numbered: true, tone: 'surface' }) : null,
      tail ? U.Callout(E, 'ss-g-sig-i', 'i', `${f.sentenceCase(noDot(tail))}.${/busy|mean least/i.test(tail) ? '' : ' They feel busy but mean least.'}`) : null,
      str(out.signals?.useThem) ? LeadPara(k, 'ss-g-sig-use', out.signals.useThem) : null,
    ],
  }
  // 7. Who to study: saved examples, with what the plan says about each.
  const studied = arr(out.studied).filter((x) => str(x?.name))
  const examples = arr(b.examples).filter((x) => str(x?.name)).map((x) => ({ ...x, ...(studied.find((y) => str(y.name).toLowerCase() === str(x.name).toLowerCase()) || {}) }))
  const pubs = [...examples, ...studied.filter((y) => !examples.some((x) => str(x.name).toLowerCase() === str(y.name).toLowerCase()))]
  const study = {
    id: 'study', jump: 'Study', title: 'Who to study', answer: pubs.length ? `${plural(pubs.length, 'publication')} to learn from.` : '',
    body: () => (pubs.length ? [U.Grid(E, 'ss-g-study', pubs.map((x, i) => U.SpineCard(E, `ss-g-st-${i}`, SEC_SPINE()[i % 4], [
      <E.Box key={`ss-g-st-${i}-h`} flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" gap={1}>
        <E.Box flexShrink={1} minWidth={0}>{E.Link && str(x.url) ? <E.Link href={x.url} label={x.name} /> : U.Strong(E, null, x.name)}</E.Box>
        {str(x.why) ? U.Chip(E, `ss-g-st-${i}-c`, f.sentenceCase(x.why), 'quiet') : null}
      </E.Box>,
      str(x.takeaway) || str(x.study) ? U.Body(E, `ss-g-st-${i}-s`, str(x.takeaway) || `Study: ${str(x.study)}`) : null,
      str(x.angle) ? U.Meta(E, `ss-g-st-${i}-a`, `How yours differs: ${x.angle}`) : null,
    ])), wide)] : []),
  }
  return [
    ...Sections(k, 'ss-g', [rhythm, notesSec, callSec, offerSec, share, signals, study]),
    ChangeRow(k, o),
  ]
}

// ---------------------------------------------------------------- version 3
// A strategy written to the v3 standard (11 Nov, SUBSTACK-V3-PAGE-HANDOFF.md):
// every post has a full card. Chosen by the saved shape; a strategy saved in
// today's shape keeps today's views, and nothing saved is ever converted.
export function isV3(out) {
  if (!out || typeof out !== 'object') return false
  if (out.publication && typeof out.publication === 'object') return true
  return arr(out.pieces).some((x) => x && str(x.reader) && str(x.problem) && str(x.offerFit))
}
// A post whose card is written (an outline has only its headline, kind, move and status).
// The same test as builders.js cardWritten, which decides what Write the rest writes.
const written = (x) => Boolean(x && str(x.reader) && str(x.problem) && str(x.offerFit) && arr(x.arc).length)
const STATUS3 = { ready: ['✓ Ready to write', 'done'], detail: ['◐ Needs a detail', 'hl'], first: ['! Do this first', 'decide'] }
function statusOf(x) {
  const s = str(x?.status).toLowerCase()
  return s.startsWith('ready') ? 'ready' : s.includes('detail') ? 'detail' : s.includes('first') ? 'first' : null
}
// The ending's shape (standard part 4): its name and one line on what it does.
const SHAPES = {
  next: ['Your next step', "A short section that carries the post's argument on to your free call."],
  door: ['Soft door', 'A question for readers and a share line, with your footer underneath. No push.'],
  end: ['Read to the end', "The post tells readers early that there's an invitation at the end, then ends on it."],
}
function shapeOf(s) {
  const t = str(s).toLowerCase()
  if (!t) return null
  const id = t.includes('next') ? 'next' : t.includes('door') ? 'door' : t.includes('end') ? 'end' : null
  return id ? SHAPES[id] : [t[0].toUpperCase() + t.slice(1), '']
}
const cap1 = (t) => { const x = str(t); return x ? x[0].toUpperCase() + x.slice(1) : x }
// What a piece of research gives the post (12 Nov), as its small label.
const GIVES_LABEL = { tension: 'Tension', example: 'Example', 'reader question': 'Reader question', finding: 'Finding', 'point of view': 'Point of view', 'cultural moment': 'Cultural moment' }
const andList = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
const longDay = (ms) => new Date(ms).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
// A link's label (handoff 5): the reference's own source name when it gives
// one, "Wikipedia", "Read on Substack", else the site's domain. Never the raw address.
export function linkLabel(url, source) {
  const s = str(source)
  if (s && !/^https?:|\//i.test(s)) return s
  const m = /^https?:\/\/([^/?#:\s]+)/i.exec(str(url))
  if (!m) return ''
  const host = m[1].toLowerCase().replace(/^www\./, '')
  if (host === 'wikipedia.org' || host.endsWith('.wikipedia.org')) return 'Wikipedia'
  if (host === 'substack.com' || host.endsWith('.substack.com')) return 'Read on Substack'
  return host
}
function RefLink(E, key, url, source) {
  const u = str(url)
  const label = /^https?:\/\/\S+$/i.test(u) ? linkLabel(u, source) : ''
  if (!label) return null
  return E.Link ? <E.Link key={key} href={u} label={`${label} ↗`} /> : U.Meta(E, key, `${label} ↗`)
}
// The status chip (handoff 5): ready in the done style, needs a detail on the highlighter, do this first as a decision.
function Pill(E, key, text, kind) {
  if (kind !== 'hl') return U.Chip(E, key, text, kind)
  return (
    <E.Box key={key} paddingX={1} borderStyle="round" borderColor={T.highlight} backgroundColor={T.highlight} alignSelf="flex-start" flexShrink={0}>
      <E.Text size="caption" weight="semibold" color={T.body}>{String(text)}</E.Text>
    </E.Box>
  )
}
const StatusChip = (E, key, x) => { const s = STATUS3[statusOf(x)]; return s ? Pill(E, key, s[0], s[1]) : null }
// "[add your booking link]" and the like, on the highlighter wherever it appears.
function marked(E, text) {
  const parts = str(text).split(/(\[add your[^\]]*\])/i).filter(Boolean)
  return parts.map((p, n) => (/^\[add your/i.test(p) ? <E.Text key={`h${n}`} weight="semibold" backgroundColor={T.highlight}>{p}</E.Text> : p))
}
const Marked = (E, key, text) => <E.Text key={key} color={T.body} wrap="wrap">{marked(E, text)}</E.Text>
const hasLink = (t) => /\[add your booking link\]/i.test(str(t))
// A thin rule between a card's head and its body.
function RuleLine(k, key) {
  if (!k.E.Svg) return null
  const w = Math.max(200, Math.min(k.colPx || k.px, k.px) - 24)
  return <k.E.Svg key={key} source={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 3" width="${w}" height="3"><rect y="1" width="${w}" height="1" fill="${T.line}"/></svg>`} alt="" />
}
// A numbered circle for a timeline (the post's beats, Before it goes out).
const ringSvg = (n) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 26" width="26" height="26"><circle cx="13" cy="13" r="11.75" fill="${T.surface}" stroke="${T.artInk}" stroke-width="1.5"/><text x="13" y="17.5" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="13" fill="${T.heading}">${n}</text></svg>`
// A timeline: a numbered circle per step, a line joining them, every step open.
function Timeline(k, key, steps) {
  const E = k.E
  const xs = steps.filter((s) => s && s.filter(Boolean).length)
  if (!xs.length) return null
  return (
    <E.Box key={key} flexDirection="column">
      {xs.map((s, n) => (
        <E.Box key={`${key}-${n}`} flexDirection="row" gap={1}>
          <E.Box key={`${key}-${n}-r`} flexDirection="column" alignItems="center" flexShrink={0} width={4}>
            {E.Svg ? <E.Svg key={`${key}-${n}-m`} source={ringSvg(n + 1)} alt={`${n + 1}.`} /> : <E.Text key={`${key}-${n}-m`} weight="bold" color={T.heading}>{`${n + 1}.`}</E.Text>}
            {n < xs.length - 1 ? <E.Box key={`${key}-${n}-ln`} width={1} flexGrow={1} backgroundColor={T.line} /> : null}
          </E.Box>
          <E.Box key={`${key}-${n}-b`} flexDirection="column" gap={U.S.none} flexGrow={1} flexShrink={1} minWidth={0} paddingBottom={n < xs.length - 1 ? 1 : 0}>
            {s.filter(Boolean)}
          </E.Box>
        </E.Box>
      ))}
    </E.Box>
  )
}
// Two across when the content is 500 px or wider, an odd last item across both; one below.
function Pairs(k, key, items, min = 500) {
  const E = k.E
  const xs = items.filter(Boolean)
  if (!xs.length) return null
  const two = (k.colPx || k.px) >= min
  return (
    <E.Box key={key} flexDirection="row" flexWrap="wrap" columnGap={1} rowGap={1}>
      {xs.map((it, i) => <E.Box key={`${key}-${i}`} flexDirection="column" width={two && !(xs.length % 2 && i === xs.length - 1) ? '48%' : '100%'} flexShrink={1}>{it}</E.Box>)}
    </E.Box>
  )
}
// A reference card: an inset box, its text, the link at its foot.
const RefCard = (E, key, kids) => <E.Box key={key} flexDirection="column" gap={U.S.none} paddingX={2} paddingY={1} backgroundColor={T.inset} flexGrow={1}>{kids.filter(Boolean)}</E.Box>
// One of the card's three questions: a wash with its edge, the label beside the
// text when the content is 500 px or wider, above it below that.
function QaRow(k, key, label, text, spine, wash) {
  const E = k.E
  if (!str(text)) return null
  const side = (k.colPx || k.px) >= 500
  return (
    <E.Box key={key} flexDirection="row" backgroundColor={T[wash]}>
      <E.Box key={`${key}-sp`} width={1} flexShrink={0} backgroundColor={spine} />
      <E.Box key={`${key}-in`} flexDirection={side ? 'row' : 'column'} gap={side ? 2 : U.S.none} paddingX={2} paddingY={1} flexGrow={1} flexShrink={1} minWidth={0}>
        <E.Box key={`${key}-l`} flexShrink={0} {...(side ? { width: 17 } : {})}>{U.Cap(E, `${key}-c`, label, T.heading)}</E.Box>
        <E.Box key={`${key}-t`} flexGrow={1} flexShrink={1} minWidth={0}>{LeadPara(k, `${key}-p`, text)}</E.Box>
      </E.Box>
    </E.Box>
  )
}
// A block of the open card: its caption, then what it holds.
const Blk = (E, key, label, kids) => (kids.filter(Boolean).length ? U.Col(E, key, [U.Cap(E, `${key}-l`, label, T.heading), ...kids], U.S.tight) : null)
// The ending (standard part 4): its shape, the bridge and the wording in one box
// to copy, and what the shape does. Used on the card and on the post's page.
function EndingBox(k, key, cta, label = 'How it ends') {
  const E = k.E
  const c = cta || {}
  const bridge = str(c.bridge)
  const wording = str(c.wording)
  if (!bridge && !wording) return null
  const shape = shapeOf(c.shape)
  const text = [bridge, wording].filter(Boolean).join('\n\n')
  const copied = k.ui?.ssCopied === key
  const line = [shape?.[1], hasLink(wording) ? 'Swap in your booking link when you paste it.' : ''].filter(Boolean).join(' ')
  return (
    <E.Box key={key} flexDirection="column" gap={U.S.tight} paddingX={2} paddingY={1} backgroundColor={T.surface} borderStyle="round" borderColor={T.lineStrong}>
      <E.Box key={`${key}-h`} flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" gap={1}>
        {U.Cap(E, `${key}-l`, label, T.heading)}
        {shape ? U.Chip(E, `${key}-c`, shape[0], 'here') : null}
      </E.Box>
      <E.Box key={`${key}-m`} flexDirection="column" gap={1} paddingX={2} paddingY={1} backgroundColor={T.inset}>
        {bridge ? U.Body(E, `${key}-b`, bridge) : null}
        {wording ? Marked(E, `${key}-w`, wording) : null}
      </E.Box>
      <E.Box key={`${key}-r`} flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
        {U.Btn(E, `${key}-copy`, copied ? 'Copied' : 'Copy this ending', async () => { await k.act.copyText(text, 'Copied the ending. Paste it at the end of your post.'); await k.act.setUi({ ssCopied: key }) })}
        {line ? <E.Box key={`${key}-n`} flexGrow={1} flexShrink={1} minWidth={0}>{U.Meta(E, null, line)}</E.Box> : null}
      </E.Box>
    </E.Box>
  )
}
// One card open at a time (handoff 5): its index is kept in ui.ssCard.
async function openCard(k, i, toPosts = false) {
  if (toPosts) await k.setView('substack', 'posts')
  await k.act.setUi({ ssCard: i })
  await k.scrollTo(`ss-post-row-${i}`)
}
async function toggleCard(k, i) {
  await k.act.setUi({ ssCard: k.ui?.ssCard === i ? null : i })
  await k.scrollTo(`ss-post-row-${i}`)
}
const openIx = (k) => (Number.isInteger(k.ui?.ssCard) ? k.ui.ssCard : -1)
const cardsRunning = (k) => k.ui?.op?.status === 'running' && k.ui?.op?.name === 'cards'
// How long the set runs at the plan's pace, when the pace is one clear interval.
function runsFor(out, n) {
  const iv = intervals([out.cadence?.start, out.cadence?.rhythm, out.distribution?.cadence].map(str).join(' \n '))
  if (iv.size !== 1 || n < 2) return ''
  const step = [...iv][0]
  const pace = { 7: 'one post a week', 14: 'one post every two weeks', 21: 'one post every three weeks', 30: 'one post a month' }[step]
  const days = n * step
  const months = Math.round(days / 30)
  return `At ${pace}, this set runs about ${months >= 2 ? `${numWord(months).toLowerCase()} months` : `${numWord(Math.round(days / 7)).toLowerCase()} weeks`}.`
}
// The kinds of post with their counts, above the list.
function KindKey(k, key, pieces) {
  const E = k.E
  const kinds = ['intro', 'method', 'aud'].filter((id) => pieces.some((x) => kindOf(x) === id))
  if (!kinds.length) return null
  return U.Line(E, key, kinds.map((id) => (
    <E.Box key={`${key}-${id}`} flexDirection="row" gap={1}>
      <E.Box width={1} flexShrink={0} backgroundColor={KIND()[id].spine} />
      <E.Text size="footnote" color={T.meta}>{[`${KIND()[id].label} `, <E.Text key="n" size="footnote" weight="semibold" color={T.heading}>{String(pieces.filter((x) => kindOf(x) === id).length)}</E.Text>]}</E.Text>
    </E.Box>
  )), { columnGap: 2 })
}

// The post card's head (closed and open): caption, chips, headline, subtitle, Show more.
function cardHead(k, d, x, i, open) {
  const E = k.E
  const kd = KIND()[kindOf(x)]
  const caption = [`Post ${i + 1}`, kd?.label || k.fn.POST_TYPE(x), str(x.move)].filter(Boolean).join(' · ')
  const brief = k.fn.briefOf(d.out, i)
  const chip = StatusChip(E, `pc${i}-st`, x)
  return (
    <E.Box key={`pc${i}-h`} flexDirection="column" gap={U.S.none} paddingX={2} paddingY={1}>
      <E.Box key={`pc${i}-t`} flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" gap={1}>
        <E.Box key={`pc${i}-cap`} flexShrink={1} minWidth={0}>{U.Cap(E, `pc${i}-c`, caption)}</E.Box>
        {brief || chip ? <E.Box key={`pc${i}-ch`} flexDirection="row" gap={1} flexShrink={0}>{[brief ? U.Chip(E, `pc${i}-br`, 'Brief ✓', 'done') : null, chip].filter(Boolean)}</E.Box> : null}
      </E.Box>
      <E.Text key={`pc${i}-hl`} size="heading" weight="semibold" color={T.heading} wrap="wrap">{str(x.headline)}</E.Text>
      <E.Box key={`pc${i}-s`} flexDirection="row" {...((k.colPx || k.px) < 420 ? { flexWrap: 'wrap' } : {})} justifyContent="space-between" alignItems="flex-end" gap={1}>
        <E.Box key={`pc${i}-sub`} flexGrow={1} flexShrink={1} minWidth={0}>{str(x.subtitle) ? <E.Text color={T.meta} wrap="wrap">{str(x.subtitle)}</E.Text> : null}</E.Box>
        {U.Btn(E, `ss3-card-${i}`, open ? 'Show less ▴' : 'Show more ▾', () => toggleCard(k, i))}
      </E.Box>
    </E.Box>
  )
}
// The open card, in the standard's order (part 7), with the labels made gender-neutral (handoff 8).
function cardBody(k, d, x, i) {
  const E = k.E
  const n = d.pieces.length
  const brief = k.fn.briefOf(d.out, i)
  const p = `pc${i}`
  let blocks
  if (written(x)) {
    const beats = arr(x.arc).map((a) => (typeof a === 'string' ? { title: '', text: a } : a || {})).filter((a) => str(a.title) || str(a.text))
    const fun = arr(x.makeItFun).filter((r) => str(r?.name) || str(r?.use))
    const reads = arr(x.inspiration).filter((r) => str(r?.author) || str(r?.title) || str(r?.borrow))
    const mats = arr(x.yourMaterial).map((m) => (typeof m === 'string' ? { item: m } : m || {})).filter((m) => str(m.item))
    const adds = arr(x.toAdd).filter((a) => a && (str(a.what) || str(a.prompt)))
    blocks = [
      <E.Box key={`${p}-qa`} flexDirection="column" gap={1}>
        {[QaRow(k, `${p}-who`, "Who it's for", x.reader, T.accentFill, 'washBlue'), QaRow(k, `${p}-stuck`, "What they're stuck on", x.problem, T.spinePink, 'washPink'), QaRow(k, `${p}-fit`, 'Where your offer comes in', x.offerFit, T.spineGreen, 'washGreen')].filter(Boolean)}
      </E.Box>,
      Blk(E, `${p}-idea`, "Here's the idea", [str(x.idea) ? U.Body(E, `${p}-idea-t`, x.idea) : null]),
      Blk(E, `${p}-arc`, `How the post unfolds · ${beats.length} ${beats.length === 1 ? 'beat' : 'beats'}`, [Timeline(k, `${p}-beats`, beats.map((a, m) => [str(a.title) ? U.Strong(E, `${p}-b${m}h`, noDot(a.title)) : null, str(a.text) ? U.Body(E, `${p}-b${m}t`, a.text) : null]))]),
      fun.length ? Blk(E, `${p}-fun`, 'From research', [Pairs(k, `${p}-fun-g`, fun.map((r, m) => RefCard(E, `${p}-f${m}`, [GIVES_LABEL[str(r.kind).toLowerCase()] ? <E.Box key={`${p}-f${m}k`} flexDirection="row">{U.Chip(E, `${p}-f${m}kc`, GIVES_LABEL[str(r.kind).toLowerCase()], 'quiet')}</E.Box> : null, str(r.name) ? U.Strong(E, `${p}-f${m}n`, r.name) : null, str(r.use) ? U.Body(E, `${p}-f${m}u`, r.use) : null, RefLink(E, `${p}-f${m}a`, r.url, r.source)])))]) : null,
      !reads.length ? null : Blk(E, `${p}-read`, 'Read before you write', [Pairs(k, `${p}-read-g`, reads.map((r, m) => RefCard(E, `${p}-r${m}`, [
        <E.Text key={`${p}-r${m}h`} color={T.body} wrap="wrap">{[str(r.author) ? <E.Text key="a" weight="semibold" color={T.heading}>{str(r.author)}</E.Text> : null, str(r.author) && str(r.title) ? ' · ' : '', str(r.title) ? `“${str(r.title).replace(/^[“"]|[”"]$/g, '')}”` : ''].filter(Boolean)}</E.Text>,
        str(r.borrow) ? U.Body(E, `${p}-r${m}b`, r.borrow) : null,
        RefLink(E, `${p}-r${m}a`, r.url, r.source),
      ])))]),
      Blk(E, `${p}-mat`, 'From you', mats.map((m, j) => (
        <E.Box key={`${p}-m${j}`} flexDirection="row" gap={1} alignItems="flex-start">
          <E.Text key="g" weight="bold" color={T.doneText}>✓</E.Text>
          <E.Box key="t" flexGrow={1} flexShrink={1} minWidth={0}><E.Text color={T.body} wrap="wrap">{[<E.Text key="i" weight="semibold" color={T.heading}>{str(m.item)}</E.Text>, str(m.source) ? <E.Text key="s" color={T.meta}>{` · ${str(m.source)}`}</E.Text> : null].filter(Boolean)}</E.Text></E.Box>
        </E.Box>
      ))),
      adds.length ? Blk(E, `${p}-add`, "You'll need to add", adds.map((a, j) => (
        <E.Box key={`${p}-a${j}`} flexDirection="column" gap={U.S.none}>
          {[str(a.what) ? U.Strong(E, `${p}-a${j}w`, a.what) : null, str(a.prompt) ? U.Body(E, `${p}-a${j}p`, a.prompt) : null, str(a.ifNothing) ? U.Meta(E, `${p}-a${j}n`, `If nothing comes to mind: ${lowerLead(a.ifNothing)}`) : null].filter(Boolean)}
        </E.Box>
      ))) : null,
      str(x.beforeYouWrite) ? U.SpineCard(E, `${p}-first`, T.spineButter, [U.Cap(E, `${p}-first-l`, 'Before you write', T.heading), LeadPara(k, `${p}-first-t`, x.beforeYouWrite)], 'washButter') : null,
      EndingBox(k, `ss3-end-${i}`, x.cta),
    ]
  } else {
    // An outline only: its angle, then the card being written, or a way to write the rest.
    blocks = [
      str(x.angle) ? U.Body(E, `${p}-angle`, x.angle) : null,
      cardsRunning(k) ? U.Meta(E, `${p}-wip`, 'This card is being written now.')
        : U.Line(E, `${p}-todo`, [U.Meta(E, `${p}-todo-t`, "This card isn't written yet."), k.act.writeCards ? U.Btn(E, `ss3-write-${i}`, 'Write the rest', () => k.act.writeCards()) : null]),
    ]
  }
  const plan = brief ? U.Btn(E, `ss3-plan-${i}`, 'Open the brief', () => k.act.openPost(i), true)
    : written(x) ? U.Btn(E, `ss3-plan-${i}`, 'Plan this post', () => k.act.openPost(i), true) : null
  const actions = (
    <E.Box key={`${p}-act`} flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" gap={1}>
      {U.Line(E, `${p}-act-l`, [plan, U.Btn(E, `ss3-idea-${i}`, 'Change this idea', () => (k.act.changePostIdea ? k.act.changePostIdea(i) : k.act.planInChat('substack', true)))])}
      {U.Line(E, `${p}-act-r`, [U.Btn(E, `ss3-less-${i}`, 'Show less ▴', () => toggleCard(k, i)), i < n - 1 ? U.Btn(E, `ss3-next-${i}`, `Post ${i + 2} ▾`, () => openCard(k, i + 1)) : null])}
    </E.Box>
  )
  return (
    <E.Box key={`${p}-body`} flexDirection="column" gap={2} paddingX={2} paddingBottom={1}>
      {[...blocks, RuleLine(k, `${p}-rule2`), actions].filter(Boolean)}
    </E.Box>
  )
}
function PostCard(k, d, x, i, open) {
  const E = k.E
  const kd = KIND()[kindOf(x)]
  return (
    <E.Box key={`ss-post-row-${i}`} flexDirection="row" backgroundColor={T.surface} borderStyle="round" borderColor={open ? T.lineStrong : T.line}>
      <E.Box key={`pc${i}-sp`} width={1} flexShrink={0} backgroundColor={kd?.spine || T.line} />
      <E.Box key={`pc${i}-m`} flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
        {[cardHead(k, d, x, i, open), open ? RuleLine(k, `pc${i}-rule`) : null, open ? cardBody(k, d, x, i) : null].filter(Boolean)}
      </E.Box>
    </E.Box>
  )
}

function PostsV3(k, b, o, d) {
  const E = k.E
  const n = d.pieces.length
  const open = openIx(k)
  const firsts = d.pieces.map((x, i) => ({ x, i })).filter(({ x }) => statusOf(x) === 'first')
  const start = firsts.length ? U.SpineCard(E, 'ss3-start', T.spineButter, [
    <E.Text key="ss3-start-t" color={T.body} wrap="wrap">{[<E.Text key="b" weight="semibold" color={T.heading}>{firsts.length === 1 ? 'Start this now.' : 'Start these now.'}</E.Text>, ` ${firsts.length === 1 ? `Post ${firsts[0].i + 1} needs` : `Posts ${andList(firsts.map(({ i }) => String(i + 1)))} need`} you to do something before you can write ${firsts.length === 1 ? 'it' : 'them'}.`]}</E.Text>,
    U.Line(E, 'ss3-start-a', firsts.map(({ i }) => U.Btn(E, `ss3-start-${i}`, `Post ${i + 1} ▾`, () => openCard(k, i)))),
  ], 'washButter') : null
  // Cards still to write: a way to write them while nothing else is running.
  const left = d.pieces.filter((x) => !written(x)).length
  const op = k.ui?.op
  const running = op?.status === 'running'
  const rest = left && !running ? U.Callout(E, 'ss3-rest', 'i', U.Line(E, 'ss3-rest-l', [U.Body(E, 'ss3-rest-t', `${left} ${left === 1 ? 'card' : 'cards'} still to write.`), k.act.writeCards ? U.Btn(E, 'ss-write-rest', 'Write the rest', () => k.act.writeCards()) : null])) : null
  const wip = left && cardsRunning(k) && op?.place !== 'ss-cards' ? U.Meta(E, 'ss3-rest-wip', `${left} ${left === 1 ? 'card is' : 'cards are'} being written now.`) : null
  const order = str(d.out.orderNote) ? U.SpineCard(E, 'ss3-order', T.accentFill, [U.Cap(E, 'ss3-order-l', 'Why this order'), LeadPara(k, 'ss3-order-t', d.out.orderNote)], 'washBlue') : null
  return [
    U.Col(E, 'ss3-list', [
      U.SectionHead(E, 'ss3-list-h', { title: n ? `Your ${n <= 10 ? numWord(n).toLowerCase() : n} posts` : 'Your posts', sub: n ? ['In the order to publish them.', runsFor(d.out, n)].filter(Boolean).join(' ') : 'No posts saved yet.' }),
      start,
      ...k.act.OpSlot(k.c, 'ss-cards', [rest]),
      wip,
      KindKey(k, 'ss3-kinds', d.pieces),
      n ? <E.Box key="ss3-cards" flexDirection="column" gap={1}>{d.pieces.map((x, i) => PostCard(k, d, x, i, i === open))}</E.Box> : null,
    ], U.S.tight),
    order,
    ChangeRow(k, o),
  ]
}

function NextV3(k, b, o, d, lvl = 0) {
  const E = k.E
  const f = k.fn
  const work = k.work
  const fp = d.pieces[d.firstIx]
  const kd = fp ? KIND()[kindOf(fp)] : null
  const chips = fp ? [kd ? U.Chip(E, 'ss3-first-k', kd.label, 'quiet') : null, str(fp.move) ? U.Chip(E, 'ss3-first-m', str(fp.move), 'quiet') : null, StatusChip(E, 'ss3-first-s', fp)].filter(Boolean) : []
  const next = fp ? U.NextCard(E, 'ss-first', {
    title: 'Write your first post',
    extra: [
      <E.Text key="ss-first-h" weight="semibold" color={T.body} wrap="wrap">{[<E.Text key="h" weight="semibold" backgroundColor={T.highlight}>{str(fp.headline)}</E.Text>]}</E.Text>,
      str(fp.subtitle) ? U.Meta(E, 'ss3-first-sub', fp.subtitle) : null,
      chips.length ? U.Line(E, 'ss3-first-chips', chips) : null,
    ],
    foot: d.firstWhen ? `Goes out: ${d.firstWhen}` : '',
    actions: [U.Btn(E, 'ss-open-first', 'Open your first post', () => k.act.openPost(d.firstIx), true), U.Btn(E, 'ss3-see-idea', 'See the full idea', () => openCard(k, d.firstIx, true))],
  }) : null
  // Before it goes out: the Note the day before, then publishing and who to send it to.
  const num = d.firstIx + 1
  const forFirst = arr(d.out.notes).filter((x) => Number(x?.forPiece) === num && str(x?.text))
  const note = forFirst.find((x) => /before/i.test(str(x.when))) || forFirst[0]
  const noteDay = note ? parseDate(note.when) || (d.first && /day before/i.test(str(note.when)) ? d.first - 86400000 : null) : null
  const share = arr(d.di.shareWith).map(str).filter(Boolean)
  const stepHead = (key, title, when) => (
    <E.Box key={key} flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" gap={1}>
      {U.Strong(E, `${key}-t`, title)}
      {when ? U.Meta(E, `${key}-d`, when) : null}
    </E.Box>
  )
  const steps = [
    note ? [stepHead('ss3-b1', 'Post this Note', noteDay ? longDay(noteDay) : f.postWord(cap1(note.when))), Copy(k, 'ss3-note', { text: note.text, copyLabel: 'Copy the Note' })] : null,
    // who to send it to, as one sentence (the mock's "Then message it to…")
    d.firstWhen || share.length ? [stepHead('ss3-b2', `Publish post ${num}`, d.first ? longDay(d.first) : d.firstWhen), share.length ? U.Body(E, 'ss3-b2-t', `Then send it to ${share.map((t) => lowerLead(noDot(t))).reduce((acc, t, j, xs) => (j === 0 ? t : `${acc}${xs.length > 2 ? ';' : ''}${j === xs.length - 1 ? ' and' : ''} ${t}`), '')}.`) : null] : null,
  ].filter(Boolean)
  const before = steps.length ? U.Col(E, 'ss3-before', [
    // (no sub-line: each step carries its own date, and the view stays under 1,400 px at 840)
    U.SectionHead(E, 'ss3-before-h', { title: 'Before it goes out' }),
    Timeline(k, 'ss3-steps', steps),
  ], U.S.tight) : null
  const names = arr(d.out.names).filter((x) => str(x?.name))
  const chooseName = !str(b.chosenName) && names.length
    ? U.Btn(E, 'ss-choose-name', 'Choose a name', async () => { await k.setView('substack', 'strategy'); await k.scrollTo('ss-s-pub') }, 'plain')
    : null
  // Your Substack in one sentence (hub pack 8.19), when one is saved. The v3 page
  // leaves out today's stand-in sentence: Your publication says it, and the view stays under 1,400 px.
  const g = d.out.glance || {}
  const hl = (key, t) => <E.Text key={key} weight="semibold" backgroundColor={T.highlight}>{str(t)}</E.Text>
  const sentence = str(g.reader) && str(g.knownFor) && str(g.cadence) && str(g.goal)
    ? <E.Text key="ss-glance-t" color={T.body} wrap="wrap">{["You're writing ", hl('ss-g-r', g.reader), ', to become known for ', hl('ss-g-k', g.knownFor), ', ', hl('ss-g-c', g.cadence), ', so that ', hl('ss-g-g', noDot(g.goal)), '.']}</E.Text>
    : null
  const glance = sentence && U.SpineCard(E, 'ss-glance', T.accent, [U.Cap(E, 'ss-glance-l', 'Your Substack in one sentence'), sentence, U.Meta(E, 'ss-glance-f', 'Each part is explained in Strategy and Growth. Change any of it in the chat.')], 'washBlue')
  // One Substack for all your offers (decide), as today.
  const yes = d.offers.filter((x) => f.substackSupports(work, x))
  const no = d.offers.filter((x) => !f.substackSupports(work, x))
  const names2 = (xs) => f.nameList(xs.map((x) => `"${f.shortName(x.name)}"`))
  const decide = no.length && !b.focusKept ? U.Panel(E, 'ws-sub-offers', 'decide', [
    U.Cap(E, 'ws-sub-offers-l', d.sp ? 'One Substack for this space' : 'One Substack for all your offers', T.heading),
    U.Body(E, 'ws-sub-offers-b', `Your Substack talks about ${names2(yes) || 'your first offer'}, but not ${names2(no)} yet.`),
    U.Line(E, 'ws-sub-offers-a', [U.Btn(E, 'ws-sub-update', 'Update for all offers in the chat', () => k.act.planInChat('substack', false, '', 'portfolio')), U.Btn(E, 'ws-sub-keep', 'Keep it focused', () => k.act.keepSubstackFocus(), 'plain')]),
  ]) : null
  // Coming up: the three posts after the first, each with its status and See it.
  const narrow = (k.colPx || k.px) < 420
  const up = d.pieces.map((x, i) => ({ x, i })).filter(({ i }) => i > d.firstIx).slice(0, 3)
  const rows = up.map(({ x, i }) => {
    const kx = KIND()[kindOf(x)]
    const dt = dateOf(d, i)
    const brief = f.briefOf(d.out, i)
    const st = STATUS3[statusOf(x)]
    return {
      key: `ss-post-row-${i}`,
      spine: kx?.spine || T.line,
      name: `${i + 1}. ${str(x.headline)}`,
      meta: [kx?.label || String(f.POST_TYPE(x)).split(' · ')[0], str(x.move), dt ? withDay(dt) : '', narrow && st ? st[0] : ''].filter(Boolean).join(' · '),
      chip: narrow || !(brief || st) ? null : <E.Box key={`ss3-up-${i}-c`} flexDirection="row" gap={1}>{[brief ? U.Chip(E, `ss3-up-${i}-b`, 'Brief ✓', 'done') : null, StatusChip(E, `ss3-up-${i}-s`, x)].filter(Boolean)}</E.Box>,
      actions: [U.Btn(E, `ss3-see-${i}`, 'See it', () => openCard(k, i, true))],
    }
  })
  const coming = up.length ? U.Col(E, 'ss-up', [
    U.SectionHead(E, 'ss-up-h', { title: 'Coming up', right: U.Btn(E, 'ss-see-all', `See all ${d.pieces.length}`, () => k.setView('substack', 'posts'), 'plain') }),
    U.RowList(E, 'ss-up-list', { rows, limit: 3 }),
  ], U.S.tight) : null
  // Built around, and the other spaces' Substacks, as today.
  const otherSpaces = d.sp ? spacesOf(work).filter((x) => x.id !== d.sp.id) : []
  const built = <E.Box key="ss-built" flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
    {U.Meta(E, 'ss-built-l', 'Built around')}
    <E.Text key="ss-built-t" size="footnote" weight="semibold" color={T.heading} wrap="wrap">{d.sp && d.offers.length > 1 ? `${d.sp.name}: ${d.offers.map((x) => f.shortName(x.name)).join(', ')}` : f.shortName(o.name, 80)}</E.Text>
  </E.Box>
  const other = otherSpaces.length ? U.Line(E, 'ss-other-spaces', [
    U.Meta(E, 'ss-other-t', `${otherSpaces.length === 1 ? `Your other space, "${otherSpaces[0].name}", has its` : 'Your other spaces have their'} own Substack.`),
    otherSpaces.length === 1
      ? U.Btn(E, 'ss-other-open', 'Open it', () => k.act.openSpaceStep(otherSpaces[0].id, substackFor(work, otherSpaces[0].id)?.output ? 'substack' : 'space'), 'plain')
      : U.Btn(E, 'ss-other-open', 'Your spaces', () => k.act.goStep('done'), 'plain'),
  ]) : null
  return [
    next,
    before,
    Art(E, 'ss-masthead', mastheadArt(k, d, b, lvl > 0)),
    glance,
    decide,
    coming,
    U.Col(E, 'ss-foot', [built, other, ChangeRow(k, o, chooseName)], U.S.tight),
  ]
}

function StrategyV3(k, b, o, d, lvl = 0) {
  const E = k.E
  const pub = d.out.publication || {}
  const n = d.pieces.length
  const chosen = str(b.chosenName)
  const names = arr(d.out.names).filter((x) => str(x?.name))
  const nt = pub.namedThing || {}
  const se = pub.series || {}
  const inRange = (v) => { const x = Number(v); return Number.isInteger(x) && x >= 1 && x <= n ? x : null }
  const ntPosts = [...new Set(arr(nt.posts).map(inRange).filter(Boolean))]
  const sePost = inRange(se.firstPost)
  let num = 0
  // 1. Your publication.
  const nameBlock = chosen
    ? <E.Text key="ss3-named-as" color={T.body} wrap="wrap">{[<E.Text key="l" color={T.meta}>Your Substack is called </E.Text>, <E.Text key="n" weight="semibold" color={T.heading}>{chosen}</E.Text>]}</E.Text>
    : names.length ? U.Col(E, 'ss3-names', [U.Cap(E, 'ss3-names-l', 'Choose a name', T.heading), Pairs(k, 'ss3-names-g', names.map((x, i) => U.Panel(E, `ss3-name-${i}`, 'surface', [
      <E.Box key={`ss3-name-${i}-top`} flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" gap={1}>
        <E.Box key="n" flexShrink={1} minWidth={0}>{U.Strong(E, null, x.name)}</E.Box>
        {U.Btn(E, `ss-name-use-${i}`, 'Use this name', () => k.act.useSubstackName(str(x.name)))}
      </E.Box>,
      str(x.why) ? U.Meta(E, `ss3-name-${i}-w`, x.why) : null,
    ], { flexGrow: 1 })), 480)], U.S.tight) : null
  const belief = str(pub.belief)
  const beliefArt = belief && E.Svg && lvl === 0 ? { ...quoteArt(k, belief.replace(/^[“"]|[”"]$/g, '')), alt: `The belief you'll repeat: ${belief}` } : null
  const ntCard = str(nt.name) || str(nt.what) ? U.SpineCard(E, 'ss3-named', T.accentFill, [
    U.Cap(E, 'ss3-named-l', 'Your named thing'),
    str(nt.name) ? <E.Text key="ss3-named-n" size="heading" weight="semibold" color={T.heading} wrap="wrap">{cap1(nt.name)}</E.Text> : null,
    str(nt.what) ? U.Body(E, 'ss3-named-t', nt.what) : null,
    ntPosts.length ? U.Line(E, 'ss3-named-a', [U.Meta(E, 'ss3-named-in', 'In posts'), ...ntPosts.map((p) => U.Btn(E, `ss3-named-${p}`, String(p), () => openCard(k, p - 1, true)))]) : null,
  ], 'washBlue') : null
  const seCard = str(se.name) || str(se.what) ? U.SpineCard(E, 'ss3-series', T.spineButter, [
    U.Cap(E, 'ss3-series-l', 'Your series'),
    str(se.name) ? <E.Text key="ss3-series-n" size="heading" weight="semibold" color={T.heading} wrap="wrap">{cap1(se.name)}</E.Text> : null,
    str(se.what) ? U.Body(E, 'ss3-series-t', se.what) : null,
    sePost ? U.Line(E, 'ss3-series-a', [U.Btn(E, 'ss3-series-post', `See post ${sePost}`, () => openCard(k, sePost - 1, true))]) : null,
  ], 'washButter') : null
  const pubKids = [
    nameBlock,
    str(pub.whoFor) ? Blk(E, 'ss3-who', "Who you're writing for", [LeadPara(k, 'ss3-who-t', pub.whoFor)]) : null,
    belief ? Blk(E, 'ss3-belief', "The belief you'll repeat", [beliefArt ? Art(E, 'ss3-belief-a', beliefArt) : Italic(E, 'ss3-belief-t', belief)]) : null,
    ntCard || seCard ? Pairs(k, 'ss3-ns', [ntCard, seCard], 480) : null,
    str(pub.whySubscribe) ? Blk(E, 'ss3-why', "Why they'd subscribe before they're ready to buy", [U.Body(E, 'ss3-why-t', pub.whySubscribe)]) : null,
  ].filter(Boolean)
  const sec1 = pubKids.length ? U.Col(E, 'ss3-s1', [U.NumHead(E, 'ss-s-pub', { n: ++num, title: 'Your publication', answer: 'What every issue adds up to.' }), ...pubKids], U.S.tight) : null
  // 2. Your footer, to paste at the end of every post.
  const ft = d.out.footer || {}
  const items = arr(ft.items).filter((x) => str(x?.name) || str(x?.text))
  const itemName = (x) => { const t = str(x.name); return t && !/[.!?]$/.test(t) ? `${t}.` : t }
  const footText = [str(ft.lead), ...items.map((x) => [itemName(x), str(x.text)].filter(Boolean).join(' '))].filter(Boolean).join('\n\n')
  const copied = k.ui?.ssCopied === 'ss3-footer'
  const sec2 = footText ? U.Col(E, 'ss3-s2', [
    U.NumHead(E, 'ss3-s-footer', { n: ++num, title: 'Your footer', answer: 'Paste this at the end of every post.' }),
    <E.Box key="ss3-footer-box" flexDirection="column" gap={1} paddingX={2} paddingY={1} backgroundColor={T.inset}>
      {[str(ft.lead) ? U.Strong(E, 'ss3-footer-lead', ft.lead) : null, ...items.map((x, i) => <E.Text key={`ss3-footer-${i}`} color={T.body} wrap="wrap">{[str(x.name) ? <E.Text key="n" weight="semibold" color={T.heading}>{itemName(x)}</E.Text> : null, str(x.name) && str(x.text) ? ' ' : '', ...marked(E, x.text)].filter(Boolean)}</E.Text>)].filter(Boolean)}
    </E.Box>,
    U.Line(E, 'ss3-footer-a', [
      U.Btn(E, 'ss3-footer', copied ? 'Copied' : 'Copy the footer', async () => { await k.act.copyText(footText, 'Copied the footer. Paste it at the end of your post.'); await k.act.setUi({ ssCopied: 'ss3-footer' }) }),
      hasLink(footText) ? U.Meta(E, 'ss3-footer-n', 'Swap in your booking link when you paste it.') : null,
    ]),
  ], U.S.tight) : null
  // 3. What this is built on: today's Strategy sections, unchanged, closed until asked for.
  const secs = strategySecs(k, b, o, d, lvl, { noNames: !chosen })
  const has = (id) => { const s = secs.find((x) => x.id === id); return s && (typeof s.body === 'function' ? s.body({ spine: T.accent, tone: 'surface', n: 1 }) : s.body).filter(Boolean).length }
  const parts = [['why', "why you're writing"], ['reader', 'your reader and their week'], ['problems', "the problems you'll write about"], ['known', "what you'll be known for"], ['series', 'your series'], ['voice', 'your voice'], ['pub', chosen ? 'your name ideas and the look' : 'the look']].filter(([id]) => has(id)).map(([, t]) => t)
  const builtOpen = k.flag('ss-built')
  const sec3 = parts.length ? U.Col(E, 'ss3-s3', [
    U.NumHead(E, 'ss3-s-built', { n: ++num, title: 'What this is built on', answer: 'Everything Uncapped used to plan this, for when you want the detail.' }),
    U.Panel(E, 'ss3-built-card', 'surface', [
      U.Meta(E, 'ss3-built-t', `${cap1(andList(parts))}.`),
      U.Line(E, 'ss3-built-a', [U.Btn(E, 'ss3-built', builtOpen ? 'Hide the detail ▴' : 'Show the detail ▾', async () => { const wasOpen = k.flag('ss-built'); await k.toggle('ss-built'); if (!wasOpen) await k.scrollTo('ss3-s-built') })]),
    ]),
    ...(builtOpen ? Sections(k, 'ss-b', secs) : []),
  ], U.S.tight) : null
  return [sec1, sec2, sec3, ChangeRow(k, o)]
}

// ---------------------------------------------------------------- progress
// While a strategy is being written (12 Nov): its progress only, never part of
// it. If it stopped: what's saved and one button that does only what's missing.
const STAGES = [['field', 'Researching your field'], ['choose', 'Choosing your ten posts'], ['research', 'Researching each post'], ['cards', 'Writing and checking your cards']]
const STAGE_AT = { field: 0, choose: 1, review: 1, research: 2, refs: 2, cards: 3 }
export function StrategyProgress($, k, b, o, st) {
  const E = k.E
  const at = STAGE_AT[st.stage] ?? 0
  const live = st.live
  const note = k.ui?.opNote?.place === 'ss-progress' ? k.ui.opNote : null
  const op = live && k.ui?.op?.place === 'ss-progress' && k.ui.op.status === 'running' ? k.ui.op : null
  const count = (i) => (i === 0 ? (st.field ? `${st.field} findings` : '') : i === 1 ? (st.chosen ? `${st.chosen} posts` : '') : i === 2 ? (at >= 2 ? `${st.researched} of ${st.total}` : '') : at >= 3 ? `${st.cards} of ${st.total}` : '')
  const rows = STAGES.map(([id, label], i) => {
    const done = i < at
    const cur = i === at
    const glyph = done ? '✓' : cur ? (live ? '●' : '◌') : '○'
    return (
      <E.Box key={`ssp-${id}`} flexDirection="row" justifyContent="space-between" alignItems="center" gap={1}>
        <E.Box key="l" flexDirection="row" gap={1} flexShrink={1} minWidth={0}>
          <E.Text key="g" weight="bold" color={done ? T.doneText : cur ? T.heading : T.meta}>{glyph}</E.Text>
          <E.Text key="t" weight={cur ? 'semibold' : undefined} color={done || cur ? T.heading : T.meta} wrap="wrap">{label}</E.Text>
        </E.Box>
        {count(i) ? <E.Text key="n" size="footnote" color={T.meta}>{count(i)}</E.Text> : null}
      </E.Box>
    )
  })
  const body = live
    ? 'Uncapped is researching your field, choosing your ten posts and writing a full card for each, then checking every one. It takes about 12 minutes, and the whole strategy appears here when all ten cards are finished. You can close this and come back: nothing is lost.'
    : `${st.cards ? `${st.cards} of ${st.total} cards are written and saved.` : 'Everything done so far is saved.'} Finish my strategy carries on from there and does only what's missing.`
  const why = !live && st.error ? (st.error === 'You stopped it.' ? 'You stopped it.' : `What happened: ${st.error}`) : ''
  return [
    ...arr(k.head),
    U.NextCard(E, 'ss-progress', {
      label: live ? 'Being written' : 'Stopped partway',
      title: live ? 'Your Substack strategy is being written' : 'Your Substack strategy stopped partway',
      body,
      extra: [
        <E.Box key="ssp-rows" flexDirection="column" gap={U.S.tight}>{rows}</E.Box>,
        op ? U.Meta(E, 'ssp-now', `Now: ${op.label}${op.progress?.total ? ` (${op.progress.done} of ${op.progress.total})` : ''}`) : null,
        why ? U.Meta(E, 'ssp-why', why) : null,
        st.hadOutput ? U.Meta(E, 'ssp-old', 'Your current strategy stays as it is until this one is finished.') : null,
        note ? U.Callout(E, 'ssp-note', 'i', note.text) : null,
      ].filter(Boolean),
      actions: live ? [] : [U.Btn(E, 'ss-finish', 'Finish my strategy', () => k.act.finishStrategy(), true)],
    }),
  ].filter(Boolean)
}

// ---------------------------------------------------------------- screens
function substackBody(k, b, o) {
  const d = ssData(k, b, o)
  const cur = ['posts', 'strategy', 'growth'].includes(k.view('substack', 'next')) ? k.view('substack', 'next') : 'next'
  const views = [{ id: 'next', label: 'Next post' }, { id: 'posts', label: `Posts · ${d.pieces.length}` }, { id: 'strategy', label: 'Strategy' }, { id: 'growth', label: 'Growth' }]
  // A strategy saved in the v3 shape gets the post cards; today's shape keeps today's views.
  const v3 = isV3(d.out)
  const view = (lvl) => (cur === 'posts' ? (v3 ? PostsV3(k, b, o, d) : PostsView(k, b, o, d)) : cur === 'strategy' ? (v3 ? StrategyV3(k, b, o, d, lvl) : StrategyView(k, b, o, d, lvl)) : cur === 'growth' ? GrowthView(k, b, o, d) : v3 ? NextV3(k, b, o, d, lvl) : NextView(k, b, o, d, lvl))
  return fit((lvl) => [...arr(k.head), U.ViewSwitch(k.E, 'ss-view', views, cur, (id) => k.setView('substack', id)), ...view(lvl)].filter(Boolean), 2)
}

// The step's body once a strategy exists: Next post, Posts, Strategy, Growth.
export function SubstackScreen($, k, b, o) {
  return substackBody(k, b, o)
}

// One post's page (7.16): its full brief, or the brief not built yet.
export function PostScreen($, k, b, o, i) {
  if (!ssData(k, b, o).pieces[i]) return substackBody(k, b, o)
  return fit((lvl) => postPage(k, b, o, i, lvl), 3)
}
// A brief's text as short lines: one sentence or step per line, said words in
// quotes, an inline "1) … 2) …" list as numbered lines.
function linesOf(k, t) {
  return k.fn.briefItems(t).flatMap((x) => (x.kind === 'say' ? [`“${x.text}”`] : x.kind === 'list' ? [x.lead, ...x.items.map((it, m) => `${m + 1}. ${it}`)] : x.kind === 'sample' ? x.lines : [x.text])).map(str).filter(Boolean)
}
// One block of a beat, drawn tight: a line with its arrow, words said out loud
// in quotes, an inline list as numbered lines, a sample on its own lines.
// compact (only when a page would be too big to draw): each line drawn as one text.
function BeatBlock(E, key, x, compact = false) {
  if (x.kind === 'list') {
    return (
      <E.Box key={key} flexDirection="column" gap={U.S.none}>
        {str(x.lead) ? BriefLine(E, `${key}l`, x.lead, '→', compact) : null}
        <E.Box flexDirection="column" gap={U.S.none} paddingLeft={2}>{x.items.map((it, m) => BriefLine(E, `${key}.${m}`, it, `${m + 1}.`, compact))}</E.Box>
      </E.Box>
    )
  }
  if (x.kind === 'sample') return <E.Box key={key} flexDirection="column" gap={U.S.none} paddingX={1} backgroundColor={T.inset}>{x.lines.map((l, m) => BriefLine(E, `${key}.${m}`, l, null, compact))}</E.Box>
  return BriefLine(E, key, x.kind === 'say' ? `“${x.text}”` : x.text, '→', compact)
}
// The post's page (7.16, her 11 Nov review): the strategist talking you through
// the post in the order you'd write it, from the idea to the ask, with where it
// fits in the plan as a quiet note at the end. Every beat shows in full.
// lvl 1: the headline in native text instead of Cormorant; lvl 2: each line of
// a beat drawn as one text (only when a page would be too big to draw).
function postPage(k, b, o, i, lvl) {
  const E = k.E
  const f = k.fn
  const d = ssData(k, b, o)
  const x = d.pieces[i]
  const n = d.pieces.length
  const br = f.briefOf(d.out, i)
  const title = str(br?.title || x.headline)
  const dt = d.dates ? d.dates[i] : null
  const when = dt ? new Date(dt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }) : i === d.firstIx ? d.firstWhen : ''
  const cur = k.view('substack', 'next')
  const v3 = isV3(d.out)
  const back = async (view) => { if (view) await k.setView('substack', view); await k.act.backToStrategy() }
  const work1 = () => k.act.toChat('plan', `Substack strategy for my working offer: ${o.name} (work on post ${i + 1}: "${title}")`, 'Work on this post with Claude in the chat. The words stay yours.')
  // (a) The head: back link, breadcrumbs, eyebrow with the brief's chip, the headline, subtitle and date.
  const head = [
    U.BackLink(E, 'ss-back', cur === 'posts' ? 'Back to your posts' : 'Back to Substack', () => back(null)),
    U.Crumbs(E, 'ss-crumbs', [['Substack', () => back('next')], ['Posts', () => back('posts')], [`Post ${i + 1}`]]),
    <E.Box key="ss-p-head" flexDirection="column" gap={U.S.none}>
      <E.Box key="ss-p-eyebrow" flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" gap={1}>
        <E.Box key="ss-p-eyebrow-t" flexShrink={1} minWidth={0}>{U.Cap(E, 'ss-p-n', [`Post ${i + 1} of ${n}`, f.POST_TYPE(x), str(x.series)].filter(Boolean).join(' · '), T.accent)}</E.Box>
        {br ? U.Chip(E, 'ss-p-chip', 'Brief ✓', 'done') : U.Chip(E, 'ss-p-chip', 'Brief not built', 'quiet')}
      </E.Box>
      {lvl === 0 ? k.title(title) : <E.Text key="ss-p-title" size="title" weight="semibold" color={T.heading} wrap="wrap">{title}</E.Text>}
      {str(br?.subtitle) || (v3 && str(x.subtitle)) ? U.Meta(E, 'ss-p-sub', str(br?.subtitle) || x.subtitle) : null}
      {when ? U.Meta(E, 'ss-p-when', `Goes out ${when}`) : null}
    </E.Box>,
  ]
  // (b) The idea, said plainly: what it is and why they'll open it.
  const ideaText = [str(x.idea), str(x.whyOpen), v3 && !str(x.idea) ? str(x.angle) : ''].filter(Boolean).map((t) => (/[.!?]$/.test(t) ? t : `${t}.`)).join(' ')
  // (h) The call to action: the next step, its wording to copy and why, at the end where the post asks.
  const kind = str(br?.land?.next || x.next?.kind || x.cta?.kind).toLowerCase()
  const wording = str(x.next?.wording || x.cta?.wording)
  const ctaWhy = str(br?.land?.why || x.next?.why || x.cta?.why)
  // A v3 post (11 Nov): the brief's ending, else the card's own, drawn as on the card.
  const end3 = v3 ? [br?.ending, x.cta].find((c) => c && (str(c.bridge) || str(c.wording))) : null
  const cta = end3 ? U.Col(E, 'ss-p-cta', [EndingBox(k, `ss-p-end-${i}`, end3, 'The call to action'), br && ctaWhy ? U.Meta(E, 'ss-p-cta-y', ctaWhy) : null], U.S.tight) : kind || wording ? U.SpineCard(E, 'ss-p-cta', T.accent, [
    U.Cap(E, 'ss-p-cta-l', 'The call to action', T.accent),
    kind ? <E.Box key="ss-p-cta-h" flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">{[U.Meta(E, 'ss-p-cta-k', 'Next step for the reader'), U.Chip(E, 'ss-p-cta-c', f.NEXT_NAME[kind] || f.sentenceCase(kind), 'here')]}</E.Box> : null,
    wording ? Copy(k, br ? `ss-p-cta-${i}` : `ss-p-inv-${i}`, { text: wording, copyLabel: 'Copy invitation' }) : null,
    ctaWhy ? U.Meta(E, 'ss-p-cta-y', ctaWhy) : null,
  ]) : null
  // (i) Where this post fits in the plan: a quiet note at the very end.
  const oldRows = [['Its job', x.job], ['Why it comes here', x.whyHere], ['It leads to', x.leadsTo || x.cta?.purpose]].filter(([, v]) => str(v))
  const fitsRows = oldRows.length || !v3 ? oldRows : [['The move', x.move], ['The angle', x.angle]].filter(([, v]) => str(v))
  const fits = fitsRows.length ? (
    <E.Box key="ss-p-fits" flexDirection="column" gap={U.S.none} paddingX={2} paddingY={1} backgroundColor={T.inset}>
      {U.Meta(E, 'ss-p-fits-l', 'Where this post fits in your plan', { weight: 'semibold', color: T.body })}
      {fitsRows.map(([l, v], m) => <E.Text key={`ss-p-fits-${m}`} size="footnote" color={T.meta} wrap="wrap">{[<E.Text key="l" size="footnote" weight="semibold">{`${l}: `}</E.Text>, lowerLead(str(v))]}</E.Text>)}
    </E.Box>
  ) : null
  const actions = U.Line(E, 'ss-p-actions', [
    U.Btn(E, `ws-sub-work-${i}`, 'Work on it in the chat', work1),
    br ? U.Btn(E, `ss-p-fresh-${i}`, 'Write a fresh brief', () => k.act.writePostBrief(i, `ss-brief-${i}`, true), 'plain') : null,
    U.Btn(E, 'ss-back-2', 'Back to strategy', () => k.act.backToStrategy(), 'plain'),
  ])
  const pn = (
    <E.Box key="ss-p-nav" flexDirection="row" flexWrap="wrap" gap={2} justifyContent="space-between">
      {[i > 0 ? U.Btn(E, 'ss-p-prev', `← Post ${i}`, () => k.act.openPost(i - 1), 'plain') : <E.Text key="ss-p-prev-none"> </E.Text>, i < n - 1 ? U.Btn(E, 'ss-p-next', `Post ${i + 2} →`, () => k.act.openPost(i + 1), 'plain') : null].filter(Boolean)}
    </E.Box>
  )
  if (!br) {
    // The outline saved with the plan, then a dashed card for the brief, written here in the panel.
    const waiting = k.ui?.briefWant === i && k.ui?.op?.status === 'running'
    const invite = U.Panel(E, `ss-p-brief-card-${i}`, 'invite', [
      U.Strong(E, 'ss-p-brief-t', "The full brief isn't built yet"),
      U.Body(E, 'ss-p-brief-b', waiting ? "Another brief is being written. This post's brief starts as soon as it's done." : 'It gives you the hook, two ways in, the opening with suggested lines, the arc beat by beat, your own material to use, and how the post lands.'),
      U.Line(E, 'ss-p-brief-a', [U.Btn(E, `ss-p-brief-${i}`, 'Write the full brief', () => k.act.writePostBrief(i, `ss-brief-${i}`), true)]),
    ])
    const outline = [
      ideaText ? U.Col(E, 'ss-p-idea', [U.SectionHead(E, 'ss-p-idea-h', { title: 'The idea', sub: "Here's the idea." }), U.Body(E, 'ss-p-idea-t', ideaText)], U.S.tight) : null,
      str(x.opensWith || x.story) ? Group(E, 'ss-p-opens', 'It opens with', [U.Body(E, 'ss-p-opens-t', x.opensWith || x.story)]) : null,
      str(x.needsFromYou) ? U.Meta(E, 'ss-p-need', `The moment to look for: ${x.needsFromYou}`) : null,
      arr(x.arc).length ? Group(E, 'ss-p-cover', 'Cover these points', [U.Numbered(E, 'ss-p-cover-l', arr(x.arc).map((a) => (typeof a === 'string' ? a : noDot(a?.title) || str(a?.text))))]) : null,
      str(x.commentQuestion) ? U.Meta(E, 'ss-p-cq', `Then ask in the comments: ${x.commentQuestion}`) : null,
    ]
    return [...head, ...outline, ...k.act.OpSlot(k.c, `ss-brief-${i}`, [invite]), cta, fits, actions, pn].filter(Boolean)
  }
  // The brief, in the order you'd write it.
  const angles = arr(br.angles).filter((a) => str(a?.angle))
  const pickWord = /^[^.]*?\b(first|second|1st|2nd|one|two)\b/i.exec(str(br.pick))
  const picked = angles.findIndex((a) => a?.pick === true) >= 0 ? angles.findIndex((a) => a?.pick === true) : pickWord ? (/first|1st|one/i.test(pickWord[1]) ? 0 : 1) : -1
  // "I'd pick the first." is said by the chip and the line under the heading; the reason follows it.
  const pickWhy = str(br.pick).replace(/^I'?d pick the (first|second)( one)?\.\s*/i, '')
  const beats = arr(br.arc).filter((a) => str(a?.beat) || f.briefItems(a?.onPage).length)
  const use = arr(br.yours?.use).filter((u) => str(u?.what))
  const lines = arr(br.open?.lines).map(str).filter(Boolean)
  const compact = lvl >= 2
  const beatCard = (a, n2) => {
    const all = f.briefItems(a.onPage)
    return U.Panel(E, `ss-p-beat-${n2}`, 'surface', [
      <E.Box key={`pb${n2}h`} flexDirection="row" gap={1} alignItems="center">
        {Med(E, `pb${n2}m`, n2 + 1, T.accentFill, T.onAccent)}
        <E.Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>{U.Strong(E, null, a.beat || `Beat ${n2 + 1}`)}</E.Box>
      </E.Box>,
      all.length ? <E.Box key={`pb${n2}l`} flexDirection="column" gap={U.S.none}>{all.map((it, m) => BeatBlock(E, `pb${n2}.${m}`, it, compact))}</E.Box> : null,
      str(a.reader) ? (
        <E.Box key={`pb${n2}g`} flexDirection="column" gap={U.S.none}>
          {U.Meta(E, null, 'What the reader gets', { weight: 'semibold' })}
          <E.Text italic color={T.heading} wrap="wrap">{str(a.reader)}</E.Text>
        </E.Box>
      ) : null,
      str(a.leadsInto) && n2 < beats.length - 1 ? <E.Text key={`pb${n2}i`} size="footnote" italic color={T.accent} wrap="wrap">{`↓ ${str(a.leadsInto)}`}</E.Text> : null,
    ])
  }
  // A v3 brief's headline options, the picked one marked with its reason.
  const heads = arr(br.headlines).map((hd) => (typeof hd === 'string' ? { text: hd } : hd || {})).filter((hd) => str(hd.text))
  const secs = [
    {
      id: 'heads', jump: 'Headlines', title: 'Headline options', answer: heads.some((hd) => hd.pick) ? "I'd pick the one marked." : '',
      body: heads.map((hd, n2) => U.Panel(E, `ss-p-head-${n2}`, hd.pick ? 'accent' : 'surface', [
        <E.Box key={`ss-p-head-${n2}-h`} flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" gap={1}>{[<E.Box key="t" flexShrink={1} minWidth={0}>{U.Strong(E, null, hd.text)}</E.Box>, hd.pick ? U.Chip(E, `ss-p-head-${n2}-c`, '★ My pick', 'here') : null].filter(Boolean)}</E.Box>,
        hd.pick && str(hd.why) ? U.Meta(E, `ss-p-head-${n2}-w`, hd.why) : null,
      ])),
    },
    { id: 'idea', jump: 'The idea', title: 'The idea', answer: "Here's the idea.", body: [ideaText ? U.Body(E, 'ss-p-idea-t', ideaText) : null] },
    { id: 'hook', jump: 'Hook', title: 'The hook', answer: "Here's what I think grabs them.", body: [str(br.hook) ? U.Panel(E, 'ss-p-hook', 'surface', [U.Body(E, 'ss-p-hook-t', br.hook)]) : null] },
    {
      id: 'ways', jump: 'Ways in', title: angles.length > 1 ? 'Two ways in' : 'The way in',
      answer: `${angles.length > 1 ? 'Two ways you could open it.' : 'How you could open it.'}${picked === 0 ? " I'd pick the first." : picked === 1 ? " I'd pick the second." : ''}`,
      body: [
        angles.length ? U.Grid(E, 'ss-p-ways', angles.map((a, n2) => U.Panel(E, `ss-p-ang-${n2}`, n2 === picked ? 'accent' : 'surface', [
          <E.Box key={`ss-p-ang-${n2}-h`} flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" gap={1}>{[U.Cap(E, `ss-p-ang-${n2}-l`, `Way ${n2 + 1}`), n2 === picked ? U.Chip(E, `ss-p-ang-${n2}-c`, '★ My pick', 'here') : null].filter(Boolean)}</E.Box>,
          U.Strong(E, `ss-p-ang-${n2}-t`, a.angle),
          str(a.why) ? U.Meta(E, `ss-p-ang-${n2}-w`, a.why) : null,
        ])), k.wide) : null,
        pickWhy ? U.Col(E, 'ss-p-pick', [U.Meta(E, 'ss-p-pick-l', "Why I'd pick it", { weight: 'semibold' }), U.Body(E, 'ss-p-pick-t', pickWhy)], U.S.none) : null,
      ],
    },
    {
      id: 'open', jump: 'Opening', title: 'How it opens', answer: "Where I'd start, and lines you could borrow.",
      body: [
        str(br.open?.where) ? Group(E, 'ss-p-scene', 'The scene', [U.Body(E, 'ss-p-where', br.open.where)]) : null,
        str(br.open?.detail) ? Group(E, 'ss-p-detail', 'The detail that matters', [U.Body(E, 'ss-p-detail-t', br.open.detail)]) : null,
        lines.length ? U.Col(E, 'ss-p-lines', [U.Cap(E, 'ss-p-lines-l', 'Suggested opening lines · rewrite them in your words', T.accent), ...lines.map((l, n2) => Copy(k, `ss-p-line-${n2}`, { text: l, copyLabel: 'Copy line' }))], U.S.tight) : null,
        str(br.open?.imagined) ? U.Callout(E, 'ss-p-imag', 'i', br.open.imagined) : null,
      ],
    },
    {
      id: 'arc', jump: 'Arc', title: 'The arc', answer: 'The story, beat by beat: what happens on the page in order.',
      body: [beats.length ? <E.Box key="ss-p-beats" flexDirection="column" gap={1}>{beats.map(beatCard)}</E.Box> : null],
    },
    {
      id: 'yours', jump: 'Your material', title: 'Your own material', answer: 'Stories I know about you. Use them.',
      body: [
        use.length ? U.Grid(E, 'ss-p-use', use.map((u, n2) => U.Panel(E, `ss-p-use-${n2}`, 'surface', [
          <E.Text key={`ss-p-use-${n2}-t`} italic color={T.heading} wrap="wrap">{str(u.what)}</E.Text>,
          str(u.from) ? U.Meta(E, `ss-p-use-${n2}-f`, `From ${lowerLead(str(u.from).replace(/^from\s+/i, ''))}`) : null,
        ])), k.wide) : null,
        str(br.yours?.question) ? U.Panel(E, 'ss-p-q', 'inset', [
          U.Cap(E, 'ss-p-q-l', 'A question for you'),
          U.Strong(E, 'ss-p-q-t', br.yours.question),
          U.Line(E, 'ss-p-q-a', [U.Btn(E, `ss-p-answer-${i}`, 'Answer it in the chat', work1)]),
          str(br.yours?.meanwhile) ? U.Col(E, 'ss-p-mw', [U.Meta(E, 'ss-p-mw-l', 'Until you answer it', { weight: 'semibold' }), ...linesOf(k, br.yours.meanwhile).map((t, m) => BriefLine(E, `ss-p-mw.${m}`, t, null))], U.S.none) : null,
        ]) : null,
        str(br.yours?.check) ? U.Callout(E, 'ss-p-check', '!', U.Col(E, 'ss-p-check-c', [U.Strong(E, 'ss-p-check-l', 'Check before you post'), ...linesOf(k, br.yours.check).map((t, m) => BriefLine(E, `ss-p-ck.${m}`, t, '•'))], U.S.none)) : null,
      ],
    },
    {
      id: 'land', jump: 'Ending', title: 'How it lands', answer: 'The takeaway, the closing line, and the ask.',
      body: [
        str(br.land?.takeaway) ? U.Strong(E, 'ss-p-take', br.land.takeaway) : null,
        str(br.land?.line) ? Copy(k, `ss-p-inv-${i}`, { label: 'Closing line', text: br.land.line, copyLabel: 'Copy closing line' }) : null,
        cta,
      ],
    },
  ]
  return [
    ...head,
    ...k.act.OpSlot(k.c, `ss-brief-${i}`, []),
    ...Sections(k, 'ss-pp', secs),
    fits,
    actions,
    pn,
  ].filter(Boolean)
}
