"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Deletes a stats log: a single row by doc id, or a whole session by sessionId.
export default function DeleteLogButton({
  id,
  sessionId,
}: {
  id?: string;
  sessionId?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    const query = sessionId
      ? `sessionId=${encodeURIComponent(sessionId)}`
      : `id=${encodeURIComponent(id ?? "")}`;
    setBusy(true);
    try {
      const res = await fetch(`/api/stats?${query}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="stats-row-del"
      onClick={remove}
      disabled={busy}
      aria-label="Delete this session"
      title="Delete this session"
    >
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M2.5 4h11M6 4V2.5h4V4M5 4l.5 9a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1L11 4M6.7 6.5v5M9.3 6.5v5"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
