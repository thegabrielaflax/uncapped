// Feedback and help: builds a short, reviewable report for Gabriela from
// what the product actually knows. Pure functions; the panel and the chat
// tools call them. Delivery is an email draft in the customer's own email
// app (a mailto link opened on their Mac), so nothing depends on Pivot
// School's accounts and no credentials ship in the package. A draft is
// never described as sent: the customer presses Send in their email app.

export const FEEDBACK_TO = 'gabriela@gabrielaflaxcoaching.com'

export const KINDS = {
  broken: { label: "Something isn't working", tag: 'issue' },
  confused: { label: "I'm confused", tag: 'confusing' },
  idea: { label: 'I have an idea', tag: 'idea' },
}

// Never send personal data or machine details by accident.
export function redact(text) {
  return String(text ?? '')
    .replace(/\/Users\/[^\s/'"]+/g, '/Users/…')
    .replace(/\/home\/[^\s/'"]+/g, '/home/…')
    .replace(/[A-Za-z]:\\Users\\[^\s\\'"]+/g, 'C:\\Users\\…')
    .replace(/\b(sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9]{8,}|xox[bap]-[A-Za-z0-9-]{8,})\b/g, '[removed]')
    .slice(0, 2000)
}

// The screen, step and question the person was on, in plain words.
export function whereText(nav, labels) {
  if (!nav) return 'Unknown screen'
  const v = nav.view
  if (v === 'discover') {
    if (['garden', 'offer', 'done', 'idea', 'direction'].includes(nav.stage)) return `Your offer, ${{ garden: 'Portfolio Garden', offer: 'Portfolio Garden', done: 'Portfolio Garden', idea: 'one idea', direction: 'one skill' }[nav.stage]}`
    const stage = { overview: 'what you\'ve told me', theme: 'one answer', question: 'answering a question', followups: 'follow-up questions' }[nav.stage || 'overview'] || nav.stage
    return `Discover, ${stage}${nav.theme ? `: ${labels.theme?.[nav.theme] || nav.theme}` : ''}`
  }
  if (v === 'builder') return `${labels.builder?.[nav.builder] || nav.builder}${nav.stage ? `, ${nav.stage === 'result' ? 'results' : nav.stage === 'questions' ? `question ${(nav.step || 0) + 1}` : nav.stage}` : ''}`
  if (v === 'experiment') return 'Your test'
  if (v === 'report') return 'Report what happened'
  if (v === 'plan') return 'Your test, planning'
  return { home: 'Home', profile: 'Saved info', settings: 'Updates and help', map: 'Your map', done: 'Ready to test or Your portfolio', space: 'Your space', people: "Everyone you're talking to", tour: `How it works, step ${nav.step || 1}`, welcome: 'Welcome', setup: 'Folder setup', feedback: 'Feedback' }[v] || v || 'Home'
}

// A guess at what they were trying to do, from the screen alone. Labeled
// as a guess everywhere it appears, for the person to confirm or change.
export function guessGoal(nav, labels) {
  if (!nav) return ''
  if (nav.view === 'discover' && nav.theme) return `Answering the Discover question about ${(labels.theme?.[nav.theme] || nav.theme).toLowerCase()}`
  if (nav.view === 'discover' && nav.stage === 'garden') return 'Looking at my portfolio garden'
  if (nav.view === 'builder') return `Working on ${labels.builder?.[nav.builder] || nav.builder}`
  if (nav.view === 'settings') return 'Updating Uncapped'
  if (nav.view === 'report') return 'Reporting what happened in a test'
  if (nav.view === 'experiment') return 'Running a test'
  return ''
}

export function subjectFor(fb) {
  const tag = KINDS[fb.kind]?.tag || 'feedback'
  const where = String(fb.where || 'Uncapped').split(',')[0]
  const what = String(fb.goal || fb.actual || fb.details || '').replace(/\s+/g, ' ').trim().slice(0, 60)
  return `[Uncapped ${tag}] ${where}${what ? ` — ${what}` : ''}`
}

// The full report, exactly as the person reviews it and as it's emailed.
export function reportText(fb) {
  const ctx = fb.context || {}
  const L = []
  L.push(`Type: ${KINDS[fb.kind]?.label || 'Feedback'}`)
  L.push(`Where: ${fb.where || 'unknown'}`)
  L.push(`Trying to: ${fb.goal || '(not said)'}${fb.goalGuessed && !fb.goalConfirmed ? ' (Uncapped\'s guess from the screen, not confirmed)' : ''}`)
  L.push(`Expected: ${fb.expected || '(not said)'}`)
  L.push(`Happened instead: ${fb.actual || '(not said)'}`)
  if (fb.details) L.push(`More detail: ${fb.details}`)
  if (fb.excerpt) L.push(`Excerpt the person chose to include: ${fb.excerpt}`)
  L.push('')
  L.push('Context (observed by Uncapped):')
  if (ctx.error && !fb.removed?.error) L.push(`- Message on screen: ${redact(ctx.error)}`)
  if (ctx.lastAction && !fb.removed?.lastAction) L.push(`- Last action: ${ctx.lastAction}`)
  if (ctx.trail?.length && !fb.removed?.trail) L.push(`- Recent steps (screens and buttons, no answers): ${ctx.trail.join(' → ')}`)
  if (!fb.removed?.version) L.push(`- Uncapped ${ctx.version || '?'}, Claude Code ${ctx.claudeCode || '?'}, ${ctx.surface || 'desktop'} app`)
  if (!fb.removed?.time) L.push(`- Time: ${ctx.time || ''}`)
  L.push('')
  L.push(fb.replyTo ? `Reply to: ${fb.replyTo}` : 'No reply address given.')
  L.push(fb.screenshot ? 'Screenshot: the person will attach it in their email app.' : 'No screenshot.')
  return L.join('\n')
}

// A mailto link. Email apps cap how long these can be, so a long report is
// cut with a note; the full report is saved in my-work/support either way.
export function mailtoUrl(fb, savedAs) {
  let body = reportText(fb)
  const room = 1800
  if (body.length > room) body = body.slice(0, room) + `\n\n[Cut to fit. The full report is saved in ${savedAs || 'my-work/support'}.]`
  const enc = (s) => encodeURIComponent(s).replace(/%20/g, '%20')
  return `mailto:${FEEDBACK_TO}?subject=${enc(subjectFor(fb))}&body=${enc(body)}`
}

export function looksLikeEmail(s) {
  return !s || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim())
}
