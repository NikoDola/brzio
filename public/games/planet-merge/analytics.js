// Lightweight, self-contained play analytics for planet-merge.
//
// Sends anonymous gameplay events to the brzio /api/stats endpoint so the site
// owner can see how many people play, what scores they reach, and where they
// drop off. It is fully optional: every send is wrapped, so a missing endpoint
// (e.g. the game served standalone) or a network error can never break the
// game. No personal data is sent. The server attaches only a coarse IP for
// abuse blocking, never shown in the stats.
//
// WRITE BUDGET: Firestore bills per document write, so this is deliberately
// frugal. A typical visit is 1 write (open, deduped per visit) plus 1 write
// per round that ends. There is intentionally NO per-round "start" write.
//
// Events:
//   open      - the game loaded (written at most once per browser tab session)
//   game_over - a round ended on its own (carries score + outcome + duration)
//   quit      - the player left mid-round (best-effort beacon, once per round)

const ENDPOINT = "/api/stats";
const GAME = "planet-merge";
const OPEN_FLAG = "pm_open_reported"; // sessionStorage key, dedupes opens

// Random per-session id so the server can tell a "quit" beacon apart from the
// "game_over" of the same round.
const sessionId =
  Math.random().toString(36).slice(2) + Date.now().toString(36);

let startedAt = 0;
let endReported = false; // a clean end (game_over) was already sent this round
let quitReported = false; // a quit beacon was already sent this round

function send(event, payload, useBeacon) {
  const body = JSON.stringify({ game: GAME, sessionId, event, ...payload });
  try {
    if (useBeacon && navigator.sendBeacon) {
      // sendBeacon is the only thing that reliably survives the page being
      // closed or backgrounded, which is exactly when "quit" fires.
      navigator.sendBeacon(
        ENDPOINT,
        new Blob([body], { type: "application/json" }),
      );
    } else {
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Analytics must never throw into gameplay.
  }
}

// Count a load at most once per tab session, so refreshing or replaying does
// not rack up writes. sessionStorage survives a reload but resets on a new tab.
export function reportOpen() {
  try {
    if (sessionStorage.getItem(OPEN_FLAG)) return;
    sessionStorage.setItem(OPEN_FLAG, "1");
  } catch {
    // If storage is blocked, fall through and report once per page load.
  }
  send("open", {});
}

// No DB write: we only reset the per-round trackers and start the clock.
export function reportGameStart() {
  startedAt = Date.now();
  endReported = false;
  quitReported = false;
}

export function reportGameEnd(outcome, score, mode) {
  if (endReported) return; // report a round's end only once
  endReported = true;
  send("game_over", {
    outcome, // "lost" | "won"
    score,
    mode,
    durationMs: startedAt ? Date.now() - startedAt : 0,
  });
}

// Best-effort snapshot when the player leaves mid-round (tab close, app switch,
// screen lock). visibilitychange is the only signal that fires reliably on
// mobile. Capped to one quit per round so repeated alt-tabbing cannot spam
// writes. getSnapshot() returns the live game state so we record the score
// they left off at.
export function initAnalytics(getSnapshot) {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden") return;
    const snap = getSnapshot();
    if (!snap || !snap.active || endReported || quitReported) return;
    quitReported = true;
    send(
      "quit",
      {
        score: snap.score,
        mode: snap.mode,
        durationMs: startedAt ? Date.now() - startedAt : 0,
      },
      true, // beacon
    );
  });
}
