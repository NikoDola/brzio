"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Deletes the localhost/dev test rows from the stats collection so the table
// isn't cluttered with `::1` testing data. Real visitor data is kept.
export default function ClearLocalButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function clearLocal() {
    if (
      !confirm(
        "Delete all local/dev test logs (localhost IPs)? Real visitor data is kept.",
      )
    ) {
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/stats", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to clear");
      setMsg(`Cleared ${data.deleted ?? 0} local log${data.deleted === 1 ? "" : "s"}`);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to clear");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stats-clear">
      {msg && <span className="stats-clear-msg">{msg}</span>}
      <button
        type="button"
        className="stats-clear-btn"
        onClick={clearLocal}
        disabled={busy}
      >
        {busy ? "Clearing..." : "Clear Local"}
      </button>
    </div>
  );
}
