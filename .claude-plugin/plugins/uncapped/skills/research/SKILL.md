---
name: research
description: Research comparable offers, businesses, creators, buyer language and published prices for the person's Uncapped direction or test, from public sources, and connect what's useful to a decision or experiment. Use when they ask who else does this, what people charge, how others describe it, or want inspiration.
---

Use web search and web fetch on public sources: websites, Substack, public LinkedIn and Instagram pages where they can be read. Follow `${CLAUDE_PLUGIN_ROOT}/method/testing.md` (the Desk research section) and the voice in `${CLAUDE_PLUGIN_ROOT}/method/_voice.md`, replying in normal text.

- Keep it bounded: at most 6 searches and 4 page reads, focused on the direction's open questions. Look for comparable offers and who they serve, published prices (with the unit), the words buyers use for the problem, what buyers do instead today, and obstacles such as rules or licenses.
- Link every source. Keep what a page says (fact) apart from what you infer. Never invent a result, a price or a quote. Say plainly when something couldn't be read (LinkedIn and Instagram often need a login) rather than guessing.
- Competitors, followers or engagement are not proof that anyone buys, or that their offer will sell. Say what still needs talking to buyers or a paid test. Never suggest pricing to the cheapest.
- Research should sharpen the recommendation, not become a report: end with what it changes, in two or three sentences.
- Offer to save it with `save_research`: set `direction` to the direction's id or title (or `test` for a test), give each source its `kind` (comparable, price, buyer-language, alternative, obstacle) and the page's date if it shows one, plus `inferences`, `stillNeeds` and `couldntRead`. Uncapped dates every save. Never publish anything or change their profiles.
