import "./stats.css";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { adminDb } from "@/lib/firebase/admin";
import ClearLocalButton from "./ClearLocalButton";
import DeleteLogButton from "./DeleteLogButton";
import PlayerRow from "./PlayerRow";

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
  playerId: string | null;
  playerName: string | null;
};

type PlayerSummary = {
  playerId: string;
  name: string; // resolved: admin label, else latest nickname, else ""
  nickname: string;
  hasLabel: boolean;
  rounds: number; // start events
  bestScore: number;
  lastSeen: number;
  ips: string[]; // distinct, most-recent first
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
        playerId: v.playerId ? String(v.playerId) : null,
        playerName: v.playerName ? String(v.playerName) : null,
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
        ips: [],
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
        ips: p.ips,
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

export default async function AdminStatsPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const [{ events, error }, labels] = await Promise.all([
    loadEvents(),
    loadLabels(),
  ]);
  const games = summarise(events);
  const players = summarisePlayers(events, labels);

  // Resolve a friendly label for a session row from its player id.
  const nameById = new Map(players.map((p) => [p.playerId, p.name]));
  const sessionPlayer = (e: StatEvent): string => {
    if (!e.playerId) return "—";
    return nameById.get(e.playerId) || shortId(e.playerId);
  };

  const sessions = events
    .filter(
      (e) =>
        e.event === "start" || e.event === "game_over" || e.event === "quit",
    )
    .slice(0, 30);

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
                <th>Last seen</th>
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
            Each round as it happened: &quot;start&quot; when a player entered, then
            &quot;won&quot;/&quot;lost&quot; if it ended, or &quot;quit&quot; with the score at the moment they
            left mid-round.
          </p>
          <table className="stats-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Player</th>
                <th>Mode</th>
                <th>Result</th>
                <th>Score</th>
                <th>Played for</th>
                <th>IP</th>
                <th aria-label="Delete"></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>{fmtTime(s.ts)}</td>
                  <td>{sessionPlayer(s)}</td>
                  <td>{s.mode ?? "—"}</td>
                  <td>
                    <span
                      className={`stats-badge stats-badge--${
                        s.event === "start"
                          ? "start"
                          : s.event === "quit"
                            ? "quit"
                            : s.outcome ?? "lost"
                      }`}
                    >
                      {s.event === "start"
                        ? "start"
                        : s.event === "quit"
                          ? "quit"
                          : s.outcome ?? "ended"}
                    </span>
                  </td>
                  <td>{s.score.toLocaleString()}</td>
                  <td>{fmtDuration(s.durationMs)}</td>
                  <td className="stats-ip">{s.ip}</td>
                  <td className="stats-del-cell">
                    <DeleteLogButton id={s.id} />
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
