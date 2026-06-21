import "./stats.css";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { adminDb } from "@/lib/firebase/admin";

// Read-only window onto the anonymous gameplay stats collected by /api/stats.
// Lives under /admin, so proxy.ts makes it 404 in production: you view it by
// running `npm run dev` locally, which reads the same live Firestore.
export const dynamic = "force-dynamic";

const READ_LIMIT = 3000; // most recent events to aggregate

type StatEvent = {
  game: string;
  event: string;
  outcome: string | null;
  mode: string | null;
  score: number;
  durationMs: number;
  ts: number;
  ip: string;
};

type GameSummary = {
  game: string;
  opens: number;
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
        game: String(v.game ?? "unknown"),
        event: String(v.event ?? ""),
        outcome: v.outcome ? String(v.outcome) : null,
        mode: v.mode ? String(v.mode) : null,
        score: Number(v.score ?? 0),
        durationMs: Number(v.durationMs ?? 0),
        ts: Number(v.ts ?? 0),
        ip: String(v.ip ?? v.ipPrefix ?? "—"),
      } satisfies StatEvent;
    });
    return { events, error: null };
  } catch (e) {
    return { events: [], error: e instanceof Error ? e.message : "Firestore read failed" };
  }
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

export default async function AdminStatsPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const { events, error } = await loadEvents();
  const games = summarise(events);
  const sessions = events
    .filter((e) => e.event === "game_over" || e.event === "quit")
    .slice(0, 30);

  return (
    <div className="admin-content">
      <div className="admin-section-header admin-section-header--tight">
        <h1 className="admin-section-title">Game Analytics</h1>
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
              <div className="admin-stat-value">{(g.finishes + g.quits).toLocaleString()}</div>
              <div className="admin-stat-label">Rounds played</div>
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

      {sessions.length > 0 && (
        <div className="stats-game-block">
          <h2 className="stats-game-title">Recent sessions</h2>
          <p className="admin-section-sub">
            Where players left off. &quot;Quit&quot; rows are the score at the moment they
            closed or switched away mid-round.
          </p>
          <table className="stats-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Game</th>
                <th>Mode</th>
                <th>Result</th>
                <th>Score</th>
                <th>Played for</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => (
                <tr key={i}>
                  <td>{fmtTime(s.ts)}</td>
                  <td>{s.game}</td>
                  <td>{s.mode ?? "—"}</td>
                  <td>
                    <span className={`stats-badge stats-badge--${s.event === "quit" ? "quit" : s.outcome ?? "lost"}`}>
                      {s.event === "quit" ? "quit" : s.outcome ?? "ended"}
                    </span>
                  </td>
                  <td>{s.score.toLocaleString()}</td>
                  <td>{fmtDuration(s.durationMs)}</td>
                  <td className="stats-ip">{s.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
