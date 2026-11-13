// The money in a direction or offer, worked out one way everywhere.
//
// Claude estimates the inputs (price band, how many buyers per event, how
// many events a month, costs, hours) and says whether the price is a
// hypothesis or researched. The arithmetic is done here, so the summaries and
// the detailed tables can never disagree. Anything Claude didn't estimate is
// shown as unknown, and the figures that depend on it aren't worked out.
// The person's income goal is used only to say whether a direction fits it,
// never to set what customers pay.

export const MODELS = {
  seats: { name: 'Group sessions or events', unit: 'seat', run: 'event', runs: 'events' },
  talk: { name: 'Talks or workshops booked by organizations', unit: 'booking', run: 'booking', runs: 'bookings' },
  project: { name: 'Projects', unit: 'project', run: 'project', runs: 'projects' },
  session: { name: 'One-to-one sessions', unit: 'session', run: 'session', runs: 'sessions' },
  retainer: { name: 'Monthly retainers', unit: 'client a month', run: 'client', runs: 'clients' },
  subscription: { name: 'Subscriptions', unit: 'subscriber a month', run: 'subscriber', runs: 'subscribers' },
  product: { name: 'Products', unit: 'item', run: 'item', runs: 'items' },
}

// Directions saved before 0.2.1 have a price, a unit and "hours per unit"
// only. Their unit says which model they are; everything else is unknown.
export function modelFromUnit(unit) {
  const u = String(unit || '').toLowerCase()
  if (/seat|ticket|attendee|place/.test(u)) return 'seats'
  if (/subscri|per reader|member a month|per member/.test(u)) return 'subscription'
  if (/item|product|unit sold|per box|per kit/.test(u)) return 'product'
  if (/talk|booking|workshop for|keynote/.test(u)) return 'talk'
  if (/session|hour/.test(u)) return 'session'
  if (/month|retainer/.test(u)) return 'retainer'
  if (/project|sprint|package|engagement/.test(u)) return 'project'
  return null
}

const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v))

export function moneyInputs(d) {
  const m = d?.money || {}
  const model = MODELS[m.model] ? m.model : modelFromUnit(m.priceUnit || d?.priceUnit)
  const legacy = !d?.money
  const perRun = m.hoursPerRun || {}
  const perMonth = m.hoursPerMonth || {}
  return {
    model,
    legacy,
    priceLow: num(m.priceLow ?? d?.priceLow),
    priceHigh: num(m.priceHigh ?? d?.priceHigh) ?? num(m.priceLow ?? d?.priceLow),
    priceUnit: m.priceUnit || d?.priceUnit || '',
    basis: m.basis === 'researched' && (m.sources || []).length ? 'researched' : 'hypothesis',
    why: m.why || d?.priceWhy || '',
    sources: m.sources || [],
    buyersPerRun: num(m.buyersPerRun),
    runsPerMonth: num(m.runsPerMonth),
    costPerRun: num(m.costPerRun),
    costNote: m.costNote || '',
    fixedCostsPerMonth: num(m.fixedCostsPerMonth),
    // Saved-before-0.2.1 directions give one "hours per unit" figure: the
    // whole time for one event or project, preparation included.
    hoursPrep: num(perRun.prep),
    hoursDelivery: num(perRun.delivery) ?? (legacy ? num(d?.hoursPerUnit) : null),
    hoursSales: num(perMonth.sales),
    hoursAdmin: num(perMonth.admin),
    hoursMaking: num(perMonth.making),
  }
}

function range(lo, hi) {
  return { lo, hi: hi == null ? lo : hi }
}

// Everything worked out from the inputs, with what's missing named.
export function moneyFor(d, profile) {
  const x = moneyInputs(d)
  const M = MODELS[x.model] || null
  const missing = []
  const need = (v, label) => {
    if (v == null) missing.push(label)
    return v
  }
  if (!M) missing.push('what kind of income this is')
  need(x.priceLow, 'a price to test')
  const isSeats = x.model === 'seats'
  const isSub = x.model === 'subscription'
  const isProduct = x.model === 'product'
  const buyers = isSeats ? need(x.buyersPerRun, 'paying attendees per event') : 1
  const runs = need(x.runsPerMonth, isSub ? 'paying subscribers' : isProduct ? 'items sold a month' : `${M ? M.runs : 'sales'} a month`)
  const costPerRun = need(x.costPerRun, isProduct ? 'the cost of making each item' : isSub ? 'costs per subscriber' : `costs per ${M ? M.run : 'sale'}`)
  const fixed = x.fixedCostsPerMonth ?? 0
  const perRunHours = isSub ? 0 : (x.hoursPrep ?? 0) + (x.hoursDelivery ?? 0)
  if (!isSub && x.hoursPrep == null && x.hoursDelivery == null) missing.push(`hours per ${M ? M.run : 'sale'}`)
  const sales = need(x.hoursSales, 'hours a month finding buyers')
  const admin = need(x.hoursAdmin, 'hours a month on admin')
  const monthHours = sales != null && admin != null ? sales + admin + (x.hoursMaking ?? 0) : null
  if (isSub && x.hoursMaking == null) missing.push('hours a month writing or making it')

  const perRunRevenue = x.priceLow != null && buyers != null ? range(x.priceLow * buyers, x.priceHigh * buyers) : null
  const revenue = perRunRevenue && runs != null ? range(perRunRevenue.lo * runs, perRunRevenue.hi * runs) : null
  const costs = costPerRun != null && runs != null ? costPerRun * runs + fixed : null
  const profit = revenue && costs != null ? range(revenue.lo - costs, revenue.hi - costs) : null
  const hours = runs != null && monthHours != null ? Math.round((perRunHours * runs + monthHours) * 10) / 10 : null
  const rate = profit && hours ? range(Math.round(profit.lo / hours), Math.round(profit.hi / hours)) : null

  const L = profile?.limits || {}
  const weekly = Number(L.hoursExact) || null
  const available = weekly ? Math.round(weekly * 4.33) : null
  const goal = Number(L.income) || null
  const fit = {
    available,
    goal,
    hoursFit: hours != null && available ? (hours <= available ? 'fits' : 'over') : null,
    goalFit: profit && goal ? (profit.lo >= goal ? 'meets' : profit.hi >= goal ? 'maybe' : 'below') : null,
  }
  return { ...x, M, buyers, runs, perRunRevenue, revenue, costs, profit, hours, rate, fit, missing: [...new Set(missing)], complete: missing.length === 0 }
}

export function fmtMoney(n, cur) {
  if (n == null) return 'unknown'
  const raw = Number(n)
  const small = Math.abs(raw) < 10 && raw !== Math.round(raw)
  const v = small ? Math.abs(raw).toFixed(2) : Math.abs(Math.round(raw)).toLocaleString('en-US')
  return `${raw < 0 ? '−' : ''}${cur || '$'}${v}`
}

const an = (w) => (/^[aeiou]/i.test(w) ? `an ${w}` : `a ${w}`)

export function fmtRange(r, cur) {
  if (!r) return 'unknown'
  return r.lo === r.hi ? fmtMoney(r.lo, cur) : `${fmtMoney(r.lo, cur)} to ${fmtMoney(r.hi, cur)}`
}

// One line for a card or summary.
export function moneyLine(d, profile) {
  const cur = profile?.limits?.currency || '$'
  const m = moneyFor(d, profile)
  const price = m.priceLow != null ? `${fmtRange(range(m.priceLow, m.priceHigh), cur)} ${m.M ? an(m.M.unit) : m.priceUnit}`.trim() : 'no price yet'
  const label = m.basis === 'researched' ? 'researched' : 'a hypothesis to test'
  if (!m.complete) return `Price to test: ${price} (${label}). The monthly money can't be worked out yet.`
  return `Price to test: ${price} (${label}). Estimated profit ${fmtRange(m.profit, cur)} a month for about ${m.hours} hours, around ${fmtRange(m.rate, cur)} an hour of your time.`
}

// The rows of the detailed table, each tagged with where it comes from.
export function moneyRows(d, profile) {
  const cur = profile?.limits?.currency || '$'
  const m = moneyFor(d, profile)
  const M = m.M
  const est = m.legacy ? 'from your garden' : 'estimate'
  const rows = []
  const add = (label, value, tag) => rows.push({ label, value, tag: value === 'unknown' ? 'unknown' : tag })
  add('Kind of income', M ? M.name : 'not worked out yet', M ? est : 'unknown')
  add(`Price per ${M ? M.unit : 'sale'}`, m.priceLow != null ? fmtRange(range(m.priceLow, m.priceHigh), cur) : 'unknown', m.basis === 'researched' ? 'researched' : 'hypothesis')
  if (m.model === 'seats') add('Paying attendees per event', m.buyersPerRun ?? 'unknown', est)
  add(m.model === 'subscription' ? 'Paying subscribers' : m.model === 'product' ? 'Items sold a month' : `${M ? M.runs[0].toUpperCase() + M.runs.slice(1) : 'Sales'} a month`, m.runs ?? 'unknown', est)
  if (m.model === 'seats' || m.model === 'talk' || m.model === 'project') add(`Revenue per ${M.run}`, m.perRunRevenue ? fmtRange(m.perRunRevenue, cur) : 'unknown', 'calculated')
  add('Revenue a month', m.revenue ? fmtRange(m.revenue, cur) : 'unknown', 'calculated')
  add(`Costs per ${M ? M.run : 'sale'}${m.costNote ? ` (${m.costNote})` : ''}`, m.costPerRun != null ? fmtMoney(m.costPerRun, cur) : 'unknown', est)
  if (m.fixedCostsPerMonth) add('Fixed costs a month', fmtMoney(m.fixedCostsPerMonth, cur), est)
  add('Costs a month', m.costs != null ? fmtMoney(m.costs, cur) : 'unknown', 'calculated')
  add('Profit a month', m.profit ? fmtRange(m.profit, cur) : 'unknown', 'calculated')
  if (m.model !== 'subscription') add(`Hours per ${M ? M.run : 'sale'} (preparing and delivering)`, m.hoursPrep == null && m.hoursDelivery == null ? 'unknown' : `${(m.hoursPrep ?? 0) + (m.hoursDelivery ?? 0)}`, est)
  if (m.model === 'subscription') add('Hours a month writing or making it', m.hoursMaking ?? 'unknown', est)
  add('Hours a month finding buyers', m.hoursSales ?? 'unknown', est)
  add('Hours a month on admin', m.hoursAdmin ?? 'unknown', est)
  add('Working hours a month, in all', m.hours ?? 'unknown', 'calculated')
  add('Profit per working hour', m.rate ? fmtRange(m.rate, cur) : 'unknown', 'calculated')
  return { rows, m }
}

// How it sits against the person's own numbers. Never used to set a price.
// It says plainly what the time leaves room for, rather than assuming the
// idea can sit beside others.
export function fitLines(d, profile) {
  const cur = profile?.limits?.currency || '$'
  const m = moneyFor(d, profile)
  const out = []
  const avail = m.fit.available
  const goal = m.fit.goal
  if (avail && m.hours != null) {
    const left = Math.round(avail - m.hours)
    if (m.hours > avail) out.push(`Your time: it needs about ${m.hours} hours a month, more than the ${avail} you have. It would have to shrink, or grow slowly.`)
    else if (left < avail * 0.25) out.push(`Your time: it would use about ${m.hours} of your ${avail} hours a month, leaving little room for anything else at the same time.`)
    else out.push(`Your time: it would use about ${m.hours} of your ${avail} hours a month, leaving about ${left} for something else.`)
  } else if (avail) {
    out.push(`Your time: you have about ${avail} hours a month. This direction's hours aren't worked out yet.`)
  }
  if (goal) {
    if (!m.profit) out.push(`Your goal of ${fmtMoney(goal, cur)} a month: can't tell yet.`)
    else if (m.fit.goalFit === 'meets') out.push(`Your goal of ${fmtMoney(goal, cur)} a month: the estimate reaches it.`)
    else if (m.fit.goalFit === 'maybe') out.push(`Your goal of ${fmtMoney(goal, cur)} a month: only at the top of the price range.`)
    else {
      const room = avail && m.hours != null ? avail - m.hours : null
      out.push(room != null && room < avail * 0.25
        ? `Your goal of ${fmtMoney(goal, cur)} a month: the estimate falls well short, and it uses most of your time, so on its own it can't get you there.`
        : `Your goal of ${fmtMoney(goal, cur)} a month: the estimate falls short. ${room != null ? `It leaves about ${Math.round(room)} hours a month for another stream.` : ''}`.trim())
    }
  }
  return out
}
