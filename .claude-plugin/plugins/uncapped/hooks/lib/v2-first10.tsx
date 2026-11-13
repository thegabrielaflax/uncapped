// @ts-nocheck
// First 10 Customers, version 2 (DESIGN.md 4.3, 7.2 to 7.12, 9.2, 9.4). Drawn
// from ui2.tsx. k is the panel's kit (see v2kit in register.tsx): k.c, k.E,
// k.fn (every panel helper by name), k.act (the helpers that need $, with $
// filled in), k.head (title block and context line). $ never leaves this file's
// entry points: every action goes through k.act.
import * as U from './ui2.tsx'
import { S } from './ui2.tsx'
import { contactCounts, SIGNALS, spacesOf, offersIn } from './model.js'

const T = U.T
const COPIED = 'Copied. Paste it into your own messages.'
const toList = (k) => k.act.go({ view: 'builder', builder: 'sales', stage: 'result' })
const toPerson = (k, slot) => k.act.go({ view: 'builder', builder: 'sales', stage: 'person', slot })

// ---- the people on a plan, and how each one reads in a row
function peopleOn(k, b) {
  const f = k.fn
  return (b?.output?.list || []).map((p, i) => {
    const key = f.keyOf(p, i)
    return { p, i, key, slot: f.slotOf(p, i), t: f.contactOf(b, key) }
  })
}
// Sentence case, never chips (7.3): "Possible buyer · knows you well".
const WARM = { hot: 'knows you well', warm: 'knows you', cold: 'new to you' }
const roleWord = (p) => (p?.role === 'connector' ? 'Can introduce you' : 'Possible buyer')
const outcomeWord = (t) => (t.reply === 'said not now' ? 'said not now' : t.outcome === 'not the right person' ? 'not the right person' : t.sent === 'followed up' ? 'no reply after a week' : '')
function metaOf(k, x) {
  const finding = k.fn.stillToFind(x.p, x.t)
  return [roleWord(x.p), finding ? 'to find' : WARM[x.p?.temperature] || '', outcomeWord(x.t)].filter(Boolean).join(' · ')
}
// One status per person (7.3): the word always shows.
function statusOf(k, t) {
  const st = k.fn.stopOf(t)
  if (st === 3) return U.STATUS.talked
  if (st === 2) return U.STATUS.replied
  if (st === 1) return U.STATUS.messaged
  return String(t.draft || '').trim() && !outcomeWord(t) ? U.STATUS.draft : U.STATUS.none
}
// Introductions: someone named an introduction, or gave their time.
const introsOf = (list) => list.filter((x) => String(x.t.intro || '').trim() || x.t.signal === 'an introduction or their time').length

// ---- small blocks (8.18 in version 2 colours)
// A line with its natural lead in semibold (a list bolds every lead or none).
function Lead(k, key, text, bold = true) {
  const { E } = k
  const t = String(text || '')
  const l = bold ? k.fn.naturalLead(t) : null
  return l
    ? <E.Text key={key} color={T.body} wrap="wrap">{[<E.Text key={`${key}-b`} weight="semibold" color={T.heading}>{l.lead}</E.Text>, `${l.sep} ${l.rest}`]}</E.Text>
    : <E.Text key={key} color={T.body} wrap="wrap">{t}</E.Text>
}
// A list, one row per item, its glyph saying what kind of list it is ('#' numbers it).
// Kept lean: a long toolkit has thirty or more rows, and the tree must stay under 90,000.
function Items(k, key, items, glyph = '•') {
  const { E } = k
  const xs = (items || []).map((x) => String(x ?? '').trim()).filter(Boolean)
  if (!xs.length) return null
  const bold = k.fn.allLed(xs)
  const color = glyph === '✓' ? T.doneText : glyph === '•' || glyph === '□' ? T.meta : T.accent
  return (
    <E.Box key={key} flexDirection="column" gap={S.none}>
      {xs.map((x, i) => (
        <E.Box key={`${key}-${i}`} flexDirection="row" gap={1}>
          <E.Text color={color} weight="bold">{glyph === '#' ? `${i + 1}.` : glyph}</E.Text>
          <E.Box flexShrink={1} minWidth={0}>{Lead(k, `${key}-t-${i}`, x, bold)}</E.Box>
        </E.Box>
      ))}
    </E.Box>
  )
}
// A text in a paper box, never cut off (7.10).
function Paper(k, key, text, bg = T.inset) {
  const { E } = k
  return (
    <E.Box key={key} flexDirection="column" paddingX={2} paddingY={1} backgroundColor={bg}>
      <E.Text key={`${key}-m`} color={T.body} wrap="wrap">{String(text ?? '')}</E.Text>
    </E.Box>
  )
}
// A choice row (8.12): the chosen one secondary with a tick, the rest plain.
function Choice(k, key, label, options, cur, onPick, show = (o) => o, sub = '') {
  const { E } = k
  return U.Col(E, key, [
    U.Col(E, `${key}-h`, [U.Cap(E, `${key}-l`, label), sub ? U.Meta(E, `${key}-s`, sub) : null], S.none),
    <E.Box key={`${key}-r`} flexDirection="row" flexWrap="wrap" columnGap={1} rowGap={1}>
      {options.map((o, i) => (o === cur ? U.Btn(E, `${key}-${i}`, `✓ ${show(o)}`, () => onPick(o)) : U.Btn(E, `${key}-${i}`, show(o), () => onPick(o), 'plain')))}
    </E.Box>,
  ], S.tight)
}

// ---- the Next move (7.5): one per screen, by where the outreach stands.
// On Home it names the step and the offer in its footnote.
function NextMove(k, b, o, home) {
  const { E } = k
  const f = k.fn
  const out = b.output || {}
  const list = peopleOn(k, b)
  const cn = contactCounts(list.map((x) => x.t))
  const batch = f.firstBatch(b)
  const written = batch.filter((x) => x.draft).length
  const firstUp = batch.find((x) => x.draft && f.stopOf(f.contactOf(b, x.key)) === 0)
  const fm = out.firstMove || {}
  const where = home && o ? `First 10 · ${f.shortName(o.name)}` : ''
  const openF10 = home ? U.Btn(E, 'home-open-f10', 'Open First 10', () => k.act.goStep('sales'), 'plain') : null
  const card = (key, spec) => U.NextCard(E, home ? 'home-next' : key, {
    ...spec,
    extra: [...(spec.extra || []), home && spec.foot ? U.Meta(E, `${home ? 'home-next' : key}-facts`, spec.foot, { color: T.body }) : null],
    foot: home ? where : spec.foot,
  })
  const report = (primary) => U.Btn(E, 'ws-f10-report', 'Report back in the chat', () => k.act.reportOutreach(), primary ? true : 'plain')
  if (cn.talked >= 10) {
    return card('ws-f10-next', { title: 'Look for the pattern', body: `${cn.talked} conversations. Which pattern do you hear? Bring it to the chat and we'll read it together.`, actions: [report(true), openF10] })
  }
  if (written < batch.length) {
    return card('ws-next-msgs', {
      title: `Write your first ${batch.length === 1 ? 'message' : `${batch.length} messages`}`,
      body: `${f.nameList(batch.map((x) => f.personName(x.p, f.contactOf(b, x.key))))}. Each one is saved on their page, ready to copy.`,
      foot: `First messages written: ${written} of ${batch.length}.`,
      actions: [U.Btn(E, 'ws-write-msgs', 'Write them in the chat', () => k.act.planInChat('sales', false, '', 'messages'), true), openF10],
    })
  }
  if (firstUp) {
    const name = f.personName(firstUp.p, f.contactOf(b, firstUp.key))
    return card('ws-f10-next', {
      title: `Message ${f.inSentence(name)}`,
      // The message itself is on their page (mock 9.2): the card says why, and copies it.
      body: f.firstSentence(firstUp.p.why || fm.why || ''),
      foot: `First messages written: ${written} of ${batch.length}. Then come back and tell me what happened, even if nobody replied.`,
      actions: [
        U.Btn(E, 'ws-f10-copy', 'Copy message', () => k.act.copyText(firstUp.draft, COPIED), true),
        U.Btn(E, 'ws-f10-sent', "I've sent it", () => k.act.saveContact(firstUp.slot, { sent: 'sent' }, firstUp.key)),
        report(false),
      ],
    })
  }
  return card('ws-f10-next', { title: 'Tell me what happened', body: 'Show me what you sent and what came back, even if nobody replied. Bring the messy notes from any call.', actions: [report(true), openF10] })
}

// ---- the plan was built for another offer (mock "First 10 · plan for another offer")
function DecideCard(k, b, o) {
  const { E, work } = k
  const f = k.fn
  const planOffer = (work.offers || []).find((x) => x.id === b?.basedOn?.offerId)
  const stored = b?.byOffer?.[o.id]
  const was = f.shortName(planOffer?.name || 'an earlier offer')
  return U.Panel(E, 'ws-plan-other', 'decide', [
    U.Cap(E, 'ws-plan-other-l', 'Needs your decision', T.heading),
    <E.Text key="ws-plan-other-t" size="heading" weight="semibold" color={T.heading} wrap="wrap">{`This plan was built for ${was}`}</E.Text>,
    U.Body(E, 'ws-plan-other-b', `You're now working on ${f.shortName(o.name)}. Build a plan for it, or keep using this one.`),
    ...k.act.OpSlot(k.c, 'plan-sales', [U.Line(E, 'ws-plan-other-a', [
      stored
        ? U.Btn(E, 'plan-restore-sales', 'Open the plan for this offer', () => k.act.swapPlan('sales'), true)
        : U.Btn(E, 'plan-new-sales', 'Build a new plan in the chat', () => k.act.newPlanForOffer('sales'), true),
      U.Btn(E, 'plan-keep-sales', 'Keep this plan', () => k.act.keepPlanFor('sales')),
      U.Btn(E, 'plan-revise-sales', 'Adapt this plan instead', () => k.act.revisePlanForOffer('sales'), 'plain'),
    ])]),
    U.Meta(E, 'ws-plan-other-f', `Your notes on who you've contacted stay saved with ${was}.`, { color: T.body }),
  ])
}

// ---- "Your list" (9.2): Next move, numbers, the plan in one line, the people.
function ListView(k, b, o) {
  const { E } = k
  const f = k.fn
  const out = b.output || {}
  const list = peopleOn(k, b)
  const total = list.length || 10
  const cn = contactCounts(list.map((x) => x.t))
  const intros = introsOf(list)
  const known = list.filter((x) => !f.stillToFind(x.p, x.t))
  const toFind = list.filter((x) => f.stillToFind(x.p, x.t))
  const connectors = list.filter((x) => x.p.role === 'connector').length
  const firstUp = f.firstBatch(b).find((x) => x.draft && f.stopOf(f.contactOf(b, x.key)) === 0)
  const zero = !cn.sent && !cn.replied && !cn.talked && !intros
  const spine = (x) => { const st = f.stopOf(x.t); return st === 3 ? T.doneBorder : st >= 1 ? T.accentFill : firstUp && x.key === firstUp.key ? T.highlight : undefined }
  const row = (x) => {
    const st = statusOf(k, x.t)
    const meta = metaOf(k, x)
    return {
      key: `f10-row-${x.slot}`,
      name: f.personName(x.p, x.t),
      meta,
      status: st,
      spine: spine(x),
      actions: [U.Btn(E, `f10-open-${x.slot}`, 'Open', () => toPerson(k, x.slot), 'plain')],
    }
  }
  const seeGuide = async () => { await k.setView('sales', 'toolkit'); await k.scrollTo('f10-guide') }
  return [
    NextMove(k, b, o, false),
    U.MetricStrip(E, 'f10-metrics', [
      { label: 'Messaged', value: cn.sent },
      { label: 'Replies', value: cn.replied },
      { label: 'Talked', value: cn.talked, suffix: `of ${total}`, bar: { n: cn.talked, total, alt: `${cn.talked} of ${total} conversations` } },
      { label: 'Introduced', value: intros },
    ], k.colPx, zero ? 'These count up as you mark people on your list.' : ''),
    out.summary || list.length ? U.SpineCard(E, 'f10-summary', T.accent, [
      U.Cap(E, 'f10-summary-l', 'The plan in one line'),
      out.summary ? U.Body(E, 'f10-summary-t', out.summary) : null,
      list.length ? U.Meta(E, 'f10-mix', `${list.length - connectors} possible ${list.length - connectors === 1 ? 'buyer' : 'buyers'} · ${connectors} who can introduce you`) : null,
    ].filter(Boolean)) : null,
    cn.talked >= 5 && cn.talked < 10 ? U.Callout(E, 'ws-f10-early', 'i', (
      <E.Text key="ws-f10-early-t" color={T.body} wrap="wrap">{[<E.Text key="ws-f10-early-b" weight="semibold" color={T.heading}>{`${cn.talked} conversations: an early look.`}</E.Text>, ' Note what you keep hearing, but give it about ten before you change the offer or the buyer.']}</E.Text>
    )) : null,
    // Two messages saved: what they're inviting people into, before anything is sent.
    // The explanation (GUIDE_COPY) opens the call guide in the Toolkit, where this leads.
    f.draftsSaved(b) >= 2 ? U.Callout(E, 'f10-guide-callout', '?', U.Line(E, 'f10-guide-callout-c', [
      U.Strong(E, 'f10-gc-t', 'Wondering what to say on the call?'),
      U.Btn(E, 'f10-see-guide', 'See what to ask', seeGuide, 'plain'),
    ])) : null,
    known.length ? U.RowList(E, 'f10-known', { label: `People you know · ${known.length}`, rows: known.map(row), limit: 5, expanded: k.flag('f10-known-all'), onToggle: () => k.toggle('f10-known-all') }) : null,
    toFind.length ? U.RowList(E, 'f10-find', { label: `People to find · ${toFind.length}`, rows: toFind.map(row), limit: 5, expanded: k.flag('f10-find-all'), onToggle: () => k.toggle('f10-find-all') }) : null,
    U.Line(E, 'f10-change', [U.Btn(E, 'ws-plan-change', 'Change this plan in the chat', () => k.act.planInChat('sales', true), 'plain')]),
  ].filter(Boolean)
}

// ---- the research call guide: written for this plan, or made from its questions.
// Drawn in the Toolkit's "Your research call guide" section and in place on a person's page.
function GuideBody(k, b, out, opts = {}) {
  const { E, ui } = k
  const { client, knows, fresh } = k.fn.guideViews(out)
  const pre = opts.pre || 'g'
  if (!client && !knows) {
    return [
      U.Meta(E, `${pre}-none`, 'I can write a guide for each kind of call, with an opener, a few questions and a close.'),
      ...k.act.OpSlot(k.c, 'f10-guide-write', [U.Line(E, 'f10-guide-write-r', [U.Btn(E, 'f10-guide-write', 'Write my call guide', () => k.act.writeCallGuide('f10-guide-write'), 'plain')])]),
    ]
  }
  const both = Boolean(client && knows)
  const view = both ? (ui.guideView === 'knows' ? 'knows' : 'client') : client ? 'client' : 'knows'
  const g = view === 'knows' ? knows : client
  const said = (key, t) => (String(t || '').trim() ? U.Body(E, key, t) : null)
  const qBlock = (q, n, p2) => (
    <E.Box key={`${p2}-${n}`} flexDirection="column" gap={S.none}>
      {q.label ? <E.Text key={`${p2}-${n}-l`} size="footnote" weight="semibold" color={T.meta} wrap="wrap">{`${n + 1}. ${q.label}`}</E.Text> : null}
      <E.Text key={`${p2}-${n}-q`} color={T.body} wrap="wrap">{q.label ? q.q : `${n + 1}. ${q.q}`}</E.Text>
    </E.Box>
  )
  const qs = (g.questions || []).filter((q) => String(q?.q || '').trim()).slice(0, 4)
  const more = (g.more || []).filter((q) => String(q?.q || '').trim())
  return [
    both ? U.Col(E, `${pre}-kind`, [
      U.Meta(E, `${pre}-kind-l`, "Who's the call with? The questions change."),
      <E.Box key={`${pre}-kind-r`} flexDirection="row" flexWrap="wrap" columnGap={1} rowGap={1}>
        {[['client', 'Talking to a potential client'], ['knows', 'Someone who knows your clients']].map(([id, label]) => (
          U.Btn(E, `guide-view-${id}`, view === id ? `✓ ${label}` : label, () => k.act.setUi({ guideView: id }), view === id ? undefined : 'plain')
        ))}
      </E.Box>,
    ], S.tight) : null,
    opts.purpose === false ? null : said(`${pre}-purpose`, g.purpose),
    // The opener and the close are words to say, so they sit in copy boxes;
    // the questions get their own wash so the guide reads in three parts.
    g.opener ? U.Col(E, `${pre}-start`, [
      U.Strong(E, `${pre}-start-h`, 'Start the call'),
      U.CopyBox(E, `${pre}-opener`, { text: g.opener, onCopy: () => k.act.copyText(g.opener, 'Copied the opener.'), copyLabel: 'Copy' }),
    ], S.tight) : null,
    qs.length || more.length ? U.Panel(E, `${pre}-qs`, opts.qTone || 'washButter', [
      qs.length ? U.Strong(E, `${pre}-qs-h`, 'Questions to ask') : null,
      ...qs.map((q, n) => qBlock(q, n, `${pre}-q`)),
      // In the Toolkit the extra questions sit behind one collapsible row; on a
      // person's page (already opened in place) they're listed under a heading.
      more.length && !opts.moreOpen ? U.Line(E, `${pre}-more-row`, [U.Btn(E, 'g-more', ui.guideMore ? 'More questions if useful −' : 'More questions if useful +', () => k.act.setUi({ guideMore: !ui.guideMore }), 'dim')]) : null,
      more.length && (ui.guideMore || opts.moreOpen) ? U.Col(E, `${pre}-mqs`, [opts.moreOpen ? U.Strong(E, `${pre}-mqs-h`, 'More questions if useful') : null, ...more.map((q, n) => qBlock(q, n + qs.length, `${pre}-mq`))], S.tight) : null,
    ]) : null,
    g.close || g.intro ? U.Col(E, `${pre}-close`, [
      g.close ? U.Strong(E, `${pre}-close-h`, 'Close the call') : null,
      g.close ? U.CopyBox(E, `${pre}-close-t`, { text: g.close, onCopy: () => k.act.copyText(g.close, 'Copied the close.'), copyLabel: 'Copy' }) : null,
      // Gabriela's rule: every call ends with an ask for two introductions.
      g.intro ? said(`${pre}-intro`, `Then ask for two introductions: ${g.intro}`) : null,
    ], S.tight) : null,
    fresh ? null : U.Col(E, `${pre}-fresh`, [
      U.Meta(E, `${pre}-fresh-t`, "These are your plan's questions. I can write a guide for each kind of call, with an opener and a close."),
      ...k.act.OpSlot(k.c, 'f10-guide-write', [U.Line(E, 'f10-guide-write-r', [U.Btn(E, 'f10-guide-write', 'Write my call guide', () => k.act.writeCallGuide('f10-guide-write'), 'plain')])]),
    ], S.none),
  ].filter(Boolean)
}

// The paid pilot check (today's PilotCheck, checklist form), with its choices.
function Pilot(k, b, p) {
  const { E, ui } = k
  const f = k.fn
  const x = p || {}
  const dec = b.decisions || {}
  const choices = []
  for (const field of ['wantsHelp', 'outcome', 'approval', 'ifUnclear']) {
    f.blanksIn(x[field] ? String(x[field]) : '').forEach((bl, i) => choices.push({ key: `pilot.${field}.${i}`, label: `Your choice: ${bl.what}`, around: bl.around }))
  }
  if (String(x.decide || '').trim()) choices.push({ key: 'pilot.decide', label: 'Your choice', around: x.decide, plain: true })
  const open = choices.filter((ch) => !String(dec[ch.key] || '').trim())
  const fill = (field) => (x[field] ? f.fillBlanks(String(x[field]), field, dec) : '')
  const rows = [["They want help, not just agree it's a problem", fill('wantsHelp')], ['You can promise one tight outcome', fill('outcome')], ['They can say yes', fill('approval')]].map(([lead, d]) => (d ? `${lead}: ${d}` : `${lead}.`))
  return U.SpineCard(E, 'f10-pilot', T.spinePink, [
    U.Cap(E, 'f10-pilot-l', 'Before you suggest a paid pilot, check all three'),
    Items(k, 'f10-pl', rows, '□'),
    U.Meta(E, 'f10-pilot-u', x.ifUnclear ? `If any check is unclear: ${f.lowerFirst(f.fillBlanks(String(x.ifUnclear), 'ifUnclear', dec))}` : 'If any check is unclear, have another research conversation instead of pitching.'),
    choices.length ? U.Cap(E, 'f10-dec-h', open.length ? `A decision to make before you offer it${open.length > 1 ? ` (${open.length})` : ''}` : 'Your choices', T.heading) : null,
    ...choices.map((ch) => U.Col(E, `f10-dec-${ch.key}`, [
      U.Body(E, `f10-dec-t-${ch.key}`, ch.plain ? ch.around : `It depends on your scope: "${ch.around}". Choose it, then it fills the blank above.`),
      <E.Input key={`f10.decide.${ch.key}`} label={ch.label} value={String(ui.drafts?.[`f10.decide.${ch.key}`] ?? dec[ch.key] ?? '')} rows={1} onInput={(v) => k.act.setDraft(`f10.decide.${ch.key}`, v)} onSubmit={(v) => k.act.setDraft(`f10.decide.${ch.key}`, v)} />,
      U.Line(E, `f10-dec-a-${ch.key}`, [U.Btn(E, `f10-dec-save-${ch.key}`, 'Save my choice', () => k.act.saveDecision(ch.key))]),
    ], S.tight)),
  ], 'washPink')
}

// ---- "Toolkit" (4.3): headed sections, long is fine, with a jump bar and ↑ Top.
function Toolkit(k, b) {
  const { E, ui } = k
  const f = k.fn
  const out = b.output || {}
  const list = peopleOn(k, b)
  const by = out.buyer || {}
  const routes = (out.routes || []).filter((r) => r?.route || r?.how)
  const secs = []

  // Who to look for
  const whoParts = [
    by.description ? Lead(k, 'f10-by-d', by.description) : null,
    (by.lookFor || []).length ? U.Col(E, 'f10-look', [U.Cap(E, 'f10-look-l', 'Look for'), Items(k, 'f10-look-i', by.lookFor, '✓')], S.none) : null,
    (by.relevantNow || []).length ? U.Col(E, 'f10-now', [U.Cap(E, 'f10-now-l', 'Signs they need it now'), Items(k, 'f10-now-i', by.relevantNow, '→')], S.none) : null,
    by.hasProblem || by.champion || by.approves ? U.Col(E, 'f10-who', [
      U.Cap(E, 'f10-who-l', "Who's involved in deciding"),
      U.Facts(E, 'f10-who-f', [['Who feels the problem', by.hasProblem], ["Who'd push for it inside the business", by.champion], ['Who approves the spend', by.approves]], k.wide, false),
    ], S.tight) : null,
  ].filter(Boolean)
  if (whoParts.length) secs.push({ id: 'buyer', jump: 'Who to look for', title: 'Who to look for', sub: 'What makes someone relevant now.', body: [U.SpineCard(E, 'f10-who-card', T.accent, whoParts)] })

  // Where to find them
  if (routes.length) {
    secs.push({
      id: 'routes', jump: 'Where to find them', title: 'Where to find them',
      sub: `${routes.length} place${routes.length === 1 ? '' : 's'} to look, ${f.lowerFirst(f.sentenceCase(routes[0].route || 'the first'))} first`,
      body: [U.Grid(E, 'f10-routes', routes.map((r, i) => U.SpineCard(E, `f10-r-${i}`, T.spinePink, [
        <E.Box key={`f10-rh-${i}`} flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
          <E.Box key={`f10-rn-${i}`} flexShrink={0} paddingX={1} backgroundColor={T.lensWith}><E.Text weight="bold" color={T.onLensWith}>{String(i + 1)}</E.Text></E.Box>
          <E.Text key={`f10-rt-${i}`} weight="semibold" color={T.heading} wrap="wrap">{f.sentenceCase(r.route)}</E.Text>
          {r.when ? U.Chip(E, `f10-rw-${i}`, f.sentenceCase(r.when), i === 0 ? 'here' : 'quiet') : null}
        </E.Box>,
        r.how ? U.Body(E, `f10-rhow-${i}`, r.how) : null,
        r.fit ? U.Meta(E, `f10-rfit-${i}`, r.fit) : null,
      ])), k.wide)],
    })
  }

  // Your research call guide, and the paid pilot check
  const gv = f.guideViews(out)
  const pilot = out.conversation?.pilot
  const hasPilot = pilot && Object.values(pilot).some((v) => String(v || '').trim())
  secs.push({
    id: 'guide', key: 'f10-guide', jump: 'Call guide', title: 'Your research call guide',
    body: [
      gv.client || gv.knows ? U.Callout(E, 'f10-guide-why', 'i', f.GUIDE_COPY) : null,
      ...GuideBody(k, b, out, { pre: 'g' }),
      hasPilot ? U.Col(E, 'f10-pilot-sec', [
        U.Line(E, 'f10-pilot-row', [U.Btn(E, 'f10-pilot-toggle', ui.pilotOpen ? 'Considering a paid pilot? −' : 'Considering a paid pilot? +', () => k.act.setUi({ pilotOpen: !ui.pilotOpen }), 'dim')]),
        ui.pilotOpen ? Pilot(k, b, pilot) : null,
      ], S.tight) : null,
    ].filter(Boolean),
  })

  // Pace and tracking
  const cap = String(out.weeklyCap || '').trim()
  const capFirst = f.firstSentence(cap)
  const paceSummary = f.summaryOf(cap, 'your rhythm and what to write down')
  const capRest = paceSummary === capFirst.replace(/\.$/, '') ? cap.slice(capFirst.length).trim() : cap
  const batchNos = [...new Set(list.map((x) => Number(x.p.batch) || 1))].sort((m, n) => m - n)
  const rhythm = list.length ? batchNos.map((n, i) => `Batch ${n}${i === 0 ? ', now' : ''}: ${list.filter((x) => (Number(x.p.batch) || 1) === n).map((x) => f.personName(x.p, x.t)).join(', ')}`) : []
  const record = (out.tracker?.record || []).map(String).filter(Boolean)
  const rv = out.tracker?.review
  const ms = rv && typeof rv === 'object' && (rv.milestones || []).some((m) => m?.what) ? rv.milestones.filter((m) => m?.what).map((m) => (m.when ? `${m.when}: ${m.what}` : m.what))
    : typeof rv === 'string' && rv.trim() ? f.sentencesOf(rv).filter((x) => !/^name (it|the pattern)\b|re-aim before/i.test(x))
      : ['About 5 conversations: an early look. Note what you keep hearing.', 'About 10 conversations: look for the pattern, then decide.']
  const patterns = rv && typeof rv === 'object' && (rv.patterns || []).some((x) => x?.name) ? rv.patterns.filter((x) => x?.name) : f.PATTERNS
  const expect = String(out.expect || '').trim()
  const expectLead = f.firstSentence(expect)
  secs.push({
    id: 'track', jump: 'Pace and tracking', title: 'Pace and tracking', sub: f.sentenceCase(paceSummary),
    body: [
      capRest ? U.Body(E, 'f10-cap-rest', capRest) : null,
      U.Callout(E, 'f10-notetaker', '★', 'Record each call with a note taker (ask first), so you can bring the transcript back to the chat.'),
      U.SpineCard(E, 'f10-pace-card', T.spineGreen, [
        rhythm.length ? U.Col(E, 'f10-rh', [U.Cap(E, 'f10-rh-l', 'Your rhythm'), Items(k, 'f10-rh-i', rhythm, '→')], S.none) : null,
        record.length ? U.Col(E, 'f10-tr', [U.Cap(E, 'f10-tr-l', 'After each conversation, note'), Items(k, 'f10-tr-i', record, '•'), U.Meta(E, 'f10-tr-n', "Most of this saves on each person's page.")], S.none) : null,
        U.Col(E, 'f10-ms', [U.Cap(E, 'f10-ms-l', 'When to look back'), Items(k, 'f10-ms-i', ms, '◆')], S.none),
      ]),
      U.Col(E, 'f10-pt', [
        U.Cap(E, 'f10-pt-l', `The ${patterns.length === 4 ? 'four ' : ''}patterns to look for`),
        U.Grid(E, 'f10-pt-g', patterns.map((x, i) => (
          <E.Box key={`f10-pt-${i}`} flexDirection="row" backgroundColor={T.surface} borderStyle="round" borderColor={T.line}>
            <E.Box key={`f10-pt-${i}-sp`} width={1} flexShrink={0} backgroundColor={U.SPINES()[i % 4]} />
            <E.Box key={`f10-pt-${i}-b`} flexDirection="column" gap={S.none} paddingX={1} flexGrow={1} flexShrink={1} minWidth={0}>
              <E.Text key={`f10-pt-${i}-t`} weight="semibold" color={T.heading} wrap="wrap">{f.PATTERN_NAME[String(x.name).trim().toLowerCase()] || f.sentenceCase(x.name)}</E.Text>
              {x.looksLike ? U.Meta(E, `f10-pt-${i}-m`, x.looksLike) : null}
              {x.then ? <E.Text key={`f10-pt-${i}-x`} size="footnote" weight="semibold" color={T.body} wrap="wrap">{String(x.then)}</E.Text> : null}
            </E.Box>
          </E.Box>
        )), k.colPx >= 320),
        U.Meta(E, 'f10-pt-n', 'Change who you ask or what you say before you rebuild anything.'),
      ], S.tight),
      // Ten names are ten people, not ten customers (the plan's own words, when it has them).
      U.Callout(E, 'f10-ten', 'i', expect
        ? <E.Text key="f10-ten-t" color={T.body} wrap="wrap">{[<E.Text key="f10-ten-b" weight="semibold" color={T.heading}>{expectLead}</E.Text>, expect.slice(expectLead.length)]}</E.Text>
        : <E.Text key="f10-ten-t" weight="semibold" color={T.heading} wrap="wrap">Ten people to approach are not ten customers.</E.Text>),
    ].filter(Boolean),
  })

  const top = () => k.scrollTo('f10-view')
  return [
    secs.length > 2 ? U.JumpBar(E, 'f10-jump', secs.map((s) => ({ id: s.id, label: s.jump, onPress: () => k.scrollTo(s.key || `f10-tk-${s.id}`) }))) : null,
    ...secs.map((s, i) => U.Col(E, s.key || `f10-tk-${s.id}`, [
      U.NumHead(E, `f10-tk-${s.id}-h`, { n: i + 1, title: s.title, answer: s.sub, onTop: secs.length > 2 ? top : null }),
      ...s.body,
    ], S.tight)),
  ].filter(Boolean)
}

// ======================================================================
// The step's body once a plan exists: title block, view switcher, the view.
export function F10Screen($, k, b, o, decide) {
  const { E } = k
  const list = peopleOn(k, b)
  const view = k.view('sales', 'list') === 'toolkit' ? 'toolkit' : 'list'
  const head = (k.head || []).filter(Boolean)
  const sw = U.ViewSwitch(E, 'f10-view', [{ id: 'list', label: `Your list · ${list.length}` }, { id: 'toolkit', label: 'Toolkit' }], view, (id) => k.setView('sales', id))
  if (view === 'toolkit') return [...head, sw, ...Toolkit(k, b)]
  if (decide) return [...head, sw, DecideCard(k, b, o)]
  return [...head, sw, ...ListView(k, b, o)]
}

// ---- One person's page (7.9, 9.4)
export function PersonScreen($, k, b, o, slot) {
  const { E, ui } = k
  const f = k.fn
  const out = b.output || {}
  const list = peopleOn(k, b)
  const ix = list.findIndex((x) => String(x.slot) === String(slot))
  const backBtn = U.Line(E, 'f10-back-row', [U.BackLink(E, 'f10-back', 'Back to your list', () => toList(k))])
  if (ix < 0) return [backBtn, U.Meta(E, 'f10-p-gone', "This person isn't on your list any more.")]
  const x = list[ix]
  const { p, key, t } = x
  const d = (fl) => ui.drafts?.[`f10.${slot}.${fl}`] ?? t[fl] ?? ''
  const finding = f.stillToFind(p, t)
  const at = f.stopOf(t)
  const name = f.personName(p, t)
  const prev = list[ix - 1]
  const nxt = list[ix + 1]
  const gv = f.guideViews(out)
  const guideHere = Boolean(ui.guideOpen) && ui.guideAt === `person-${slot}`
  const minBatch = Math.min(...list.map((y) => Number(y.p.batch) || 1))
  const nb = Number(p.batch) || 1
  const when = list.some((y) => y.p.batch != null) ? `Batch ${nb}${nb === minBatch ? ', now' : ''}` : ''
  // Their first name, for the buttons and lines that speak about them ("this person" for a label).
  const named = String(p.name || t.found || '').trim()
  const first = named ? named.split(/\s+/)[0] : ''
  const who = first || 'this person'

  // Name and who they are
  const head = (
    <E.Box key="f10-p-head" flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="flex-start" gap={1}>
      <E.Box key="f10-p-head-m" flexDirection="column" gap={S.none} flexGrow={1} flexShrink={1} minWidth={0}>
        {U.H2(E, 'f10-p-title', name)}
        {U.Meta(E, 'f10-p-meta', metaOf(k, x))}
      </E.Box>
      {at === 3 ? U.Chip(E, 'f10-p-chip', 'Talked ✓', 'done') : null}
    </E.Box>
  )
  const factsBox = U.Facts(E, 'f10-p-facts', finding
    ? [['Who', p.who], ['How to find one', p.findBy || p.reach], ['When', when]]
    : [['Who', p.who], [p.role === 'connector' ? 'Who they could introduce you to' : 'Why them', p.why], ['How to reach them', p.reach], ['When', when]], k.wide)
  const facts = factsBox ? U.Col(E, 'f10-p-about', [U.Cap(E, 'f10-p-about-l', `About ${who}`), factsBox], S.tight) : null

  // Where it stands: the stepper, its one button, and Other outcome
  const outcomeNow = f.OTHER_OUTCOMES.find(([, v]) => Object.entries(v).every(([k2, v2]) => t[k2] === v2))?.[0]
  // Its edge follows where they stand: butter not contacted, blue messaged or replied, green talked.
  const stepper = U.SpineCard(E, 'f10-p-where', at === 3 ? T.spineGreen : at >= 1 ? T.accent : T.spineButter, [
    U.Cap(E, 'f10-where-h', 'Where things stand'),
    <E.Text key={`f10-stepper-${slot}`} color={T.body} wrap="wrap">{f.STOPS.map((s, i) => `${i <= at ? '●' : '○'} ${s}`).join('  ─  ')}</E.Text>,
    U.Line(E, `f10-step-row-${slot}`, [
      at < 3 ? U.Btn(E, `f10-step-${slot}`, f.STOP_NEXT[at][0], () => k.act.saveContact(slot, f.STOP_NEXT[at][1], key)) : null,
      U.Btn(E, `f10-other-${slot}`, '+ Other outcome', () => k.act.setUi({ f10other: ui.f10other === slot ? null : slot }), 'dim'),
    ]),
    ui.f10other === slot ? Choice(k, `f10-exit-${slot}`, 'Other outcome', f.OTHER_OUTCOMES.map(([l]) => l), outcomeNow, (l) => k.act.saveContact(slot, f.OTHER_OUTCOMES.find(([y]) => y === l)[1], key)) : null,
  ])

  // The message: copy, edit, the version marked sent, earlier ones, the follow-up
  const dk = `f10.${slot}.msgedit`
  const sent = at >= 1
  const newer = f.msgIsNewer(t)
  const drafts = t.drafts || []
  const sentIx = newer ? drafts.findIndex((m) => m.sentAt) : -1
  const sentVersion = sentIx >= 0 ? drafts[sentIx] : null
  const earlier = drafts.map((m, i) => ({ m, i })).filter((y) => y.i !== sentIx)
  const fuOpen = k.flag(`f10-fu-${slot}`)
  let message = null
  if (t.draft && ui.f10edit === slot) {
    message = U.Col(E, `f10-msg-${slot}`, [
      U.Cap(E, `f10-msg-l-${slot}`, 'Edit your message', T.accent),
      <E.Input key={dk} value={String(ui.drafts?.[dk] ?? t.draft ?? '')} rows={6} onInput={(v) => k.act.setDraft(dk, v)} onSubmit={(v) => k.act.setDraft(dk, v)} />,
      U.Line(E, `f10-msg-a-${slot}`, [
        U.Btn(E, `f10-save-msg-${slot}`, 'Save changes', () => k.act.saveMessageEdit(slot, key)),
        U.Btn(E, `f10-cancel-msg-${slot}`, 'Cancel', async () => { await k.act.setUi({ f10edit: null }); await k.act.setDraft(dk, undefined) }, 'plain'),
      ]),
      sent && !newer ? U.Meta(E, `f10-msg-n-${slot}`, 'Your edit is saved as a new draft. The version marked sent stays here too.') : null,
    ], S.tight)
  } else if (t.draft) {
    message = U.CopyBox(E, `f10-msg-${slot}`, {
      label: f.msgLabel(t),
      text: t.draft,
      note: 'Uncapped never sends anything.',
      actions: [
        U.Btn(E, `f10-copy-msg-${slot}`, ui.copiedMsg === slot ? 'Copied' : 'Copy message', async () => { await k.act.copyText(t.draft, COPIED); await k.act.setUi({ copiedMsg: slot }) }),
        U.Btn(E, `f10-edit-msg-${slot}`, 'Edit message', async () => { await k.act.setDraft(dk, t.draft); await k.act.setUi({ f10edit: slot }) }, 'plain'),
      ],
    })
  } else if (p.message) {
    message = U.CopyBox(E, `f10-adapt-${slot}`, {
      label: 'A message to adapt',
      text: p.message,
      actions: [U.Btn(E, `f10-write-${slot}`, 'Write it with Claude in the chat', () => k.act.planInChat('sales', false, '', 'messages'))],
    })
  } else if (!finding) {
    message = U.Col(E, `f10-nomsg-${slot}`, [
      U.Cap(E, `f10-nomsg-l-${slot}`, 'Your first message', T.accent),
      U.Meta(E, `f10-nomsg-t-${slot}`, 'Not written yet.'),
      U.Line(E, `f10-nomsg-a-${slot}`, [U.Btn(E, `f10-write-${slot}`, 'Write it with Claude in the chat', () => k.act.planInChat('sales', false, '', 'messages'))]),
    ], S.tight)
  }
  const messageExtras = [
    sentVersion && ui.f10edit !== slot ? U.CopyBox(E, `f10-sentv-${slot}`, {
      label: 'The version marked sent',
      text: sentVersion.text,
      actions: [U.Btn(E, `f10-copy-sent-${slot}`, 'Copy this version', () => k.act.copyText(sentVersion.text, COPIED), 'plain')],
      note: [`Sent ${f.dayText(sentVersion.sentAt)}`, sentVersion.at ? `written ${f.dayText(sentVersion.at)}` : ''].filter(Boolean).join(' · '),
    }) : null,
    earlier.length ? U.Col(E, `f10-earlier-${slot}`, [
      U.Cap(E, `f10-earlier-l-${slot}`, `Earlier messages · ${earlier.length}`),
      ...earlier.map(({ m, i }) => U.Col(E, `f10-earlier-${slot}-${i}`, [
        U.Meta(E, `f10-earlier-d-${slot}-${i}`, [m.sentAt ? `Sent ${f.dayText(m.sentAt)}` : 'Not sent', m.at ? `written ${f.dayText(m.at)}` : ''].filter(Boolean).join(' · ')),
        Paper(k, `f10-earlier-m-${slot}-${i}`, m.text),
        U.Line(E, `f10-earlier-a-${slot}-${i}`, [U.Btn(E, `f10-earlier-copy-${slot}-${i}`, 'Copy message', () => k.act.copyText(m.text, COPIED), 'plain')]),
      ], S.tight)),
    ], S.tight) : null,
    p.followUp ? U.Col(E, `f10-fu-sec-${slot}`, [
      U.Line(E, `f10-fu-row-${slot}`, [U.Btn(E, `f10-fu-${slot}`, fuOpen ? 'Hide the follow-up' : `If ${first || 'they'} ${first ? "doesn't" : "don't"} reply: a follow-up`, () => k.toggle(`f10-fu-${slot}`), 'plain')]),
      U.Meta(E, `f10-fu-l-${slot}`, "A shorter note to send if there's no reply after a week."),
      fuOpen ? U.CopyBox(E, `f10-fu-msg-${slot}`, { text: p.followUp, onCopy: () => k.act.copyText(p.followUp, COPIED) }) : null,
    ], S.tight) : null,
  ].filter(Boolean)

  // Found someone? (a person still to find, or one found since)
  const found = finding || p.kind === 'prospect to find' ? U.Col(E, `f10-found-${slot}`, [
    U.Cap(E, `f10-found-l-${slot}`, 'Found someone? Their name or initials'),
    <E.Input key={`f10.${slot}.found`} placeholder="Once you know who it is, they stop being someone to find" value={String(d('found'))} rows={1} onInput={(v) => k.act.setDraft(`f10.${slot}.found`, v)} onSubmit={(v) => k.act.setDraft(`f10.${slot}.found`, v)} />,
    U.Line(E, `f10-found-a-${slot}`, [U.Btn(E, `f10-save-${slot}`, 'Save', () => k.act.saveContact(slot, null, key))]),
  ], S.tight) : null

  // What to ask, opened here on their page
  const ask = gv.client || gv.knows ? [
    U.Line(E, `f10-p-guide-row-${slot}`, [U.Btn(E, `f10-p-guide-${slot}`, guideHere ? 'Hide what to ask' : `See what to ask ${who} on the call`, () => (guideHere ? k.act.setUi({ guideOpen: false }) : k.act.seeGuide(p.role === 'connector' && gv.knows ? 'knows' : 'client', `person-${slot}`)))]),
    guideHere ? U.Panel(E, 'f10-guide', 'washButter', [U.Cap(E, 'f10-guide-l', 'Your research call guide'), ...GuideBody(k, b, out, { pre: 'pg', moreOpen: true, qTone: 'surface' })]) : null,
  ] : []

  // After the call: bring it to the chat, where Claude helps work out how to turn them into a client.
  const callCard = U.SpineCard(E, `f10-p-call-${slot}`, T.spineButter, [
    U.Strong(E, `f10-p-call-t-${slot}`, `Had the call with ${who}?`),
    U.Body(E, `f10-p-call-b-${slot}`, `Bring your notes or the transcript from your note taker to the chat. Tell me what you learned, and we'll work out together how to turn ${first || 'them'} into a client.`),
    U.Line(E, `f10-p-call-a-${slot}`, [U.Btn(E, `f10-p-report-${slot}`, 'Report back in the chat', () => k.act.reportOutreach())]),
    U.Meta(E, `f10-p-call-n-${slot}`, 'You can paste or attach the transcript in the chat.'),
  ], 'washButter')
  // What you learned, and their strongest response so far, together on a green wash.
  const notes = U.SpineCard(E, `f10-notes-${slot}`, T.spineGreen, [
    U.Col(E, `f10-notes-c-${slot}`, [
      U.Cap(E, 'f10-learn-h', 'What you learned'),
      <E.Input key={`f10.${slot}.learned`} placeholder="What did they say? Who did they mention?" value={String(d('learned'))} rows={3} onInput={(v) => k.act.setDraft(`f10.${slot}.learned`, v)} onSubmit={(v) => k.act.setDraft(`f10.${slot}.learned`, v)} />,
      U.Line(E, `f10-notes-a-${slot}`, [U.Btn(E, `f10-save-notes-${slot}`, 'Save notes', () => k.act.saveContact(slot, null, key))]),
    ], S.tight),
    Choice(k, `f10-sg-${slot}`, 'Their strongest response so far', SIGNALS, t.signal || 'none yet', (v) => k.act.saveContact(slot, { signal: v }, key), f.sentenceCase, "Pick the strongest thing they've done so far."),
  ], 'washGreen')

  const pn = (
    <E.Box key="f10-pn" flexDirection="row" flexWrap="wrap" gap={2} justifyContent="space-between">
      {prev ? U.Btn(E, 'f10-prev', '← Previous person', () => toPerson(k, prev.slot), 'dim') : <E.Text key="f10-prev-none"> </E.Text>}
      {nxt ? U.Btn(E, 'f10-next', 'Next person →', () => toPerson(k, nxt.slot), 'plain') : null}
    </E.Box>
  )
  const msgBlock = message || messageExtras.length ? U.Col(E, `f10-msgs-${slot}`, [message, ...messageExtras], S.tight) : null
  // Who they are first, then where it stands, the message and what to ask; after the call, what you learned.
  return (finding
    ? [backBtn, head, facts, found, msgBlock, stepper, ...ask, callCard, notes, pn]
    : [backBtn, head, facts, found, stepper, msgBlock, ...ask, callCard, notes, pn]
  ).filter(Boolean)
}

// ---- Everyone they're talking to, across their offers (two or more spaces)
export function PeopleScreen($, k) {
  const { E, work } = k
  const f = k.fn
  const rows = f.peopleOf(work)
  const spaces = spacesOf(work)
  const later = f.toFindCount(work)
  const seen = new Set()
  const row = (r, i, gid) => {
    // Open opens the record that's furthest along (the message they sent, say).
    const first = r.on.slice().sort((a, z) => (f.stopOf(z.t) - f.stopOf(a.t)) || (Number(Boolean(z.t.draft)) - Number(Boolean(a.t.draft))))[0]
    // Name the offer when it isn't obvious: they're on two lists, or their space holds more than one offer.
    const showOffer = r.on.length > 1 || offersIn(work, first.o.spaceId).length > 1 || (spaces.length < 2 && f.chosenOffers(work).length > 1)
    const st = statusOf(k, first.t)
    const meta = showOffer ? r.on.map((x) => (r.on.length > 1 ? `${f.shortName(x.o.name, 28)}: ${statusOf(k, x.t).text.toLowerCase()}` : f.shortName(x.o.name, 28))).join(' · ') : ''
    const okey = seen.has(i) ? `pp-open-${i}-${gid}` : `pp-open-${i}`
    seen.add(i)
    return {
      key: `pp-${gid}-${i}`,
      name: r.name,
      meta,
      status: st,
      actions: [U.Btn(E, okey, 'Open', () => k.act.openPerson(first.o.id, first.slot), 'plain')],
    }
  }
  const groups = spaces.length > 1
    ? spaces.map((sp) => ({ id: sp.id, label: sp.name, rows: rows.map((r, i) => [r, i]).filter(([r]) => r.on.some((x) => x.o.spaceId === sp.id)) })).filter((g) => g.rows.length)
    : rows.length ? [{ id: 'all', label: '', rows: rows.map((r, i) => [r, i]) }] : []
  return [
    U.TitleBlock(E, 'pp-head', {
      eyebrow: "Everyone you're talking to",
      title: k.title("Everyone you're talking to"),
      promise: rows.length ? `${rows.length} ${rows.length === 1 ? 'person' : 'people'} across your offers. Open anyone to see their messages, where things stand and your notes.` : 'Nobody yet. Your First 10 Customers plans add people here.',
    }),
    ...groups.map((g) => U.RowList(E, `pp-list-${g.id}`, {
      label: g.label ? `${g.label} · ${g.rows.length}` : '',
      rows: g.rows.map(([r, i]) => row(r, i, g.id)),
      limit: 5,
      expanded: k.flag(`pp-all-${g.id}`),
      onToggle: () => k.toggle(`pp-all-${g.id}`),
    })),
    later ? U.Meta(E, 'pp-later', `${later} more ${later === 1 ? 'place' : 'places'} on your lists ${later === 1 ? 'is a person' : 'are people'} still to find.`) : null,
  ].filter(Boolean)
}

// ---- First 10's Next move, for Home: the same card the list view shows.
export function first10Next($, k, b, o) {
  if (!b?.output || !o) return null
  // A plan built for another offer: Home keeps its own move, and First 10 asks.
  if (b.basedOn?.offerId && b.basedOn.offerId !== o.id && b.keptFor !== o.id) return null
  return NextMove(k, b, o, true)
}
