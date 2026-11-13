// @ts-nocheck
// Uncapped panel, version 2 (DESIGN.md, 11 Nov 2026): the building blocks.
// Every screen in version 2 is drawn from these. They read colours from T
// (never a raw hex), use only S spacing, and take the element table E from
// the screen that draws them. Presses are handed off with later(), so a
// press never runs past Claude Desktop's 10-second budget.

import { V, S, LENS, LENS_FILL, barSvg } from './brand.js'

// Claude Desktop doesn't tell a panel its light or dark setting (Claude Code
// 2.1.321), so version 2 draws light. VD in brand.js holds the dark set.
export const T = V
export { S }

export function later(fn) {
  return () => { Promise.resolve().then(fn).catch(() => {}) }
}

// Buttons: primary (one per screen), secondary, or plain. kind: true or
// 'primary', 'plain', 'dim' (plain and quiet), else secondary.
export function Btn(E, key, label, onPress, kind, opts = {}) {
  // Every press is a visible button (11 Nov): plain text-only buttons read as text in Desktop.
  const v = kind === true || kind === 'primary' ? { variant: 'primary' } : { variant: 'secondary' }
  return <E.Button key={key} label={label} onPress={later(onPress)} {...v} {...opts} />
}
export const BackLink = (E, key, label, fn) => Btn(E, key, `← ${label}`, fn, 'dim')

// ---- text roles
export const Body = (E, key, text, props = {}) => <E.Text key={key} color={T.body} wrap="wrap" {...props}>{String(text ?? '')}</E.Text>
export const Meta = (E, key, text, props = {}) => <E.Text key={key} size="footnote" color={T.meta} wrap="wrap" {...props}>{String(text ?? '')}</E.Text>
export const Cap = (E, key, text, color = T.meta) => <E.Text key={key} size="caption" weight="bold" color={color} wrap="wrap">{String(text ?? '').toUpperCase()}</E.Text>
export const Strong = (E, key, text, props = {}) => <E.Text key={key} weight="semibold" color={T.heading} wrap="wrap" {...props}>{String(text ?? '')}</E.Text>
export const H2 = (E, key, text) => <E.Text key={key} size="heading" weight="semibold" color={T.heading} wrap="wrap">{String(text ?? '')}</E.Text>
// One to four words on the highlighter.
export const Hl = (E, key, text) => <E.Text key={key} backgroundColor={T.highlight} color={T.body}>{String(text ?? '')}</E.Text>

// ---- layout
export function Col(E, key, children, gap = S.tight, props = {}) {
  return <E.Box key={key} flexDirection="column" gap={gap} {...props}>{(Array.isArray(children) ? children : [children]).filter(Boolean)}</E.Box>
}
export function Line(E, key, children, props = {}) {
  return <E.Box key={key} flexDirection="row" flexWrap="wrap" gap={1} alignItems="center" {...props}>{(Array.isArray(children) ? children : [children]).filter(Boolean)}</E.Box>
}
// Two columns when the content column is wide enough (5.3), one below.
export function Grid(E, key, items, wide, width = '48%') {
  return (
    <E.Box key={key} flexDirection="row" flexWrap="wrap" columnGap={1} rowGap={1}>
      {items.filter(Boolean).map((it, i) => <E.Box key={`${key}-c${i}`} flexDirection="column" width={wide ? width : '100%'} flexShrink={1}>{it}</E.Box>)}
    </E.Box>
  )
}

// ---- cards. Every card has one tone; two strong ones per screen at most.
const TONES = {
  next: { bg: T.nextBg, border: T.nextBorder, hover: T.nextHover },
  decide: { bg: T.decideBg, border: T.decideBorder },
  working: { bg: T.workingBg, border: T.workingBorder },
  done: { bg: T.doneBg, border: T.doneBorder },
  surface: { bg: T.surface, border: T.line },
  inset: { bg: T.inset },
  invite: { bg: T.bg, border: T.disabled, dashed: true },
  accent: { bg: T.surface, border: T.accent },
  washPink: { bg: T.washPink },
  washButter: { bg: T.washButter },
  washBlue: { bg: T.washBlue },
  washGreen: { bg: T.washGreen },
}
export function Panel(E, key, tone, children, props = {}) {
  const t = TONES[tone] || TONES.surface
  return (
    <E.Box key={key} flexDirection="column" gap={S.tight} paddingX={2} paddingY={1} backgroundColor={t.bg} {...(t.border ? { borderStyle: t.dashed ? 'dashed' : 'round', borderColor: t.border } : {})} {...(t.hover && key ? { hover: { backgroundColor: t.hover } } : {})} {...props}>
      {(Array.isArray(children) ? children : [children]).filter(Boolean)}
    </E.Box>
  )
}

// A card with a coloured left edge and an optional wash behind it, so kinds of
// block look different at a glance (11 Nov: less beige, more variation).
export function SpineCard(E, key, spine, children, tone = 'surface') {
  const t = TONES[tone] || TONES.surface
  return (
    <E.Box key={key} flexDirection="row" backgroundColor={t.bg} {...(tone === 'surface' ? { borderStyle: 'round', borderColor: T.line } : {})}>
      <E.Box key={`${key}-sp`} width={1} flexShrink={0} backgroundColor={spine} />
      <E.Box key={`${key}-b`} flexDirection="column" gap={S.tight} paddingX={2} paddingY={1} flexGrow={1} flexShrink={1} minWidth={0}>
        {(Array.isArray(children) ? children : [children]).filter(Boolean)}
      </E.Box>
    </E.Box>
  )
}
export const SPINES = () => [T.accent, T.spinePink, T.spineButter, T.spineGreen]

// The Next move (7.5): label, an instruction of 60 characters or fewer, one
// sentence of why, a footnote of facts, the primary button and at most one more.
export function NextCard(E, key, { label = 'Your next move', title, body, foot, actions = [], extra = [], tone = 'next' }) {
  return Panel(E, key, tone, [
    Cap(E, `${key}-l`, label, tone === 'working' ? T.accent : tone === 'decide' ? T.heading : T.accent),
    title ? <E.Text key={`${key}-t`} size="heading" weight="semibold" color={T.heading} wrap="wrap">{String(title)}</E.Text> : null,
    body ? Body(E, `${key}-b`, body) : null,
    ...extra.filter(Boolean),
    foot ? Meta(E, `${key}-f`, foot, { color: T.body }) : null,
    actions.filter(Boolean).length ? Line(E, `${key}-a`, actions.filter(Boolean)) : null,
  ])
}

// Chips (7.12): sentence case, at most one per row or card.
const CHIP = {
  done: { bg: T.doneBg, fg: T.doneText, border: T.doneBorder },
  here: { bg: T.surface, fg: T.accent, border: T.accent },
  quiet: { bg: T.inset, fg: T.meta, border: T.line },
  accent: { bg: T.accentFill, fg: T.onAccent, border: T.accentFill },
  pick: { bg: T.nextBg, fg: T.heading, border: T.nextBorder },
  decide: { bg: T.decideBg, fg: T.heading, border: T.decideBorder },
  working: { bg: T.workingBg, fg: T.heading, border: T.workingBorder },
}
export function Chip(E, key, text, kind = 'quiet') {
  const lens = String(kind).startsWith('lens:') ? String(kind).slice(5) : null
  const t = lens && LENS_FILL[lens] ? { bg: T[LENS_FILL[lens][0]], fg: T[LENS_FILL[lens][1]], border: T[LENS_FILL[lens][0]] } : CHIP[kind] || CHIP.quiet
  return (
    <E.Box key={key} paddingX={1} borderStyle="round" borderColor={t.border} backgroundColor={t.bg} alignSelf="flex-start" flexShrink={0}>
      <E.Text size="caption" weight="semibold" color={t.fg}>{String(text)}</E.Text>
    </E.Box>
  )
}
export const lensColor = (id) => (LENS_FILL[id] ? T[LENS_FILL[id][0]] : T.line)

// The title block (7.1): eyebrow, the Cormorant title (an element the screen
// draws, since it needs the fonts), a footnote promise, a status chip on the right.
export function TitleBlock(E, key, { eyebrow, title, promise, chip }) {
  return (
    <E.Box key={key} flexDirection="column" gap={S.none}>
      {eyebrow || chip ? (
        <E.Box key={`${key}-top`} flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" gap={1}>
          {eyebrow ? Cap(E, `${key}-e`, eyebrow, T.accent) : <E.Text key={`${key}-e`}> </E.Text>}
          {chip || null}
        </E.Box>
      ) : null}
      {title}
      {promise ? Meta(E, `${key}-p`, promise) : null}
    </E.Box>
  )
}

// A metric tile (7.2): label, a number read in a second, context, a bar.
export function Metric(E, key, { label, value, suffix, context, bar }, width) {
  return (
    <E.Box key={key} flexDirection="column" gap={S.none} paddingX={2} paddingY={1} backgroundColor={T.surface} borderStyle="round" borderColor={T.line} width={width} flexShrink={1}>
      {Cap(E, `${key}-l`, label)}
      <E.Box key={`${key}-v`} flexDirection="row" gap={1} alignItems="flex-end">
        <E.Text size="title" weight="semibold" color={T.heading}>{String(value ?? 0)}</E.Text>
        {suffix ? <E.Text size="footnote" color={T.meta}>{String(suffix)}</E.Text> : null}
      </E.Box>
      {bar && E.Svg ? <E.Svg key={`${key}-b`} source={barSvg({ n: bar.n, total: bar.total, w: 96 })} alt={bar.alt || `${bar.n} of ${bar.total}`} /> : null}
      {context ? Meta(E, `${key}-c`, context) : null}
    </E.Box>
  )
}
// Four across when the column is wide, two by two below; tiles never hide.
export function MetricStrip(E, key, tiles, colPx, note) {
  const four = tiles.length > 2 && colPx >= 520
  const w = four ? (tiles.length === 3 ? '31%' : '23%') : '48%'
  return (
    <E.Box key={key} flexDirection="column" gap={S.none}>
      <E.Box key={`${key}-r`} flexDirection="row" flexWrap="wrap" columnGap={1} rowGap={1}>
        {tiles.map((t, i) => Metric(E, `${key}-${i}`, t, w))}
      </E.Box>
      {note ? Meta(E, `${key}-n`, note) : null}
    </E.Box>
  )
}

// A row list (7.3): one container, many rows. Each row: an optional spine,
// a name, one meta line, one status (glyph and word), and its buttons.
export function RowList(E, key, { label, rows, limit = 5, expanded = false, onToggle, empty }) {
  const shown = expanded || rows.length <= limit ? rows : rows.slice(0, limit)
  return (
    <E.Box key={key} flexDirection="column" gap={S.none}>
      {label ? Cap(E, `${key}-h`, label) : null}
      <E.Box key={`${key}-box`} flexDirection="column" gap={1} paddingY={1} paddingRight={1} backgroundColor={T.surface} borderStyle="round" borderColor={T.line}>
        {shown.length ? shown.map((r) => ListRow(E, r)) : <E.Box key={`${key}-empty-b`} paddingX={2}>{Meta(E, `${key}-empty`, empty || 'Nothing here yet.')}</E.Box>}
        {rows.length > limit && onToggle ? <E.Box key={`${key}-all`} flexDirection="row" paddingX={2}>{Btn(E, `${key}-all-btn`, expanded ? 'Show fewer' : `Show all ${rows.length}`, onToggle, 'dim')}</E.Box> : null}
      </E.Box>
    </E.Box>
  )
}
export function ListRow(E, r) {
  return (
    <E.Box key={r.key} flexDirection="row" gap={1}>
      <E.Box key={`${r.key}-sp`} width={1} flexShrink={0} backgroundColor={r.spine || T.surface} />
      <E.Box key={`${r.key}-m`} flexDirection="column" gap={S.none} flexGrow={1} flexShrink={1} minWidth={0} paddingLeft={1} alignSelf="flex-start">
        <E.Text weight="semibold" color={T.heading} wrap="wrap">{String(r.name ?? '')}</E.Text>
        {r.meta ? Meta(E, `${r.key}-meta`, r.meta) : null}
        {r.text ? Body(E, `${r.key}-text`, r.text, { size: 'footnote' }) : null}
      </E.Box>
      <E.Box key={`${r.key}-s`} flexDirection="row" flexWrap="wrap" gap={1} alignItems="center" alignSelf="flex-start" flexShrink={0}>
        {r.status ? <E.Text key={`${r.key}-st`} size="footnote" weight="semibold" color={r.status.color || T.meta}>{`${r.status.glyph ? `${r.status.glyph} ` : ''}${r.status.text}`}</E.Text> : null}
        {r.chip || null}
        {(r.actions || []).filter(Boolean)}
      </E.Box>
    </E.Box>
  )
}
// The status words and glyphs (7.3): the word always shows.
export const STATUS = {
  none: { glyph: '○', text: 'Not contacted', color: T.meta },
  draft: { glyph: '○', text: 'Message ready', color: T.meta },
  messaged: { glyph: '●', text: 'Messaged', color: T.accent },
  replied: { glyph: '●', text: 'Replied', color: T.body },
  talked: { glyph: '✓', text: 'Talked', color: T.doneText },
}

// The view switcher (7.4): the selected view secondary, the others plain and quiet.
export function ViewSwitch(E, key, views, cur, onPick) {
  return (
    <E.Box key={key} flexDirection="row" flexWrap="wrap" gap={1}>
      {views.map((v) => (v.id === cur
        ? <E.Button key={`${key}-${v.id}`} variant="secondary" label={`● ${v.label}`} onPress={later(() => onPick(v.id))} />
        : <E.Button key={`${key}-${v.id}`} variant="secondary" dimColor label={v.label} onPress={later(() => onPick(v.id))} />))}
    </E.Box>
  )
}

// An answer tile (7.6): the question, the gist, Open on its own page.
export function Tile(E, key, { q, gist, muted, actions = [], spine }) {
  return (spine ? (k, tone, kids) => SpineCard(E, k, spine, kids) : (k, tone, kids) => Panel(E, k, tone, kids))(key, 'surface', [
    <E.Box key={`${key}-top`} flexDirection="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
      <E.Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>{Meta(E, `${key}-q`, q)}</E.Box>
      <E.Box flexDirection="row" flexShrink={0}>{actions.filter(Boolean)[0] || null}</E.Box>
    </E.Box>,
    muted ? Meta(E, `${key}-g`, gist) : <E.Text key={`${key}-g`} weight="semibold" color={T.heading} wrap="wrap">{String(gist ?? '')}</E.Text>,
    ...actions.filter(Boolean).slice(1),
  ])
}

// An offer card (7.7): spine in its lens colour, title, one chip, a meta
// line and a status line, and Open.
export function OfferCard(E, key, { lens, title, chip, meta, status, actions = [], accent }) {
  return (
    <E.Box key={key} flexDirection="row" backgroundColor={T.surface} borderStyle="round" borderColor={accent ? T.accent : T.line}>
      <E.Box key={`${key}-sp`} width={1} flexShrink={0} backgroundColor={lensColor(lens)} />
      <E.Box key={`${key}-b`} flexDirection="row" flexWrap="wrap" gap={1} paddingX={2} paddingY={1} flexGrow={1} flexShrink={1} alignItems="flex-start" justifyContent="space-between">
        <E.Box key={`${key}-m`} flexDirection="column" gap={S.none} flexGrow={1} flexShrink={1} minWidth={0}>
          <E.Box key={`${key}-tl`} flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
            <E.Text weight="semibold" color={T.heading} wrap="wrap">{String(title ?? '')}</E.Text>
            {chip || null}
          </E.Box>
          {meta ? Meta(E, `${key}-meta`, meta) : null}
          {status ? Meta(E, `${key}-st`, status, { color: T.body }) : null}
        </E.Box>
        <E.Box key={`${key}-a`} flexDirection="row" flexWrap="wrap" gap={1} flexShrink={0}>{actions.filter(Boolean)}</E.Box>
      </E.Box>
    </E.Box>
  )
}

// A summary card (7.8): a label and one or two sentences.
export function SummaryCard(E, key, label, children) {
  return Panel(E, key, 'surface', [Cap(E, `${key}-l`, label), ...(Array.isArray(children) ? children : [children])])
}

// Key facts in an inset box (7.9): label over value, two columns wide, six at most.
export function Facts(E, key, pairs, wide, boxed = true) {
  const facts = pairs.filter(([, v]) => String(v ?? '').trim()).slice(0, 6)
  if (!facts.length) return null
  const inner = (
    <E.Box key={`${key}-g`} flexDirection="row" flexWrap="wrap" columnGap={2} rowGap={1}>
      {facts.map(([l, v], i) => (
        <E.Box key={`${key}-${i}`} flexDirection="column" gap={S.none} width={wide && facts.length > 1 ? '46%' : '100%'} flexShrink={1}>
          {Cap(E, `${key}-${i}-l`, l)}
          {Body(E, `${key}-${i}-v`, v)}
        </E.Box>
      ))}
    </E.Box>
  )
  return boxed ? <E.Box key={key} flexDirection="column" paddingX={2} paddingY={1} backgroundColor={T.surface} borderStyle="round" borderColor={T.line}>{inner}</E.Box> : <E.Box key={key} flexDirection="column">{inner}</E.Box>
}

// A callout: a glyph and a line, on paper. (i) to know, (!) to check, (?) to learn.
export function Callout(E, key, glyph, text) {
  const wash = glyph === '!' ? T.washPink : glyph === '?' || glyph === '★' ? T.washButter : glyph === '✓' ? T.washGreen : T.washBlue
  const spine = glyph === '!' ? T.spinePink : glyph === '?' || glyph === '★' ? T.spineButter : glyph === '✓' ? T.spineGreen : T.accent
  return (
    <E.Box key={key} flexDirection="row" backgroundColor={wash}>
      <E.Box key={`${key}-sp`} width={1} flexShrink={0} backgroundColor={spine} />
      <E.Box key={`${key}-in`} flexDirection="row" gap={1} paddingX={2} paddingY={1} flexGrow={1} flexShrink={1} minWidth={0} alignItems="flex-start">
        <E.Text key={`${key}-g`} weight="bold" color={glyph === '!' ? T.heading : T.accent}>{glyph}</E.Text>
        <E.Box key={`${key}-t`} flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>{typeof text === 'string' ? Body(E, `${key}-tx`, text) : text}</E.Box>
      </E.Box>
    </E.Box>
  )
}

// A copy block (7.10): the whole text wrapped in a paper box, never cut off,
// then the copy button and any others.
export function CopyBox(E, key, { label, text, onCopy, copyLabel = 'Copy message', note, actions = [] }) {
  return (
    <E.Box key={key} flexDirection="column" gap={S.tight} paddingBottom={1}>
      {label ? Cap(E, `${key}-l`, label, T.accent) : null}
      <E.Box key={`${key}-box`} flexDirection="row" backgroundColor={T.surface} borderStyle="round" borderColor={T.line}>
        <E.Box key={`${key}-sp`} width={1} flexShrink={0} backgroundColor={T.accent} />
        <E.Box key={`${key}-in`} flexDirection="column" paddingX={2} paddingY={1} flexGrow={1} flexShrink={1} minWidth={0}>
          <E.Text key={`${key}-m`} color={T.body} wrap="wrap">{String(text ?? '')}</E.Text>
        </E.Box>
      </E.Box>
      <E.Box key={`${key}-r`} flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
        {onCopy ? Btn(E, `${key}-copy`, copyLabel, onCopy) : null}
        {actions.filter(Boolean)}
        {note ? Meta(E, `${key}-n`, note) : null}
      </E.Box>
    </E.Box>
  )
}

// A section heading with its explaining line underneath (gap 0) and an
// optional quiet button on the right.
export function SectionHead(E, key, { title, sub, right }) {
  return (
    <E.Box key={key} flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="flex-end" gap={1}>
      <E.Box key={`${key}-m`} flexDirection="column" gap={S.none} flexGrow={1} flexShrink={1} minWidth={0}>
        <E.Text size="heading" weight="semibold" color={T.heading} wrap="wrap">{String(title)}</E.Text>
        {sub ? Meta(E, `${key}-s`, sub) : null}
      </E.Box>
      {right || null}
    </E.Box>
  )
}

// A jump bar (7.15): "JUMP TO" and a quiet button per section.
export function JumpBar(E, key, items) {
  return (
    <E.Box key={key} flexDirection="row" flexWrap="wrap" gap={1} alignItems="center" paddingX={2} paddingY={1} backgroundColor={T.inset}>
      {Cap(E, `${key}-l`, 'Jump to')}
      {items.map((it, i) => Btn(E, `${key}-${it.id || i}`, it.label, it.onPress, 'plain'))}
    </E.Box>
  )
}
const NUMFILL = [[T.accentFill, T.onAccent], [T.lensWith, T.onLensWith], [T.lensTeach, T.onLensTeach], [T.spineGreen, '#FFFFFF'], [T.lensPackage, T.onLensPackage], [T.lensPublish, T.onLensPublish]]
// A numbered section head (7.15): number, name, the answer in semibold, ↑ Top.
export function NumHead(E, key, { n, title, answer, onTop }) {
  return (
    <E.Box key={key} flexDirection="row" gap={1} alignItems="flex-start">
      <E.Box key={`${key}-n`} flexShrink={0} paddingX={1} backgroundColor={NUMFILL[(Number(n) - 1) % NUMFILL.length]?.[0] || T.accentFill}><E.Text size="heading" weight="bold" color={NUMFILL[(Number(n) - 1) % NUMFILL.length]?.[1] || T.onAccent}>{String(n)}</E.Text></E.Box>
      <E.Box key={`${key}-m`} flexDirection="column" gap={S.none} flexGrow={1} flexShrink={1} minWidth={0}>
        <E.Text size="heading" weight="semibold" color={T.heading} wrap="wrap">{String(title)}</E.Text>
        {answer ? <E.Text weight="semibold" color={T.body} wrap="wrap">{String(answer)}</E.Text> : null}
      </E.Box>
      {onTop ? <E.Box key={`${key}-top`} flexShrink={0}>{Btn(E, `${key}-top-btn`, '↑ Top', onTop, 'dim')}</E.Box> : null}
    </E.Box>
  )
}

// Lists (hub pack 8.18): a glyph per line, or numbers.
export function Bullets(E, key, items, glyph = '→') {
  const xs = (items || []).map((x) => String(x ?? '').trim()).filter(Boolean)
  if (!xs.length) return null
  return (
    <E.Box key={key} flexDirection="column" gap={S.none}>
      {xs.map((t, i) => (
        <E.Box key={`${key}-${i}`} flexDirection="row" gap={1} alignItems="flex-start">
          <E.Box key={`${key}-${i}-gb`} flexShrink={0}><E.Text key={`${key}-${i}-g`} color={glyph === '✓' ? T.doneText : T.accent} weight="bold">{glyph}</E.Text></E.Box>
          <E.Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>{Body(E, `${key}-${i}-t`, t)}</E.Box>
        </E.Box>
      ))}
    </E.Box>
  )
}
export function Numbered(E, key, items) {
  const xs = (items || []).map((x) => String(x ?? '').trim()).filter(Boolean)
  if (!xs.length) return null
  return (
    <E.Box key={key} flexDirection="column" gap={S.none}>
      {xs.map((t, i) => (
        <E.Box key={`${key}-${i}`} flexDirection="row" gap={1} alignItems="flex-start">
          <E.Box key={`${key}-${i}-nb`} flexShrink={0}><E.Text key={`${key}-${i}-n`} weight="bold" color={T.accent}>{`${i + 1}.`}</E.Text></E.Box>
          <E.Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>{Body(E, `${key}-${i}-t`, t)}</E.Box>
        </E.Box>
      ))}
    </E.Box>
  )
}

// Breadcrumbs for a detail page: quiet buttons joined by ›, the last one plain text.
export function Crumbs(E, key, parts) {
  return (
    <E.Box key={key} flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
      {parts.flatMap(([label, fn], i) => [
        fn ? Btn(E, `${key}-${i}`, label, fn, 'dim') : Meta(E, `${key}-${i}`, label),
        i < parts.length - 1 ? <E.Text key={`${key}-sep-${i}`} size="footnote" color={T.disabled}>›</E.Text> : null,
      ]).filter(Boolean)}
    </E.Box>
  )
}

// The lens band of an idea card (7.14): the lens fill, its name, and a time
// meter of five squares filled to the lens's place on the ladder.
export const LADDER = { publish: 1, package: 2, teach: 3, with: 4, for: 5 }
export function LensBand(E, key, lens) {
  const [fill, on] = LENS_FILL[lens] || ['inset', 'meta']
  const lv = LADDER[lens] || 0
  return (
    <E.Box key={key} flexDirection="row" justifyContent="space-between" alignItems="center" paddingX={2} backgroundColor={T[fill]}>
      <E.Text size="caption" weight="bold" color={T[on]}>{String(LENS[lens]?.name || 'An idea').toUpperCase()}</E.Text>
      {lv ? <E.Text key={`${key}-m`} size="caption" color={T[on]}>{'■'.repeat(lv) + '□'.repeat(5 - lv)}</E.Text> : null}
    </E.Box>
  )
}
// A price split into amount and unit, only on a clear match ("£35 a seat").
export function splitPrice(p) {
  const m = String(p || '').trim().match(/^([£$€]\s?[\d,.]+[kK]?(?:\s?(?:to|-|–)\s?[£$€]?\s?[\d,.]+[kK]?)?)\s+((?:a|an|per|each)\b.*)$/)
  return m ? [m[1], m[2]] : [String(p || ''), '']
}
