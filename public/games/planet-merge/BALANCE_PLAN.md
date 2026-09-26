# Opening level balance

Reviewed with an Astra planning agent on September 27, 2026. The aim is a
more approachable first Sun-pair milestone, followed by a clear matching
challenge in Level 2. Every level still advances when two Suns touch.

## Normal drop chances

| Planet | Level 1 | Level 2 onward |
| --- | ---: | ---: |
| Stars | 0% | 10% |
| Moon | 10% | 15% |
| Pluto | 10% | 15% |
| Mercury | 10% | 10% |
| Mars | 30% | 25% |
| Venus | 40% | 25% |

Mars and Venus account for 70% of Level 1 drops, compared with 59.1% before
this pass. Their higher merge value helps build large planets sooner.
Level 2 increases the proportion of small planets and introduces Stars at
10%, keeping them less frequent than the previous 18.5%. Smaller planets
need more merges to reach Suns, but also occupy less space, so their effect
on win rates must be measured in play.

Level 3 keeps Level 2's odds and removes the shield from new shakes. Later
levels retain that mix and the existing multiplier progression. The opening
drop remains a 50/50 choice between the two smallest roster planets. Powers,
board dimensions, carried planets and the 25% ready-to-use shake reward
remain as implemented in the endless progression.

## Implementation

`level-config.js` owns the profiles and shared `dropRatesFor`,
`createDropPicker` and `firstDropFor` functions. Live play refreshes its
picker on advancement, reset and restore. Simulations use the same picker;
explicit captured weights still override the defaults for repeatable tests.
Both dev tools capture odds for the level selected in their controls.
The level card displays percentages from the effective rates, and the
player-facing post describes the same progression.

## Evidence and limits

Two Suns contain 4,096 Stars' worth of merge material. Mean material per
ordinary random drop rises from about 15.45 to 19 in Level 1. Dividing the
target by those means gives roughly 265 versus 216 drops, an 18.7% reduction
in the ideal material budget. Level 2's new mean is 13.8, or roughly 297 drops.
These are throughput proxies, not predicted completion counts: they ignore
the opening exception, Choose Planet, elimination, stranded material,
carried boards, and physics losses.

A small comparison used Matter.js 0.19.0, desktop physics defaults, Quick
strategy, seeds `balance-review/1`, `/2`, `/3`, and a 15-minute / 1,000-drop
limit. Each test started on an empty board and stopped at the first Sun pair.

| Profile | Level | Wins / losses / limits | Highest planet by seed |
| --- | ---: | --- | --- |
| Previous global weights | 1 | 0 / 2 / 1 | Jupiter, Jupiter, Jupiter |
| New level weights | 1 | 0 / 2 / 1 | Jupiter, Sun, Sun |
| Previous global weights | 2 | 0 / 2 / 1 | Sun, Jupiter, Jupiter |
| New level weights | 2 | 0 / 2 / 1 | Saturn, Jupiter, Jupiter |

The opening sample reached larger planets but did not demonstrate a higher
completion rate. Retain this as an initial balance pass rather than claim
an easy or guaranteed win. Three seeds are insufficient to justify another
odds change. Next useful evidence is a larger matched batch with Smart play
and human attempts through the actual Level 1-to-2 transition. Fresh-board
simulations do not measure carried-board difficulty or the level-up shake
reward. The simulator also chooses not to use unshielded Level 3 shakes.

Regression coverage includes weighted boundaries, roster exclusion, opening
drops, dev overrides, advancement and restoration, live/simulation sequence
agreement, selected-level exports, and existing physics/persistence rules.
