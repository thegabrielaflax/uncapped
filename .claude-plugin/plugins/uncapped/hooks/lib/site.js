// The starter one-page website the Website Builder saves to
// my-work/website/index.html. It is deliberately plain and well made, in the
// customer's name, not Uncapped's: a starting point they rebuild with AI.

import { esc } from './brand.js'

export function siteHtml(out, work) {
  const name = esc(work?.profile?.name || 'Your name')
  const h = out.hero || {}
  const gap = out.gap || {}
  const about = out.about || {}
  const proof = out.proof || {}
  const closing = out.closing || {}
  const offers = (out.offers || []).map((o) => `<div class="offer"><h3>${esc(o.name)}</h3><p>${esc(o.description)}</p>${o.price ? `<p class="price">${esc(o.price)}</p>` : ''}</div>`).join('')
  const faq = (out.faq || []).map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')
  const points = (proof.points || []).map((p) => `<li>${esc(p)}</li>`).join('')
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name}</title>
<style>
:root{--ink:#1d1d1f;--muted:#5e5e66;--accent:#2B3BFF;--bg:#fbfaf7;--card:#fff;--line:#e6e2d8}
*{box-sizing:border-box}body{margin:0;font:18px/1.6 -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;color:var(--ink);background:var(--bg)}
main{max-width:860px;margin:0 auto;padding:48px 20px 80px;display:flex;flex-direction:column;gap:56px}
h1,h2,h3{font-family:Georgia,"Times New Roman",serif;line-height:1.1;margin:0 0 12px}h1{font-size:clamp(36px,6vw,56px)}h2{font-size:30px}
.brand{font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:13px;color:var(--muted)}
.cta{display:inline-block;margin-top:16px;padding:14px 26px;border-radius:999px;background:var(--accent);color:#fff;text-decoration:none;font-weight:700}
.offers{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}.offer{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px}.price{font-weight:700}
details{border-bottom:1px solid var(--line);padding:12px 0}summary{cursor:pointer;font-weight:600}
</style></head><body><main>
<section><div class="brand">${name}</div><h1>${esc(h.headline)}</h1><p>${esc(h.subhead)}</p><a class="cta" href="#contact">${esc(h.cta || 'Get in touch')}</a></section>
<section><h2>${esc(gap.heading)}</h2><p>${esc(gap.body)}</p></section>
<section><h2>How I can help</h2><div class="offers">${offers}</div></section>
${points ? `<section><h2>${esc(proof.heading || 'Results')}</h2><ul>${points}</ul></section>` : ''}
<section><h2>${esc(about.heading || 'About')}</h2><p>${esc(about.body)}</p></section>
${faq ? `<section><h2>Questions</h2>${faq}</section>` : ''}
<section id="contact"><h2>${esc(closing.heading)}</h2><a class="cta" href="#">${esc(closing.cta || h.cta || 'Get in touch')}</a></section>
</main></body></html>`
}
