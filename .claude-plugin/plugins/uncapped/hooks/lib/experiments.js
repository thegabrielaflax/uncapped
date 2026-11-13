// Experiments: turning a direction or offer into a test with real buyers,
// organizing what comes back, and reading it without overstating it.
// Pure: prompts, shapes and helpers. The panel and the chat tools both use
// these, and save into work.experiments.

import { activeOffer, priceText, now } from './model.js'
import { profileText, offerText } from './builders.js'

export const UNCERTAINTIES = {
  problem: 'Whether buyers really have this problem',
  buyer: 'Who exactly the buyer is',
  pay: "Whether they'd pay, and how buying happens",
  price: 'What price works',
  framing: 'How to describe it so it lands',
  delivery: "Whether I'd enjoy it or can deliver it well",
  credibility: "Whether buyers would hire someone like me for it",
}

export const DECISIONS = {
  continue: 'Keep testing',
  revise_buyer: 'Change who it is for',
  revise_problem: 'Change the problem it solves',
  change_offer: 'Change the package or price',
  pilot: 'Offer a small paid pilot',
  pause: 'Pause it for now (low flame)',
}

export const LEVELS = { none: 'No evidence yet', early: 'Early signs', some: 'Some evidence', strong: 'Strong evidence' }

export const EVIDENCE = {
  problem: 'The problem exists',
  pay: 'Someone will pay',
  deliver: 'You can deliver it profitably',
  repeat: 'Sales can repeat',
}

export function experimentSource(work, ref) {
  if (ref?.offerId) return work.offers.find((o) => o.id === ref.offerId) || null
  if (ref?.directionId) return (work.discover?.early?.directions || []).find((d) => d.id === ref.directionId) || null
  return activeOffer(work)
}

function sourceText(work, src, cur) {
  if (!src) return '(no offer or direction chosen)'
  if (src.title) return [`Direction: ${src.title}`, `Buyer: ${src.buyer}`, `Problem: ${src.problem}`, `Why now: ${src.whyNow}`, `What they hold at the end: ${src.handover}`, `Price idea: ${priceText(src, cur)}`, `Why them: ${src.whyYou}`, `Assumptions: ${JSON.stringify(src.assumptions || [])}`].join('\n')
  return offerText(src, cur)
}

export const PLAN_SHAPE = `{
 "title": "short name for the test",
 "buyer": "the specific buyer and their situation",
 "problem": "the problem being investigated, in buyer terms",
 "believe": "what the person currently believes",
 "why": "why they believe it: what's demonstrated vs their own thought",
 "assumptions": [{"text": "", "source": "a buyer said it | their own thought | Claude's suggestion"}],
 "uncertainty": "problem | buyer | pay | price | framing | delivery | credibility",
 "uncertaintyText": "the one thing this test is for, in a sentence",
 "kind": "problem conversations | buyer comparison | price test | paid pilot | beta | language test | content test | desk research",
 "whyThisTest": "why this test fits the uncertainty, their hours, energy and who they can reach",
 "steps": ["do this", "then this"],
 "who": "who to contact first and how many",
 "outreach": [{"to": "kind of person", "message": "a short first message in their voice, no pitch"}],
 "guide": {"warmups": [""], "problem": [""], "money": [""], "closers": [""]},
 "avoid": ["questions or moves to avoid and why"],
 "capture": ["what to write down after each conversation"],
 "signals": {"support": [""], "weaken": [""], "change": [""]},
 "reviewInDays": 14,
 "assets": [{"builder": "content | linkedin | website | offer | sales", "what": "", "purpose": "what it helps them learn"}],
 "bringBack": "exactly how to bring the findings back into Uncapped"
}`

export function planPrompt(work, src, focus, methods) {
  const cur = work.profile?.limits?.currency || '$'
  return {
    system: methods._voice,
    prompt: [
      methods.testing,
      '',
      'ABOUT THEM',
      profileText(work),
      '',
      'WHAT THEY WANT TO TEST',
      sourceText(work, src, cur),
      focus ? `\nWhat they say they're most unsure about: ${focus}` : '',
      '',
      "Plan one experiment. Pick the most important uncertainty (or use theirs), choose the test that fits it and their week, energy and who they can reach, and write everything they need to run it: who to contact, outreach messages, a conversation guide built only from past-behaviour and money questions that never mention the idea, what to avoid, what to capture, what would support, weaken or change the hypothesis, a review date, any small asset that would help them learn (never a full brand or website), and how to bring findings back: they can tell Uncapped in the chat in their own words (\"I've had three calls...\"), or press \"Report what happened\" on the test in the Sales Builder or on the home screen. Never invent results, testimonials or demand.",
      'Return exactly this JSON shape:',
      PLAN_SHAPE,
    ].join('\n'),
  }
}

export const ORGANISE_SHAPE = `{
 "summary": "one or two sentences: what happened",
 "withWhom": "who they spoke to or contacted (roles, no extra detail)",
 "counts": {"contacted": 0, "replied": 0, "conversations": 0, "paid": 0},
 "observations": [{"text": "what happened or what the buyer did", "kind": "behavior | spend | buying-process | reaction | silence"}],
 "quotes": ["the buyer's exact words, only if the notes contain them"],
 "interpretations": ["what the person thinks it means, labeled as their interpretation"],
 "unknowns": ["what is still unknown"],
 "missing": [{"q": "a short question about a detail that would change the reading", "why": ""}]
}`

export function organisePrompt(work, exp, notes, who, methods) {
  return {
    system: methods._voice,
    prompt: [
      methods.testing,
      '',
      'THE TEST',
      JSON.stringify({ title: exp.title, buyer: exp.buyer, problem: exp.problem, uncertainty: exp.uncertaintyText, kind: exp.kind }),
      '',
      "THEIR ROUGH NOTES (pasted replies, summaries, anything)",
      notes,
      who ? `With: ${who}` : '',
      '',
      'Organize these notes without adding anything. Keep observations (what people did, said, spent, how they buy) apart from the person\'s interpretation. Compliments and "I\'d probably buy that" are reactions, not evidence. Silence is an observation, not a verdict. Quote buyer words only if they are in the notes. Counts only from what the notes say (leave 0 if not stated). Ask at most two questions, only about details that would change how this is read.',
      'Return exactly this JSON shape:',
      ORGANISE_SHAPE,
    ].join('\n'),
  }
}

export const READING_SHAPE = `{
 "learned": "what you take from it, to them as 'you', in two or three short sentences, one idea each, without overstating it",
 "supports": "what their answers back up so far, in one or two short sentences, or empty",
 "signals": [{"who": "a role, or the name only if the notes give it", "what": "what they said or did, from the notes", "kind": "compliment | past behavior | commitment | advancement"}],
 "questionFix": [{"asked": "a question from their notes or guide that may have steered the answer", "issue": "leading wording | an assumption built in | a hypothetical | a pitch mixed in", "better": "a neutral version for the next call, about a specific past experience: what they did, tried or spent"}],
 "adjust": {"area": "who you contact | your message | your questions | your offer | your Substack angle | none", "what": "the one change before the next message or call, as an action in one or two short sentences", "why": "why, in one or two short sentences"},
 "evidence": {"problem": {"level": "none | early | some | strong", "why": ""}, "pay": {"level": "", "why": ""}, "deliver": {"level": "", "why": ""}, "repeat": {"level": "", "why": ""}},
 "limits": "what this can't tell them yet, in two or three short sentences",
 "bucket": "holds | wrong buyer | wrong offer | wrong framing | too early to tell",
 "options": [{"choice": "continue | revise_buyer | revise_problem | change_offer | pilot | pause", "why": ""}],
 "recommended": {"choice": "", "why": ""},
 "proposedChange": {"field": "buyer | problem | name | handover | priceLow | priceHigh | priceUnit | none", "to": "", "why": ""},
 "next": {"label": "a short action, e.g. Plan the next test, Draft a post, Review website copy", "builder": "sales | content | linkedin | website | offer", "why": "why it matters now"},
 "contentIdea": "a post idea that explores what they learned, in their voice, or empty"
}`

export function readingPrompt(work, exp, methods) {
  const cur = work.profile?.limits?.currency || '$'
  const o = experimentSource(work, exp.source)
  return {
    system: methods._voice,
    prompt: [
      methods.testing,
      '',
      'THE OFFER OR DIRECTION BEING TESTED',
      sourceText(work, o, cur),
      '',
      'THE TEST',
      JSON.stringify({ title: exp.title, buyer: exp.buyer, problem: exp.problem, believe: exp.believe, uncertainty: exp.uncertaintyText, kind: exp.kind, signals: exp.signals, questions: exp.guide, messages: (exp.outreach || []).map((m) => m.message) }),
      '',
      'EVERYTHING THEY HAVE BROUGHT BACK, OLDEST FIRST',
      JSON.stringify((exp.findings || []).map((f) => ({ at: f.at, summary: f.summary, counts: f.counts, observations: f.observations, quotes: f.quotes, interpretations: f.interpretations, unknowns: f.unknowns }))),
      '',
      'EARLIER DECISIONS',
      JSON.stringify(exp.decisions || []),
      '',
      'Read the evidence honestly. Keep the four evidence levels apart and say what each rests on. Two conversations conclude nothing; silence is ambiguous (targeting, message, timing or offer). Never call anything "validated". Give the options that fit, recommend one with the reason, and propose a change to the offer only if the evidence points to one (otherwise field "none"). This is a tentative reading: nothing changes until the person decides. Suggest the single most useful next action, specific to their work. Write every field in plain words they would say out loud, to them as "you", one idea per sentence: say who did what, and keep what they told you apart from what you take from it.',
      'Sort what buyers said or did: a compliment (not evidence), a report of past behavior, a commitment that costs them time, reputation or money, or advancement (they book the next step, bring a colleague, ask to be first). Say what the responses support and what is still unclear (limits). If a question they asked, or one in their guide, could have steered the answer (leading wording, an assumption built in, a hypothetical such as "would you pay for", or a pitch mixed into a learning conversation), give a better version for the next call that asks about a specific past experience and follows what the buyer did, tried or spent; otherwise leave questionFix empty. Recommend one adjustment before their next message or call (who they contact, their message, a question, the offer or their Substack angle), in their terms, or "none" if the next round should run as planned. Silence after a message is about targeting, wording, timing or the offer: say which you would change first and why.',
      'Return exactly this JSON shape:',
      READING_SHAPE,
    ].join('\n'),
  }
}

export function experimentFrom(plan, src, ref) {
  const t = now()
  return {
    id: `x${Date.now().toString(36)}`,
    createdAt: t,
    status: 'planned',
    source: ref || (src?.id ? { offerId: src.id } : null),
    sourceName: src?.name || src?.title || '',
    ...plan,
    reviewOn: new Date(Date.now() + (Number(plan.reviewInDays) || 14) * 86400000).toISOString().slice(0, 10),
    findings: [],
    readings: [],
    decisions: [],
    research: [],
  }
}

export function experimentLine(x) {
  return `${x.title} (${x.status}${x.findings?.length ? `, ${x.findings.length} report${x.findings.length === 1 ? '' : 's'}` : ''}${x.reviewOn ? `, review on ${x.reviewOn}` : ''})`
}

export function findExperiment(work, ref) {
  const list = work.experiments || []
  if (!list.length) return { none: true }
  if (ref) {
    const r = String(ref).toLowerCase()
    const hit = list.filter((x) => x.id === ref || String(x.title).toLowerCase().includes(r) || String(x.sourceName).toLowerCase().includes(r))
    if (hit.length === 1) return { exp: hit[0] }
    if (hit.length > 1) return { ambiguous: hit }
  }
  const open = list.filter((x) => !['decided', 'paused'].includes(x.status))
  if (open.length === 1) return { exp: open[0] }
  if (!open.length && list.length === 1) return { exp: list[0] }
  return { ambiguous: open.length ? open : list }
}
