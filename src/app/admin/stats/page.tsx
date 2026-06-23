import "./stats.css";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { adminDb } from "@/lib/firebase/admin";
import ClearLocalButton from "./ClearLocalButton";
import DeleteLogButton from "./DeleteLogButton";
import PlayerRow from "./PlayerRow";
import AutoRefresh from "./AutoRefresh";
import CheckLiveButton from "./CheckLiveButton";

// Read-only window onto the anonymous gameplay stats collected by /api/stats.
// Lives under /admin, so proxy.ts makes it 404 in production: you view it by
// running `npm run dev` locally, which reads the same live Firestore.
export const dynamic = "force-dynamic";

const READ_LIMIT = 3000; // most recent events to aggregate

type StatEvent = {
  id: string;
  game: string;
  event: string;
  outcome: string | null;
  mode: string | null;
  score: number;
  durationMs: number;
  ts: number;
  ip: string;
  sessionId: string | null;
  playerId: string | null;
  playerName: string | null;
  client: ClientInfo | null;
};

type SessionRow = {
  sessionId: string;
  playerId: string | null;
  mode: string | null;
  result: "won" | "lost" | "quit" | "playing";
  score: number;
  startTs: number;
  endTs: number | null;
  durationMs: number;
  ip: string;
  ts: number; // sort key
};

type ClientInfo = {
  device: string;
  os: string;
  browser: string;
  language: string;
  timezone: string;
  screen: string;
  referrer: string;
};

type PlayerSummary = {
  playerId: string;
  name: string; // resolved: admin label, else latest nickname, else ""
  nickname: string;
  hasLabel: boolean;
  rounds: number; // start events
  bestScore: number;
  lastSeen: number;
  lastEvent: string; // most recent event type (start = currently playing)
  lastMode: string | null; // mode of the most recent event
  ips: string[]; // distinct, most-recent first
  client: ClientInfo | null; // most recent device/browser context
};

type GameSummary = {
  game: string;
  opens: number;
  starts: number; // rounds entered
  finishes: number; // game_over events (won or lost)
  wins: number;
  quits: number;
  playsToday: number;
  avgScore: number;
  maxScore: number;
};

function readClient(raw: unknown): ClientInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const s = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : "");
  return {
    device: s("device"),
    os: s("os"),
    browser: s("browser"),
    language: s("language"),
    timezone: s("timezone"),
    screen: s("screen"),
    referrer: s("referrer"),
  };
}

async function loadEvents(): Promise<{ events: StatEvent[]; error: string | null }> {
  try {
    const snap = await adminDb
      .collection("game_stats")
      .orderBy("ts", "desc")
      .limit(READ_LIMIT)
      .get();
    const events = snap.docs.map((d) => {
      const v = d.data();
      return {
        id: d.id,
        game: String(v.game ?? "unknown"),
        event: String(v.event ?? ""),
        outcome: v.outcome ? String(v.outcome) : null,
        mode: v.mode ? String(v.mode) : null,
        score: Number(v.score ?? 0),
        durationMs: Number(v.durationMs ?? 0),
        ts: Number(v.ts ?? 0),
        ip: String(v.ip ?? v.ipPrefix ?? "—"),
        sessionId: v.sessionId ? String(v.sessionId) : null,
        playerId: v.playerId ? String(v.playerId) : null,
        playerName: v.playerName ? String(v.playerName) : null,
        client: readClient(v.client),
      } satisfies StatEvent;
    });
    return { events, error: null };
  } catch (e) {
    return { events: [], error: e instanceof Error ? e.message : "Firestore read failed" };
  }
}

// Admin-assigned display names, keyed by playerId. Override the in-game nickname.
async function loadLabels(): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  try {
    const snap = await adminDb.collection("player_labels").get();
    snap.docs.forEach((d) => {
      const name = String(d.data().name ?? "").trim();
      if (name) labels.set(d.id, name);
    });
  } catch {
    // No labels collection yet, or read failed: fall back to nicknames.
  }
  return labels;
}

// Time of the last admin "Check live players" request, and each player's pong
// (their answer). Used to prune unresponsive players from Currently Playing.
async function loadVerifyAt(): Promise<number> {
  try {
    const doc = await adminDb.collection("meta").doc("live_check").get();
    return doc.exists ? Number(doc.get("at")) || 0 : 0;
  } catch {
    return 0;
  }
}
async function loadPongs(): Promise<Map<string, number>> {
  const pongs = new Map<string, number>();
  try {
    const snap = await adminDb.collection("presence").get();
    snap.docs.forEach((d) => {
      const pid = String(d.data().playerId ?? "");
      if (pid) pongs.set(pid, Number(d.data().lastPong) || 0);
    });
  } catch {
    // no presence collection yet
  }
  return pongs;
}

// Pair start + end events by sessionId into one row per round, so the table can
// show the start date and the quit/end date side by side.
function summariseSessions(events: StatEvent[]): SessionRow[] {
  const byId = new Map<string, SessionRow>();
  for (const e of events) {
    if (e.event !== "start" && e.event !== "game_over" && e.event !== "quit") continue;
    if (!e.sessionId) continue;
    let s = byId.get(e.sessionId);
    if (!s) {
      s = {
        sessionId: e.sessionId,
        playerId: e.playerId,
        mode: e.mode,
        result: "playing",
        score: 0,
        startTs: 0,
        endTs: null,
        durationMs: 0,
        ip: e.ip,
        ts: 0,
      };
      byId.set(e.sessionId, s);
    }
    if (e.playerId) s.playerId = e.playerId;
    if (e.mode) s.mode = e.mode;
    if (e.ip && e.ip !== "—") s.ip = e.ip;
    if (e.event === "start") {
      s.startTs = e.ts;
    } else {
      s.endTs = e.ts;
      s.score = e.score;
      s.durationMs = e.durationMs;
      s.result = e.event === "quit" ? "quit" : e.outcome === "won" ? "won" : "lost";
    }
    s.ts = Math.max(s.startTs, s.endTs ?? 0);
  }
  return [...byId.values()].sort((a, b) => b.ts - a.ts).slice(0, 30);
}

function summarisePlayers(
  events: StatEvent[],
  labels: Map<string, string>,
): PlayerSummary[] {
  const byPlayer = new Map<
    string,
    PlayerSummary & { nickAt: number }
  >();
  // events arrive newest-first, so the first nickname / ip we see is the latest.
  for (const e of events) {
    if (!e.playerId) continue; // legacy rows have no player id
    let p = byPlayer.get(e.playerId);
    if (!p) {
      p = {
        playerId: e.playerId,
        name: "",
        nickname: "",
        hasLabel: false,
        rounds: 0,
        bestScore: 0,
        lastSeen: 0,
        // First time we see this player is their newest event (newest-first).
        lastEvent: e.event,
        lastMode: e.mode,
        ips: [],
        client: null,
        nickAt: 0,
      };
      byPlayer.set(e.playerId, p);
    }
    if (e.ts > p.lastSeen) p.lastSeen = e.ts;
    if (e.event === "start") p.rounds++;
    if (e.event === "game_over" && e.score > p.bestScore) p.bestScore = e.score;
    if (e.playerName && e.ts >= p.nickAt) {
      p.nickname = e.playerName;
      p.nickAt = e.ts;
    }
    // events are newest-first, so the first client we see is the most recent
    if (!p.client && e.client) p.client = e.client;
    if (e.ip && e.ip !== "—" && !p.ips.includes(e.ip)) p.ips.push(e.ip);
  }

  return [...byPlayer.values()]
    .map((p) => {
      const label = labels.get(p.playerId) ?? "";
      return {
        playerId: p.playerId,
        name: label || p.nickname,
        nickname: p.nickname,
        hasLabel: Boolean(label),
        rounds: p.rounds,
        bestScore: p.bestScore,
        lastSeen: p.lastSeen,
        lastEvent: p.lastEvent,
        lastMode: p.lastMode,
        ips: p.ips,
        client: p.client,
      };
    })
    .sort((a, b) => b.lastSeen - a.lastSeen);
}

function summarise(events: StatEvent[]): GameSummary[] {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();

  const byGame = new Map<string, GameSummary & { scoreSum: number }>();
  for (const e of events) {
    let g = byGame.get(e.game);
    if (!g) {
      g = {
        game: e.game,
        opens: 0,
        starts: 0,
        finishes: 0,
        wins: 0,
        quits: 0,
        playsToday: 0,
        avgScore: 0,
        maxScore: 0,
        scoreSum: 0,
      };
      byGame.set(e.game, g);
    }
    if (e.event === "open") g.opens++;
    else if (e.event === "start") g.starts++;
    else if (e.event === "quit") g.quits++;
    else if (e.event === "game_over") {
      g.finishes++;
      g.scoreSum += e.score;
      if (e.score > g.maxScore) g.maxScore = e.score;
      if (e.outcome === "won") g.wins++;
      if (e.ts >= todayMs) g.playsToday++;
    }
  }

  return [...byGame.values()]
    .map((g) => ({
      game: g.game,
      opens: g.opens,
      starts: g.starts,
      finishes: g.finishes,
      wins: g.wins,
      quits: g.quits,
      playsToday: g.playsToday,
      avgScore: g.finishes ? Math.round(g.scoreSum / g.finishes) : 0,
      maxScore: g.maxScore,
    }))
    .sort((a, b) => b.opens - a.opens);
}

function fmtTime(ts: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

function fmtDuration(ms: number): string {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function shortId(id: string): string {
  return `#${id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 5)}`;
}

// "where they came from": the referrer's host, or "direct" when there is none.
function fromLabel(referrer: string): string {
  if (!referrer) return "direct";
  try {
    return new URL(referrer).host || referrer;
  } catch {
    return referrer;
  }
}

export default async function AdminStatsPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const [{ events, error }, labels, verifyAt, pongs] = await Promise.all([
    loadEvents(),
    loadLabels(),
    loadVerifyAt(),
    loadPongs(),
  ]);
  const games = summarise(events);
  const players = summarisePlayers(events, labels);

  // "Currently playing" = the player's most recent event is a start and they
  // have not left (a quit is only logged when they close the tab / leave the
  // site). Switching tabs does not change this.
  //
  // Staleness guard (no extra writes): if a quit can never fire (phone dies, OS
  // restart, all tabs closed at once) the start would otherwise linger forever,
  // so the start must also be recent.
  //
  // Live check: when "Check live players" is clicked it stamps verifyAt; playing
  // clients answer with a pong. After a short grace, anyone who started before
  // the check and did not pong since is pruned.
  const PLAYING_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
  const RESPONSE_GRACE_MS = 25 * 1000; // time for clients to answer a check
  const now = Date.now();
  const verifyEnforced = verifyAt > 0 && now - verifyAt >= RESPONSE_GRACE_MS;
  const currentlyPlaying = players.filter((p) => {
    if (p.lastEvent !== "start") return false;
    if (now - p.lastSeen >= PLAYING_WINDOW_MS) return false;
    if (!verifyEnforced) return true;
    // started after the check (new) or answered it (alive) → keep; else prune.
    return Math.max(p.lastSeen, pongs.get(p.playerId) ?? 0) >= verifyAt;
  });

  // Resolve a friendly label from a player id.
  const nameById = new Map(players.map((p) => [p.playerId, p.name]));
  const playerName = (playerId: string | null): string => {
    if (!playerId) return "—";
    return nameById.get(playerId) || shortId(playerId);
  };

  const sessions = summariseSessions(events);

  return (
    <div className="admin-content">
      <div className="admin-section-header admin-section-header--tight stats-header-row">
        <h1 className="admin-section-title">Game Analytics</h1>
        <ClearLocalButton />
      </div>
      <p className="admin-section-sub">
        Anonymous play data. Showing the most recent {READ_LIMIT.toLocaleString()} events.
        No personal data is stored.
      </p>

      <AutoRefresh seconds={20} />

      <div className="stats-game-block">
        <div className="stats-header-row">
          <h2 className="stats-game-title">
            Currently Playing
            <span className="stats-live-count">{currentlyPlaying.length}</span>
          </h2>
          <CheckLiveButton />
        </div>
        {currentlyPlaying.length === 0 ? (
          <p className="admin-section-sub">No one is in a round right now.</p>
        ) : (
          <table className="stats-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Mode</th>
                <th>Started</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {currentlyPlaying.map((p) => (
                <tr key={p.playerId}>
                  <td>
                    <span className="stats-live-dot" aria-hidden="true" />
                    {p.name || shortId(p.playerId)}
                  </td>
                  <td>{p.lastMode ?? "—"}</td>
                  <td>{fmtTime(p.lastSeen)}</td>
                  <td className="stats-ip">{p.ips[0] ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {error && (
        <div className="stats-empty">
          <strong>Could not read stats.</strong>
          <p>{error}</p>
          <p>
            If this is the first run, enable Cloud Firestore in the Firebase console
            for this project, then reload. Until a game is played there will be no data.
          </p>
        </div>
      )}

      {!error && games.length === 0 && (
        <div className="stats-empty">
          <strong>No data yet.</strong>
          <p>Open a game and play a round, then reload this page.</p>
        </div>
      )}

      {games.map((g) => (
        <div key={g.game} className="stats-game-block">
          <h2 className="stats-game-title">{g.game}</h2>
          <div className="admin-dashboard-grid">
            <div className="admin-stat-card">
              <div className="admin-stat-value">{g.opens.toLocaleString()}</div>
              <div className="admin-stat-label">Opens</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-value">{g.starts.toLocaleString()}</div>
              <div className="admin-stat-label">Rounds started</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-value">{g.finishes.toLocaleString()}</div>
              <div className="admin-stat-label">Rounds finished</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-value">{g.quits.toLocaleString()}</div>
              <div className="admin-stat-label">Quit mid-round</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-value">{g.playsToday.toLocaleString()}</div>
              <div className="admin-stat-label">Finished today</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-value">{g.wins.toLocaleString()}</div>
              <div className="admin-stat-label">Wins</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-value">{g.avgScore.toLocaleString()}</div>
              <div className="admin-stat-label">Avg score</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-value">{g.maxScore.toLocaleString()}</div>
              <div className="admin-stat-label">Best score</div>
            </div>
          </div>
        </div>
      ))}

      {players.length > 0 && (
        <div className="stats-game-block">
          <h2 className="stats-game-title">Players</h2>
          <p className="admin-section-sub">
            Each browser gets a stable id that does not change with the network,
            so the same person stays one row even when their IP changes. Edit a
            name to label them. &quot;IPs seen&quot; lists every address that id has
            used, more than one means their IP changed.
          </p>
          <table className="stats-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Rounds</th>
                <th>Best</th>
                <th>IPs seen</th>
                <th aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <PlayerRow
                  key={p.playerId}
                  playerId={p.playerId}
                  displayName={p.name || shortId(p.playerId)}
                  labelValue={p.hasLabel ? p.name : ""}
                  placeholder={p.nickname || shortId(p.playerId)}
                  rounds={p.rounds.toLocaleString()}
                  best={p.bestScore.toLocaleString()}
                  lastSeen={fmtTime(p.lastSeen)}
                  ips={p.ips}
                  device={p.client?.device ?? ""}
                  os={p.client?.os ?? ""}
                  browser={p.client?.browser ?? ""}
                  language={p.client?.language ?? ""}
                  timezone={p.client?.timezone ?? ""}
                  screen={p.client?.screen ?? ""}
                  from={p.client ? fromLabel(p.client.referrer) : ""}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sessions.length > 0 && (
        <div className="stats-game-block">
          <h2 className="stats-game-title">Recent sessions</h2>
          <p className="admin-section-sub">
            One row per round: when the player started and when they ended (won,
            lost, or quit mid-round). &quot;Started&quot; and &quot;Ended&quot; sit side by side.
          </p>
          <table className="stats-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Mode</th>
                <th>Result</th>
                <th>Score</th>
                <th>Started</th>
                <th>Ended</th>
                <th>Played for</th>
                <th>IP</th>
                <th aria-label="Delete"></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.sessionId}>
                  <td>{playerName(s.playerId)}</td>
                  <td>{s.mode ?? "—"}</td>
                  <td>
                    <span
                      className={`stats-badge stats-badge--${
                        s.result === "playing" ? "start" : s.result
                      }`}
                    >
                      {s.result === "playing" ? "playing" : s.result}
                    </span>
                  </td>
                  <td>{s.score.toLocaleString()}</td>
                  <td>{s.startTs ? fmtTime(s.startTs) : "—"}</td>
                  <td>{s.endTs ? fmtTime(s.endTs) : "—"}</td>
                  <td>{fmtDuration(s.durationMs)}</td>
                  <td className="stats-ip">{s.ip}</td>
                  <td className="stats-del-cell">
                    <DeleteLogButton sessionId={s.sessionId} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
