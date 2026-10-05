# SEO slop and content-farm fragments

> Content-farm patterns, clickbait templates, and search-optimized synthetic prose engineered to capture traffic rather than serve readers.

**Hit list:** [`hitlists/seo-slop-fragments.json`](../hitlists/seo-slop-fragments.json)  
**Signal strength:** Strong contextual for clickbait variants  
**False-positive risk:** Medium — SEO templates serve genuine traffic functions  

## Why it reads as slop

Ahrefs (2024) found 74% of new webpages include AI content. Title templates (*The Ultimate Guide to, Everything You Need to Know*) promise comprehensiveness while inviting keyword-stuffed padding. Listicle frames (*Top 10 Tips, 7 Things You Need to Know*) reduce complex topics to arbitrary numbered lists. Engagement bait (*You Won’t Believe Number 7*) exploits loss aversion and curiosity gaps.

## What it looks like

*The Ultimate Guide to [Topic]* — superlative promise that nearly never delivers. *Everything You Need to Know About [Topic]* — implicit contract the content cannot fulfill. *You Won’t Believe Number [X]* — pure engagement bait. *[Number] Proven Strategies* — “proven” demands evidence that almost never follows. *How to [Do Something] (The Complete Guide)* — double-decker title stacking every SEO keyword.

## How to rewrite it

Apply these strategies from [strategies.md](strategies.md), in this order of preference:

- **Add authorship**: add lived observation, domain knowledge and a point of view only the writer has.
- **De-hype**: replace the amplifier with the measured effect.
- **Specify**: replace abstraction with concrete nouns, dates, people and mechanisms: who did what, when, with what result.

Use the `replacement` field in the hit list as a starting point, not a drop-in. A replacement that does not carry a real fact is just a different filler phrase.

## When not to flag it

A single hit is a prompt to check the sentence, not a verdict. Flag a passage when markers cluster (two or more per 100 words is worth a look, five or more is a strong signal) and when the text could have said something more specific. Never treat a hit as evidence of who or what wrote the text. See [the editorial policy](../docs/editorial-policy.md).
