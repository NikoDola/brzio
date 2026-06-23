"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Manual live-check. Stamps a verify time (one write); playing clients see it
// on their next poll and answer with a pong. After a short grace we refresh, so
// anyone who didn't answer drops out of Currently Playing. No heartbeat.
export default function CheckLiveButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "checking">("idle");

  async function check() {
    setState("checking");
    try {
      await fetch("/api/stats", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify" }),
      });
    } catch {
      // ignore; the refresh below still reflects whatever answered
    }
    // Give playing clients time to poll + answer, then show the pruned list.
    setTimeout(() => {
      router.refresh();
      setState("idle");
    }, 26000);
  }

  return (
    <button
      type="button"
      className="stats-check-btn"
      onClick={check}
      disabled={state === "checking"}
    >
      {state === "checking" ? "Checking…" : "Check live players"}
    </button>
  );
}
