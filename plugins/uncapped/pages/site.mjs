// Uncapped's pages, as pure text.
//
// Nothing in here touches a disk, a network or a process, so it runs the same
// in Node (for the prototype) and inside the plugin (for a customer, whose
// machine may have no Node at all). It takes the work and the brand, and gives
// back a map of filename to contents. The caller writes them.

export function buildSite({ work, V, VD, C, LIVE_STEPS, actionList = [], fonts = {} }) {
  const ACTIONS = actionList.map((a) => ({ ...a, re: new RegExp(a.pattern, 'i') }))
  const T = new Proxy({}, { get: (_, k) => `var(--v-${String(k)})` })
  const unknownSays = new Set()
  const kindOf = (say) => {
    const t = say.replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim()
    const hit = ACTIONS.find((a) => a.re.test(t))
    if (!hit) unknownSays.add(t)
    return hit ? hit.kind : ''
  }
  const stampKinds = (html) => html.replace(/<button\b([^>]*?)data-say="([^"]*)"/g,
    (m, a, say) => `<button${a}data-say="${say}" data-kind="${kindOf(say)}"`)
  // Every one of these is something to say in the chat. It shows the exact
  // words, because a phrase you have to guess at is no use to anyone.
  const sayChip = (text, { big = false } = {}) => {
    const t = txt(text)
    return `<span class="say-chip${big ? ' big' : ''}" data-say="${esc(t)}" data-kind="${kindOf(t)}" title="${esc(t)}">${esc(t)}</span>`
  }
  const isNum = (v) => v !== '' && v !== null && v !== undefined && Number.isInteger(Number(v))
  const txt = (v) => {
    if (v === null || v === undefined) return ''
    if (typeof v === 'string' || typeof v === 'number') return String(v)
    if (Array.isArray(v)) return v.map(txt).filter(Boolean).join(' \u00b7 ')
    for (const k of ['text', 'label', 'name', 'gist', 'description', 'wording', 'what', 'q', 'angle', 'beat', 'line', 'takeaway', 'rhythm', 'summary'])
      if (typeof v[k] === 'string') return v[k]
    const first = Object.values(v).find((x) => typeof x === 'string')
    return first || ''
  }
  const esc = (s) => txt(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const has = (x) => x !== undefined && x !== null && x !== '' && !(Array.isArray(x) && !x.length)

  // A brand new person has none of this. Every page has to stand up with
  // nothing in it and say what to do next, so read defensively from here down.
  const g = work.discover?.early || null
  const sales = work.builders?.sales?.output || null
  const sub = work.builders?.substack?.output || null
  // The offer they are working on is the one they chose, which is the one the
  // work marks active. 19 Nov: the pages took offers[0] instead, so switching
  // to another idea left every page showing the offer before it, and an idea
  // only kept as a possible income stream (status "idea") could show as theirs.
  const realOffers = (work.offers || []).filter((o) => o && o.status !== 'idea')
  const offer = realOffers.find((o) => o.id === work.activeOfferId) || realOffers[0] || null
  const named = Boolean(txt(work.profile?.name))
  const EMAIL = 'gabriela@gabrielaflaxcoaching.com'
  // Nobody has to tell Uncapped their name, so every page has to read well
  // without one. `who` is the name and is empty when there isn't one: it can
  // only ever be used where `named` has been checked. `mine` and `greeting`
  // are the two places that needed it, and they both say something sensible
  // either way. 19 Nov: `who` fell back to the word "Your", which produced
  // "Good morning, Your." and "Your's Portfolio Garden" for a customer who
  // had never been asked her name.
  const who = txt(work.profile?.name)
  const mine = named ? `${who}'s` : 'Your'
  const greeting = named ? `Good morning, ${who}.` : 'Good morning.'
  const themesAnswered = Object.keys(work.profile?.answers || {}).filter((k) => has(work.profile.answers[k])).length
  const started = themesAnswered > 0 || work.discover?.status === 'in_progress'

  // What to say on a page whose work does not exist yet: why it is empty, what
  // comes first, and the way to start it.
  const empty = (title, why, firstThing, primary, link) => `
    <div class="empty">
      <span class="empty-ico">${ico(GLYPH.flag, T.heading)}</span>
      <h2>${esc(title)}</h2>
      <p class="empty-why">${esc(why)}</p>
      ${firstThing ? `<p class="empty-first"><span class="label">First</span> ${esc(firstThing)}</p>` : ''}
      ${primary ? `<div class="bigwrap">
        ${sayChip(primary, { big: true })}
        <p class="bignote">Click it to copy, then paste it into the chat with Claude. The questions are asked and answered there, your answers are saved as you give them, and this page fills in.</p>
      </div>` : ''}
      ${link ? `<a class="link" href="${link[1]}">${esc(link[0])} &rarr;</a>` : ''}
    </div>
  `

  // The signpost at the foot of a step: what comes next, and whether it is open.
  const nextStep = (label, file, ready, why) => `
    <div class="signpost${ready ? '' : ' locked'}">
      <div><p class="label">${ready ? 'Next step' : 'Comes next'}</p>
        <p class="signpost-title">${esc(label)}</p>
        ${!ready && why ? `<p class="meta">${esc(why)}</p>` : ''}</div>
      ${ready ? `<a class="btn" href="${file}">Open ${esc(label)} &rarr;</a>` : ''}
    </div>`

  // Small line drawings for the publication chain. Plain, one weight, no motion.
  const GLYPH = {
    reader: 'M12 11a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4zM5 20c0-3.3 3.1-5.6 7-5.6s7 2.3 7 5.6',
    problem: 'M12 16.5v.01M12 13c0-2 2.4-2.3 2.4-4.4A2.6 2.6 0 0012 6a2.7 2.7 0 00-2.6 2.2',
    write: 'M4 20l4.5-1.2L19 8.3a2 2 0 000-2.8l-.5-.5a2 2 0 00-2.8 0L5.2 15.5 4 20z',
    call: 'M4 6.5C4 15 9 20 17.5 20a2 2 0 002-2l-3.2-1.6-2 2a12 12 0 01-4.7-4.7l2-2L10 8.5H6a2 2 0 00-2-2z',
    offer: 'M4 7l8-4 8 4v10l-8 4-8-4V7zm0 0l8 4 8-4M12 11v10',
    heart: 'M12 20s-7-4.4-7-9a3.8 3.8 0 017-2.1A3.8 3.8 0 0119 11c0 4.6-7 9-7 9z',
    clock: 'M12 20a8 8 0 100-16 8 8 0 000 16zm0-12.2V12l3 1.8',
    gift: 'M4 11h16v9H4v-9zm-1-4h18v4H3V7zm9 0v13M12 7S10.5 3.5 8.5 4.5 9.6 7 12 7zm0 0s1.5-3.5 3.5-2.5S14.4 7 12 7z',
    tag: 'M4 11.5V4.5h7l9 9-7 7-9-9zM8 8.5v.01',
    star: 'M12 4.5l2.3 4.9 5.2.7-3.8 3.7 1 5.2-4.7-2.6-4.7 2.6 1-5.2L4.5 10l5.2-.7L12 4.5z',
    flag: 'M6 20V5m0 0h11l-2.2 3.6L17 12H6',
    find: 'M11 18a7 7 0 100-14 7 7 0 000 14zm5.2-1.8L21 21',
    voice: 'M12 15a3 3 0 003-3V7a3 3 0 10-6 0v5a3 3 0 003 3zm-6-3a6 6 0 0012 0M12 18v3',
    tick: 'M5 12.5l4.5 4.5L19 7.5',
  }

  // One step in a chain: a coloured icon tile, a label, and either a sentence or
  // a short list. Used by the offer, the publication and the buyer.
  const actions = (label, items) => {
    const xs = (items || []).filter(Boolean)
    if (!xs.length) return ''
    return `<div class="actions"><p class="label">${esc(label)}</p>
      <div class="say-row">${xs.map((t) => sayChip(t)).join('')}</div>
      <p class="meta">Click one to copy it, then paste it into the chat. The page fills in with what comes back.</p></div>`
  }

  const chainStep = (bg, ink, glyph, label, lines) => {
    const xs = arr(lines).map(txt).filter(Boolean)
    if (!xs.length) return ''
    return `<div class="chain-step" style="--c:${bg}">
      <span class="chain-ico">${ico(glyph, ink)}</span>
      <p class="label">${esc(label)}</p>
      ${xs.length > 1 ? list(xs) : `<p class="chain-text">${esc(xs[0])}</p>`}
    </div>`
  }

  const LENSES = [
    { name: 'do it for them', short: 'For them', bg: T.lensFor, ink: T.onLensFor, icon: 'M4 12h16M14 6l6 6-6 6' },
    { name: 'do it with them', short: 'With them', bg: T.lensWith, ink: T.onLensWith, icon: 'M8 11a3 3 0 100-6 3 3 0 000 6zm8 0a3 3 0 100-6 3 3 0 000 6zM2 20c0-3 2-5 6-5s6 2 6 5m-1 0c0-3 2-5 5-5s5 2 5 5' },
    { name: 'teach them how', short: 'Teach', bg: T.lensTeach, ink: T.onLensTeach, icon: 'M3 8l9-4 9 4-9 4-9-4zm4 6v4c0 1 2 2 5 2s5-1 5-2v-4' },
    { name: 'package it', short: 'Package', bg: T.lensPackage, ink: T.onLensPackage, icon: 'M4 7l8-4 8 4v10l-8 4-8-4V7zm0 0l8 4 8-4M12 11v10' },
    { name: 'publish it', short: 'Publish', bg: T.lensPublish, ink: T.onLensPublish, icon: 'M5 4h11l3 3v13H5V4zm3 6h8M8 14h8M8 18h5' },
  ]
  const lensOf = (n) => LENSES.find((l) => l.name === n) || { short: n || '', bg: T.inset, ink: T.heading, icon: 'M5 12h14' }
  const ico = (p, ink) => `<svg viewBox="0 0 24 24" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${p}"/></svg>`

  const NAV = [
    { file: 'index.html', label: 'Home', home: true },
    { file: 'discover.html', label: 'Discover' },
    { file: 'garden.html', label: 'Portfolio Garden' },
    { file: 'offer.html', label: 'Your offer' },
    { file: 'first10.html', label: 'First 10 Customers' },
    { file: 'substack.html', label: 'Substack' },
    { file: 'map.html', label: 'Your map' },
  ]
  const FOOT = [
    { file: 'updates.html', label: 'Updates' },
    { file: 'help.html', label: 'Help' },
  ]

  // ---------------------------------------------------------------- shell
  const page = (file, title, hero, body) => {
    hero = stampKinds(hero); body = stampKinds(body)
    const nav = NAV.map((n) => `<a class="nav-item${n.file === file ? ' here' : ''}${n.home ? ' home' : ''}" href="${n.file}">${esc(n.label)}</a>`).join('')
    const foot = FOOT.map((n) => `<a class="nav-item quiet${n.file === file ? ' here' : ''}" href="${n.file}">${esc(n.label)}</a>`).join('')
    return `<!doctype html>
  <html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(title)} &middot; Uncapped</title>
  <script>try{var t=localStorage.getItem('uncapped.theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t;}catch(e){}</script><link rel="stylesheet" href="styles.css"></head>
  <body>
  <div class="freshbar" id="freshbar">
    <span class="fresh-when">Grown from your work at <b>${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</b></span>
  </div>
  <div class="shell">
    <aside class="rail">
      <p class="wordmark"><a href="index.html">Uncapped</a></p>
      <nav>${nav}</nav>
      <nav class="foot-nav">${foot}</nav>
      <p class="rail-foot">${esc(mine)} workspace<br><span>Grown from your work &middot; ${new Date().toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'long' })}</span></p>
    </aside>
    <main>
      ${hero}
      <div class="wrap">${body}</div>
    </main>
  </div>
  <script src="app.js"></script>
  </body></html>`
  }

  const hero = ({ eyebrow, title, through, read, stats }) => `
  <header class="hero"><div class="hero-in">
    ${eyebrow ? `<p class="hero-eyebrow">${esc(eyebrow)}</p>` : ''}
    <h1>${esc(title)}</h1>
    ${through ? `<p class="through">${esc(through)}</p>` : ''}
    ${read ? `<p class="read">${esc(read)}</p>` : ''}
    ${(() => {
      const raw = (v) => typeof v === 'string' && v.indexOf('<') === 0
      const keep = (stats || []).filter((s) => has(s[0]) && (raw(s[0]) || txt(s[0]).length <= 14))
      return keep.length ? `<div class="stats">${keep.map((s) => `<span class="stat"><b>${raw(s[0]) ? s[0] : esc(s[0])}</b><span>${esc(s[1])}</span></span>`).join('')}</div>` : ''
    })()}
  </div></header>`

  // A card with the garden's colour bar across its top, and the little coloured
  // icon chip its tiles use. Every page draws from the same set.
  const cardA = (accent, label, inner, cls = '') =>
    `<div class="card accented ${cls}" style="--c:${accent}">${label ? `<p class="label">${esc(label)}</p>` : ''}${inner}</div>`
  const chipI = (accent, ink, path, word) =>
    `<span class="chiprow"><span class="ico" style="background:${accent}">${ico(path, ink)}</span><span class="lens">${esc(word)}</span></span>`
  const card = (label, inner, cls = '') => `<div class="card ${cls}">${label ? `<p class="label">${esc(label)}</p>` : ''}${inner}</div>`
  const facts = (rows) => `<dl class="facts">${rows.filter(([, v]) => has(v)).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`
  const arr = (x) => (Array.isArray(x) ? x : has(x) ? [x] : [])
  const list = (xs, f = (x) => esc(x)) => `<ul class="plain">${arr(xs).filter(has).map((x) => `<li>${f(x)}</li>`).join('')}</ul>`
  const sect = (t, note) => `<h2 class="section">${esc(t)}</h2>${note ? `<p class="section-note">${esc(note)}</p>` : ''}`
  // Two labels over one sentence reads as a mistake, and a garden written
  // before ideas had their own fields answers more than one question with the
  // same words. Keep the first label it earned and drop the repeat.
  const onceEach = (rows) => {
    const seen = new Set()
    return rows.filter(([, v]) => {
      const k = txt(v).trim().toLowerCase()
      if (!k || seen.has(k)) return false
      seen.add(k)
      return true
    })
  }

  // ---------------------------------------------------------------- pages
  // How far a person has got, from what is actually saved. Catherine has messaged
  // nobody yet, so everyone shows as Not contacted - the page never invents progress.
  const tracker = work.builders?.sales?.tracker || work.builders?.sales?.contacts || {}
  const contactStop = (pp) => {
    const t = tracker[pp.key] || tracker[String(pp.slot)] || tracker[pp.name] || {}
    if (t.talk === 'had it') return 3
    if (t.reply === 'replied') return 2
    if (t.sent && t.sent !== 'not sent yet') return 1
    return 0
  }

  const priceRange = (d) => (has(d.priceLow)
    ? `$${d.priceLow}${has(d.priceHigh) && String(d.priceHigh) !== String(d.priceLow) ? ` to $${d.priceHigh}` : ''}${d.priceUnit ? ` ${d.priceUnit}` : ''}`
    : txt(d.priceNote))

  // Every idea in the garden, in the same order and with the same keys as the
  // plugin's gardenIdeas(), so the pages and the chat always mean the same
  // idea by the same name. 19 Nov: this listed only growInto, so a direction's
  // own first offer - the one whose price and buyer the direction shows - had
  // no tile at all, and the page said eight ideas where the garden had eleven.
  const normName = (x) => String(x || '').trim().toLowerCase()
  const ideas = (g?.directions || []).flatMap((d, di) => {
    const grow = d.growInto || []
    // A related idea that repeats the first offer is the same offer: once, with
    // the fuller wording, exactly as gardenIdeas() treats it.
    const dupAt = grow.findIndex((x) => normName(x.name) && normName(x.name) === normName(d.firstOffer || d.title))
    const dup = dupAt >= 0 ? grow[dupAt] : null
    const first = {
      key: d.id, dir: di, grow: null, stage: d.stage, own: Boolean(d.own),
      name: d.firstOffer || d.title, lens: d.lens || d.route, family: d.family || '',
      buyer: d.buyer || '', trigger: d.whyNow || '', why: d.whyNow || '',
      receives: (dup && dup.receives) || d.handover || '', credible: d.whyYou || '',
      how: d.summary || (dup && dup.how) || '', price: priceRange(d) || (dup && dup.price) || '',
      hours: d.deliveryHours || '', size: d.size || '', test: d.testIt || '',
      needs: d.needs || '', proof: d.proof || '',
    }
    const rest = grow
      .map((x, ii) => ({ ...x, key: `${d.id}-grow-${ii}`, dir: di, grow: ii, stage: d.stage }))
      .filter((_, ii) => ii !== dupAt)
    return [first, ...rest]
  })

  // Which idea in the garden the offer they are working on came from, so a page
  // can name it and link straight to it instead of to its direction.
  const sameGrow = (a, b) => (a === undefined ? null : a) === (b === undefined ? null : b)
  const offerIdea = offer && g
    ? ideas.find((x) => (g.directions[x.dir] || {}).id === offer.fromDirection && sameGrow(x.grow, offer.fromGrow)) || null
    : null

  function home() {
    if (!started) {
      return page('index.html', 'Home',
        hero({ title: 'Welcome to Uncapped.',
          through: 'Let us find what you could get paid for.',
          read: 'About 20 minutes of questions about your work, your life and what people already ask you for. Everything you build is saved in your own folder, on your computer.' }),
        empty('Start with Discover',
          'Nothing here yet, and that is how it should be. Uncapped grows every page on this site from your answers.',
          'Discover is about 20 minutes. You can stop and come back.',
          'Start Discover',
          ['See the Discover page', 'discover.html'],) +
        sect('What you will build') +
        `<div class="chain">
          ${chainStep(T.lensFor, T.onLensFor, GLYPH.find, 'Discover', ['What you could get paid for, from your work and your life.'])}
          ${chainStep(T.lensTeach, T.onLensTeach, GLYPH.star, 'Your offer', ['The one idea worth testing first, priced.'])}
          ${chainStep(T.lensWith, T.onLensWith, GLYPH.voice, 'First 10 Customers', ['Ten real conversations, starting with people who know you.'])}
          ${chainStep(T.lensPublish, T.onLensPublish, GLYPH.write, 'Substack', ['One publication for all your offers.'])}
        </div>`)
    }
    if (!g) {
      return page('index.html', 'Home',
        hero({ title: greeting,
          through: 'Discover is under way.',
          read: 'Your answers are saved as you give them. When there are enough, Claude grows your Portfolio Garden from them, and the rest of this site fills in from there.',
          stats: [[`${themesAnswered} of 7`, 'Themes answered']] }),
        empty('Carry on with Discover',
          `You have answered ${themesAnswered} theme${themesAnswered === 1 ? '' : 's'}. A few more and there is enough to grow your garden.`,
          'You can stop and come back. Nothing is lost.',
          'Carry on with Discover',
          ['See what you have said', 'discover.html']) +
        sect('What comes next') +
        `<div class="chain">
          ${chainStep(T.lensFor, T.onLensFor, GLYPH.find, 'Your Portfolio Garden', ['Everything you could get paid for, grown from your answers.'])}
          ${chainStep(T.lensTeach, T.onLensTeach, GLYPH.star, 'Your offer', ['The one idea worth testing first, priced.'])}
          ${chainStep(T.lensWith, T.onLensWith, GLYPH.voice, 'First 10 Customers', ['Ten real conversations, starting with people who know you.'])}
          ${chainStep(T.lensPublish, T.onLensPublish, GLYPH.write, 'Substack', ['One publication for all your offers.'])}
        </div>`)
    }
    const steps = LIVE_STEPS.map((s, i) => {
      const done = [true, !!offer, !!sales, !!sub][i]
      const file = ['discover.html', 'offer.html', 'first10.html', 'substack.html'][i] || '#'
      const pc = [T.lensFor, T.lensWith, T.lensTeach, T.lensPublish][i % 4]
      const pi = [T.onLensFor, T.onLensWith, T.onLensTeach, T.onLensPublish][i % 4]
      return `<a class="path-step${done ? ' done' : ''}" href="${file}" style="--c:${pc}">
        <span class="path-num" style="background:${pc};color:${pi}">${s.pos}</span>
        <span class="path-text"><b>${esc(s.name)}</b><span>${esc(s.promise)}</span></span>
        <span class="path-state">${done ? 'Done' : 'Next'}</span></a>`
    }).join('')
    return page('index.html', 'Home',
      hero({
        title: greeting,
        through: g.throughLine,
        read: (sub && sub.nextAction) || g.read,
        stats: [[(g.directions || []).length, 'Directions'], [ideas.length, 'Ideas'],
          ...(sales ? [[(sales.list || []).length, 'People to talk to']] : []),
          ...(sub ? [[(sub.pieces || []).length, 'Posts planned']] : [])],
      }),
      `${sales ? `<div class="next-move">
         <p class="label">Your next move</p>
         <h2>${esc(sales.firstMove?.who || sales.firstMove?.what || 'Message the first person on your list')}</h2>
         ${has(sales.firstMove?.why) ? `<p>${esc(sales.firstMove.why)}</p>` : ''}
         <a class="btn" href="first10.html">Open First 10 Customers &rarr;</a>
       </div>` : ''}
       ${sect('Your offer')}
       ${offer
         ? cardA(lensOf(((g.directions || []).find((x) => x.id === offer.fromDirection) || (g.directions || [])[0] || {}).route).bg, '', `<p class="offer-name">${esc(offer.name)}</p>
          ${facts([['For', offer.buyer], ['The problem', offer.problem], ['Price', `${offer.priceLow === offer.priceHigh ? '$' + offer.priceLow : '$' + offer.priceLow + ' to $' + offer.priceHigh} ${offer.priceUnit || ''}`]])}
          <a class="link" href="offer.html">See the whole offer &rarr;</a>`)
         : cardA(T.lensTeach, 'Not chosen yet', `<p class="lede">Your garden has ${ideas.length} idea${ideas.length === 1 ? '' : 's'} in it. Choosing one turns it into an offer with a price and a first step, and the rest of this site is built around it.</p>
          <div class="say-row" style="margin-top:14px">${sayChip('Help me choose my offer')}</div>
          <a class="link" href="garden.html">See your garden &rarr;</a>`)}
       ${sect('Your path')}
       <div class="path">${steps}</div>
       ${actions('What you can ask for here', [
         offer ? `Change my offer: ${txt(offer.name)}` : 'Help me choose my offer',
         'Report what happened with a test', 'Show me my tests',
         'What should I do next?'])}`)
  }

  function discover() {
    if (!started) {
      return page('discover.html', 'Discover',
        hero({ eyebrow: 'Step 1 of 4 \u00b7 Find it', title: 'Discover',
          through: 'What could you get paid for?',
          read: 'Seven short themes about your work, your life and what people already ask you for. Claude asks them one at a time in the chat, and saves every answer in your own words. They appear here as you go.' }),
        empty('Not started yet',
          'Your answers appear here as you give them, each one saved in your own words. Nothing is sent anywhere.',
          'The first question is about what you do now. There is no wrong answer, and you can change any of them later.',
          'Start Discover',
          null,) +
        nextStep('Your offer', 'offer.html', false, 'Your offer is chosen from the garden Discover grows.'))
    }
    const lim = work.profile?.limits || {}
    const nrg = work.profile?.energy || {}
    const money = [lim.income && `${lim.currency || '$'}${lim.income} a month`, lim.goal].filter(Boolean).join(' \u00b7 ')
    const weekText = [lim.hours && `${lim.hours} hours a week`, money].filter(Boolean).join('. ')
    const energyText = [nrg.more && `More of: ${nrg.more}`, nrg.less && `Less of: ${nrg.less}`,
      nrg.never && `Never again: ${nrg.never}`].filter(Boolean).join('\n\n')
    const THEMES = [['start', 'Where you are starting from'], ['now', 'What you do now'],
      ['led', 'What led you here'], ['askedFor', 'What people ask you for'],
      ['know', 'What you know well'], ['outside', 'Outside work'],
      ['try', 'What you want to try'], ['buyers', 'Who you already know'],
      ['week', 'Your week and your goal', weekText], ['energy', 'What gives you energy', energyText]]
    const answerFor = ([k, , own]) => own !== undefined ? own : work.profile?.answers?.[k]
    const saved = THEMES.filter((t) => has(answerFor(t)))
    return page('discover.html', 'Discover',
      hero({ eyebrow: 'Step 1 of 4 \u00b7 Find it', title: 'Discover',
        through: g ? g.throughLine : 'What could you get paid for?',
        read: g ? g.read : 'Every answer is saved in your own words. When there are enough, Claude grows your Portfolio Garden from them.',
        stats: [[saved.length + ' of ' + THEMES.length, 'Themes saved'],
          ...(g ? [[(g.strengths?.demand || []).length, 'Times people paid'], [(g.questions || []).length, 'Questions left']] : [])] }),
      `${sect('What you told me', 'Each answer is saved in your own words.')}
       <div class="grid">${saved.map((t, i) => {
         const [k, label] = t
         const text = txt(answerFor(t))
         const sum = work.profile?.summaries?.[k]
         return `<div class="card theme accented" style="--c:${[T.lensFor, T.lensWith, T.lensTeach, T.lensPublish, T.lensPackage][i % 5]}"><p class="label">${esc(label)}</p>
           ${has(sum) ? `<p class="theme-sum">${esc(sum)}</p>` : ''}
           <details><summary>Read what you said</summary>${text.split('\n\n').filter(Boolean).map((para) => `<p>${esc(para)}</p>`).join('')}</details>
           <div class="ask">${sayChip(`I want to change my Discover answer about ${label.toLowerCase()}`)}</div></div>`
       }).join('')}</div>
       ${g && has(g.strengths) ? `${sect('What stands out')}<div class="grid">
         ${Object.entries(g.strengths).map(([k, v]) => Array.isArray(v) && v.length ? card(k === 'demand' ? 'People have paid for' : k, list(v)) : '').join('')}</div>` : ''}
       ${g && has(g.mainTest) ? card('The main thing to find out', `<p class="lede">${esc(g.mainTest)}</p>`, 'accent') : ''}
       ${actions('What you can ask for here', [
         'Add something new to Discover',
         'Ask me the questions I have not answered',
         g ? 'Grow my garden again from my answers' : 'Grow my garden now'])}`)
  }

  function garden() {
    if (!g) {
      return page('garden.html', 'Portfolio Garden',
        hero({ title: 'Your Portfolio Garden',
          through: 'Everything you could get paid for, in one place.',
          read: 'A garden grows from your Discover answers: several directions, each with ideas you could test, across the five ways to earn.' }),
        empty(started ? 'Still growing' : 'Nothing planted yet',
          started
            ? `You have answered ${themesAnswered} theme${themesAnswered === 1 ? '' : 's'}. A few more and Claude can grow your garden.`
            : 'Your garden grows from Discover. Answer the questions first and this fills itself.',
          started ? 'Carry on with Discover, then ask for your garden.' : 'Discover comes first.',
          started ? 'Carry on with Discover' : 'Start Discover',
          ['See the Discover page', 'discover.html']))
    }
    const tile = (it) => {
      const l = lensOf(it.lens)
      return `<button class="tile" data-local="opens this idea, inside the direction it grew from" data-lens="${slug(it.lens)}" data-dir="${it.dir}" data-idea="${esc(it.key)}" style="--c:${l.bg};--ci:${l.ink}">
        <span class="tile-top"><span class="ico">${ico(l.icon, l.ink)}</span><span class="lens">${esc(l.short)}</span>
        ${it.price ? `<span class="price">${esc(it.price)}</span>` : ''}</span>
        <span class="tile-name">${esc(it.name)}</span><span class="tile-buyer">${esc(it.buyer)}</span>
        <span class="tile-how">${esc(it.how)}</span><span class="tile-go">See this idea &rarr;</span></button>`
    }
    // An idea, inside the direction it grew from, with everything the garden
    // knows about it and the words that choose it. Before 19 November an idea
    // was a tile and nothing else: pressing one opened its direction, which
    // describes a different offer at a different price, so every press showed
    // the wrong thing and no idea was named anywhere on the page but its tile.
    const ideaRow = (it) => {
      const l = lensOf(it.lens)
      const isYours = Boolean(offer) && offer.fromDirection === (g.directions[it.dir] || {}).id
        && (offer.fromGrow === undefined ? null : offer.fromGrow) === (it.grow === undefined ? null : it.grow)
      return `<div class="idea${isYours ? ' yours' : ''}" id="idea-${esc(it.key)}">
        <button class="idea-head" data-local="opens and closes this idea" aria-expanded="false" aria-controls="ib-${esc(it.key)}">
          <span class="ico" style="background:${l.bg}">${ico(l.icon, l.ink)}</span>
          <span class="idea-head-text">
            <span class="idea-name">${esc(it.name)}</span>
            <span class="idea-meta">${esc(l.short)}${it.price ? ` <span class="dot">&middot;</span> ${esc(it.price)}` : ''}${it.hours ? ` <span class="dot">&middot;</span> ${esc(it.hours)}` : ''}</span></span>
          ${isYours ? `<span class="pill" style="background:${l.bg};color:${l.ink}">The one you chose</span>` : ''}
          <span class="chev"></span></button>
        <div class="idea-body" id="ib-${esc(it.key)}" hidden>
          ${facts(onceEach([['Who buys it', it.buyer], ['What makes them act', it.trigger], ['Why they would pay', it.why],
            ['What they get', it.receives], ['How it works', it.how], ['Price to test', it.price],
            ['Hours it takes', it.hours], ['How much of your week', it.size], ['Why you can do it', it.credible],
            ['What you would need first', it.needs], ['How to test it', it.test], ['Still a guess', it.proof]]))}
          <div class="ask">${sayChip(`Start with this offer: ${txt(it.name)}`)}</div></div></div>`
    }
    const dir = (d, i) => {
      const l = lensOf(d.route)
      const mineHere = ideas.filter((x) => x.dir === i)
      return `<section class="dir" id="dir-${i}" style="--c:${l.bg};--ci:${l.ink}">
        <button class="dir-head" data-local="opens and closes this direction" aria-expanded="false" aria-controls="db-${i}">
          <span class="dir-num">${i + 1}</span>
          <span class="dir-head-text">
            <span class="eyebrow"><span class="pill" style="background:${l.bg};color:${l.ink}">${esc(d.stage)}</span>
              <span class="dot">&middot;</span> ${esc(d.basis)}${d.monthsToFirstIncome ? ` <span class="dot">&middot;</span> first income in about ${d.monthsToFirstIncome} month${d.monthsToFirstIncome > 1 ? 's' : ''}` : ''}</span>
            <span class="dir-title">${esc(d.title)}</span></span>
          <span class="chev"></span></button>
        <div class="dir-body" id="db-${i}" hidden>
          <p class="lede">${esc(d.opportunity)}</p>
          <div class="two">${card('Why you', `<p>${esc(d.whyYou)}</p>`)}
            ${d.take ? card('My read', `<p><strong>${esc(d.take.appeal)}</strong> ${esc(d.take.limitation)}</p><p class="meta">Based on ${esc(d.take.basis)}.</p>`) : ''}</div>
          ${facts([['The first offer to test', d.firstOffer], ['Who buys it', d.buyer], ['The problem', d.problem], ['Why now', d.whyNow], ['What they get', d.handover],
            ['Price', priceRange(d)], ['Why that price', d.priceWhy],
            ['Hours a job', d.deliveryHours], ['First step', d.firstStep]])}
          ${d.nextTest ? card('Next test', `<p>${esc(d.nextTest.learn || d.nextTest.label)}</p>`, 'accent') : ''}
          <h3 class="sub">${mineHere.length === 1 ? 'The idea in this direction' : `The ${mineHere.length} ideas in this direction`}</h3>
          <p class="section-note">Open one to see who buys it, what it costs them and how to test it. Each one carries the words that make it your offer.</p>
          <div class="ideas">${mineHere.map(ideaRow).join('')}</div>
          <div class="ask">${sayChip(`Tell me more about ${txt(d.title)}`)}${sayChip(`Research this direction for me: ${txt(d.title)}`)}</div></div></section>`
    }
    return page('garden.html', 'Portfolio Garden',
      hero({ title: `${mine} Portfolio Garden`, through: g.throughLine, read: g.read,
        stats: [[g.directions.length, 'Directions'], [ideas.length, 'Ideas to test'], [new Set(ideas.map((i) => i.lens)).size, 'Ways to earn'], [(g.unknowns || []).length, 'Still to find out']] }),
      `<div class="bar"><span class="bar-label">Show</span>
        <button class="filter" data-local="shows every idea again" data-f="lens" data-v="all" aria-pressed="true">Everything</button>
        ${LENSES.map((l) => `<button class="filter lens" data-local="shows only this way of earning" data-f="lens" data-v="${slug(l.name)}" aria-pressed="false" style="--c:${l.bg};--ci:${l.ink}">${esc(l.short)}</button>`).join('')}
        <span class="count" id="count"></span></div>
       ${sect('Everything that could grow here', 'Press a lens to see one way of earning, or press an idea to open the direction it came from.')}
       <div class="grid" id="grid">${ideas.map(tile).join('')}</div>
       ${sect(`The ${g.directions.length} directions`, 'Press one to open it.')}
       ${g.directions.map(dir).join('')}
       <div class="two">
         ${has(g.unknowns) ? card('Still to find out', list(g.unknowns, (u) => esc(u.text || u))) : ''}
         ${has(g.leftAside) ? card('Set aside for now', list(g.leftAside, (u) => esc(u.text || u))) : ''}</div>
       ${actions('What you can ask for here', [
         'I have my own idea to add to the garden', 'Something is missing from my garden',
         'I want to work on a different idea'])}`)
  }

  function offerPage() {
    if (!offer) {
      return page('offer.html', 'Your offer',
        hero({ eyebrow: 'Step 2 of 4 \u00b7 Find it', title: 'Your offer',
          through: 'The one idea worth testing first.',
          read: 'You choose one idea from your garden, and Claude works out what it is, who it is for, what it costs and what it has to prove.' }),
        empty(g ? 'Not chosen yet' : 'Your garden comes first',
          g ? 'Your garden has ideas in it. Choosing one turns it into an offer with a price and a first step.'
            : 'An offer is chosen from your Portfolio Garden, and your garden grows from Discover.',
          g ? 'Open your garden and pick the one you would test first.' : 'Discover, then your garden, then this.',
          g ? 'Help me choose my offer' : 'Start Discover',
          g ? ['See your garden', 'garden.html'] : ['See the Discover page', 'discover.html']) +
        nextStep('First 10 Customers', 'first10.html', false, 'Your first ten conversations are planned around the offer you choose.'))
    }
    return page('offer.html', 'Your offer',
      hero({ eyebrow: 'Step 2 of 4 · Find it', title: offer.name,
        through: offer.problem, read: offer.whyNow,
        stats: [[`$${offer.priceLow}${offer.priceHigh !== offer.priceLow ? '–' + offer.priceHigh : ''}`, offer.priceUnit || 'Price'], [esc(offer.status || 'active'), 'Status'], [esc(offer.format || '—'), 'Format']] }),
      `${(() => {
        const d = g.directions.find((x) => x.id === offer.fromDirection) || g.directions[0]
        const l = lensOf(d && d.route)
        return `<div class="card accented" style="--c:${l.bg}">
          <div class="offer-hero">
            <div>${chipI(l.bg, l.ink, l.icon, l.short)}
              <p class="offer-name">${esc(offer.name)}</p>
              <p class="lede">${esc(offer.problem)}</p></div>
            <p class="bigprice">$${esc(offer.priceLow)}&ndash;${esc(offer.priceHigh)}<span>${esc(offer.priceUnit || 'per job')}</span></p>
          </div></div>
        <div class="chain">
          ${chainStep(T.lensFor, T.onLensFor, GLYPH.reader, 'Who it is for', [offer.buyer])}
          ${chainStep(T.lensTeach, T.onLensTeach, GLYPH.clock, 'Why now', [offer.whyNow])}
          ${chainStep(T.lensWith, T.onLensWith, GLYPH.gift, 'What they get', [offer.handover])}
        </div>
        <div class="chain">
          ${chainStep(T.lensPublish, T.onLensPublish, GLYPH.tag, 'Why that price', [offer.priceWhy])}
          ${chainStep(T.lensPackage, T.onLensPackage, GLYPH.star, 'Why you', [offer.whyYou])}
          ${chainStep(T.lensFor, T.onLensFor, GLYPH.flag, 'Start with', [offer.startWith])}
        </div>
        ${has(offer.firstStep) ? card('First step', `<p class="lede">${esc(offer.firstStep)}</p>`, 'accent') : ''}
        ${actions('What you can ask for here', [
          `Change my offer: ${txt(offer.name)}`, `Change the price of my offer: ${txt(offer.name)}`,
          'I want to choose a different idea instead',
          `Keep my offer and move on: ${txt(offer.name)}`, `Plan a test for my offer: ${txt(offer.name)}`])}`
      })()}
       ${has(offer.toTest) ? card('What this still has to prove', `<p class="lede">${esc(offer.toTest)}</p>`, 'accent') : ''}
       ${sect('Where it came from')}
       ${card('', `<p>Grown from ${offerIdea ? `<strong>${esc(offerIdea.name)}</strong>, an idea in the direction ` : 'the direction '}<strong>${esc(g.directions.find((d) => d.id === offer.fromDirection)?.title || offer.fromDirection || '')}</strong> in your Portfolio Garden.</p><a class="link" href="garden.html${offerIdea ? `?idea=${encodeURIComponent(offerIdea.key)}` : ''}">${offerIdea ? 'Open that idea' : 'Open the garden'} &rarr;</a>`)}`)
  }

  const guideCard = (title, gd, accent, ink, glyph) => `<div class="guide" style="--c:${accent};--ci:${ink}">
    <div class="guide-head"><span class="guide-ico">${ico(glyph, ink)}</span>
      <h3 class="guide-title">${esc(title)}</h3></div>
    <div class="guide-body">
    ${has(gd.purpose) ? `<p class="lede">${esc(gd.purpose)}</p>` : ''}
    ${has(gd.intro) ? `<p class="meta">${esc(gd.intro)}</p>` : ''}
    ${has(gd.opener) ? `<p class="label" style="margin-top:14px">How to open</p><blockquote>${esc(gd.opener)}</blockquote>` : ''}
    ${has(gd.questions) ? `<p class="label" style="margin-top:14px">What to ask</p>${list(gd.questions, (q) => esc(typeof q === 'string' ? q : q.q || q.text))}` : ''}
    ${has(gd.more) ? `<details><summary>More to ask if it is going well</summary>${list(gd.more, (q) => esc(typeof q === 'string' ? q : q.q || q.text))}</details>` : ''}
    ${has(gd.close) ? `<p class="label" style="margin-top:14px">How to close</p><blockquote>${esc(gd.close)}</blockquote>` : ''}
    </div></div>`

  function first10() {
    if (!sales) {
      return page('first10.html', 'First 10 Customers',
        hero({ eyebrow: 'Step 3 of 4 \u00b7 Sell it', title: 'First 10 Customers',
          through: 'Ten real conversations, starting with people who know you.',
          read: 'Claude works out who to talk to, in what order, and writes the message for each one, so you are never staring at a blank message box.' }),
        empty(offer ? 'Not built yet' : 'Your offer comes first',
          offer ? 'Your plan is built from your offer and the people you already know.'
            : 'This plan is built around an offer, so that comes first.',
          offer ? 'Claude asks you three short questions, then writes the list and the messages.'
            : 'Choose your offer, then come back here.',
          offer ? 'Build my First 10 Customers plan' : 'Help me choose my offer',
          offer ? null : ['See your offer', 'offer.html']) +
        nextStep('Substack', 'substack.html', false, 'Your Substack is written for the buyer this plan is aimed at.'))
    }
    const batches = [...new Set(sales.list.map((x) => x.batch))]
    const BATCH_C = [T.lensFor, T.lensWith, T.lensTeach, T.lensPublish]
    const STOPS = ['Not contacted', 'Messaged', 'Replied', 'Talked']
    const person = (p) => {
      const who = p.name || p.label || 'Someone you know'
      // What they will SAY about this person. 'Someone you know' is fine as a
      // heading but useless in a phrase: with no names saved, all ten would say
      // the same words and the chat could not tell them apart.
      const sayWho = p.name || p.label || `number ${p.slot} on my list`
      const stop = contactStop(p)
      return `
      <div class="card person accented" data-batch="${slug(p.batch || '')}" style="--c:${BATCH_C[Math.max(0, batches.indexOf(p.batch)) % 4]}">
        <div class="person-top"><span class="slot">${p.slot}</span>
          <span class="person-name">${esc(who)}</span>
          ${p.temperature ? `<span class="tag">${esc(p.temperature)}</span>` : ''}
          ${p.batch ? `<span class="tag quiet">${esc(p.batch)}</span>` : ''}</div>
        <ol class="stops">${STOPS.map((st, i) => `<li class="${i === stop ? 'at' : i < stop ? 'past' : ''}">${esc(st)}</li>`).join('')}</ol>
        ${facts([['Who', p.who], ['Why them', p.why], ['How to reach them', p.reach || p.findBy], ['Kind of message', p.messageType]])}
        ${has(p.message) ? `<div class="msg"><p class="label">The message to send</p>
          <blockquote id="m-${p.slot}">${esc(p.message)}</blockquote>
          <button class="copy" data-local="copies the message" data-copy="m-${p.slot}">Copy this message</button></div>` : ''}
        ${has(p.followUp) ? `<details><summary>If they don't reply</summary><blockquote>${esc(p.followUp)}</blockquote></details>` : ''}
        <div class="say"><p class="label">When something happens, click it and paste it in the chat</p>
          <div class="say-row">${(() => { const nm = sayWho.split(',')[0].replace(/^(The|Your|A|An) /, (m) => m.toLowerCase())
            return [`I messaged ${nm}`, `${nm.charAt(0).toUpperCase() + nm.slice(1)} replied`, `I talked to ${nm}`, `${nm.charAt(0).toUpperCase() + nm.slice(1)} said not now`,
              has(p.message) ? `Rewrite the message for ${nm}` : `Write the message for ${nm}`] })()
            .map((t) => sayChip(t)).join('')}</div>
          <p class="meta">Click whichever just happened to copy it, then paste it into the chat. This page shows the new status next time you open it.</p></div>
      </div>`
    }
    const guide = sales.callGuide || {}
    // A person can have a First 10 list for each offer, so each phrase says which
    const f10Whose = txt(offer?.name) || 'my offer'
    return page('first10.html', 'First 10 Customers',
      hero({ eyebrow: 'Step 3 of 4 · Sell it', title: 'First 10 Customers',
        through: sales.buyer?.description || sales.buyer, read: typeof sales.summary === 'string' ? sales.summary : sales.expect,
        stats: [[sales.list.length, 'People to talk to'], [sales.weeklyCap || '—', 'Conversations a week'], [new Set(sales.list.map((p) => p.batch)).size, 'Batches'], [(sales.routes || []).length, 'Ways in']] }),
      `${has(sales.firstMove) ? `<div class="next-move"><p class="label">Start here</p>
         <h2>${esc(sales.firstMove.who || sales.firstMove.what || '')}</h2>${has(sales.firstMove.why) ? `<p>${esc(sales.firstMove.why)}</p>` : ''}</div>` : ''}
       ${sect('Your ten', 'Everyone worth a conversation, in the order to do them.')}
       <div class="people">${sales.list.map(person).join('')}</div>
       ${has(sales.routes) ? `${sect('Ways in', `How to reach people you do not already know. Open the one you need.${has(sales.weeklyCap) ? ' ' + txt(sales.weeklyCap) : ''}`)}
         <div class="accordion">${sales.routes.map((r, i) => `<details class="fold" style="--c:${[T.lensFor, T.lensWith, T.lensTeach, T.lensPublish][i % 4]}">
           <summary><span class="fold-title">${esc(r.route)}</span><span class="fold-when">${esc(r.when)}</span><span class="fold-chev"></span></summary>
           <div class="fold-body">${facts([['Fits because', r.fit], ['How it works', r.how]])}</div></details>`).join('')}</div>` : ''}
       ${has(sales.buyer) ? `${sect('Who you are looking for', 'What a good person to talk to looks like.')}
         ${has(sales.buyer.description) ? `<div class="feature" style="--c:${T.lensFor}">
           <span class="feature-ico">${ico(GLYPH.reader, T.onLensFor)}</span>
           <div><p class="label">In short</p><p class="feature-text">${esc(sales.buyer.description)}</p></div></div>` : ''}
         <div class="chain">
           ${chainStep(T.lensTeach, T.onLensTeach, GLYPH.find, 'What to look for', [sales.buyer.lookFor])}
           ${chainStep(T.lensWith, T.onLensWith, GLYPH.clock, 'Why it matters now', [sales.buyer.relevantNow])}
           ${chainStep(T.lensPublish, T.onLensPublish, GLYPH.problem, 'They have the problem when', [sales.buyer.hasProblem])}
         </div>
         <div class="chain">
           ${chainStep(T.lensWith, T.onLensWith, GLYPH.voice, 'Who champions it', [sales.buyer.champion])}
           ${chainStep(T.lensPackage, T.onLensPackage, GLYPH.tick, 'Who approves it', [sales.buyer.approves])}
         </div>` : ''}
       ${actions('What you can ask for here', [
         `Write the messages for the rest of my list: ${f10Whose}`,
         `Change my First 10 plan: ${f10Whose}`,
         `Report back on how the conversations went: ${f10Whose}`,
         `Write my call guide: ${f10Whose}`,
         `Someone had a different outcome I want to record: ${f10Whose}`])}
       ${has(guide.client) ? `${sect('What to ask on a call', 'Two guides: one for someone who could buy, one for someone who knows your buyers.')}
         ${guideCard('Someone who could buy', guide.client, T.lensFor, T.onLensFor, GLYPH.tag)}
         ${has(guide.knows) ? guideCard('Someone who knows your buyers', guide.knows, T.lensWith, T.onLensWith, GLYPH.voice) : ''}` : ''}`)
  }

  function substack() {
    if (!sub) {
      return page('substack.html', 'Substack',
        hero({ eyebrow: 'Step 4 of 4 \u00b7 Show up', title: 'Substack',
          through: 'One publication for all your offers.',
          read: 'Claude researches your field, chooses ten posts, and writes a full card for each one: the idea, why someone opens it, how it unfolds and where your offer comes in.' }),
        empty(offer ? 'Not built yet' : 'Your offer comes first',
          offer ? 'Your strategy is written for the reader your offer is for, so it is built after the offer.'
            : 'A Substack is written for a buyer, and your buyer comes from your offer.',
          offer ? 'Claude asks about your stories and your views first, then takes about twelve minutes to write the whole strategy.'
            : 'Choose your offer, then come back here.',
          offer ? 'Build my Substack strategy' : 'Help me choose my offer',
          offer ? null : ['See your offer', 'offer.html']))
    }
    const o = sub.overview || {}
    const w = sub.world || {}
    // Every phrase here names the Substack it belongs to. One space, one
    // Substack, so the offer it is written for is what tells them apart.
    const subWhose = txt(offer?.name) || txt(sub.forOffer?.offer) || 'my offer'
    const arrTxt = (x) => arr(x).map(txt).filter(Boolean)

    const POST_C = { 'intro story': T.lensWith, methodology: T.lensFor, 'audience builder': T.lensTeach }
    const post = (p, i) => {
      const brief = sub.briefs?.[String(i)]
      // a post with no headline saved yet still has its number, and must not
      // trail a bare colon into the chat
      const tail = txt(p.headline) ? `: ${txt(p.headline)}` : ''
      return `
      <article class="card post accented" data-post="${i}" style="--c:${POST_C[p.type] || T.lensPublish}">
        <div class="post-top">
          <label class="tick"><input type="checkbox" class="posted" data-post="${i}"><span class="box"></span><span class="tick-word">Posted</span></label>
          <span class="slot">${i + 1}</span>
          <span class="tag quiet">${esc(p.type || '')}</span>
          ${p.series ? `<span class="tag">${esc(p.series)}</span>` : ''}
          ${brief ? '<span class="tag done">Brief written</span>' : ''}
        </div>
        <h3>${esc(p.headline)}</h3>
        <p class="lede">${esc(p.idea)}</p>
        ${facts([['Why someone opens it', p.whyOpen], ['What it does for you', p.job],
          ['Opens with', p.opensWith], ['Leads to', p.leadsTo],
          ['Next step for the reader', p.next?.wording ? `${p.next.wording}${p.next.kind ? ` (${p.next.kind})` : ''}` : p.next]])}
        ${brief
          ? `<a class="link" href="post-${i + 1}.html">Read the full brief &rarr;</a>`
          : `<div class="ask">${sayChip(`Write the brief for post ${i + 1}${tail}`)}
             <span class="meta">No brief yet. Press to copy the words, paste them into the chat.</span></div>`}
        <div class="ask">${sayChip(`Change the idea for post ${i + 1}${tail}`)}</div>
      </article>`
    }

    const WHEEL = [T.lensFor, T.lensWith, T.lensTeach, T.lensPublish, T.lensPackage]
    let turn = 0
    const mini = (label, value) => has(value)
      ? cardA(WHEEL[turn++ % 5], label, `<p>${esc(value)}</p>`, 'mini') : ''
    const miniList = (label, xs) => arrTxt(xs).length
      ? cardA(WHEEL[turn++ % 5], label, list(arrTxt(xs)), 'mini') : ''

    return page('substack.html', 'Substack',
      hero({ eyebrow: 'Step 4 of 4 \u00b7 Show up', title: sub.names?.[0]?.name || 'Your Substack',
        through: sub.knownFor?.gist, read: o.whySubscribe || o.writingFor,
        stats: [[sub.pieces.length, 'Posts planned'], ['<span id="postedcount">0</span>', 'Posted'],
          [Object.keys(sub.briefs || {}).length, 'Briefs written'], [(sub.series || []).length, 'Series']] }),
      `${sect('What this publication is', 'Who you are writing for, and the path from a post to a conversation.')}
       ${has(o.writingFor) ? `<div class="feature" style="--c:${T.lensFor}">
         <span class="feature-ico">${ico(GLYPH.reader, T.onLensFor)}</span>
         <div><p class="label">Writing for</p><p class="feature-text">${esc(o.writingFor)}</p></div>
       </div>` : ''}
       <div class="chain">
         ${chainStep(T.lensWith, T.onLensWith, GLYPH.problem, 'What they are stuck on', arrTxt(o.problems))}
         ${chainStep(T.lensTeach, T.onLensTeach, GLYPH.write, 'So you write about', arrTxt(o.writeAbout))}
         ${chainStep(T.lensFor, T.onLensFor, GLYPH.call, 'Which leads to a call', [o.toCalls])}
         ${chainStep(T.lensPublish, T.onLensPublish, GLYPH.offer, 'Where your offer fits', [o.offerFits])}
       </div>
       ${has(o.whySubscribe) ? `<div class="whycard">
         <span class="why-ico">${ico(GLYPH.heart, T.heading)}</span>
         <div><p class="label">Why anyone subscribes</p><p class="why-text">${esc(o.whySubscribe)}</p></div>
       </div>` : ''}

       ${has(w) ? `${sect('Your reader\u2019s world', 'Who you are writing to, in their own week.')}
         <div class="grid">
           ${mini('In a sentence', w.gist)}
           ${mini('Their week', w.week)}
           ${miniList('What they complain about', w.complaints)}
           ${miniList('What they put off', w.putOff)}
           ${miniList('What they notice', w.notice)}
         </div>` : ''}

       ${has(sub.voice) ? `${sect('Your voice')}
         ${cardA(T.lensTeach, '', `<p class="lede">${esc(sub.voice.gist)}</p>${facts([['How you sound', sub.voice.profile], ['Words you use', arrTxt(sub.voice.words).join(', ')], ['Your point of view', sub.voice.pov]])}`)}` : ''}

       ${has(sub.series) ? `${sect('Your series', 'Recurring shapes, so you are never staring at a blank page.')}
         <div class="grid series-grid">${sub.series.map((x, i) => `<div class="card accented" style="--c:${WHEEL[i % 5]}">
           <p class="offer-name small">${esc(x.name)}</p>
           ${facts([['What it is', x.what], ['An example', x.example], ['Why it is yours', x.fromYou]])}</div>`).join('')}</div>` : ''}

       ${sect('Your first ten posts', 'In order. Tick one when it goes out.')}
       <div class="posts">${sub.pieces.map(post).join('')}</div>

       <div class="grid">
         ${has(sub.cadence) ? `<div class="card accented" style="--c:${T.lensPublish}"><p class="label">Your rhythm</p>${facts([['How often', sub.cadence.rhythm], ['Which day', sub.cadence.day], ['Start on', sub.cadence.start], ['First one out', sub.cadence.firstOut], ['Notes', sub.cadence.notes]])}</div>` : ''}
         ${has(sub.knownFor) ? `<div class="card accented" style="--c:${T.lensFor}"><p class="label">What you would be known for</p>${facts([['Your lane', sub.knownFor.lane], ['What you believe', sub.knownFor.belief], ['How it builds', sub.knownFor.howIssuesBuild]])}</div>` : ''}
         ${has(sub.branding) ? `<div class="card accented" style="--c:${T.lensWith}"><p class="label">Look and feel</p>${facts([['Direction', sub.branding.direction], ['Avoid', sub.branding.avoid]])}</div>` : ''}
       </div>

       ${actions('What you can ask for here', [
         `Change my Substack strategy: ${subWhose}`,
         `Change who I am writing for in my Substack: ${subWhose}`,
         `Write the briefs for all ten posts in my Substack: ${subWhose}`,
         `Keep my Substack focused on one offer: ${subWhose}`])}
       ${has(sub.names) ? `${sect('Names to choose from')}<div class="grid">${sub.names.map((nm) => card('', `<p class="offer-name small">${esc(nm.name)}</p><p class="meta">${esc(nm.why)}</p>`)).join('')}</div>` : ''}`)
  }

  function postBrief(keyIn, file) {
    if (!sub || !Object.keys(sub.briefs || {}).length) {
      return page('post.html', 'A post brief',
        hero({ title: 'A post brief',
          through: 'Everything you need to write one post.',
          read: 'A brief takes one of your ten posts and plans it properly: the angles, where it opens, the story beat by beat, and how it lands.' }),
        empty(sub ? 'No briefs written yet' : 'Your Substack comes first',
          sub ? 'Each of your ten posts can have one. Ask for the first and it appears here.'
            : 'Briefs are written for the posts in your Substack strategy.',
          sub ? 'Open your Substack and press Write this brief on any post.' : 'Build your Substack strategy first.',
          sub ? (txt(sub.pieces?.[0]?.headline)
            ? `Write the brief for post 1: ${txt(sub.pieces[0].headline)}`
            : 'Write the brief for post 1') : 'Build my Substack strategy',
          ['See your Substack', 'substack.html']))
    }
    const key = (keyIn === undefined || keyIn === null) ? Object.keys(sub.briefs || {})[0] : String(keyIn)
    const b = (sub.briefs || {})[key] || {}
    const p = sub.pieces[Number(key)] || {}
    // Which post this is, in the words they will paste into the chat
    const pn = Number(key) + 1
    const phl = txt(p.headline || b.title || '')
    const ptail = phl ? `: ${phl}` : ''
    return page(file || 'post.html', 'A post brief',
      hero({ eyebrow: `Post ${Number(key) + 1} of ${sub.pieces.length}`, title: b.title || p.headline,
        through: b.subtitle, read: b.hook,
        stats: [[esc(p.type || '—'), 'Type'], [(b.angles || []).length, 'Angles considered'], [esc(p.series || '—'), 'Series']] }),
      `${has(b.angles) ? `${sect('Angles considered', 'Every way this post could have opened, and the one to write.')}
         <div class="grid">${b.angles.map((a, i) => {
           const picked = isNum(b.pick) && Number(b.pick) === i
           return cardA(picked ? T.lensTeach : T.line, picked ? 'The one to write' : `Angle ${i + 1}`,
             `<p class="offer-name small">${esc(a.angle || a)}</p>${has(a.why) ? `<p class="meta">${esc(a.why)}</p>` : ''}`)
         }).join('')}</div>
         ${has(b.pick) && !isNum(b.pick) ? cardA(T.lensTeach, 'The one to write, and why', `<p class="lede">${esc(b.pick)}</p>`) : ''}` : ''}
       ${has(b.open) ? `${sect('How it opens')}${card('', facts([['Where you start', b.open.where], ['The detail to use', b.open.detail], ['What the reader pictures', b.open.imagined]]) + (has(b.open.lines) ? `<p class="label" style="margin-top:14px">Lines to write from</p>${list(b.open.lines)}` : ''))}` : ''}
       ${has(b.arc) ? `${sect('The story, beat by beat')}<div class="posts">${arr(b.arc).map((x, i) => `<div class="card accented" style="--c:${[T.lensFor, T.lensWith, T.lensTeach, T.lensPublish, T.lensPackage][i % 5]}"><div class="post-top"><span class="slot">${i + 1}</span><span class="person-name">${esc(x.beat)}</span></div>${facts([['On the page', x.onPage], ['What the reader feels', x.reader], ['Leads into', x.leadsInto]])}</div>`).join('')}</div>` : ''}
       ${has(b.yours) ? card('What makes it sound like you', facts([['Use', b.yours.use], ['Ask yourself', b.yours.question], ['Meanwhile', b.yours.meanwhile], ['Check', b.yours.check]])) : ''}
       ${has(b.land) ? card('How it lands', facts([['The takeaway', b.land.takeaway], ['The last line', b.land.line], ['What you ask of them', b.land.next], ['Why that', b.land.why]]), 'accent') : ''}
       ${actions('What you can ask for here', [
         `Write a fresh brief for post ${pn}${ptail}`, `Change the idea for post ${pn}${ptail}`,
         `Help me write post ${pn} now${ptail}`, `I have published post ${pn}${ptail}`])}
       <a class="link" href="substack.html">&larr; Back to all ten posts</a>`)
  }

  function updates() {
    const version = work.updatedWith || work.createdWith || '0.4.2'
    return page('updates.html', 'Updates',
      hero({ title: 'Updates',
        through: `You are on Uncapped ${version}.`,
        read: 'Updates bring new builders and fixes. They never change your work.' }),
      `<div class="empty">
        <span class="empty-ico">${ico(GLYPH.tick, T.heading)}</span>
        <h2>Uncapped ${esc(version)}</h2>
        <p class="empty-why">This is the version you are running. If there is a newer one, Claude will tell you and offer to install it.</p>
        <div class="bigwrap">
          ${sayChip('Check for a new version of Uncapped', { big: true })}
          <p class="bignote">Click it to copy, then paste it into the chat. If there is a newer version, Claude backs your work up first, then installs it. Start a new chat afterwards to use it.</p>
        </div>
      </div>
      ${cardA(T.lensFor, 'Your work', `<p class="lede">Everything you build is saved in your own folder, on your computer. Claude backs it up before any update, and you can ask for a backup whenever you like.</p>
        <div class="say-row" style="margin-top:14px">
          ${sayChip('Back up my work now')}
          ${sayChip('Show me my work folder')}
        </div>`)}`)
  }

  function help() {
    const kind = (bg, ink, glyph, title, what, say) => `
      <div class="chain-step" style="--c:${bg}">
        <span class="chain-ico">${ico(glyph, ink)}</span>
        <p class="label">${esc(title)}</p>
        <p class="chain-text">${esc(what)}</p>
        <div style="margin-top:12px">${sayChip(say)}</div>
      </div>`
    return page('help.html', 'Help',
      hero({ title: 'Help', through: 'Stuck, confused, or something is broken?',
        read: 'Change how these pages look, see what the colours mean, or send Gabriela a report. She reads every one.' }),
      `${sect('Light or dark', 'Whichever is easier on your eyes. These pages remember your choice.')}
       ${cardA(T.lensPackage, '', `<div class="themepick">
          <button class="themebtn" data-local="switches these pages to light" data-theme-set="light">Light</button>
          <button class="themebtn" data-local="switches these pages to dark" data-theme-set="dark">Dark</button>
          <span class="meta" id="themenow"></span>
        </div>`)}

       ${sect('What the colours mean')}
       <div class="chain">
         ${chainStep(T.nextBg, T.heading, GLYPH.flag, 'Yellow', ['Your next move.'])}
         ${chainStep(T.decideBg, T.heading, GLYPH.problem, 'Pink', ['Needs a decision from you.'])}
         ${chainStep(T.workingBg, T.heading, GLYPH.clock, 'Blue', ['Claude is working.'])}
         ${chainStep(T.doneBg, T.heading, GLYPH.tick, 'Green', ['Done.'])}
       </div>

       ${sect('Send Gabriela a report', 'Take a screenshot first. It is the most useful thing you can send.')}
       ${cardA(T.lensTeach, 'Taking a screenshot', `<p><strong>On a Mac:</strong> hold <strong>Shift + Command + 4</strong> and drag over the part of the screen you want. The picture lands on your desktop.</p>
         <p><strong>On Windows:</strong> hold <strong>Windows key + Shift + S</strong> and drag. The picture is copied, ready to paste into the email.</p>`)}

       <div class="chain">
         ${kind(T.lensFor, T.onLensFor, GLYPH.problem, 'Something is broken', 'A page that will not open, a button that does nothing, a result that came back wrong.', 'Something is broken in Uncapped. Write me a report for Gabriela.')}
         ${kind(T.lensWith, T.onLensWith, GLYPH.voice, 'I am confused', 'Wording that did not make sense, or a step you could not work out.', 'I am confused by something in Uncapped. Write me a report for Gabriela.')}
         ${kind(T.lensTeach, T.onLensTeach, GLYPH.star, 'I have an idea', 'Something you wish Uncapped did, or did differently.', 'I have an idea for Uncapped. Write me a report for Gabriela.')}
       </div>

       ${card('', `${facts([
          ['What goes in it', 'Where you were, what you expected, what happened instead, and which version you are on.'],
          ['What stays out', 'Your Discover answers and everything in your work folder. Only what is needed to fix it.'],
          ['Where to send it', EMAIL],
        ])}
        <p class="meta" style="margin-top:14px">Claude writes the report in the chat and gives you the address. Add anything else, attach your screenshot, and send it from your own email. Nothing is sent for you.</p>`, 'accent')}`)
  }

  function portfolio() {
    const space = work.spaces[0] || {}
    return page('portfolio.html', 'Your portfolio',
      hero({ title: 'Your portfolio', through: g.throughLine,
        read: 'Your offers, grouped by the kind of buyer they are for. Each group gets its own Substack.',
        stats: [[work.offers.length, 'Offers'], [work.spaces.length, 'Spaces'], [ideas.length, 'Ideas waiting']] }),
      `${sect(space.name || 'Your space')}
       ${card('', `<p class="offer-name">${esc(offer.name)}</p>${facts([['For', offer.buyer], ['Price', `$${offer.priceLow} to $${offer.priceHigh} ${offer.priceUnit || ''}`], ['Status', offer.status]])}
          <a class="link" href="offer.html">Open it &rarr;</a>`)}
       ${sect('Not yet chosen', 'Everything else in your garden is still here when you want it.')}
       <div class="grid">${ideas.slice(0, 6).map((it) => { const l = lensOf(it.lens)
         return `<div class="card" style="border-top:4px solid ${l.bg}"><p class="label">${esc(l.short)}</p><p class="offer-name small">${esc(it.name)}</p><p class="meta">${esc(it.buyer)}</p>${it.price ? `<p class="price-line">${esc(it.price)}</p>` : ''}</div>` }).join('')}</div>`)
  }

  function map() {
    const { STEPS, PHASES } = { STEPS: null, PHASES: null }
    const live = LIVE_STEPS.map((s) => s.id)
    const all = ['discover', 'offer', 'brand', 'sales', 'substack', 'linkedin', 'content', 'website', 'delivery', 'operations']
    const name = { discover: 'Discover', offer: 'Your offer', brand: 'Your brand', sales: 'First 10 Customers', substack: 'Substack', linkedin: 'LinkedIn', content: 'Content', website: 'Website', delivery: 'Delivery', operations: 'Operations' }
    return page('map.html', 'Your map',
      hero({ title: 'Your map', read: 'Everything Uncapped builds with you. Four are open now; the rest are coming, and you get them in the price you already paid.',
        stats: [[live.length, 'Open now'], [all.length - live.length, 'Coming'], [all.length, 'Builders in all']] }),
      `<div class="grid">${all.map((id) => {
        const on = live.includes(id)
        const st = LIVE_STEPS.find((s) => s.id === id)
        const mc = on ? [T.lensFor, T.lensWith, T.lensTeach, T.lensPublish][(st.pos - 1) % 4] : T.disabled
        return `<div class="card map-card accented${on ? '' : ' soon'}" style="--c:${mc}">
          <p class="label">${on ? `Step ${st.pos} &middot; ${esc(st.phase)}` : 'Coming'}</p>
          <p class="offer-name small">${esc(name[id])}</p>
          ${on ? `<p class="meta">${esc(st.promise)}</p><a class="link" href="${['discover.html', 'offer.html', 'first10.html', 'substack.html'][st.pos - 1] || '#'}">Open &rarr;</a>` : '<p class="meta">Included in what you paid.</p>'}</div>`
      }).join('')}</div>`)
  }

  // ---------------------------------------------------------------- styles
  const css = `
  @font-face{font-family:Fraunces;src:url(fraunces-800i-latin.woff2) format('woff2');font-weight:800;font-style:italic;font-display:swap}
  @font-face{font-family:Cormorant;src:url(cormorant-600-latin.woff2) format('woff2');font-weight:600;font-display:swap}
  @font-face{font-family:Cormorant;src:url(cormorant-500i-v2.woff2) format('woff2');font-weight:500;font-style:italic;font-display:swap}
  @font-face{font-family:Caveat;src:url(caveat-500-latin.woff2) format('woff2');font-weight:500;font-display:swap}
  :root{
    ${Object.keys(V).map((k) => `--v-${k}:${V[k]};`).join('')}
    --butter:${C.butter};--pink:${C.pink};
    --bg:var(--v-bg);--surface:var(--v-surface);--ink:var(--v-body);--head:var(--v-heading);
    --meta:var(--v-meta);--line:var(--v-line);--inset:var(--v-inset);--accent:var(--v-accent);
    --espresso:var(--v-heading);
    --ease:cubic-bezier(.16,1,.3,1);--mono:ui-monospace,"SF Mono",Menlo,monospace;
    --rail:var(--v-heading);--rail-ink:var(--v-bg);
  }
  :root[data-theme="dark"]{
    ${Object.keys(VD).map((k) => `--v-${k}:${VD[k]};`).join('')}
    --butter:${C.butter};--pink:${C.pink};
    --rail:#160F0D;--rail-ink:${VD.heading};
  }
  :root[data-theme="dark"] .hero{color:var(--v-heading)}
  :root[data-theme="dark"] .bigwrap .bigbtn{background:var(--butter);color:#1F1815}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-size:16px;line-height:1.55;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
  a{color:inherit}
  .shell{display:flex;min-height:100vh}
  .rail{width:248px;flex:0 0 248px;background:var(--rail);color:var(--rail-ink);padding:28px 20px;
    position:sticky;top:0;height:100vh;display:flex;flex-direction:column}
  .wordmark{font-family:Fraunces,Georgia,serif;font-style:italic;font-weight:800;font-size:22px;
    color:var(--butter);margin:0 0 30px}
  .wordmark a{text-decoration:none}
  .nav-item{display:block;padding:9px 13px;border-radius:10px;text-decoration:none;font-size:14px;
    color:rgba(247,245,237,.82);transition:all .25s var(--ease)}
  .nav-item:hover{background:rgba(247,245,237,.09);color:#fff}
  .nav-item.here{background:var(--butter);color:var(--espresso);font-weight:650}
  .rail-foot{margin-top:auto;font-size:12px;color:rgba(247,245,237,.6);line-height:1.5}
  .rail-foot span{font-family:var(--mono);font-size:11.5px;letter-spacing:.06em}
  main{flex:1;min-width:0}
  .hero{background:var(--rail);color:var(--rail-ink)}
  .hero-in{max-width:1380px;margin:0 auto;padding:48px clamp(24px,4vw,64px) 52px}
  .hero-eyebrow{font-family:var(--mono);font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;
    color:var(--butter);margin:0 0 14px}
  .hero h1{font-family:Cormorant,Georgia,serif;font-weight:600;font-size:clamp(38px,5.2vw,64px);
    line-height:1.02;letter-spacing:-.02em;margin:0 0 16px;max-width:17ch}
  .through{font-family:Caveat,cursive;font-size:clamp(23px,2.8vw,31px);line-height:1.3;
    color:var(--butter);margin:0 0 18px;max-width:30ch}
  .read{font-size:16.5px;max-width:58ch;margin:0;opacity:.88}
  .stats{display:flex;gap:26px;flex-wrap:wrap;margin-top:30px;padding-top:22px;border-top:1px solid rgba(247,245,237,.18)}
  .stat b{display:block;font-family:Cormorant,Georgia,serif;font-weight:600;font-size:32px;line-height:1;color:var(--butter)}
  .stat span{font-family:var(--mono);font-size:11.5px;letter-spacing:.13em;text-transform:uppercase;color:rgba(247,245,237,.72)}
  .wrap{max-width:1380px;margin:0 auto;padding:44px clamp(24px,4vw,64px) 96px}
  h2.section{font-family:Cormorant,Georgia,serif;font-weight:600;font-size:32px;color:var(--head);
    margin:42px 0 6px;letter-spacing:-.01em}
  .section-note{color:var(--meta);margin:0 0 18px;font-size:14.5px;max-width:76ch}
  .label{font-family:var(--mono);font-size:11.5px;font-weight:700;letter-spacing:.11em;
    text-transform:uppercase;color:var(--head);margin:0 0 9px}
  .card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:20px 22px;margin-bottom:14px}
  .card.accent{background:var(--v-nextBg);border-color:var(--v-nextBorder)}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:14px}
  .grid .card{margin-bottom:0}
  .grid{margin-bottom:16px}
  .grid+.card,.grid+.posts,.grid+.people{margin-top:18px}
  .card,.dir-body,.next-move{container-type:inline-size}
  .facts{margin:0;display:grid;gap:12px}
  .facts>div{display:grid;grid-template-columns:1fr;gap:3px;align-items:baseline}
  @container (min-width:460px){.facts>div{grid-template-columns:170px 1fr;gap:16px}.facts{gap:10px}}
  .facts dt{font-family:var(--mono);font-size:11.5px;font-weight:700;letter-spacing:.1em;
    text-transform:uppercase;color:var(--head)}
  .facts dd{margin:0;font-size:15px;max-width:78ch}
  .plain{margin:0;padding-left:18px}.plain li{margin-bottom:6px;font-size:15px}
  .lede{font-size:16.5px;margin:0 0 6px}
  .meta{color:var(--meta);font-size:13.5px;margin:0}
  blockquote{margin:8px 0 0;padding:12px 16px;background:var(--inset);border-radius:10px;
    font-size:15px;border-left:3px solid var(--accent)}
  details{margin-top:10px}
  summary{cursor:pointer;font-size:13px;font-weight:650;color:var(--accent);list-style:none}
  summary::-webkit-details-marker{display:none}
  summary::before{content:"+ ";font-family:var(--mono)}
  details[open] summary::before{content:"\\2212 "}
  details p{font-size:14.5px;margin:8px 0 0}
  .btn{display:inline-block;margin-top:14px;background:var(--rail);color:var(--rail-ink);
    text-decoration:none;font-size:14px;font-weight:650;padding:11px 18px;border-radius:999px;
    transition:transform .3s var(--ease),box-shadow .3s var(--ease)}
  .btn:hover{transform:translateY(-2px);box-shadow:0 12px 24px -14px rgba(31,24,21,.8)}
  .link{display:inline-block;margin-top:12px;color:var(--accent);text-decoration:none;font-size:13.5px;font-weight:650}
  .link:hover{text-decoration:underline}
  .next-move{background:var(--v-nextBg);border:1px solid var(--v-nextBorder);border-radius:18px;padding:24px 26px;margin:28px 0 0}
  .next-move h2{font-family:Cormorant,Georgia,serif;font-weight:600;font-size:28px;color:var(--head);margin:0 0 8px}
  .next-move p{margin:0;max-width:60ch}
  .offer-name{font-family:Cormorant,Georgia,serif;font-weight:600;font-size:25px;color:var(--head);margin:0 0 12px;line-height:1.2}
  .offer-name.small{font-size:19px;margin-bottom:6px}
  .price-line{font-family:Cormorant,Georgia,serif;font-weight:600;font-size:19px;color:var(--head);margin:8px 0 0}
  .path{display:flex;flex-direction:column;gap:8px}
  .path-step{display:flex;gap:14px;align-items:center;background:var(--surface);border:1px solid var(--line);
    border-radius:14px;padding:14px 18px;text-decoration:none;transition:all .25s var(--ease)}
  .path-step:hover{transform:translateX(3px);border-color:var(--c,var(--accent))}
  .path-num{font-family:Cormorant,Georgia,serif;font-size:22px;font-weight:600;color:var(--head);
    width:32px;height:32px;border-radius:999px;background:var(--inset);display:grid;place-items:center;flex:0 0 auto}
  .path-text{flex:1}.path-text b{display:block;color:var(--head);font-size:15.5px}
  .path-text span{font-size:13.5px;color:var(--meta)}
  .path-state{font-family:var(--mono);font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--meta)}
  .path-step.done .path-state{color:var(--v-doneBorder)}
  .theme-sum{font-size:15px;margin:0;color:var(--head);font-weight:600}
  .card p,.card blockquote{max-width:82ch}
  /* garden */
  .bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:16px 0 4px;position:sticky;top:0;background:var(--bg);z-index:4}
  .bar-label{font-family:var(--mono);font-size:11.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--meta)}
  .filter{font:inherit;font-size:12.5px;font-weight:650;cursor:pointer;border:1px solid var(--line);
    background:var(--surface);color:var(--head);padding:7px 14px;border-radius:999px;transition:all .25s var(--ease)}
  .filter:hover{transform:translateY(-1px)}
  .filter[aria-pressed="true"]{background:var(--head);color:var(--bg);border-color:var(--head)}
  .filter.lens[aria-pressed="true"]{background:var(--c);color:var(--ci);border-color:transparent}
  .count{margin-left:auto;font-family:var(--mono);font-size:11px;color:var(--meta)}
  .tile{all:unset;box-sizing:border-box;cursor:pointer;display:flex;flex-direction:column;background:var(--surface);
    border:1px solid var(--line);border-radius:16px;padding:18px 20px 16px;position:relative;overflow:hidden;
    transition:transform .35s var(--ease),box-shadow .35s var(--ease)}
  .tile::before{content:"";position:absolute;inset:0 0 auto 0;height:5px;background:var(--c)}
  .tile:hover{transform:translateY(-4px);box-shadow:0 18px 36px -22px rgba(31,24,21,.6)}
  .tile-top{display:flex;align-items:center;gap:8px;margin:6px 0 12px}
  .ico{width:26px;height:26px;border-radius:8px;background:var(--c);display:grid;place-items:center;flex:0 0 auto}
  .ico svg{width:15px;height:15px}
  .lens{font-family:var(--mono);font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--meta)}
  .price{margin-left:auto;font-family:Cormorant,Georgia,serif;font-weight:600;font-size:19px;color:var(--head)}
  .tile-name{font-size:16px;font-weight:650;line-height:1.3;color:var(--head);margin-bottom:8px}
  .tile-buyer{font-size:13px;color:var(--meta);margin-bottom:10px}
  .tile-how{font-size:14px;margin-bottom:14px}
  .tile-go{margin-top:auto;font-size:12.5px;font-weight:650;color:var(--accent);opacity:0;transform:translateX(-4px);transition:all .3s var(--ease)}
  .tile:hover .tile-go{opacity:1;transform:none}
  .tile[hidden]{display:none}
  .dir{background:var(--surface);border:1px solid var(--line);border-radius:18px;margin-bottom:12px;overflow:hidden;position:relative}
  .dir::before{content:"";position:absolute;inset:0 auto 0 0;width:6px;background:var(--c)}
  .dir-head{all:unset;box-sizing:border-box;cursor:pointer;display:flex;gap:16px;align-items:flex-start;
    width:100%;padding:22px 24px 22px 30px;transition:background .25s var(--ease)}
  .dir-head:hover{background:var(--inset)}
  .dir-num{flex:0 0 auto;width:32px;height:32px;border-radius:999px;background:var(--inset);color:var(--head);
    font-family:Cormorant,Georgia,serif;font-weight:600;font-size:18px;display:grid;place-items:center;margin-top:2px}
  .dir-head-text{display:flex;flex-direction:column;gap:7px;flex:1}
  .eyebrow{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-family:var(--mono);font-size:11.5px;
    letter-spacing:.1em;text-transform:uppercase;color:var(--meta)}
  .pill{padding:3px 9px;border-radius:999px;font-weight:700}
  .dot{opacity:.5}
  .dir-title{font-family:Cormorant,Georgia,serif;font-weight:600;font-size:clamp(22px,2.5vw,28px);
    line-height:1.18;color:var(--head);letter-spacing:-.01em}
  .chev{flex:0 0 auto;width:10px;height:10px;margin-top:13px;border-right:2px solid var(--meta);
    border-bottom:2px solid var(--meta);transform:rotate(45deg);transition:transform .3s var(--ease)}
  .dir-head[aria-expanded="true"] .chev{transform:rotate(225deg)}
  .dir-body{padding:0 30px 24px}
  /* the ideas inside a direction: one row each, opened in place */
  .sub{font-family:Cormorant,Georgia,serif;font-weight:600;font-size:21px;color:var(--head);margin:26px 0 4px;letter-spacing:-.01em}
  .ideas{display:flex;flex-direction:column;gap:8px}
  .idea{background:var(--inset);border:1px solid var(--line);border-radius:14px;overflow:hidden;scroll-margin-top:94px}
  .idea.yours{border-color:var(--accent)}
  .idea-head{all:unset;box-sizing:border-box;cursor:pointer;display:flex;gap:12px;align-items:center;
    width:100%;padding:14px 16px;transition:background .25s var(--ease)}
  .idea-head:hover{background:var(--surface)}
  .idea-head-text{display:flex;flex-direction:column;gap:4px;flex:1;min-width:0}
  .idea-name{font-size:15.5px;font-weight:650;line-height:1.3;color:var(--head)}
  .idea-meta{font-family:var(--mono);font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--meta)}
  .idea-head .chev{margin-top:0}
  .idea-head[aria-expanded="true"] .chev{transform:rotate(225deg)}
  .idea-body{padding:2px 16px 16px}
  .idea-body .facts{margin-bottom:12px}
  .two{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}
  .two .card{margin-bottom:14px}
  /* people + posts */
  .people,.posts{display:grid;grid-template-columns:1fr;gap:12px}
  @media (min-width:1180px){.people,.posts{grid-template-columns:1fr 1fr}}
  .person-top,.post-top{display:flex;align-items:center;gap:9px;margin-bottom:12px;flex-wrap:wrap}
  .slot{width:28px;height:28px;border-radius:999px;background:var(--rail);color:var(--rail-ink);
    font-family:var(--mono);font-size:12px;display:grid;place-items:center;flex:0 0 auto}
  .person-name{font-family:Cormorant,Georgia,serif;font-weight:600;font-size:21px;color:var(--head)}
  .tag{font-family:var(--mono);font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;
    padding:4px 9px;border-radius:999px;background:var(--butter);color:#1F1815;font-weight:700}
  .tag.quiet{background:var(--inset);color:var(--meta)}
  .tag.done{background:var(--v-doneBg);color:var(--v-heading)}
  .post h3{font-family:Cormorant,Georgia,serif;font-weight:600;font-size:23px;color:var(--head);
    margin:0 0 12px;line-height:1.25}
  .map-card.soon{opacity:.62;background:var(--inset)}
  .empty{background:var(--surface);border:1px solid var(--line);border-radius:18px;
    padding:34px 32px;margin-bottom:18px;position:relative;overflow:hidden}
  .empty::before{content:"";position:absolute;inset:0 auto 0 0;width:6px;background:${C.butter}}
  .empty-ico{width:46px;height:46px;border-radius:999px;background:${C.butter};display:grid;
    place-items:center;margin-bottom:16px}
  .empty-ico svg{width:23px;height:23px}
  .empty h2{font-family:Cormorant,Georgia,serif;font-weight:600;font-size:32px;color:var(--head);
    margin:0 0 10px;letter-spacing:-.01em}
  .empty-why{font-size:16.5px;margin:0 0 14px;max-width:62ch}
  .empty-first{background:var(--inset);border-radius:12px;padding:14px 16px;margin:0 0 22px;max-width:66ch;font-size:15px}
  /* words to say, not a thing to press: no shadow, no hover, a quote mark */
  .say-chip{display:inline-block;font:inherit;font-size:14px;font-weight:600;background:var(--surface);
    border:1px solid var(--line);border-left:4px solid var(--butter);border-radius:0 11px 11px 0;
    padding:9px 15px 9px 13px;margin:0 8px 8px 0;color:var(--head);max-width:min(62ch,100%);
    vertical-align:middle;cursor:pointer;user-select:all;
    transition:transform .2s var(--ease),box-shadow .2s var(--ease),border-color .2s var(--ease)}
  .say-chip:hover{transform:translateY(-1px);border-color:var(--butter);
    box-shadow:0 8px 18px -12px rgba(31,24,21,.5)}
  .say-chip.done{background:var(--v-doneBg);border-left-color:var(--v-doneBorder)}
  .say-chip::before{content:"“";color:var(--meta);margin-right:5px;font-size:1.15em;line-height:0}
  .say-chip::after{content:"”";color:var(--meta);margin-left:4px;font-size:1.15em;line-height:0}
  .say-chip.big{font-family:Cormorant,Georgia,serif;font-weight:600;font-size:26px;letter-spacing:-.01em;
    padding:16px 26px;border-left-width:7px;border-radius:0 16px 16px 0;white-space:normal;display:block;
    max-width:44ch;margin-bottom:4px}
  .bigwrap{margin:0 0 6px}
  .bigwrap .bigbtn{font-family:Cormorant,Georgia,serif;font-weight:600;font-size:27px;letter-spacing:-.01em;
    background:var(--rail);color:var(--rail-ink);border:0;border-radius:16px;padding:18px 34px;cursor:pointer;
    transition:transform .3s var(--ease),box-shadow .3s var(--ease)}
  .bigwrap .bigbtn:hover{transform:translateY(-2px);box-shadow:0 18px 34px -18px rgba(31,24,21,.8)}
  .bigwrap .bigbtn.waiting{background:var(--espresso);color:var(--v-bg)}
  .bigwrap .bigbtn.took{background:var(--v-doneBg);color:var(--head)}
  .bigwrap .bigbtn.ready{background:${C.butter};color:var(--espresso)}
  .bignote{font-size:14px;color:var(--meta);margin:14px 0 0;max-width:58ch}
  .alsoask{font-size:13px;color:var(--meta);margin:0 0 8px}
  .alsoask .chip-btn.small{font-size:12px;padding:5px 11px;margin-left:5px}
  .themepick{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .themebtn{font:inherit;font-family:Cormorant,Georgia,serif;font-weight:600;font-size:22px;cursor:pointer;
    border:1px solid var(--line);background:var(--bg);color:var(--head);padding:12px 30px;border-radius:14px;
    transition:all .25s var(--ease)}
  .themebtn:hover{transform:translateY(-1px)}
  .themebtn[aria-pressed="true"]{background:var(--butter);color:#1F1815;border-color:transparent;box-shadow:0 10px 22px -14px rgba(0,0,0,.6)}
  .empty-first .label{display:inline;margin-right:8px}
  .signpost{display:flex;gap:18px;align-items:center;flex-wrap:wrap;background:var(--inset);
    border-radius:16px;padding:20px 24px;margin-top:26px}
  .signpost .btn{margin-top:0;margin-left:auto}
  .signpost-title{font-family:Cormorant,Georgia,serif;font-weight:600;font-size:24px;color:var(--head);margin:0}
  .signpost.locked{opacity:.8}
  .guide{background:var(--surface);border:1px solid var(--line);border-radius:18px;overflow:hidden;margin-bottom:16px}
  .guide-head{display:flex;align-items:center;gap:14px;background:var(--c);padding:16px 22px}
  .guide-ico{width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.55);display:grid;place-items:center;flex:0 0 auto}
  .guide-ico svg{width:19px;height:19px}
  .guide-title{font-family:Cormorant,Georgia,serif;font-weight:600;font-size:26px;margin:0;color:var(--ci,var(--head));letter-spacing:-.01em}
  .guide-body{padding:22px}
  .ask{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:14px;padding-top:14px;border-top:1px dashed var(--line)}
  .actions{background:var(--inset);border-radius:16px;padding:20px 22px;margin:22px 0 8px}
  .actions .say-row{margin-bottom:8px}
  .actions .meta{font-size:12.5px;margin:0}
  .ask .meta{font-size:12.5px}
  .feature{display:flex;gap:20px;align-items:flex-start;background:var(--surface);
    border:1px solid var(--line);border-radius:18px;padding:26px 28px;margin-bottom:20px;
    position:relative;overflow:hidden}
  .feature::before{content:"";position:absolute;inset:0 auto 0 0;width:6px;background:var(--c)}
  .feature-ico{flex:0 0 auto;width:54px;height:54px;border-radius:999px;background:var(--c);
    display:grid;place-items:center;margin-left:6px}
  .feature-ico svg{width:27px;height:27px}
  .feature-text{font-family:Cormorant,Georgia,serif;font-size:25px;line-height:1.35;color:var(--head);
    margin:0;max-width:52ch;font-weight:600}
  .chain{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px;margin-bottom:20px;
    position:relative}
  .chain-step{background:var(--surface);border:1px solid var(--line);border-radius:16px;
    padding:22px 20px 20px;position:relative;transition:transform .35s var(--ease),box-shadow .35s var(--ease)}
  .chain-step:hover{transform:translateY(-3px);box-shadow:0 16px 32px -22px rgba(31,24,21,.5)}
  .chain-ico{width:40px;height:40px;border-radius:12px;background:var(--c);display:grid;place-items:center;margin-bottom:14px}
  .chain-ico svg{width:21px;height:21px}
  .chain-text{margin:0;font-size:14.5px}
  .chain-step .plain{padding-left:16px}
  .chain-step .plain li{font-size:14px;margin-bottom:7px}
  @media (min-width:1080px){
    .chain-step:not(:last-child)::after{content:"";position:absolute;right:-11px;top:40px;width:8px;height:8px;
      border-right:2px solid var(--line);border-top:2px solid var(--line);transform:rotate(45deg);z-index:1}
  }
  .whycard{display:flex;gap:18px;align-items:flex-start;background:var(--v-nextBg);
    border:1px solid var(--v-nextBorder);border-radius:18px;padding:24px 26px;margin-bottom:8px}
  .why-ico{flex:0 0 auto;width:42px;height:42px;border-radius:999px;background:${C.butter};
    display:grid;place-items:center}
  .why-ico svg{width:22px;height:22px}
  .why-text{font-family:Cormorant,Georgia,serif;font-size:22px;line-height:1.4;color:var(--head);margin:0;max-width:56ch;font-weight:600}
  .accordion{display:flex;flex-direction:column;gap:9px}
  .fold{background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden;position:relative}
  .fold::before{content:"";position:absolute;inset:0 auto 0 0;width:5px;background:var(--c)}
  .fold summary{display:flex;align-items:center;gap:14px;padding:16px 20px 16px 26px;cursor:pointer;
    list-style:none;transition:background .25s var(--ease)}
  .fold summary::-webkit-details-marker{display:none}
  .fold summary::before{content:none}
  .fold summary:hover{background:var(--inset)}
  .fold-title{font-family:Cormorant,Georgia,serif;font-weight:600;font-size:21px;color:var(--head);flex:1}
  .fold-when{font-family:var(--mono);font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--meta);text-align:right}
  .fold-chev{flex:0 0 auto;width:9px;height:9px;border-right:2px solid var(--meta);border-bottom:2px solid var(--meta);
    transform:rotate(45deg);transition:transform .3s var(--ease)}
  .fold[open] .fold-chev{transform:rotate(225deg)}
  .fold-body{padding:0 20px 20px 26px}
  .card.accented{position:relative;overflow:hidden;padding-top:24px}
  .card.accented::before{content:"";position:absolute;inset:0 0 auto 0;height:5px;background:var(--c)}
  .grid .card.accented,.people .card.accented,.posts .card.accented{transition:transform .35s var(--ease),box-shadow .35s var(--ease)}
  .grid .card.accented:hover,.people .card.accented:hover,.posts .card.accented:hover{transform:translateY(-3px);box-shadow:0 16px 32px -22px rgba(31,24,21,.55)}
  .chiprow{display:inline-flex;align-items:center;gap:8px;margin-bottom:10px}
  .bigprice{font-family:Cormorant,Georgia,serif;font-weight:600;font-size:42px;line-height:1;color:var(--head);white-space:nowrap}
  .bigprice span{font-family:var(--mono);font-size:11.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--meta);display:block;margin-top:8px;white-space:normal}
  .offer-hero{display:grid;grid-template-columns:1fr;gap:18px}
  @container (min-width:620px){.offer-hero{grid-template-columns:1fr auto;align-items:start}}
  .card.mini p:not(.label){margin:0;font-size:15px}
  .card.mini .plain{margin-top:2px}
  .series-grid{grid-template-columns:repeat(auto-fill,minmax(340px,1fr))}
  .tick{display:inline-flex;align-items:center;gap:7px;cursor:pointer;user-select:none;margin-right:4px}
  .tick input{position:absolute;opacity:0;width:0;height:0}
  .tick .box{width:19px;height:19px;border-radius:6px;border:1.5px solid var(--line);
    background:var(--bg);display:grid;place-items:center;transition:all .22s var(--ease)}
  .tick .box::after{content:"";width:9px;height:5px;border-left:2px solid var(--espresso);
    border-bottom:2px solid var(--espresso);transform:rotate(-45deg) scale(.4);opacity:0;transition:all .22s var(--ease);margin-top:-2px}
  .tick:hover .box{border-color:var(--accent)}
  .tick input:focus-visible+.box{outline:2px solid var(--accent);outline-offset:2px}
  .tick input:checked+.box{background:var(--butter);border-color:transparent}
  .tick input:checked+.box::after{opacity:1;transform:rotate(-45deg) scale(1)}
  .tick-word{font-family:var(--mono);font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--meta)}
  .tick input:checked~.tick-word{color:var(--head);font-weight:700}
  .post.done{background:var(--v-doneBg)}
  .post.done h3{opacity:.72}
  .sentbar{position:sticky;top:0;z-index:21;background:var(--rail);color:var(--rail-ink);
    padding:10px 18px;font-family:var(--mono);font-size:11px;letter-spacing:.05em;
    display:flex;align-items:center;gap:10px}
  .sentbar.done{background:var(--v-doneBg);color:var(--head)}
  .sent-dot{width:8px;height:8px;border-radius:999px;background:${C.butter};flex:0 0 auto;
    animation:pulse 1.4s ease-in-out infinite}
  .sentbar.done .sent-dot{background:var(--v-doneBorder);animation:none}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
  @media (prefers-reduced-motion:reduce){.sent-dot{animation:none}}
  .sentbar.ready{background:${C.butter};color:var(--espresso)}
  .sentbar.ready .sent-dot{background:var(--espresso);animation:none}
  .sent-refresh{font:inherit;font-size:11.5px;letter-spacing:.06em;cursor:pointer;border:0;
    border-radius:999px;background:var(--espresso);color:var(--v-bg);padding:5px 13px;margin-left:auto;
    transition:transform .25s var(--ease)}
  .sent-refresh:hover{transform:translateY(-1px)}
  .chip-btn.ready{background:${C.butter};border-color:transparent;color:var(--espresso);font-weight:700}
  .chip-btn.waiting{background:var(--espresso);border-color:transparent;color:var(--v-bg)}
  .chip-btn.took{background:var(--v-doneBg);border-color:transparent;color:var(--head)}
  .freshbar{position:sticky;top:0;z-index:20;background:var(--inset);border-bottom:1px solid var(--line);
    padding:8px 18px;font-family:var(--mono);font-size:11.5px;letter-spacing:.06em;color:var(--meta);
    display:flex;align-items:center;gap:10px;transition:background .3s var(--ease)}
  .freshbar.stale{background:var(--v-nextBg);border-bottom-color:var(--v-nextBorder);color:var(--head)}
  .freshbar.stale .fresh-when{display:none}
  .freshbar.fresh-new{background:var(--v-doneBg);border-bottom-color:var(--v-doneBorder);color:var(--head)}
  .fresh-when b{color:var(--head);font-weight:600}
  .fresh-btn{font:inherit;font-size:11.5px;letter-spacing:.06em;cursor:pointer;border:0;border-radius:999px;
    background:var(--espresso);color:var(--bg);padding:5px 13px;margin-left:8px;transition:transform .25s var(--ease)}
  .fresh-btn:hover{transform:translateY(-1px)}
  .nav-item.home{font-size:15.5px;font-weight:700;padding:12px 11px;margin-bottom:4px}
  .foot-nav{margin-top:14px;padding-top:12px;border-top:1px solid rgba(247,245,237,.16);display:flex;flex-direction:column}
  .nav-item.quiet{font-size:13px;color:rgba(247,245,237,.62)}
  .nav-item.here,.nav-item.quiet.here{background:var(--butter);color:#1F1815;font-weight:650}
  .stops{display:flex;gap:0;list-style:none;margin:0 0 16px;padding:0;flex-wrap:wrap}
  .stops li{font-family:var(--mono);font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;
    color:var(--meta);background:var(--inset);padding:6px 13px 6px 18px;position:relative;clip-path:polygon(12px 0,100% 0,calc(100% - 7px) 50%,100% 100%,12px 100%,calc(12px + 7px) 50%)}
  .stops li:first-child{padding-left:13px;clip-path:polygon(0 0,100% 0,calc(100% - 7px) 50%,100% 100%,0 100%)}
  .stops li.past{background:var(--v-doneBg);color:var(--head)}
  .stops li.at{background:var(--rail);color:var(--rail-ink);font-weight:700}
  .msg{margin-top:14px}
  .copy,.chip-btn{font:inherit;cursor:pointer;border-radius:999px;transition:all .25s var(--ease)}
  .copy{margin-top:10px;font-size:13px;font-weight:650;background:var(--espresso);color:var(--bg);
    border:0;padding:9px 16px}
  .copy:hover{transform:translateY(-1px)}
  .copy.done{background:var(--v-doneBg);color:var(--head)}
  .say{margin-top:18px;padding-top:14px;border-top:1px dashed var(--line)}
  .say-row{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:9px}
  .chip-btn{font-size:12.5px;font-weight:600;background:var(--surface);border:1px solid var(--line);
    color:var(--head);padding:7px 13px}
  .chip-btn:hover{border-color:var(--accent);color:var(--accent)}
  .chip-btn.done{background:var(--butter);border-color:transparent;color:var(--espresso)}
  ol.plain{padding-left:20px}ol.plain li{margin-bottom:8px}
  @media (max-width:900px){.shell{flex-direction:column}.rail{width:auto;height:auto;position:static;flex-direction:row;
    flex-wrap:wrap;align-items:center;gap:6px;padding:14px 18px}.wordmark{margin:0 14px 0 0}.rail nav{display:flex;flex-wrap:wrap;gap:4px}
    .rail-foot{display:none}.hero-in,.wrap{padding-left:18px;padding-right:18px}.two,.facts>div{grid-template-columns:1fr}}
  @media (prefers-reduced-motion:reduce){*{transition:none!important}}
  `

  const js = `
  (function () {
    // Bring an opened idea into view with its own name first, clear of the bars
    // pinned to the top of the window. Their height is only knowable once they
    // are actually stuck and the fonts have settled - measured any earlier, the
    // name ends up hidden behind them - so jump, then measure, then correct.
    function pinnedBottom() {
      var bottom = 0;
      var bars = document.querySelectorAll('.freshbar, .bar');
      for (var i = 0; i < bars.length; i++) {
        var how = getComputedStyle(bars[i]).position;
        if (how !== 'sticky' && how !== 'fixed') continue;
        var r = bars[i].getBoundingClientRect();
        if (r.top <= 1 && r.bottom > bottom) bottom = r.bottom;
      }
      return bottom;
    }
    function showIdea(idea) {
      var head = idea.querySelector('.idea-head') || idea;
      // Only ever nudge DOWN a name the bars are covering, and only while it is
      // still close by: the browser does its own jump to a #idea- link after
      // this runs, and a late correction must never yank a page the reader has
      // since scrolled somewhere else.
      function settle() {
        var off = pinnedBottom() + 12 - head.getBoundingClientRect().top;
        if (off > 2 && off < 400) window.scrollBy(0, -off);
      }
      idea.scrollIntoView({ block: 'start' });
      settle();
      // again as the fonts land and the bars find their real height, and once
      // more after load, which is when the browser does its own jump to a
      // #idea- link and undoes everything done before it
      setTimeout(settle, 150);
      setTimeout(settle, 450);
      if (document.readyState !== 'complete') {
        window.addEventListener('load', function () { settle(); setTimeout(settle, 120); });
      } else {
        setTimeout(settle, 900);
      }
    }
    var tiles = [].slice.call(document.querySelectorAll('.tile'));
    var count = document.getElementById('count');
    if (tiles.length) {
      var lens = 'all';
      function apply() {
        var shown = 0;
        tiles.forEach(function (t) { var ok = lens === 'all' || t.dataset.lens === lens; t.hidden = !ok; if (ok) shown++; });
        if (count) count.textContent = shown + ' of ' + tiles.length + ' ideas';
      }
      document.querySelectorAll('[data-f="lens"]').forEach(function (b) {
        b.addEventListener('click', function () {
          lens = b.dataset.v;
          document.querySelectorAll('[data-f="lens"]').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
          apply();
        });
      });
      // Pressing an idea opens THAT idea, in the direction it grew from. It
      // used to scroll to the direction and stop, and a direction describes a
      // different offer, so the answer on screen was never the idea pressed.
      tiles.forEach(function (t) {
        t.addEventListener('click', function () {
          var sec = document.getElementById('dir-' + t.dataset.dir);
          if (!sec) return;
          var head = sec.querySelector('.dir-head');
          if (head && head.getAttribute('aria-expanded') !== 'true') head.click();
          var idea = t.dataset.idea ? document.getElementById('idea-' + t.dataset.idea) : null;
          if (!idea) { sec.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
          var ih = idea.querySelector('.idea-head');
          if (ih && ih.getAttribute('aria-expanded') !== 'true') ih.click();
          showIdea(idea);
        });
      });
      apply();
    }
    // Does the saved work still match what this page was grown from? Only a
    // served page can ask; opened straight from the folder, it stays quiet.
    window.__workNow = null;
    window.__workThen = null;
    // No watcher: these pages are files on this computer, with nothing to poll.
    // Uncapped rebuilds them whenever the work changes, so a refresh is current.

    (function posted() {
      var boxes = [].slice.call(document.querySelectorAll('input.posted'));
      if (!boxes.length) return;
      var countEl = document.getElementById('postedcount');
      var KEY = 'uncapped.posted';
      var done = {};
      try { done = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
      function paint() {
        var n = 0;
        boxes.forEach(function (b) {
          var on = !!done[b.dataset.post];
          b.checked = on;
          b.closest('.post').classList.toggle('done', on);
          if (on) n++;
        });
        if (countEl) countEl.textContent = n;
      }
      boxes.forEach(function (b) {
        b.addEventListener('change', function () {
          done[b.dataset.post] = b.checked;
          try { localStorage.setItem(KEY, JSON.stringify(done)); } catch (e) {}
          paint();
        });
      });
      paint();
    })();

    function flash(btn, word) {
      var old = btn.textContent;
      btn.textContent = word; btn.classList.add('done');
      setTimeout(function () { btn.textContent = old; btn.classList.remove('done'); }, 1600);
    }
    function copyText(text, onDone, onFail) {
      var done = false;
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, text.length);
        done = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (e) { done = false; }
      if (done) { onDone(); return; }
      // a secure context may still have the modern one; a file does not
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(onDone, onFail);
      } else { onFail(); }
    }

    document.querySelectorAll('.copy').forEach(function (b) {
      b.addEventListener('click', function () {
        var el = document.getElementById(b.dataset.copy);
        if (!el) return;
        copyText(el.textContent.trim(), function () { flash(b, 'Copied'); }, function () { flash(b, 'Select it and copy'); });
      });
    });

    // Every phrase is a button now: one click puts the words on the clipboard,
    // they paste it into the chat. No server can exist behind these pages, so
    // copy is the only press that can honestly do something.
    document.querySelectorAll('.say-chip').forEach(function (c) {
      c.addEventListener('click', function () {
        var text = c.dataset.say || c.textContent.replace(/[\u201c\u201d]/g, '').trim();
        copyText(text, function () { flash(c, 'Copied \u2014 paste it in the chat'); }, function () { flash(c, 'Select it and copy'); });
      });
    });
    // light or dark, chosen right here and remembered
    (function theme() {
      var btns = [].slice.call(document.querySelectorAll('[data-theme-set]'));
      var now = document.getElementById('themenow');
      function current() {
        try { return localStorage.getItem('uncapped.theme') || 'light'; } catch (e) { return 'light'; }
      }
      function apply(t) {
        document.documentElement.dataset.theme = t;
        try { localStorage.setItem('uncapped.theme', t); } catch (e) {}
        btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.themeSet === t)); });
        if (now) now.textContent = t === 'dark' ? 'Dark, on every page.' : 'Light, on every page.';
      }
      btns.forEach(function (b) { b.addEventListener('click', function () { apply(b.dataset.themeSet); }); });
      apply(current());
    })();

    // Nothing is sent from these pages. Each phrase is something to say in the
    // chat, which is also where it is answered.

    // Directions and the ideas inside them open the same way.
    document.querySelectorAll('.dir-head, .idea-head').forEach(function (h) {
      h.addEventListener('click', function () {
        var open = h.getAttribute('aria-expanded') === 'true';
        h.setAttribute('aria-expanded', String(!open));
        var body = document.getElementById(h.getAttribute('aria-controls'));
        if (body) body.hidden = open;
      });
    });
    var firstDir = document.querySelector('.dir-head');
    if (firstDir) firstDir.click();

    // A link to one idea (offer.html sends you to the one you chose) opens that
    // idea, not just the page it sits on. It is ?idea=, not #idea-, because a
    // fragment makes the browser scroll there itself, after everything here has
    // run, and it lands the idea's name underneath the bars pinned at the top.
    var asked = location.search.match(/[?&]idea=([^&]+)/);
    var wantKey = asked ? decodeURIComponent(asked[1])
      : location.hash.indexOf('#idea-') === 0 ? location.hash.slice(6) : '';
    if (wantKey) {
      var want = document.getElementById('idea-' + wantKey);
      if (want) {
        var holder = want.closest('.dir');
        var dh = holder && holder.querySelector('.dir-head');
        if (dh && dh.getAttribute('aria-expanded') !== 'true') dh.click();
        var wh = want.querySelector('.idea-head');
        if (wh && wh.getAttribute('aria-expanded') !== 'true') wh.click();
        showIdea(want);
      }
    }
  })();
  `

  const pages = { 'index.html': home(), 'discover.html': discover(), 'garden.html': garden(),
    'offer.html': offerPage(), 'first10.html': first10(), 'substack.html': substack(),
    'post.html': postBrief(), 'map.html': map(), 'updates.html': updates(), 'help.html': help() }

  // Every brief gets its own page. Before this, all ten posts shared post.html,
  // so opening post 6 showed post 1.
  for (const k of Object.keys(sub?.briefs || {})) {
    const file = `post-${Number(k) + 1}.html`
    pages[file] = postBrief(k, file)
  }

  // the fonts travel inside the stylesheet, because a plugin can write text and
  // not bytes, and a page opened from a file has nowhere else to fetch them from
  let styles = css
  for (const [file, b64] of Object.entries(fonts)) {
    styles = styles.split(`url(${file})`).join(`url(data:font/woff2;base64,${b64})`)
  }

  return { files: { ...pages, 'styles.css': styles, 'app.js': js }, unknown: [...unknownSays] }
}
