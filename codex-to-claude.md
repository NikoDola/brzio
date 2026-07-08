# Codex to Claude Handoff

## Current Task

Planet Merge ongoing changes.

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
- Added a `New Game` confirmation popup when a local save exists, so saved progress is not discarded until the player confirms.
- Renamed `assets/sounds/tarteg-lock-constant.mp3` to `target-lock-constant.mp3` and wired it as a looping Eliminate armed sound.
- Eliminate now plays the full target-lock sequence whenever a charge newly arms: `target-lock.mp3` first, then the constant beep loop.

## Notes

- The red dashed line is visual only. It does not collide with planets and does not directly end the run.
- The warning line is gated by older board planets in the top zone, not the incoming falling planet.
- `dropBlockedAt()` still uses the current planet for normal player drop refusal.
- `boardFull()` now uses `BOARD_ROOM_TEST_LVL`, which resolves to Earth by name.
- The start screen `New Game` button now opens `#new-game-confirm` if `loadSave()` returns a saved game.
- `playTargetLockThenConstant()` starts the normal lock sound, then loops `target-lock-constant.mp3` until `clearDestroyPower()` or game over stops it. Restored saved charges start the constant loop directly because they are already armed.
- Keep future mechanic changes synced across code, `posts.json`, and this handoff file.
