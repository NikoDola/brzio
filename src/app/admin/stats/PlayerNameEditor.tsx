"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Inline editor for a player's admin display name. Saves on Enter or blur to
// the player_labels collection via PUT /api/stats. An empty value clears the
// label, falling back to the player's in-game nickname (shown as placeholder).
export default function PlayerNameEditor({
  playerId,
  name,
  placeholder,
}: {
  playerId: string;
  name: string;
  placeholder: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (value === name) return; // nothing changed
    setBusy(true);
    try {
      const res = await fetch("/api/stats", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, name: value.trim() }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <input
      className="stats-name-input"
      type="text"
      value={value}
      placeholder={placeholder}
      maxLength={40}
      disabled={busy}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}
