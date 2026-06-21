"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// One player row. Name shows as text (or an inline input while renaming) and a
// 3-dots menu at the far-right end offers Rename / Delete log. Numeric and date
// cells are pre-formatted on the server and passed in as strings to avoid any
// hydration mismatch.
export default function PlayerRow({
  playerId,
  displayName,
  labelValue,
  placeholder,
  rounds,
  best,
  lastSeen,
  ips,
}: {
  playerId: string;
  displayName: string;
  labelValue: string;
  placeholder: string;
  rounds: string;
  best: string;
  lastSeen: string;
  ips: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [value, setValue] = useState(labelValue);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  async function saveName() {
    setBusy(true);
    try {
      const res = await fetch("/api/stats", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, name: value.trim() }),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function deleteLogs() {
    if (
      !confirm(
        "Delete ALL logs for this player? Their sessions disappear and the name label is removed. This cannot be undone.",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/stats?playerId=${encodeURIComponent(playerId)}`,
        { method: "DELETE" },
      );
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <td>
        {editing ? (
          <input
            className="stats-name-input"
            type="text"
            autoFocus
            value={value}
            placeholder={placeholder}
            maxLength={40}
            disabled={busy}
            onChange={(e) => setValue(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setValue(labelValue);
                setEditing(false);
              }
            }}
          />
        ) : (
          <span className="stats-name-text">{displayName}</span>
        )}
      </td>
      <td>{rounds}</td>
      <td>{best}</td>
      <td>{lastSeen}</td>
      <td className="stats-ip">
        {ips.length === 0 ? (
          "—"
        ) : (
          <span title={ips.join(", ")}>
            {ips.length > 1 ? `${ips.length} IPs: ` : ""}
            {ips.slice(0, 3).join(", ")}
            {ips.length > 3 ? "…" : ""}
          </span>
        )}
      </td>
      <td className="stats-del-cell">
        <div className="stats-menu" ref={menuRef}>
          <button
            type="button"
            className="stats-menu-btn"
            onClick={() => setMenuOpen((o) => !o)}
            disabled={busy}
            aria-label="Player actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <circle cx="8" cy="3" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="8" cy="13" r="1.5" />
            </svg>
          </button>
          {menuOpen && (
            <div className="stats-menu-pop" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setEditing(true);
                }}
              >
                Rename
              </button>
              <button
                type="button"
                role="menuitem"
                className="stats-menu-danger"
                onClick={() => {
                  setMenuOpen(false);
                  deleteLogs();
                }}
              >
                Delete log
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
