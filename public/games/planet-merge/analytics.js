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
// frugal. A typical visit is 1 write (open, deduped per visit) plus a start and
// an end (game_over or quit) per round played.
//
// Events:
//   open      - the game loaded (written at most once per browser tab session)
//   start     - the player entered a round (carries mode)
//   game_over - a round ended on its own (carries score + outcome + duration)
//   quit      - the player left mid-round (best-effort beacon, once per round)

const ENDPOINT = "/api/stats";
const GAME = "planet-merge";
const OPEN_FLAG = "pm_open_reported"; // sessionStorage key, dedupes opens
const PLAYER_ID_KEY = "pm_player_id"; // persistent random id, survives IP changes
const PLAYER_NAME_KEY = "pm_player_name"; // optional nickname the player typed

// Random per-session id so the server can tell a "quit" beacon apart from the
// "game_over" of the same round.
const sessionId =
  Math.random().toString(36).slice(2) + Date.now().toString(36);

// Stable per-browser id. Unlike the IP it does not change when the network
// does, so it is how we recognise the same player across sessions. Stored once
// in localStorage; a fresh browser / cleared storage just becomes a new player.
function loadPlayerId() {
  try {
    let id = localStorage.getItem(PLAYER_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(PLAYER_ID_KEY, id);
    }
    return id;
  } catch {
    // Storage blocked: a throwaway id keeps events flowing without crashing.
    return "anon-" + Math.random().toString(36).slice(2);
  }
}
const playerId = loadPlayerId();

let playerName = "";
try {
  playerName = localStorage.getItem(PLAYER_NAME_KEY) || "";
} catch {
  playerName = "";
}

export function getPlayerName() {
  return playerName;
}
export function setPlayerName(name) {
  playerName = (name || "").slice(0, 40);
  try {
    localStorage.setItem(PLAYER_NAME_KEY, playerName);
  } catch {
    // ignore: name just won't persist across reloads
  }
}

// One-time, benign device/browser context. All of this is either sent by the
// browser anyway (user agent) or trivially readable, no fingerprinting (no GPU,
// canvas, fonts). Computed once and attached to every event.
function detectClient() {
  const ua = (navigator.userAgent || "").slice(0, 400);

  let device = "desktop";
  const uaData = navigator.userAgentData;
  if (uaData && typeof uaData.mobile === "boolean") {
    device = uaData.mobile ? "mobile" : "desktop";
  }
  if (/iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(ua)) device = "tablet";
  else if (/Mobi|iPhone|iPod|Android.*Mobile/i.test(ua)) device = "mobile";

  let os = "Unknown";
  if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/CrOS/i.test(ua)) os = "ChromeOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Unknown";
  let m;
  if ((m = ua.match(/Edg\/(\d+)/))) browser = "Edge " + m[1];
  else if ((m = ua.match(/(?:OPR|Opera)\/(\d+)/))) browser = "Opera " + m[1];
  else if ((m = ua.match(/SamsungBrowser\/(\d+)/))) browser = "Samsung " + m[1];
  else if ((m = ua.match(/Firefox\/(\d+)/))) browser = "Firefox " + m[1];
  else if ((m = ua.match(/Chrome\/(\d+)/))) browser = "Chrome " + m[1];
  else if ((m = ua.match(/Version\/(\d+)[\d.]*\s*(?:Mobile\/\S+\s*)?Safari/)))
    browser = "Safari " + m[1];
  else if (/Safari/i.test(ua)) browser = "Safari";

  let language = "";
  try { language = navigator.language || ""; } catch { language = ""; }

  let timezone = "";
  try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { timezone = ""; }

  let screenSize = "";
  try { screenSize = `${window.screen.width}x${window.screen.height}`; } catch { screenSize = ""; }

  // The game runs in a same-origin iframe, so document.referrer here is just the
  // brzio wrapper. The real "came from" is the parent page's referrer, which we
  // can read because it is the same origin.
  let referrer = "";
  try {
    referrer =
      window.top && window.top !== window
        ? window.top.document.referrer || ""
        : document.referrer || "";
  } catch {
    referrer = document.referrer || "";
  }

  return {
    device,
    os,
    browser,
    language,
    timezone,
    screen: screenSize,
    referrer: referrer.slice(0, 300),
  };
}
const clientInfo = detectClient();

let startedAt = 0;
let endReported = false; // a clean end (game_over) was already sent this round
let quitReported = false; // a quit beacon was already sent this round

function send(event, payload, useBeacon) {
  const body = JSON.stringify({
    game: GAME,
    sessionId,
    playerId,
    playerName,
    client: clientInfo,
    event,
    ...payload,
  });
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

// Logs a "start" when the player enters a round, and resets the per-round
// trackers + clock so the matching quit/game_over is measured from here.
export function reportGameStart(mode) {
  startedAt = Date.now();
  endReported = false;
  quitReported = false;
  send("start", { mode });
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
const QUIT_MIN_MS = 5000; // a hide before this, at score 0, is a glance, not a quit

export function initAnalytics(getSnapshot) {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden") return;
    const snap = getSnapshot();
    if (!snap || !snap.active || endReported || quitReported) return;
    const durationMs = startedAt ? Date.now() - startedAt : 0;
    // Ignore a hide right after starting with no progress: that is someone
    // glancing away (e.g. switching tabs), not a real mid-round quit.
    if (snap.score <= 0 && durationMs < QUIT_MIN_MS) return;
    quitReported = true;
    send("quit", { score: snap.score, mode: snap.mode, durationMs }, true);
  });
}
