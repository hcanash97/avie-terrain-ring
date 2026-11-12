# Independent review brief: À Vie Terrain Ring configurator

Paste this to a reviewing AI that can **open and interact with web pages in a real browser**
(for example ChatGPT agent mode, Claude in Chrome, Gemini with browsing, or Perplexity Comet).
Tools that only fetch page text will see an empty page, because the ring is drawn with WebGL.

---

You are reviewing a prototype 3D ring configurator for À Vie Diamonds, a UK bespoke jeweller.
Be critical and specific. Do not soften findings.

**Prototype:** https://claude.ai/artifact/CGRQ13s5c5kgj6JMji3ojB
**Benchmark (an established competitor in the same category):** https://wildring.studio/design
**Brand reference:** https://aviediamonds.com

Notes on the prototype:
- The live map and place search are disabled on this hosted preview (the host blocks external
  map servers). The seven suggested places (Snowdon, Ben Nevis, Matterhorn, Table Mountain,
  Mount Fuji, Grand Canyon, Lake District) use real saved elevation data.
- "Add to cart" is intentionally not connected yet.

## Tasks

1. In the prototype, go through all four steps (Place, Landscape, Ring, Size & review). Try at
   least three places, all three weights, all three shoulder styles, all three band profiles,
   silver and 18ct gold, and the terrain-height slider at its minimum and maximum. Drag the ring
   to view it from the side, front and above.
2. In the benchmark, configure a comparable signet ring for one of the same places.
3. Compare the two on each point below. For each, give a score from 1 to 5 for the prototype,
   what the benchmark does better (if anything), and the single most important fix.

| # | Area | What to judge |
|---|------|---------------|
| 1 | Ring silhouette | Does it read as a refined signet? Head height, corner bulk, shoulder flow, band slimness |
| 2 | Terrain sculpting | Is the landscape recognisable? Crisp ridges vs. melted/blobby; relief depth |
| 3 | Metal rendering | Do silver and gold look like real polished/satin metal or like plastic? |
| 4 | Proportions per weight | Do Slim / Standard / Bold differ sensibly? Anything clumsy? |
| 5 | Controls | Are the options understandable? Is anything missing that the benchmark offers? |
| 6 | Flow and copy | Is the step order logical? Is the copy clear, calm, on-brand for À Vie? |
| 7 | Brand fit | Does it look like part of aviediamonds.com (Trirong, off-white, dark green, muted gold)? |
| 8 | Mobile | Resize to phone width. Anything cramped, overlapping or hard to use? |
| 9 | Trust | Does it make clear what you're buying, the approval step, and lead time? |
| 10 | Bugs | Anything broken, glitchy or slow. Include steps to reproduce. |

## Output format

- A table with the 10 areas: score (1–5), benchmark advantage, top fix.
- Then the five highest-impact changes overall, in priority order, each one sentence.
- Then any bugs, each with steps to reproduce.
