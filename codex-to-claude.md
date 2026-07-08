# Codex to Claude Handoff

## Current Task

Planet Merge warning and no-room loss change.

## Changes Made

- Added a red dashed warning line in `public/games/planet-merge/game.js`.
- The line appears 50px below the ship once the stack reaches the top fifth of the container, which is when the no-room loss check becomes armed.
- Changed the no-room loss condition to test whether an Earth-sized planet can fit anywhere across the drop area, instead of testing the current waiting planet.
- Updated the no-room game-over message to say there was no room for an Earth-sized drop.
- Updated player-facing copy in `src/content/posts.json` so the rules match the code.
- Updated `public/games/planet-merge/CLAUDE.md` to document the warning line and Earth-sized no-room rule.
- Updated stale `shakes.js` comments that still referred to the old danger-line wording.
- Follow-up fix: `boardFullArmed()` now ignores bodies younger than 1.6s so the warning line does not appear just because a freshly dropped planet is falling through the top zone.
- Rounded the choose/drop prompt boxes in `public/games/planet-merge/style.css`.

## Notes

- The red dashed line is visual only. It does not collide with planets and does not directly end the run.
- The warning line is gated by older board planets in the top zone, not the incoming falling planet.
- `dropBlockedAt()` still uses the current planet for normal player drop refusal.
- `boardFull()` now uses `BOARD_ROOM_TEST_LVL`, which resolves to Earth by name.
- Keep future mechanic changes synced across code, `posts.json`, and this handoff file.
