"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

// One player row. The visible cells are kept minimal (name, rounds, best, IPs);
// the full device/browser context lives behind the 3-dots "More info" popup.
// Numeric/date cells are pre-formatted on the server and passed as strings to
// avoid hydration mismatch.
export default function PlayerRow({
  playerId,
  displayName,
  labelValue,
  placeholder,
  rounds,
  best,
  lastSeen,
  ips,
  device,
  os,
  browser,
  language,
  timezone,
  screen,
  from,
}: {
  playerId: string;
  displayName: string;
  labelValue: string;
  placeholder: string;
  rounds: string;
  best: string;
  lastSeen: string;
  ips: string[];
  device: string;
  os: string;
  browser: string;
  language: string;
  timezone: string;
  screen: string;
  from: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
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

  useEffect(() => {
    if (!infoOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setInfoOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [infoOpen]);

  function cancelEdit() {
    setValue(labelValue);
    setEditing(false);
  }

  async function saveName() {
    // No write if nothing changed, just close the editor.
    if (value.trim() === labelValue.trim()) {
      setEditing(false);
      return;
    }
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

  const infoRows: [string, string][] = [
    ["Name", displayName],
    ["Player ID", playerId],
    ["Last seen", lastSeen],
    ["Device", device || "—"],
    ["Operating system", os || "—"],
    ["Browser", browser || "—"],
    ["Language", language || "—"],
    ["Timezone", timezone || "—"],
    ["Screen", screen || "—"],
    ["Came from", from || "—"],
    ["Rounds", rounds],
    ["Best score", best],
    ["IPs seen", ips.length ? ips.join(", ") : "—"],
  ];

  return (
    <tr>
      <td>
        {editing ? (
          <div className="stats-name-edit">
            <input
              className="stats-name-input"
              type="text"
              autoFocus
              value={value}
              placeholder={placeholder}
              maxLength={40}
              disabled={busy}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") cancelEdit();
              }}
            />
            <button
              type="button"
              className="stats-apply-btn"
              onClick={saveName}
              disabled={busy || value.trim() === labelValue.trim()}
            >
              Apply
            </button>
          </div>
        ) : (
          <span className="stats-name-text">{displayName}</span>
        )}
      </td>
      <td>{rounds}</td>
      <td>{best}</td>
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
                  setInfoOpen(true);
                }}
              >
                More info
              </button>
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

        {infoOpen &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="stats-modal-backdrop"
              onClick={() => setInfoOpen(false)}
            >
              <div
                className="stats-modal"
                role="dialog"
                aria-modal="true"
                aria-label="Player details"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="stats-modal-head">
                  <h3>{displayName}</h3>
                  <button
                    type="button"
                    className="stats-modal-x"
                    onClick={() => setInfoOpen(false)}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
                <dl className="stats-modal-body">
                  {infoRows.map(([label, val]) => (
                    <div key={label} className="stats-modal-row">
                      <dt>{label}</dt>
                      <dd>{val}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>,
            document.body,
          )}
      </td>
    </tr>
  );
}
