// Uncapped's visual language for the panel.
// Native elements (Text, Box, Button) take the colors below. Anything the
// native elements can't do (the Fraunces-style wordmark, tilted polaroids,
// hard offset shadows, stickers, the four-point star) is drawn as SVG, which
// the desktop app renders with the Mac's own fonts as stand-ins:
//   Cormorant Garamond -> Baskerville / Georgia
//   Caveat             -> Bradley Hand / Noteworthy
//   Fraunces italic    -> Georgia bold italic

export const C = {
  cream: '#F7F5ED',
  paper: '#EEEAE0',
  white: '#FFFFFF',
  espresso: '#2A1F1D',
  ink: '#1F1815',
  taupeInk: '#6B5F53',
  taupe: '#8F8273',
  taupeLight: '#BDB2A4',
  sand: '#E8E0D3',
  blue: '#2B3BFF',
  blueTint: '#E2E5FF',
  blueLight: '#DADDFF',
  pink: '#F4A6B8',
  pinkTint: '#FBDDE3',
  butter: '#FFD45C',
  butterTint: '#FFF3A8',
  green: '#1E7A4C',
  greenTint: '#DFF3E7',
  // hub design system 1.0
  hoverWhite: '#FBFAF5', // hover on white item cards
  hoverButter: '#FFEE8A', // hover on the Next move card
  line: '#D9D0C3', // hairline borders on item cards
}

// Spacing, in cells. Only these values: a label right above its value, inside
// a card or between list items, and between the slots of a screen.
export const S = { none: 0, tight: 1, section: 2 }

// The five ways to earn, from the lightest commitment to the deepest. Their
// colors appear only on lens chips, idea-card spines and the lens artwork.
export const LENS_ORDER = ['publish', 'package', 'teach', 'with', 'for']
export const LENS = {
  publish: { id: 'publish', name: 'Publish it', line: 'Write it once for many readers.', color: C.sand, text: C.espresso, border: C.espresso, does: 'Write it once', gets: 'Something to read and use on their own', time: 'Almost none per sale', price: 'Lowest' },
  package: { id: 'package', name: 'Package it', line: 'Make a tool once and they use it themselves.', color: C.espresso, text: C.cream, border: C.espresso, does: 'Make a tool once', gets: 'A tool to use on their own', time: 'Almost none per sale', price: 'Low' },
  teach: { id: 'teach', name: 'Teach them how', line: 'You teach a group and they do it themselves.', color: C.butter, text: C.espresso, border: C.espresso, does: 'Teach a group', gets: 'The skill, and a plan to apply it', time: 'A few hours per group', price: 'Low per seat, many seats' },
  with: { id: 'with', name: 'Do it with them', line: "You work side by side until it's done.", color: C.pink, text: C.espresso, border: C.espresso, does: 'Work side by side', gets: 'It done, and they learned how', time: 'Hours per client', price: 'Middle' },
  for: { id: 'for', name: 'Do it for them', line: 'You do it and hand it over finished.', color: C.blue, text: C.white, border: C.espresso, does: 'Do the work', gets: 'It done, handed over', time: 'The most', price: 'Highest' },
}

// The builders, in the order a portfolio career gets built, grouped in phases.
// Only live steps show; the number shown is the step's place among live steps.
export const PHASES = {
  find: { name: 'Find it', color: C.butter, text: C.espresso },
  shape: { name: 'Shape it', color: C.pink, text: C.espresso },
  sell: { name: 'Sell it', color: C.blue, text: C.white },
  show: { name: 'Show up', color: C.sand, text: C.espresso },
  run: { name: 'Run it', color: C.paper, text: C.espresso },
}
export const STEPS = [
  { id: 'discover', n: 1, name: 'Discover', phase: 'find', promise: 'what you could get paid for', live: true },
  { id: 'offer', n: 2, name: 'Your offer', phase: 'find', promise: 'the idea worth testing first', live: true },
  { id: 'brand', n: 3, name: 'Brand', phase: 'shape', promise: 'how you describe what you do', live: false },
  { id: 'sales', n: 4, name: 'First 10 Customers', short: 'First 10', phase: 'sell', promise: 'ten real conversations, starting with people who know you', live: true },
  { id: 'substack', n: 5, name: 'Substack', phase: 'show', promise: 'one publication for all your offers', live: true },
  { id: 'linkedin', n: 6, name: 'LinkedIn', phase: 'show', promise: 'a profile that says what you sell', live: false },
  { id: 'content', n: 7, name: 'Content', phase: 'show', promise: 'what to post and why', live: false },
  { id: 'website', n: 8, name: 'Website', phase: 'show', promise: 'a page that books calls', live: false },
  { id: 'delivery', n: 9, name: 'Delivery', phase: 'run', promise: 'a smooth start for every client', live: false },
  { id: 'operations', n: 10, name: 'Operations', phase: 'run', promise: 'contracts, invoices and the basics', live: false },
]
export const LIVE_STEPS = STEPS.filter((s) => s.live).map((s, i) => ({ ...s, pos: i + 1 }))

const SERIF = "'Cormorant Garamond', Baskerville, 'Baskerville Old Face', Georgia, serif"
// Caveat is retired from the panel (11 Nov): Gabriela's notes are Cormorant italic.
const HAND = "'Cormorant Italic', 'Cormorant Garamond', Georgia, serif"
const MARK = "Fraunces, Georgia, 'Times New Roman', serif"
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif"

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Wraps text into lines of at most `max` characters, for SVG <text>.
export function wrap(text, max) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const w of words) {
    if ((line + ' ' + w).trim().length > max && line) {
      lines.push(line)
      line = w
    } else {
      line = (line + ' ' + w).trim()
    }
  }
  if (line) lines.push(line)
  return lines
}

export function star(x, y, size, fill) {
  const s = size / 24
  return `<path transform="translate(${x} ${y}) scale(${s})" d="M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6z" fill="${fill}"/>`
}

// The top band of every screen: wordmark, a line in the margin, a star.
export function headerSvg(note) {
  const w = 520
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 74" width="${w}" height="74">
  <rect x="0" y="0" width="${w}" height="74" fill="${C.cream}"/>
  <text x="4" y="46" font-family="${MARK}" font-style="italic" font-weight="800" font-size="40" fill="${C.blue}" letter-spacing="-0.5">Uncapped</text>
  ${star(186, 14, 20, C.pink)}
  <text x="6" y="66" font-family="${SANS}" font-weight="700" font-size="10.5" letter-spacing="2.2" fill="${C.taupeInk}">BY PIVOT SCHOOL</text>
  ${note ? `<text x="${w - 6}" y="44" text-anchor="end" font-family="${HAND}" font-size="22" fill="${C.blue}" transform="rotate(-3 ${w - 80} 40)">${esc(note)}</text>` : ''}
  <line x1="0" y1="73" x2="${w}" y2="73" stroke="${C.espresso}" stroke-width="2"/>
</svg>`
}

// The welcome polaroid: a tilted photo with tape and a handwritten caption.
export function polaroidSvg(photoBase64, caption) {
  const img = photoBase64
    ? `<image href="data:image/jpeg;base64,${photoBase64}" x="14" y="14" width="200" height="236" preserveAspectRatio="xMidYMin slice"/>`
    : `<rect x="14" y="14" width="200" height="236" fill="${C.pinkTint}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 330" width="280" height="330">
  <g transform="rotate(2.5 140 160)">
    <rect x="20" y="22" width="228" height="296" fill="${C.espresso}"/>
    <rect x="10" y="10" width="228" height="296" fill="${C.white}" stroke="${C.espresso}" stroke-width="2.5"/>
    <clipPath id="ph"><rect x="24" y="24" width="200" height="236"/></clipPath>
    <g clip-path="url(#ph)" transform="translate(10 10)">${img}</g>
    <rect x="84" y="-2" width="100" height="26" fill="${C.pink}" fill-opacity="0.8" transform="rotate(-4 134 10)"/>
    <text x="124" y="294" text-anchor="middle" font-family="${HAND}" font-size="26" fill="${C.espresso}">${esc(caption)}</text>
  </g>
  ${star(250, 40, 22, C.butter)}
</svg>`
}

// A pill sticker, like "start here!" on the landing page.
export function stickerSvg(text, fill = C.butter, tilt = -4) {
  const w = Math.max(90, 16 + String(text).length * 11)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w + 12} 44" width="${w + 12}" height="44">
  <g transform="rotate(${tilt} ${w / 2} 22)">
    <rect x="6" y="8" width="${w}" height="30" rx="15" fill="${fill}" stroke="${C.espresso}" stroke-width="2"/>
    <text x="${6 + w / 2}" y="30" text-anchor="middle" font-family="${HAND}" font-size="21" fill="${C.espresso}">${esc(text)}</text>
  </g>
</svg>`
}

// Progress: a ring drawn in blue on cream, with "3 of 10" in the middle.
export function progressSvg(done, total, label) {
  const r = 34
  const circ = 2 * Math.PI * r
  const frac = total ? Math.min(1, done / total) : 0
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 92" width="340" height="92">
  <circle cx="46" cy="46" r="${r}" fill="${C.white}" stroke="${C.espresso}" stroke-width="2"/>
  <circle cx="46" cy="46" r="${r}" fill="none" stroke="${C.blue}" stroke-width="9" stroke-dasharray="${(circ * frac).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 46 46)" stroke-linecap="round"/>
  <text x="46" y="52" text-anchor="middle" font-family="${SERIF}" font-weight="700" font-size="22" fill="${C.espresso}">${done}/${total}</text>
  <text x="98" y="40" font-family="${SERIF}" font-weight="600" font-size="24" fill="${C.espresso}">${esc(label)}</text>
  <text x="99" y="66" font-family="${HAND}" font-size="21" fill="${C.blue}">${done === 0 ? 'every portfolio starts somewhere' : done >= total ? 'you did the whole thing!' : 'look at you go'}</text>
</svg>`
}

// The loading moment: three stars that twinkle (the desktop app runs SVG
// animation; where it doesn't, the stars simply sit still).
export function thinkingSvg(line) {
  const twinkle = (d) => `<animateTransform attributeName="transform" type="scale" values="0.7;1.15;0.7" dur="1.4s" begin="${d}s" repeatCount="indefinite" additive="sum"/>`
  const s = (x, fill, d) => `<g transform="translate(${x} 26)"><g>${twinkle(d)}<path transform="translate(-12 -12)" d="M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6z" fill="${fill}"/></g></g>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 56" width="420" height="56">
  ${s(18, C.blue, 0)}${s(50, C.pink, 0.2)}${s(82, C.butter, 0.4)}
  <text x="110" y="34" font-family="${HAND}" font-size="23" fill="${C.blue}">${esc(line)}</text>
</svg>`
}

// A builder's title band: number, name, and its promise in the margin.
export function builderHeadSvg(num, title, tint, note) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 96" width="520" height="96">
  <rect x="8" y="8" width="504" height="80" rx="16" fill="${C.espresso}"/>
  <rect x="2" y="2" width="504" height="80" rx="16" fill="${tint}" stroke="${C.espresso}" stroke-width="2"/>
  <circle cx="44" cy="42" r="24" fill="${C.white}" stroke="${C.espresso}" stroke-width="2"/>
  <text x="44" y="50" text-anchor="middle" font-family="${SERIF}" font-weight="700" font-size="22" fill="${C.espresso}">${esc(num)}</text>
  <text x="82" y="52" font-family="${SERIF}" font-weight="700" font-size="32" fill="${C.espresso}">${esc(title)}</text>
  ${note ? `<text x="496" y="74" text-anchor="end" font-family="${HAND}" font-size="19" fill="${C.blue}">${esc(note)}</text>` : ''}
</svg>`
}

// The first offer, as a card with a blue hard shadow, like Bella's on the page.
export function offerCardSvg(offer) {
  const rows = [
    ['Buyer', offer.buyer],
    ['Problem', offer.problem],
    ['Price to test', offer.priceText],
    ['First step', offer.firstStep],
  ]
  let y = 86
  const body = rows
    .map(([k, v]) => {
      const lines = wrap(v, 46).slice(0, 3)
      const out = `<text x="28" y="${y}" font-family="${SANS}" font-weight="700" font-size="13" fill="${C.espresso}">${esc(k)}</text>` +
        lines.map((l, i) => `<text x="140" y="${y + i * 18}" font-family="${SANS}" font-size="13.5" fill="${C.ink}">${esc(l)}</text>`).join('')
      y += Math.max(1, lines.length) * 18 + 12
      return out
    })
    .join('')
  const h = y + 30
  const title = wrap(offer.name, 34).slice(0, 2)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 ${h + 20}" width="520" height="${h + 20}">
  <g transform="rotate(-0.8 260 ${h / 2})">
    <rect x="16" y="16" width="488" height="${h}" rx="14" fill="${C.blue}"/>
    <rect x="8" y="8" width="488" height="${h}" rx="14" fill="${C.white}" stroke="${C.espresso}" stroke-width="2"/>
    <text x="28" y="36" font-family="${SANS}" font-weight="700" font-size="11" letter-spacing="1.8" fill="${C.blue}">YOUR FIRST OFFER</text>
    ${title.map((l, i) => `<text x="28" y="${62 + i * 26}" font-family="${SERIF}" font-weight="700" font-size="25" fill="${C.espresso}">${esc(l)}</text>`).join('')}
    <g transform="translate(0 ${(title.length - 1) * 26})">${body}</g>
    <text x="484" y="${h - 4}" text-anchor="end" font-family="${HAND}" font-size="20" fill="${C.blue}">a hypothesis worth testing</text>
  </g>
</svg>`
}

// A small "Up to date" / "Review suggested" stamp.
export function stampSvg(text, fill) {
  const w = 18 + String(text).length * 7.4
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 26" width="${w}" height="26">
  <rect x="1" y="1" width="${w - 2}" height="24" rx="12" fill="${fill}" stroke="${C.espresso}" stroke-width="1.5"/>
  <text x="${w / 2}" y="17" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="11" letter-spacing="0.6" fill="${C.espresso}">${esc(text.toUpperCase())}</text>
</svg>`
}

// ======================================================================
// 0.2.0: artwork laid out at the panel's real width, in the real fonts.
// Fonts are the landing page's own (Google Fonts, Open Font License,
// licenses in assets/fonts), embedded per drawing so the desktop app can
// render them. Body text elsewhere uses the app's own typeface.
// `px` is the width the drawing gets; it never draws wider than that.
// ======================================================================

export function pxFor(bodyColumns, max = 640) {
  // Desktop measures panes in cells of its code font, about 7.5 px each.
  const px = Math.floor((Number(bodyColumns) || 60) * 7.5) - 24
  return Math.max(240, Math.min(max, px))
}

export function face(family, b64, weight = 400, style = 'normal') {
  return b64 ? `@font-face{font-family:'${family}';font-weight:${weight};font-style:${style};src:url(data:font/woff2;base64,${b64}) format('woff2');}` : ''
}

// Approximate advance widths (in em) for wrapping without a layout engine.
const AVG = { cormorant: 0.43, caveat: 0.41, serif: 0.5, sans: 0.53, fraunces: 0.55 }
// Advance widths in em, measured from the embedded Cormorant subsets (11 Nov),
// so headings wrap and the highlighter lands where the words really are.
const EM = {"c6":{" ":0.234,"!":0.257,"\"":0.295,"#":0.526,"$":0.418,"%":0.574,"&":0.709,"'":0.147,"(":0.309,")":0.309,"*":0.448,"+":0.398,",":0.222,"-":0.323,".":0.204,"/":0.348,"0":0.477,"1":0.332,"2":0.402,"3":0.392,"4":0.454,"5":0.409,"6":0.465,"7":0.429,"8":0.489,"9":0.465,":":0.204,";":0.229,"<":0.407,"=":0.468,">":0.407,"?":0.336,"@":0.726,"A":0.711,"B":0.582,"C":0.683,"D":0.7,"E":0.547,"F":0.518,"G":0.725,"H":0.762,"I":0.339,"J":0.333,"K":0.653,"L":0.541,"M":0.85,"N":0.732,"O":0.766,"P":0.549,"Q":0.766,"R":0.689,"S":0.507,"T":0.64,"U":0.701,"V":0.662,"W":0.918,"X":0.649,"Y":0.616,"Z":0.602,"[":0.274,"\\":0.348,"]":0.274,"^":0.392,"_":0.398,"`":0.213,"a":0.42,"b":0.514,"c":0.42,"d":0.511,"e":0.414,"f":0.305,"g":0.449,"h":0.505,"i":0.266,"j":0.261,"k":0.491,"l":0.265,"m":0.772,"n":0.523,"o":0.486,"p":0.512,"q":0.497,"r":0.374,"s":0.337,"t":0.337,"u":0.501,"v":0.438,"w":0.68,"x":0.44,"y":0.43,"z":0.405,"{":0.289,"|":0.168,"}":0.283,"~":0.443},"c5i":{" ":0.234,"!":0.219,"\"":0.325,"#":0.438,"$":0.384,"%":0.522,"&":0.755,"'":0.132,"(":0.283,")":0.283,"*":0.448,"+":0.398,",":0.227,"-":0.305,".":0.2,"/":0.305,"0":0.441,"1":0.291,"2":0.366,"3":0.346,"4":0.426,"5":0.374,"6":0.422,"7":0.389,"8":0.44,"9":0.422,":":0.2,";":0.222,"<":0.407,"=":0.468,">":0.407,"?":0.295,"@":0.722,"A":0.602,"B":0.534,"C":0.586,"D":0.62,"E":0.519,"F":0.484,"G":0.631,"H":0.672,"I":0.317,"J":0.292,"K":0.604,"L":0.499,"M":0.735,"N":0.652,"O":0.652,"P":0.512,"Q":0.652,"R":0.62,"S":0.465,"T":0.553,"U":0.619,"V":0.595,"W":0.826,"X":0.579,"Y":0.531,"Z":0.55,"[":0.25,"\\":0.305,"]":0.249,"^":0.353,"_":0.363,"`":0.166,"a":0.437,"b":0.439,"c":0.346,"d":0.446,"e":0.347,"f":0.264,"g":0.382,"h":0.448,"i":0.247,"j":0.242,"k":0.415,"l":0.24,"m":0.679,"n":0.468,"o":0.401,"p":0.406,"q":0.417,"r":0.345,"s":0.306,"t":0.297,"u":0.468,"v":0.437,"w":0.621,"x":0.424,"y":0.446,"z":0.344,"{":0.261,"|":0.152,"}":0.262,"~":0.443}}
// Which embedded faces actually loaded. Without one, the drawing falls back to
// Georgia, which runs wider, so measuring by Cormorant would overflow the edge.
let LOADED = { c6: false, c5i: false, mark: false }
export function fontsLoaded(f) { LOADED = { c6: Boolean(f?.corm600), c5i: Boolean(f?.c5i), mark: Boolean(f?.mark) } }
export function textW(text, size, face = 'c6') {
  if (!LOADED[face]) return String(text).length * size * 0.52
  const t = EM[face] || EM.c6
  let w = 0
  for (const ch of String(text)) w += t[ch] ?? (ch === '\u00a0' ? t[' '] : 0.45)
  return w * size
}
// Wraps by measured width (Cormorant upright or italic); a non-breaking space keeps words together.
function wrapMeasured(text, maxPx, size, face) {
  const words = String(text || '').split(/ +/)
  const lines = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (cur && textW(next, size, face) > maxPx) { lines.push(cur); cur = w } else cur = next
  }
  if (cur) lines.push(cur)
  return lines
}
export function wrapPx(text, maxPx, size, kind) {
  if (kind === 'cormorant' || kind === 'caveat') {
    const face = kind === 'caveat' ? 'c5i' : 'c6'
    return wrapMeasured(text, maxPx, size, face)
  }
  return wrap(text, Math.max(8, Math.floor(maxPx / (size * (AVG[kind] || 0.5)))))
}

export function headerSvg2({ px, fonts, pivot, right }) {
  const h = 54
  const pv = pivot ? `<g transform="translate(${142} 20)"><text x="0" y="12" font-family="${SANS}" font-size="11" fill="${C.taupeInk}">by</text><image href="data:image/png;base64,${pivot}" x="18" y="-1" width="66" height="17" filter="url(#ink)"/></g>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${px} ${h}" width="${px}" height="${h}">
  <defs><style>${face('Fraunces', fonts?.mark, 800, 'italic')}</style>
  <filter id="ink"><feColorMatrix type="matrix" values="0 0 0 0 0.165  0 0 0 0 0.122  0 0 0 0 0.114  0 0 0 1 0"/></filter></defs>
  <text x="2" y="36" font-family="Fraunces, Georgia, serif" font-style="italic" font-weight="800" font-size="31" fill="${C.blue}" letter-spacing="-0.3">Uncapped</text>
  ${pv}
  ${right && px > 360 ? `<text x="${px - 2}" y="34" text-anchor="end" font-family="${SANS}" font-size="11.5" fill="${C.taupeInk}">${esc(right)}</text>` : ''}
  <line x1="0" y1="${h - 1}" x2="${px}" y2="${h - 1}" stroke="${C.espresso}" stroke-width="2"/>
</svg>`
}

// The Uncapped wordmark on its own, in Fraunces 800 italic with the real font
// file. Its box is a little wider than the word, so it never clips; the panel
// lays it out beside the Pivot School logo, so the two can't overlap.
export const WORDMARK_EM = 4.75 // width of "Uncapped" in ems, measured in a browser with the real font
export function wordmarkSvg({ fonts, size = 30, color = C.blue }) {
  // Without the Fraunces file, Georgia's bold italic runs wider: leave it room.
  const w = Math.ceil(size * (fonts?.mark ? WORDMARK_EM : 5.9)) + 8
  const h = Math.ceil(size * 1.3)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs><style>${face('Fraunces', fonts?.mark, 800, 'italic')}</style></defs>
  <text x="2" y="${Math.round(size * 1.0)}" font-family="Fraunces, Georgia, serif" font-style="italic" font-weight="800" font-size="${size}" fill="${color}" letter-spacing="-0.3">Uncapped</text>
</svg>`
}

// "by Pivot School", with the landing page's own logo file, inked espresso.
export function pivotSvg({ pivot, height = 16 }) {
  const lw = Math.round(height * (414 / 105))
  const w = 20 + lw + 2
  const h = height + 4
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs><filter id="ink"><feColorMatrix type="matrix" values="0 0 0 0 0.165  0 0 0 0 0.122  0 0 0 0 0.114  0 0 0 1 0"/></filter></defs>
  <text x="0" y="${Math.round(h * 0.72)}" font-family="${SANS}" font-size="11" fill="${C.espresso}">by</text>
  ${pivot ? `<image href="data:image/png;base64,${pivot}" x="18" y="2" width="${lw}" height="${height}" filter="url(#ink)"/>` : `<text x="18" y="${Math.round(h * 0.72)}" font-family="${SANS}" font-size="12" font-weight="700" fill="${C.espresso}">Pivot School</text>`}
</svg>`
}

// A heading in Cormorant Garamond, wrapped to the width it's given.
export function titleSvg(text, { px, fonts, size = 30, weight = 600, color = C.espresso, highlight }) {
  const lines = wrapPx(text, px - 8, size, 'cormorant')
  const lh = Math.round(size * 1.12)
  const h = lines.length * lh + Math.round(size * 0.35)
  const b64 = fonts?.corm600
  const hl = highlight ? `<rect x="0" y="${h - Math.round(size * 0.42)}" width="${Math.min(px - 4, Math.max(...lines.map((l) => l.length)) * size * AVG.cormorant)}" height="${Math.round(size * 0.3)}" fill="${C.pink}" opacity="0.85"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${px} ${h}" width="${px}" height="${h}">
  <defs><style>${face('Cormorant Garamond', b64, weight)}</style></defs>${hl}
  ${lines.map((l, i) => `<text x="0" y="${(i + 1) * lh - Math.round(size * 0.18)}" font-family="'Cormorant Garamond', Baskerville, Georgia, serif" font-weight="${weight}" font-size="${size}" fill="${color}">${esc(l)}</text>`).join('')}
</svg>`
}

// Gabriela's margin note (v2, 11 Nov): Cormorant Garamond italic 500, 19 px,
// in the accent colour, flat (no tilt), never wider than px.
export function noteSvg(text, { px, fonts, size = 19, color = C.blue }) {
  const lines = wrapPx(text, px - 8, size, 'caveat')
  const lh = Math.round(size * 1.18)
  const h = lines.length * lh + 6
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${px} ${h}" width="${px}" height="${h}">
  <defs><style>${face('Cormorant Italic', fonts?.c5i, 500)}</style></defs>
  ${lines.map((l, i) => `<text x="0" y="${(i + 1) * lh - 2}" font-family="${HAND}" font-style="${fonts?.c5i ? 'normal' : 'italic'}" font-weight="500" font-size="${size}" fill="${color}">${esc(l)}</text>`).join('')}
</svg>`
}

export function polaroidSvg2(photo, caption, { px, fonts }) {
  const w = Math.min(230, px - 20)
  const inner = w - 24
  const ih = Math.round(inner * 1.15)
  const H = ih + 76
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w + 24} ${H}" width="${w + 24}" height="${H}">
  <defs><clipPath id="pc"><rect x="12" y="12" width="${inner}" height="${ih}"/></clipPath></defs>
  <g transform="rotate(2 ${w / 2} ${H / 2})">
    <rect x="12" y="12" width="${w}" height="${H - 20}" fill="${C.espresso}"/>
    <rect x="4" y="4" width="${w}" height="${H - 20}" fill="${C.white}" stroke="${C.espresso}" stroke-width="2"/>
    ${photo ? `<image href="data:image/jpeg;base64,${photo}" x="12" y="12" width="${inner}" height="${ih}" preserveAspectRatio="xMidYMin slice" clip-path="url(#pc)"/>` : ''}
    <rect x="${w / 2 - 40}" y="-4" width="80" height="20" fill="${C.pink}" fill-opacity="0.8" transform="rotate(-4 ${w / 2} 6)"/>
    <text x="${w / 2 + 4}" y="${ih + 46}" text-anchor="middle" font-family="${HAND}" font-weight="500" font-size="23" fill="${C.espresso}">${esc(caption)}</text>
  </g>
</svg>`
}

// How the ten builders feed each other, laid out to the width given.
export function builderMapSvg({ px, active = {} }) {
  const rows = [['Discover'], ['Offer', 'Brand'], ['LinkedIn', 'Content', 'Substack', 'Website'], ['Sales'], ['Delivery', 'Operations']]
  const gap = 8
  const bh = 30
  const rowGap = 22
  let y = 4
  const parts = []
  rows.forEach((row, r) => {
    const bw = Math.min(150, (px - gap * (row.length - 1) - 8) / row.length)
    const total = bw * row.length + gap * (row.length - 1)
    let x = (px - total) / 2
    for (const name of row) {
      const on = active[name]
      const fill = name === 'Discover' ? C.blue : on === 'done' ? C.blueTint : on === 'in_progress' ? C.butterTint : C.white
      parts.push(`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="10" fill="${fill}" stroke="${C.espresso}" stroke-width="1.6"/><text x="${x + bw / 2}" y="${y + 19}" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="${bw < 70 ? 10 : 12}" fill="${name === 'Discover' ? C.white : C.espresso}">${esc(name)}</text>`)
      x += bw + gap
    }
    if (r < rows.length - 1) parts.push(`<path d="M${px / 2} ${y + bh + 3} L${px / 2} ${y + bh + rowGap - 4}" stroke="${C.espresso}" stroke-width="1.6"/><path d="M${px / 2 - 5} ${y + bh + rowGap - 9} L${px / 2} ${y + bh + rowGap - 3} L${px / 2 + 5} ${y + bh + rowGap - 9}" fill="none" stroke="${C.espresso}" stroke-width="1.6"/>`)
    y += bh + rowGap
  })
  const h = y - rowGap + 8
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${px} ${h}" width="${px}" height="${h}">${parts.join('')}</svg>`
}

// The portfolio garden: how soon each direction could plausibly earn,
// against how excited the person is. They set the excitement; the timing
// is the model's hypothesis.
export function gardenSvg(dirs, { px, fonts }) {
  const H = 270
  const L = 40, R = 12, T = 14, B = 46
  const w = px - L - R
  const h = H - T - B
  const xs = [[0.5, 'weeks'], [1, '1 month'], [3, '3 months'], [6, '6 months'], [12, 'a year+']]
  const xOf = (m) => {
    const v = Math.log2(Math.max(0.5, Math.min(12, Number(m) || 3)) / 0.5) / Math.log2(24)
    return L + v * w
  }
  const yOf = (e) => T + h - ((Math.max(1, Math.min(5, e)) - 1) / 4) * h
  const fill = { demonstrated: C.blue, adjacent: C.butter, aspirational: C.pink }
  const pts = dirs.map((d, i) => {
    const x = xOf(d.monthsToFirstIncome)
    const known = Number(d.excitement) > 0
    const y = yOf(known ? d.excitement : 3) + ((i % 3) - 1) * 6
    return `<g><circle cx="${x}" cy="${y}" r="13" fill="${fill[d.basis] || C.white}" stroke="${C.espresso}" stroke-width="2" ${known ? '' : 'stroke-dasharray="3 3"'}/><text x="${x}" y="${y + 4.5}" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="12" fill="${d.basis === 'demonstrated' ? C.white : C.espresso}">${i + 1}${known ? '' : '?'}</text></g>`
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${px} ${H}" width="${px}" height="${H}">
  <rect x="${L}" y="${T}" width="${w}" height="${h}" fill="${C.white}" stroke="${C.espresso}" stroke-width="1.6" rx="8"/>
  <rect x="${L}" y="${T}" width="${w / 2}" height="${h / 2}" fill="${C.butterTint}" opacity="0.6" rx="8"/>
  <text x="${L + 8}" y="${T + 16}" font-family="${SANS}" font-size="10.5" font-weight="700" fill="${C.taupeInk}">SOON AND EXCITING</text>
  ${xs.map(([m, lab]) => `<line x1="${xOf(m)}" y1="${T + h}" x2="${xOf(m)}" y2="${T + h + 5}" stroke="${C.espresso}"/><text x="${xOf(m)}" y="${T + h + 17}" text-anchor="middle" font-family="${SANS}" font-size="10" fill="${C.taupeInk}">${lab}</text>`).join('')}
  <text x="${L + w / 2}" y="${H - 8}" text-anchor="middle" font-family="${SANS}" font-size="11" font-weight="700" fill="${C.espresso}">How soon it could plausibly earn</text>
  ${[1, 3, 5].map((e) => `<text x="${L - 8}" y="${yOf(e) + 4}" text-anchor="end" font-family="${SANS}" font-size="10" fill="${C.taupeInk}">${e}</text>`).join('')}
  <text transform="translate(12 ${T + h / 2}) rotate(-90)" text-anchor="middle" font-family="${SANS}" font-size="11" font-weight="700" fill="${C.espresso}">How excited you are</text>
  ${pts.join('')}
</svg>`
}

export function offerCardSvg2(offer, { px, fonts }) {
  const pad = 18
  const inner = px - pad * 2 - 14
  const title = wrapPx(offer.name, inner, 24, 'serif').slice(0, 3)
  const rows = [['Buyer', offer.buyer], ['Problem', offer.problem], ['Price to test', offer.priceText], ['First step', offer.firstStep]].filter(([, v]) => v)
  const labW = 92
  let y = 54 + (title.length - 1) * 27 + 30
  const body = rows.map(([k, v]) => {
    const lines = wrapPx(v, inner - labW, 13, 'sans').slice(0, 4)
    const out = `<text x="${pad}" y="${y}" font-family="${SANS}" font-weight="700" font-size="12.5" fill="${C.espresso}">${esc(k)}</text>` + lines.map((l, i) => `<text x="${pad + labW}" y="${y + i * 17}" font-family="${SANS}" font-size="13" fill="${C.ink}">${esc(l)}</text>`).join('')
    y += Math.max(1, lines.length) * 17 + 10
    return out
  }).join('')
  const h = y + 8
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${px} ${h + 10}" width="${px}" height="${h + 10}">
  <defs></defs>
  <rect x="8" y="8" width="${px - 12}" height="${h}" rx="14" fill="${C.blue}"/>
  <rect x="2" y="2" width="${px - 12}" height="${h}" rx="14" fill="${C.white}" stroke="${C.espresso}" stroke-width="2"/>
  <text x="${pad}" y="26" font-family="${SANS}" font-weight="700" font-size="10.5" letter-spacing="1.6" fill="${C.blue}">${esc(offer.label || 'YOUR FIRST OFFER')}</text>
  ${title.map((l, i) => `<text x="${pad}" y="${54 + i * 27}" font-family="'Cormorant Garamond', Georgia, serif" font-weight="700" font-size="24" fill="${C.espresso}">${esc(l)}</text>`).join('')}
  ${body}
</svg>`
}

// ======================================================================
// Hub design system 1.0, section 7: the artwork. Each piece takes { px,
// fonts }, lays itself out to px, wraps its own text and returns
// { source, alt }: the drawing and a full description of what it shows.
// ======================================================================
const CORM = "'Cormorant Garamond', Baskerville, Georgia, serif"
const HANDF = "'Cormorant Italic', 'Cormorant Garamond', Georgia, serif"
// Desktop draws a panel only when its whole tree is under 100,000 characters, and a
// font file is 30,000 to 68,000 of them: only the Cormorant heading face is ever
// embedded (once a screen, in the step header or title). Everything else uses the
// Mac's own stand-ins named in each font stack (Baskerville, Georgia, Bradley Hand).
export const fontsCss = (fonts, which) => (which.includes('c6') ? face('Cormorant Garamond', fonts?.corm600, 600) : '') + (which.includes('cv') ? face('Cormorant Italic', fonts?.c5i, 500) : '')
export const svgOpen = (w, h, css) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs><style>${css}</style></defs>`
export const tspanLines = (lines, x, y, lh, attrs) => lines.map((l, i) => `<text x="${x}" y="${y + i * lh}" ${attrs}>${esc(l)}</text>`).join('')
// A Caveat sticker in a pill, gently tilted.
function stickerAt(x, y, text, fill, tilt = -4, size = 17, stroke = C.espresso) {
  const w = Math.round(text.length * size * 0.42) + 22
  return `<g transform="rotate(${tilt} ${x + w / 2} ${y + 12})"><rect x="${x}" y="${y}" width="${w}" height="${size + 9}" rx="${(size + 9) / 2}" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/><text x="${x + w / 2}" y="${y + size + 1}" text-anchor="middle" font-family="${HANDF}" font-weight="500" font-size="${size}" fill="${C.espresso}">${esc(text)}</text></g>`
}

// 7.2 The step header band: number medallion in the phase color, eyebrow,
// step name, its promise in Caveat, and a status sticker.
export function stepHeadSvg({ px, fonts, num, total, title, promise, phase, phaseName, status }) {
  const narrow = px < 400
  const tx = 88
  const sticker = Array.isArray(status) ? status : { done: ['done ✓', C.greenTint, C.green], here: ["you're here", C.butter, C.espresso], next: ['next', C.white, C.espresso], later: ['later', C.white, C.taupe] }[status]
  const nameSize = narrow ? 26 : 30
  const room = px - tx - (narrow || !sticker ? 22 : 128)
  const name = wrapPx(title, room, nameSize, 'serif').slice(0, 2)
  const prom = promise ? wrapPx(promise, px - tx - 22, 19, 'caveat').slice(0, 2) : []
  let y = 34
  const eyebrow = num ? `STEP ${num} OF ${total}${phaseName ? ` · ${phaseName}` : ''}`.toUpperCase() : String(phaseName || '').toUpperCase()
  const parts = [`<text x="${tx}" y="${y}" font-family="${SANS}" font-weight="700" font-size="10.5" letter-spacing="1.4" fill="${C.blue}">${esc(eyebrow)}</text>`]
  if (narrow && sticker) { parts.push(stickerAt(tx, y + 6, sticker[0], sticker[1], -3, 15, sticker[2])); y += 30 }
  y += nameSize + 2
  parts.push(tspanLines(name, tx, y, Math.round(nameSize * 1.05), `font-family="${CORM}" font-weight="600" font-size="${nameSize}" fill="${C.espresso}"`))
  y += (name.length - 1) * Math.round(nameSize * 1.05)
  if (prom.length) { y += 24; parts.push(tspanLines(prom, tx, y, 21, `font-family="${HANDF}" font-weight="500" font-size="19" fill="${C.taupeInk}"`)); y += (prom.length - 1) * 21 }
  const h = Math.max(96, Math.min(150, y + 18))
  const fill = PHASES[phase]?.color || C.paper
  const numFill = PHASES[phase]?.text || C.espresso
  if (!narrow && sticker) parts.push(stickerAt(px - 122, 14, sticker[0], sticker[1], 3, 17, sticker[2]))
  // No embedded font: the band sits on every step screen, and the Mac's Baskerville
  // keeps the screen well under Desktop's size limit.
  const source = `${svgOpen(px, h + 7, '')}
  <rect x="7" y="7" width="${px - 9}" height="${h - 2}" rx="16" fill="${C.espresso}"/>
  <rect x="2" y="2" width="${px - 9}" height="${h - 2}" rx="16" fill="${C.white}" stroke="${C.espresso}" stroke-width="2"/>
  ${num ? `<circle cx="46" cy="${Math.round(h / 2)}" r="24" fill="${fill}" stroke="${C.espresso}" stroke-width="2"/><text x="46" y="${Math.round(h / 2) + 9}" text-anchor="middle" font-family="${CORM}" font-weight="700" font-size="26" fill="${numFill}">${num}</text>` : `<g transform="translate(34 ${Math.round(h / 2) - 12})">${star(0, 0, 24, C.blue)}</g>`}
  ${parts.join('')}
</svg>`
  return { source, alt: `${eyebrow ? `${eyebrow}: ` : ''}${title}${promise ? `, ${promise}` : ''}${sticker ? ` (${sticker[0]})` : ''}` }
}

// Blocks on a staircase, used by 7.4, 7.5 and 7.10. Each block: fill, title
// lines, sub lines, an optional pill and dashed when empty.
function staircase({ px, fonts, blocks, gridBelow = 520, foot }) {
  const n = blocks.length
  // Narrow: the staircase stands up. Each step sits a little further in, and one
  // arrow down the left runs from the first label to the last, beside the steps.
  if (px < gridBelow) {
    const indent = Math.min(14, Math.floor((px - 200) / Math.max(1, n)))
    const left = 30
    const out = []
    let y = foot ? 30 : 8
    if (foot) out.push(`<text x="${left}" y="18" font-family="${HANDF}" font-weight="500" font-size="18" fill="${C.blue}">${esc(foot[0])}</text>`)
    const top = y
    blocks.forEach((b, i) => {
      const x = left + i * indent
      const w = px - x - 8
      const t = wrapPx(b.title, w - 20, 12.5, 'sans').slice(0, 2)
      const sub = b.sub ? wrapPx(b.sub, w - 20 - (b.pill ? 110 : 0), 11, 'sans').slice(0, 2) : []
      const h = 16 + t.length * 15 + sub.length * 13 + 10
      out.push(`<g${b.dim ? ' opacity="0.35"' : ''}>${b.empty ? '' : `<rect x="${x + 4}" y="${y + 4}" width="${w - 4}" height="${h}" rx="10" fill="${C.espresso}"/>`}<rect x="${x}" y="${y}" width="${w - 4}" height="${h}" rx="10" fill="${b.empty ? C.cream : b.fill}" stroke="${b.empty ? C.taupe : C.espresso}" stroke-width="2"${b.empty ? ' stroke-dasharray="5 4"' : ''}/>`)
      out.push(tspanLines(t, x + 10, y + 20, 15, `font-family="${SANS}" font-weight="700" font-size="12.5" fill="${b.empty ? C.taupeInk : b.text || C.espresso}"`))
      out.push(tspanLines(sub, x + 10, y + 22 + t.length * 15, 13, `font-family="${SANS}" font-size="11" fill="${b.empty ? C.taupeInk : b.text || C.espresso}"`))
      if (b.pill) { const pw = Math.min(104, b.pill.length * 6.4 + 16); out.push(`<rect x="${x + w - pw - 14}" y="${y + 10}" width="${pw}" height="20" rx="10" fill="${C.white}" stroke="${C.espresso}" stroke-width="1.2"/><text x="${x + w - 14 - pw / 2}" y="${y + 24}" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="10.5" fill="${C.espresso}">${esc(b.pill)}</text>`) }
      if (b.star) out.push(`<g transform="translate(${x - 14} ${y - 8})">${star(0, 0, 20, C.blue)}</g>`)
      out.push('</g>')
      y += h + 10
    })
    const bottom = y - 10
    if (foot) {
      out.push(`<path d="M12 ${top + 2} L12 ${bottom - 2}" stroke="${C.blue}" stroke-width="1.8"/><path d="M6 ${top + 10} L12 ${top + 2} L18 ${top + 10} M6 ${bottom - 10} L12 ${bottom - 2} L18 ${bottom - 10}" stroke="${C.blue}" stroke-width="1.8" fill="none"/>`)
      out.push(`<text x="${left}" y="${bottom + 24}" font-family="${HANDF}" font-weight="500" font-size="18" fill="${C.blue}">${esc(foot[1])}</text>`)
    }
    return `${svgOpen(px, bottom + (foot ? 34 : 8), fontsCss(fonts, ''))}${out.join('')}</svg>`
  }
  const gap = 10
  const bw = Math.floor((px - 12 - gap * (n - 1)) / n)
  const stepUp = 16
  const lines = blocks.map((b) => ({ ...b, t: wrapPx(b.title, bw - 18, 12.5, 'sans').slice(0, 3), s: b.sub ? wrapPx(b.sub, bw - 18, 11, 'sans').slice(0, 4) : [] }))
  const bh = Math.max(...lines.map((b) => 30 + b.t.length * 15 + b.s.length * 13 + (b.pill ? 30 : 6)))
  const top = 18 + stepUp * (n - 1)
  const H = top + bh + gap + (foot ? 46 : 8)
  const out = []
  lines.forEach((b, i) => {
    const x = 2 + i * (bw + gap)
    const y = top - stepUp * i
    const h = bh + stepUp * i
    out.push(`<g${b.dim ? ' opacity="0.35"' : ''}>${b.empty ? '' : `<rect x="${x + 5}" y="${y + 5}" width="${bw - 4}" height="${h - 4}" rx="10" fill="${C.espresso}"/>`}<rect x="${x}" y="${y}" width="${bw - 4}" height="${h - 4}" rx="10" fill="${b.empty ? C.cream : b.fill}" stroke="${b.empty ? C.taupe : C.espresso}" stroke-width="2"${b.empty ? ' stroke-dasharray="5 4"' : ''}/>`)
    out.push(tspanLines(b.t, x + 10, y + 22, 15, `font-family="${SANS}" font-weight="700" font-size="12.5" fill="${b.empty ? C.taupeInk : b.text || C.espresso}"`))
    out.push(tspanLines(b.s, x + 10, y + 26 + b.t.length * 15, 13, `font-family="${SANS}" font-size="11" fill="${b.empty ? C.taupeInk : b.text || C.espresso}"`))
    if (b.pill) { const pw = Math.min(bw - 20, b.pill.length * 6.4 + 16); out.push(`<rect x="${x + 10}" y="${y + h - 34}" width="${pw}" height="20" rx="10" fill="${C.white}" stroke="${C.espresso}" stroke-width="1.2"/><text x="${x + 10 + pw / 2}" y="${y + h - 20}" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="10.5" fill="${C.espresso}">${esc(b.pill)}</text>`) }
    if (b.star) out.push(`<g transform="translate(${x + bw - 30} ${y - 14})">${star(0, 0, 24, C.blue)}</g>`)
    out.push('</g>')
  })
  if (foot) {
    const fy = top + bh + gap + 14
    out.push(`<path d="M8 ${fy} L${px - 10} ${fy}" stroke="${C.blue}" stroke-width="1.8" fill="none"/><path d="M16 ${fy - 6} L8 ${fy} L16 ${fy + 6} M${px - 18} ${fy - 6} L${px - 10} ${fy} L${px - 18} ${fy + 6}" stroke="${C.blue}" stroke-width="1.8" fill="none"/><text x="10" y="${fy + 24}" font-family="${HANDF}" font-weight="500" font-size="18" fill="${C.blue}">${esc(foot[0])}</text><text x="${px - 10}" y="${fy + 24}" text-anchor="end" font-family="${HANDF}" font-weight="500" font-size="18" fill="${C.blue}">${esc(foot[1])}</text>`)
  }
  return `${svgOpen(px, H, fontsCss(fonts, ''))}${out.join('')}</svg>`
}

// 7.4 Five ways to earn: a staircase from the lightest commitment to the
// deepest, with how many of their ideas sit on each step.
export function lensLadderSvg({ px, fonts, counts = {}, active = null, pick = null }) {
  const blocks = LENS_ORDER.map((id) => ({ title: LENS[id].name, sub: LENS[id].line, fill: LENS[id].color, text: LENS[id].text, pill: `${counts[id] || 0} of your ideas`, dim: active && active !== id, star: pick === id }))
  return { source: staircase({ px, fonts, blocks, foot: ['less of your time per sale', 'more per client'] }), alt: `Five ways to earn, from the lightest to the deepest: ${LENS_ORDER.map((id) => `${LENS[id].name}, ${counts[id] || 0} of your ideas`).join('; ')}.` }
}

// 7.5 One skill, five ways: the same staircase with their own idea and price
// on each step; a way with no idea here is drawn empty.
export function skillLadderSvg({ px, fonts, ideas = [] }) {
  const blocks = LENS_ORDER.map((id) => { const i = ideas.find((x) => x.lens === id); return i ? { title: i.name, sub: [LENS[id].name, i.price].filter(Boolean).join(' · '), fill: LENS[id].color, text: LENS[id].text } : { title: LENS[id].name, sub: 'no idea here yet', empty: true } })
  return { source: staircase({ px, fonts, blocks, foot: ['less of your time per sale', 'more per client'] }), alt: `This skill, five ways to earn: ${LENS_ORDER.map((id) => { const i = ideas.find((x) => x.lens === id); return `${LENS[id].name}: ${i ? `${i.name}${i.price ? `, ${i.price}` : ''}` : 'no idea yet'}` }).join('; ')}.` }
}

// 7.10 The offer ladder: their offers from the easiest way in to the deepest.
export function portfolioLadderSvg({ px, fonts, offers = [] }) {
  const blocks = offers.map((o) => ({ title: o.name, sub: [o.lens ? LENS[o.lens]?.name : '', o.price].filter(Boolean).join(' · '), fill: o.lens ? LENS[o.lens].color : C.white, text: o.lens ? LENS[o.lens].text : C.espresso }))
  return { source: staircase({ px, fonts, blocks, gridBelow: offers.length > 2 ? 480 : 360, foot: ['the easiest way in', 'your deepest offer'] }), alt: `Your offers, from the easiest way in to the deepest: ${offers.map((o) => `${o.name}${o.price ? `, ${o.price}` : ''}`).join('; ')}.` }
}

// 7.7 Outreach progress: four stations in the order of the work.
export function funnelSvg({ px, fonts, sent = 0, replied = 0, talked = 0, goal = 10, intros = 0 }) {
  const st = [['Messages sent', sent], ['Replies', replied], ['Conversations', talked], ['Introductions', intros]]
  const zero = !sent && !replied && !talked && !intros
  const r = px < 400 ? 22 : 27
  const H = r * 2 + 50 + (zero ? 30 : 0)
  const step = (px - 2 * r - 16) / 3
  const cy = r + 8
  const out = [`<line x1="${r + 8}" y1="${cy}" x2="${px - r - 8}" y2="${cy}" stroke="${C.espresso}" stroke-width="2"${zero ? ' stroke-dasharray="6 5"' : ''}/>`]
  st.forEach(([label, v], i) => {
    const cx = r + 8 + i * step
    out.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.white}" stroke="${C.espresso}" stroke-width="2"/>`)
    if (i === 2 && talked > 0) {
      const f = Math.min(1, talked / goal)
      const a = f * 2 * Math.PI - Math.PI / 2
      out.push(f >= 1 ? `<circle cx="${cx}" cy="${cy}" r="${r - 3}" fill="none" stroke="${C.blue}" stroke-width="4"/>` : `<path d="M${cx} ${cy - r + 3} A${r - 3} ${r - 3} 0 ${f > 0.5 ? 1 : 0} 1 ${cx + (r - 3) * Math.cos(a)} ${cy + (r - 3) * Math.sin(a)}" fill="none" stroke="${C.blue}" stroke-width="4"/>`)
    }
    out.push(`<text x="${cx}" y="${cy + 8}" text-anchor="middle" font-family="${CORM}" font-weight="700" font-size="${i === 2 ? r * 0.72 : r * 0.9}" fill="${C.espresso}">${i === 2 ? `${v} / ${goal}` : v}</text>`)
    // The end labels hug the edges so they never run off the drawing.
    const [lx, anchor] = i === 0 ? [cx - r, 'start'] : i === 3 ? [cx + r, 'end'] : [cx, 'middle']
    out.push(tspanLines(wrapPx(label, step - 4, 11, 'sans').slice(0, 2), lx, cy + r + 18, 13, `text-anchor="${anchor}" font-family="${SANS}" font-weight="700" font-size="11" fill="${C.taupeInk}"`))
  })
  if (zero) out.push(`<text x="4" y="${H - 8}" font-family="${HANDF}" font-weight="500" font-size="18" fill="${C.blue}">every list starts at zero</text>`)
  return { source: `${svgOpen(px, H, fontsCss(fonts, 'c7cv'))}${out.join('')}</svg>`, alt: `Messages sent ${sent}, replies ${replied}, conversations ${talked} of ${goal}, introductions ${intros}.` }
}

// 7.8 The reader promise: the promise in Cormorant inside big quote marks.
export function promiseSvg({ px, fonts, text, fill }) {
  const size = px < 400 ? 21 : 24
  const lines = wrapPx(text, px - 70, size, 'serif').slice(0, 5)
  const lh = Math.round(size * 1.15)
  const h = 50 + lines.length * lh + 30
  return { source: `${svgOpen(px, h + 7, fontsCss(fonts, 'c7cv'))}
  <rect x="7" y="7" width="${px - 9}" height="${h - 2}" rx="14" fill="${C.espresso}"/>
  <rect x="2" y="2" width="${px - 9}" height="${h - 2}" rx="14" fill="${fill || C.sand}" stroke="${C.espresso}" stroke-width="2"/>
  <text x="14" y="58" font-family="${CORM}" font-weight="700" font-size="64" fill="${C.taupe}">“</text>
  ${tspanLines(lines, 44, 44, lh, `font-family="${CORM}" font-weight="700" font-size="${size}" fill="${C.espresso}"`)}
  <text x="44" y="${44 + lines.length * lh + 14}" font-family="${HANDF}" font-weight="500" font-size="19" fill="${C.blue}">your promise to every reader</text>
</svg>`, alt: `Your reader promise: ${text}` }
}

// 7.9 The post arc: numbered stops on a gentle arc, each with its title and type.
export function arcSvg({ px, fonts, posts = [] }) {
  const n = posts.length
  if (!n) return { source: `${svgOpen(px, 10, '')}</svg>`, alt: 'No posts yet.' }
  if (px < 480) {
    const blocks = posts.map((p) => ({ t: wrapPx(p.title, px - 70, 13, 'sans').slice(0, 3), type: p.type }))
    let y = 10
    const out = []
    blocks.forEach((b, i) => {
      const cy = y + 16
      if (i < n - 1) out.push(`<path d="M24 ${cy + 18} Q ${i % 2 ? 10 : 38} ${cy + 34} 24 ${cy + 50 + b.t.length * 8}" stroke="${C.espresso}" stroke-width="1.8" fill="none" stroke-dasharray="4 4"/>`)
      out.push(`<circle cx="24" cy="${cy}" r="16" fill="${i === 0 ? C.butter : C.white}" stroke="${C.espresso}" stroke-width="2"/><text x="24" y="${cy + 6}" text-anchor="middle" font-family="${CORM}" font-weight="700" font-size="18" fill="${C.espresso}">${i + 1}</text>`)
      out.push(tspanLines(b.t, 52, cy - 2, 15, `font-family="${SANS}" font-weight="700" font-size="13" fill="${C.espresso}"`))
      if (b.type) out.push(`<text x="52" y="${cy + b.t.length * 15 + 2}" font-family="${HANDF}" font-weight="500" font-size="16" fill="${C.taupeInk}">${esc(b.type)}</text>`)
      y += Math.max(56, b.t.length * 15 + 34)
    })
    return { source: `${svgOpen(px, y + 4, fontsCss(fonts, 'c7cv'))}${out.join('')}</svg>`, alt: `Your first posts, in order: ${posts.map((p, i) => `${i + 1}. ${p.title}${p.type ? ` (${p.type})` : ''}`).join('; ')}.` }
  }
  const step = (px - 60) / Math.max(1, n - 1)
  const yOf = (i) => 40 + Math.round(26 * Math.sin((Math.PI * i) / Math.max(1, n - 1)) * -1) + 26
  const out = [`<path d="${posts.map((_, i) => `${i ? 'L' : 'M'}${30 + i * step} ${yOf(i)}`).join(' ')}" stroke="${C.espresso}" stroke-width="1.8" fill="none" stroke-dasharray="5 5"/>`]
  let maxLines = 1
  posts.forEach((p, i) => {
    const cx = 30 + i * step
    const t = wrapPx(p.title, Math.min(step - 8, 170), 12, 'sans').slice(0, 4)
    maxLines = Math.max(maxLines, t.length)
    out.push(`<circle cx="${cx}" cy="${yOf(i)}" r="17" fill="${i === 0 ? C.butter : C.white}" stroke="${C.espresso}" stroke-width="2"/><text x="${cx}" y="${yOf(i) + 6}" text-anchor="middle" font-family="${CORM}" font-weight="700" font-size="19" fill="${C.espresso}">${i + 1}</text>`)
    const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'
    const tx = i === 0 ? cx - 16 : i === n - 1 ? cx + 16 : cx
    out.push(tspanLines(t, tx, 112, 14, `text-anchor="${anchor}" font-family="${SANS}" font-weight="700" font-size="12" fill="${C.espresso}"`))
    if (p.type) out.push(`<text x="${tx}" y="${112 + t.length * 14 + 4}" text-anchor="${anchor}" font-family="${HANDF}" font-weight="500" font-size="16" fill="${C.taupeInk}">${esc(p.type)}</text>`)
  })
  const H = 112 + maxLines * 14 + 26
  return { source: `${svgOpen(px, H, fontsCss(fonts, 'c7cv'))}${out.join('')}</svg>`, alt: `Your first posts, in order: ${posts.map((p, i) => `${i + 1}. ${p.title}${p.type ? ` (${p.type})` : ''}`).join('; ')}.` }
}

// 7.12 The welcome letter: tape, a headline with a highlighter drawn in once,
// a few lines from Gabriela in Caveat, and her photo if there is one.
export function welcomeSvg({ px, fonts, name, photo }) {
  const narrow = px < 420
  const hs = narrow ? 27 : 32
  const head = "Let's find what you could get paid for."
  const hl = wrapPx(head.replace('get paid for.', 'get\u00a0paid\u00a0for.'), px - 60, hs, 'cormorant').map((l) => l.replace(/\u00a0/g, ' '))
  const letter = `Hi ${name || 'there'}, I'm Gabriela. I've helped 500+ people turn what they already know into income. Uncapped is my method, and I'll be in the margin the whole way.`
  const ls = narrow ? 20 : 22
  const lt = wrapPx(letter, px - 60, ls, 'caveat')
  const lhH = Math.round(hs * 1.1)
  const lhL = Math.round(ls * 1.1)
  const topY = 44
  const sigY = topY + hl.length * lhH + 22 + lt.length * lhL + 12
  const h = sigY + (photo ? 46 : 24)
  // The pink highlighter sits under "get paid for", on whichever line it lands.
  const li = hl.findIndex((l) => l.includes('paid'))
  const lineText = hl[Math.max(0, li)] || ''
  const startCh = Math.max(0, lineText.indexOf('get paid'))
  const hx = 28 + textW(lineText.slice(0, startCh), hs)
  const hw = textW('get paid for', hs)
  const hy = topY + Math.max(0, li) * lhH + 6
  return { source: `${svgOpen(px, h + 8, fontsCss(fonts, 'c6cv'))}
  <g transform="rotate(-1 ${px / 2} ${h / 2})">
    <rect x="9" y="11" width="${px - 18}" height="${h - 6}" rx="6" fill="${C.espresso}"/>
    <rect x="4" y="6" width="${px - 18}" height="${h - 6}" rx="6" fill="${C.cream}" stroke="${C.espresso}" stroke-width="2"/>
    <rect x="${px / 2 - 50}" y="-2" width="100" height="22" fill="${C.pink}" fill-opacity="0.85" transform="rotate(-3 ${px / 2} 9)"/>
    <rect x="${hx}" y="${hy}" width="${hw}" height="${Math.round(hs * 0.32)}" fill="${C.pink}" opacity="0.9"><animate attributeName="width" from="0" to="${hw}" dur="0.9s" fill="freeze"/></rect>
    ${tspanLines(hl, 28, topY, lhH, `font-family="${CORM}" font-weight="600" font-size="${hs}" fill="${C.espresso}"`)}
    ${tspanLines(lt, 28, topY + hl.length * lhH + 18, lhL, `font-family="${HANDF}" font-weight="500" font-size="${ls}" fill="${C.blue}"`)}
    ${photo ? `<defs><clipPath id="wp"><circle cx="${48}" cy="${sigY + 14}" r="22"/></clipPath></defs><image href="data:image/jpeg;base64,${photo}" x="26" y="${sigY - 8}" width="44" height="44" clip-path="url(#wp)" preserveAspectRatio="xMidYMid slice"/><circle cx="48" cy="${sigY + 14}" r="22" fill="none" stroke="${C.espresso}" stroke-width="2"/>` : ''}
    <text x="${photo ? 80 : 28}" y="${sigY + (photo ? 21 : 6)}" font-family="${HANDF}" font-weight="500" font-size="${ls + 2}" fill="${C.blue}">Gabriela x</text>
  </g>
</svg>`, alt: `${head} ${letter} Gabriela x` }
}

// 7.14 Step complete: three stars pop once, with a line in Caveat.
export function celebrateSvg({ px, fonts, line }) {
  const pop = (d) => `<animateTransform attributeName="transform" type="scale" values="0;1.15;1" keyTimes="0;0.7;1" dur="0.6s" begin="${d}s" fill="freeze" additive="sum"/>`
  const s = (x, size, fill, d) => `<g transform="translate(${x} 34)"><g>${pop(d)}<path transform="translate(${-size / 2} ${-size / 2}) scale(${size / 24})" d="M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6z" fill="${fill}" stroke="${C.espresso}" stroke-width="1"/></g></g>`
  const lines = wrapPx(line, px - 140, 24, 'caveat').slice(0, 2)
  const h = Math.max(68, 30 + lines.length * 26)
  return { source: `${svgOpen(px, h, fontsCss(fonts, 'cv'))}${s(24, 34, C.blue, 0)}${s(62, 26, C.pink, 0.12)}${s(94, 30, C.butter, 0.24)}${tspanLines(lines, 124, 40, 26, `font-family="${HANDF}" font-weight="500" font-size="24" fill="${C.espresso}"`)}</svg>`, alt: `Three stars: ${line}` }
}

// While the portfolio garden grows: a little stop-motion, one frame at a time
// (dig, drop a seed, water it, a sprout). The panel moves to the next frame
// about once a second, so it doesn't depend on SVG animation.
export const PLANTING_FRAMES = 4
export function plantingSvg({ px, fonts, frame = 0 }) {
  const f = ((Number(frame) || 0) % PLANTING_FRAMES + PLANTING_FRAMES) % PLANTING_FRAMES
  const SOIL = '#7A5A43'
  const W = 300
  const ox = Math.max(0, Math.round((px - W) / 2))
  const ink = `stroke="${C.espresso}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`
  const bed = `<path d="M24 98 Q150 84 276 98 L276 110 Q150 122 24 110 Z" fill="${SOIL}" ${ink}/>`
  const parts = []
  if (f === 0) {
    // a trowel digs in, soil flying
    parts.push(`<g transform="rotate(-28 150 70)"><rect x="143" y="22" width="14" height="34" rx="6" fill="${C.butter}" ${ink}/><path d="M138 56 L162 56 L150 96 Z" fill="${C.taupeLight}" ${ink}/></g>`)
    parts.push(`<circle cx="186" cy="74" r="3.5" fill="${SOIL}"/><circle cx="198" cy="84" r="2.5" fill="${SOIL}"/><circle cx="178" cy="62" r="2.5" fill="${SOIL}"/>`)
  } else if (f === 1) {
    // a seed drops into the hole
    parts.push(`<ellipse cx="150" cy="96" rx="16" ry="5" fill="${C.espresso}"/>`)
    parts.push(`<ellipse cx="150" cy="58" rx="7" ry="10" fill="#C68B4E" ${ink}/>`)
    parts.push(`<path d="M138 34 L138 44 M150 28 L150 40 M162 34 L162 44" ${ink} fill="none"/>`)
  } else if (f === 2) {
    // the watering can
    parts.push(`<path d="M150 92 Q150 84 158 84 Q166 84 166 92" fill="${SOIL}" ${ink}/>`)
    parts.push(`<g transform="rotate(24 92 48)"><rect x="62" y="34" width="56" height="38" rx="9" fill="${C.blue}" ${ink}/><path d="M118 46 L150 30" ${ink} fill="none"/><rect x="146" y="22" width="12" height="12" rx="3" fill="${C.blue}" ${ink}/><path d="M70 34 Q90 10 110 34" fill="none" ${ink}/></g>`)
    for (const [x, y] of [[156, 62], [166, 72], [148, 76], [162, 52]]) parts.push(`<path d="M${x} ${y - 5} Q${x + 4} ${y + 1} ${x} ${y + 4} Q${x - 4} ${y + 1} ${x} ${y - 5} Z" fill="${C.blueLight}" stroke="${C.blue}" stroke-width="1.4"/>`)
  } else {
    // a sprout, and a star for it
    parts.push(`<path d="M150 98 Q148 82 152 64" fill="none" stroke="${C.green}" stroke-width="4" stroke-linecap="round"/>`)
    parts.push(`<ellipse cx="138" cy="66" rx="14" ry="7" transform="rotate(-24 138 66)" fill="${C.greenTint}" stroke="${C.green}" stroke-width="2"/>`)
    parts.push(`<ellipse cx="166" cy="58" rx="16" ry="8" transform="rotate(-36 166 58)" fill="${C.greenTint}" stroke="${C.green}" stroke-width="2"/>`)
    parts.push(`<g transform="translate(206 38)"><path transform="translate(-11 -11) scale(0.92)" d="M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6z" fill="${C.butter}" stroke="${C.espresso}" stroke-width="1"/></g>`)
  }
  const words = ['digging in…', 'planting your ideas…', 'watering…', 'something’s growing!'][f]
  const h = 156
  return {
    source: `${svgOpen(px, h, fontsCss(fonts, 'cv'))}<g transform="translate(${ox} 0)">${bed}${parts.join('')}<text x="150" y="146" text-anchor="middle" font-family="${HANDF}" font-weight="500" font-size="24" fill="${C.blue}">${esc(words)}</text></g></svg>`,
    alt: `Your portfolio garden is growing: ${words.replace('…', '')}`,
  }
}

// 7.11 Your map, restyled: the ten builders in phase rows. Done in green
// tint, where you are in butter with a star, the rest white; the ones still
// to come dashed and marked "coming soon".
export function builderMapSvg2({ px, fonts, states = {} }) {
  const phases = Object.keys(PHASES)
  const gap = 8
  const bh = 34
  let y = 6
  const out = []
  for (const ph of phases) {
    const steps = STEPS.filter((s) => s.phase === ph)
    out.push(`<text x="2" y="${y + 10}" font-family="${SANS}" font-weight="700" font-size="10" letter-spacing="1.2" fill="${C.taupeInk}">${esc(PHASES[ph].name.toUpperCase())}</text>`)
    y += 16
    const cols = px < 420 ? Math.min(2, steps.length) : steps.length
    const bw = Math.floor((px - 4 - gap * (cols - 1)) / cols)
    steps.forEach((s, i) => {
      const x = 2 + (i % cols) * (bw + gap)
      const yy = y + Math.floor(i / cols) * (bh + gap)
      const st = states[s.id] || (s.live ? 'todo' : 'soon')
      const fill = st === 'done' ? C.greenTint : st === 'here' ? C.butter : st === 'soon' ? C.cream : C.white
      out.push(`<rect x="${x}" y="${yy}" width="${bw}" height="${bh}" rx="9" fill="${fill}" stroke="${st === 'soon' ? C.taupe : st === 'done' ? C.green : C.espresso}" stroke-width="1.6"${st === 'soon' ? ' stroke-dasharray="5 4"' : ''}/>`)
      out.push(`<text x="${x + 10}" y="${yy + (st === 'soon' ? 15 : 21)}" font-family="${SANS}" font-weight="700" font-size="${bw < 90 ? 10.5 : 12}" fill="${st === 'soon' ? C.taupeInk : C.espresso}">${esc(`${s.n}. ${s.name}`)}${st === 'done' ? ' ✓' : ''}</text>`)
      if (st === 'soon') out.push(`<text x="${x + 10}" y="${yy + 28}" font-family="${HANDF}" font-weight="500" font-size="13" fill="${C.taupeInk}">coming soon</text>`)
      if (st === 'here') out.push(`<g transform="translate(${x + bw - 22} ${yy - 8})">${star(0, 0, 18, C.blue)}</g>`)
    })
    y += Math.ceil(steps.length / cols) * (bh + gap) + 6
  }
  return { source: `${svgOpen(px, y, fontsCss(fonts, 'cv'))}${out.join('')}</svg>`, alt: `Your map of ten builders: ${STEPS.map((s) => `${s.n}. ${s.name}, ${({ done: 'done', here: "you're here", todo: 'to do', soon: 'coming soon' })[states[s.id] || (s.live ? 'todo' : 'soon')]}`).join('; ')}.` }
}

// 7.6 The featured offer card, restyled: a blue hard shadow, and an optional
// sticker on its top-right edge ("my pick!").
export function offerCardSvg3(offer, { px, fonts, sticker }) {
  const base = offerCardSvg2(offer, { px: px - (sticker ? 6 : 0), fonts })
  if (!sticker) return base
  const m = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(base)
  const w = Number(m[1]); const h = Number(m[2])
  return base.replace(`viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"`, `viewBox="0 -14 ${px} ${h + 14}" width="${px}" height="${h + 14}"`).replace('</svg>', `${stickerAt(px - 108, -12, sticker, C.butter, 4, 17)}</svg>`)
}

// The path on Welcome (SCREENS S0): the live steps as medallions on a dotted,
// hand-drawn trail, each with its promise in Caveat; top to bottom when narrow.
export function pathSvg({ px, fonts, steps = [] }) {
  const n = steps.length
  const out = []
  if (px < 480) {
    let y = 26
    steps.forEach((s, i) => {
      const prom = wrapPx(s.promise, px - 80, 18, 'caveat').slice(0, 2)
      if (i < n - 1) out.push(`<path d="M24 ${y + 22} Q 34 ${y + 40} 24 ${y + 58 + prom.length * 10}" stroke="${C.taupe}" stroke-width="2" fill="none" stroke-dasharray="2 6" stroke-linecap="round"/>`)
      out.push(`<circle cx="24" cy="${y}" r="20" fill="${PHASES[s.phase]?.color || C.white}" stroke="${C.espresso}" stroke-width="2"/><text x="24" y="${y + 7}" text-anchor="middle" font-family="${CORM}" font-weight="700" font-size="20" fill="${PHASES[s.phase]?.text || C.espresso}">${i + 1}</text>`)
      out.push(`<text x="56" y="${y - 2}" font-family="${SANS}" font-weight="700" font-size="13" fill="${C.espresso}">${esc(s.name)}</text>`)
      out.push(tspanLines(prom, 56, y + 18, 19, `font-family="${HANDF}" font-weight="500" font-size="18" fill="${C.blue}"`))
      y += 50 + prom.length * 19
    })
    return { source: `${svgOpen(px, y - 14, fontsCss(fonts, 'c7cv'))}${out.join('')}</svg>`, alt: `Your path: ${steps.map((s, i) => `${i + 1}. ${s.name}, ${s.promise}`).join('; ')}.` }
  }
  const step = (px - 60) / Math.max(1, n - 1)
  let maxLines = 1
  out.push(`<path d="${steps.map((_, i) => `${i ? 'Q' : 'M'}${i ? `${30 + (i - 0.5) * step} ${i % 2 ? 14 : 46} ` : ''}${30 + i * step} 30`).join(' ')}" stroke="${C.taupe}" stroke-width="2" fill="none" stroke-dasharray="2 6" stroke-linecap="round"/>`)
  steps.forEach((s, i) => {
    const cx = 30 + i * step
    const prom = wrapPx(s.promise, Math.min(step - 10, 150), 17, 'caveat').slice(0, 3)
    maxLines = Math.max(maxLines, prom.length)
    const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'
    const tx = i === 0 ? cx - 20 : i === n - 1 ? cx + 20 : cx
    out.push(`<circle cx="${cx}" cy="30" r="21" fill="${PHASES[s.phase]?.color || C.white}" stroke="${C.espresso}" stroke-width="2"/><text x="${cx}" y="37" text-anchor="middle" font-family="${CORM}" font-weight="700" font-size="21" fill="${PHASES[s.phase]?.text || C.espresso}">${i + 1}</text>`)
    out.push(`<text x="${tx}" y="74" text-anchor="${anchor}" font-family="${SANS}" font-weight="700" font-size="13" fill="${C.espresso}">${esc(s.name)}</text>`)
    out.push(tspanLines(prom, tx, 94, 18, `text-anchor="${anchor}" font-family="${HANDF}" font-weight="500" font-size="17" fill="${C.blue}"`))
  })
  return { source: `${svgOpen(px, 94 + maxLines * 18, fontsCss(fonts, 'c7cv'))}${out.join('')}</svg>`, alt: `Your path: ${steps.map((s, i) => `${i + 1}. ${s.name}, ${s.promise}`).join('; ')}.` }
}

// Small dots for a count (Discover's themes): filled for covered, open for not yet.
export function dotsSvg({ done, total, size = 6 }) {
  const g = size + 5
  const w = total * g
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${size + 4}" width="${w}" height="${size + 4}">${Array.from({ length: total }, (_, i) => `<circle cx="${i * g + size / 2 + 2}" cy="${size / 2 + 2}" r="${size / 2}" fill="${i < done ? C.espresso : C.white}" stroke="${C.espresso}" stroke-width="1"/>`).join('')}</svg>`
}


// ======================================================================
// Version 2 (DESIGN.md, 11 Nov 2026): one set of keys for light (V) and dark
// (VD). Components read T, never a raw hex. Claude Desktop doesn't tell a
// panel its appearance (Claude Code 2.1.321), so T is the light set for now;
// VD is kept ready and checked by design-system/contrast.py.
export const V = {
  bg: '#F7F5ED', surface: '#FFFFFF', inset: '#EEEAE0', hover: '#FBFAF5', line: '#D9D0C3', lineStrong: '#2A1F1D',
  heading: '#2A1F1D', body: '#1F1815', meta: '#6B5F53', disabled: '#8F8273',
  accent: '#2B3BFF', accentFill: '#2B3BFF', onAccent: '#FFFFFF', wordmark: '#2B3BFF',
  nextBg: '#FFF3A8', nextBorder: '#2A1F1D', nextHover: '#FFEE8A',
  decideBg: '#FBDDE3', decideBorder: '#2A1F1D',
  workingBg: '#E2E5FF', workingBorder: '#2B3BFF',
  doneBg: '#DFF3E7', doneBorder: '#1E7A4C', doneText: '#186A41',
  highlight: '#FFD45C',
  lensPublish: '#E8E0D3', lensPackage: '#2A1F1D', lensTeach: '#FFD45C', lensWith: '#F4A6B8', lensFor: '#2B3BFF',
  onLensPublish: '#1F1815', onLensPackage: '#F7F5ED', onLensTeach: '#1F1815', onLensWith: '#1F1815', onLensFor: '#FFFFFF',
  artInk: '#2A1F1D', artShadow: '#2A1F1D', artAccent: '#2B3BFF',
  // soft brand washes for kinds of block (11 Nov, Gabriela: "more variation, more colour")
  washPink: '#FDEEF2', washButter: '#FFF8D6', washBlue: '#EEF0FF', washGreen: '#E9F6EE',
  spinePink: '#F4A6B8', spineButter: '#FFD45C', spineGreen: '#1E7A4C',
}
export const VD = {
  bg: '#1F1815', surface: '#2A1F1D', inset: '#362A26', hover: '#332723', line: '#5A4B43', lineStrong: '#7A6A5E',
  heading: '#F3EDE4', body: '#E3DCD1', meta: '#B8AC9D', disabled: '#8F8273',
  accent: '#9AA2FF', accentFill: '#9AA2FF', onAccent: '#1F1815', wordmark: '#F4A6B8',
  nextBg: '#3A3019', nextBorder: '#FFD45C', nextHover: '#463A1D',
  decideBg: '#3E2129', decideBorder: '#F4A6B8',
  workingBg: '#20244A', workingBorder: '#9AA2FF',
  doneBg: '#16332A', doneBorder: '#6FD19C', doneText: '#6FD19C',
  highlight: '#FFD45C',
  lensPublish: '#6B5F53', lensPackage: '#E3DCD1', lensTeach: '#FFD45C', lensWith: '#F4A6B8', lensFor: '#9AA2FF',
  onLensPublish: '#F3EDE4', onLensPackage: '#1F1815', onLensTeach: '#1F1815', onLensWith: '#1F1815', onLensFor: '#1F1815',
  artInk: '#7A6A5E', artShadow: '#0C0908', artAccent: '#9AA2FF',
  washPink: '#35232A', washButter: '#332B1A', washBlue: '#1F2238', washGreen: '#17291F',
  spinePink: '#F4A6B8', spineButter: '#FFD45C', spineGreen: '#6FD19C',
}
// The lens fill and the text that sits on it, by way of earning.
export const LENS_FILL = { publish: ['lensPublish', 'onLensPublish'], package: ['lensPackage', 'onLensPackage'], teach: ['lensTeach', 'onLensTeach'], with: ['lensWith', 'onLensWith'], for: ['lensFor', 'onLensFor'] }

// A small progress bar for a metric tile (7.2): 6 px high, no font.
export function barSvg({ n = 0, total = 10, w = 120, T = V }) {
  const f = Math.max(0, Math.min(1, total ? n / total : 0))
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 6" width="${w}" height="6"><rect width="${w}" height="6" rx="3" fill="${T.inset}"/>${f > 0 ? `<rect width="${Math.max(6, Math.round(w * f))}" height="6" rx="3" fill="${T.accentFill}"/>` : ''}</svg>`
}

// The step title (7.1): Cormorant Garamond 600 in an SVG, heading colour.
export function serifTitleSvg(text, { px, fonts, size = 28, color = V.heading }) {
  const lines = wrapPx(text, px - 8, size, 'cormorant')
  const lh = Math.round(size * 1.12)
  const h = lines.length * lh + Math.round(size * 0.3)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${px} ${h}" width="${px}" height="${h}">
  <defs><style>${face('Cormorant Garamond', fonts?.corm600, 600)}</style></defs>
  ${lines.map((l, i) => `<text x="0" y="${(i + 1) * lh - Math.round(size * 0.2)}" font-family="'Cormorant Garamond', Baskerville, Georgia, serif" font-weight="600" font-size="${size}" fill="${color}">${esc(l)}</text>`).join('')}
</svg>`
}

// Your map (11 Nov, Gabriela: "make it an actual map… one picture"): a route
// through the ten builders. Wide: two rows joined by a bend; narrow: one column.
// Stations: done (green, tick), here (blue ring), open (white), soon (dashed).
export function routeMapSvg({ px, states = {} }) {
  const T = V
  const PHC = { find: T.spineButter, shape: T.spinePink, sell: T.accent, show: T.spineGreen, run: '#B9AC97' }
  const wide = px >= 520
  const r = 15
  const pts = []
  let W = px, H
  const split = (name) => { const ws = String(name).split(' '); const lines = ['']; for (const w of ws) { if ((lines[lines.length - 1] + ' ' + w).trim().length > 13 && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = (lines[lines.length - 1] + ' ' + w).trim() } return lines.slice(0, 2) }
  if (wide) {
    const m = 30, colw = (W - 2 * m) / 5
    const y1 = 78, y2 = 214
    STEPS.forEach((s, i) => { const row = i < 5 ? 0 : 1; const col = row ? 4 - (i - 5) : i; pts.push({ s, x: m + colw * (col + 0.5), y: row ? y2 : y1, row }) })
    H = 316
  } else {
    const x = 46, top = 40, step = 62
    STEPS.forEach((s, i) => pts.push({ s, x, y: top + i * step, row: 0 }))
    H = top + 9 * step + 44
  }
  const out = []
  // the card the map sits on: paper, an espresso outline and a hard shadow
  out.push(`<rect x="6" y="6" width="${W - 10}" height="${H - 10}" rx="14" fill="${T.artShadow}"/><rect x="2" y="2" width="${W - 10}" height="${H - 10}" rx="14" fill="${T.surface}" stroke="${T.artInk}" stroke-width="2"/>`)
  // the route, one segment per step, in the colour of the phase it leads into
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    const soon = !b.s.live
    const col = PHC[b.s.phase] || T.line
    const dash = soon ? ' stroke-dasharray="2 9" opacity="0.8"' : ''
    if (wide && a.row !== b.row) {
      const bx = W - 12
      out.push(`<path d="M${a.x} ${a.y} C ${bx} ${a.y}, ${bx} ${b.y}, ${b.x} ${b.y}" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round"${dash}/>`)
    } else out.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${col}" stroke-width="7" stroke-linecap="round"${dash}/>`)
  }
  // phase names over (row 1) or under (row 2) their stations
  const phases = Object.keys(PHASES)
  for (const ph of phases) {
    for (const row of wide ? [0, 1] : [0]) {
      const ps = pts.filter((p) => p.s.phase === ph && p.row === row)
      if (!ps.length) continue
      if (wide) {
        const cx = (Math.min(...ps.map((p) => p.x)) + Math.max(...ps.map((p) => p.x))) / 2
        const y = row ? ps[0].y + 72 : ps[0].y - 34
        out.push(`<text x="${cx}" y="${y}" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="10.5" letter-spacing="1.3" fill="${PHC[ph] === T.spineButter ? '#8A6A00' : PHC[ph] === T.spinePink ? '#A8405E' : PHC[ph] === '#B9AC97' ? T.meta : PHC[ph]}">${esc(PHASES[ph].name.toUpperCase())}</text>`)
      } else {
        const p = ps[0]
        out.push(`<text x="${p.x + 30}" y="${p.y - 22}" font-family="${SANS}" font-weight="700" font-size="10" letter-spacing="1.2" fill="${T.meta}">${esc(PHASES[ph].name.toUpperCase())}</text>`)
      }
    }
  }
  // stations and their names
  for (const p of pts) {
    const st = states[p.s.id] || (p.s.live ? 'todo' : 'soon')
    const fill = st === 'done' ? T.spineGreen : st === 'here' ? T.accentFill : T.surface
    const stroke = st === 'done' ? T.spineGreen : st === 'here' ? T.accentFill : st === 'soon' ? T.disabled : T.artInk
    const ring = st === 'here' ? `<circle cx="${p.x}" cy="${p.y}" r="${r + 6}" fill="none" stroke="${T.accentFill}" stroke-width="2" opacity="0.45"/>` : ''
    const mark = st === 'done' ? '✓' : String(p.s.n)
    const markFill = st === 'done' || st === 'here' ? '#FFFFFF' : st === 'soon' ? T.meta : T.heading
    out.push(`${ring}<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2.2"${st === 'soon' ? ' stroke-dasharray="3 3"' : ''}/><text x="${p.x}" y="${p.y + 4.5}" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="13" fill="${markFill}">${esc(mark)}</text>`)
    const lines = split(p.s.name)
    const word = st === 'done' ? 'Done' : st === 'here' ? "You're here" : st === 'soon' ? 'Coming soon' : 'Open'
    const wordFill = st === 'done' ? T.doneText : st === 'here' ? T.accent : T.meta
    if (wide) {
      const y0 = p.y + r + 17
      lines.forEach((l, k) => out.push(`<text x="${p.x}" y="${y0 + k * 15}" text-anchor="middle" font-family="${SANS}" font-weight="${st === 'soon' ? 500 : 700}" font-size="12.5" fill="${st === 'soon' ? T.meta : T.heading}">${esc(l)}</text>`))
      out.push(`<text x="${p.x}" y="${y0 + lines.length * 15 + 1}" text-anchor="middle" font-family="${SANS}" font-size="10.5" fill="${wordFill}">${esc(word)}</text>`)
    } else {
      out.push(`<text x="${p.x + 30}" y="${p.y + 1}" font-family="${SANS}" font-weight="${st === 'soon' ? 500 : 700}" font-size="13" fill="${st === 'soon' ? T.meta : T.heading}">${esc(p.s.name)}</text>`)
      out.push(`<text x="${p.x + 30}" y="${p.y + 16}" font-family="${SANS}" font-size="11" fill="${wordFill}">${esc(word)}</text>`)
    }
  }
  const alt = `Your map: ${STEPS.map((s) => `${s.n}. ${s.name}, ${({ done: 'done', here: "you're here", todo: 'open', soon: 'coming soon' })[states[s.id] || (s.live ? 'todo' : 'soon')]}`).join('; ')}.`
  return { source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${out.join('')}</svg>`, alt }
}
