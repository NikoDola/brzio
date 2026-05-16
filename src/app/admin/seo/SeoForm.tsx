"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import type { SeoEntry } from "@/lib/content";

interface RouteEntry {
  path: string;
  label: string;
  entry: SeoEntry;
}

const TITLE_TARGET = 60;
const TITLE_MAX = 70;
const DESC_TARGET = 155;
const DESC_MAX = 165;

async function uploadFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", "seo");
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const data = await res.json();
  return data.path as string;
}

export default function SeoForm({ initial }: { initial: RouteEntry[] }) {
  const [rows, setRows] = useState<RouteEntry[]>(initial);
  const [savingPath, setSavingPath] = useState<string | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [error, setError] = useState("");

  function updateRow(path: string, patch: Partial<SeoEntry>) {
    setRows((rs) => rs.map((r) => (r.path === path ? { ...r, entry: { ...r.entry, ...patch } } : r)));
    setSavedPath(null);
  }

  async function handleSave(path: string, entry: SeoEntry) {
    setError("");
    setSavingPath(path);
    setSavedPath(null);
    try {
      const res = await fetch("/api/seo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, entry }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Save failed.");
        return;
      }
      setSavedPath(path);
    } catch {
      setError("Something went wrong.");
    } finally {
      setSavingPath(null);
    }
  }

  return (
    <div className="admin-seo-list">
      {error && <div className="admin-error-msg">{error}</div>}

      {rows.map((row) => (
        <SeoRow
          key={row.path}
          row={row}
          onChange={(patch) => updateRow(row.path, patch)}
          onSave={() => handleSave(row.path, row.entry)}
          saving={savingPath === row.path}
          saved={savedPath === row.path}
        />
      ))}
    </div>
  );
}

function SeoRow({
  row,
  onChange,
  onSave,
  saving,
  saved,
}: {
  row: RouteEntry;
  onChange: (patch: Partial<SeoEntry>) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { title, description, ogImage } = row.entry;

  const titleLen = title.length;
  const descLen = description.length;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = await uploadFile(file);
    onChange({ ogImage: path });
  }

  return (
    <div className="admin-card admin-seo-card">
      <div className="admin-seo-card-head">
        <div>
          <h2 className="admin-seo-card-title">{row.label}</h2>
          <code className="admin-seo-card-path">{row.path}</code>
        </div>
      </div>

      <div className="admin-field">
        <label className="admin-label">Meta Title</label>
        <input
          className="admin-input"
          value={title}
          onChange={(e) => onChange({ title: e.target.value })}
          maxLength={TITLE_MAX + 10}
          placeholder="e.g. Logo Design Services | Digital Nectar"
        />
        <span className={`admin-hint ${titleLen > TITLE_MAX ? "admin-hint-warn" : ""}`}>
          {titleLen}/{TITLE_TARGET} characters · target ≤ {TITLE_TARGET}, hard cap ~{TITLE_MAX}. Google truncates longer titles in search results.
        </span>
      </div>

      <div className="admin-field">
        <label className="admin-label">Meta Description</label>
        <textarea
          className="admin-textarea admin-textarea--sm"
          value={description}
          onChange={(e) => onChange({ description: e.target.value })}
          maxLength={DESC_MAX + 20}
          placeholder="A one or two sentence summary that appears under the page title in Google."
        />
        <span className={`admin-hint ${descLen > DESC_MAX ? "admin-hint-warn" : ""}`}>
          {descLen}/{DESC_TARGET} characters · target ≤ {DESC_TARGET}, hard cap ~{DESC_MAX}.
        </span>
      </div>

      <div className="admin-field">
        <label className="admin-label">Social Share Image (Open Graph)</label>
        <div className="admin-upload-zone" onClick={() => fileRef.current?.click()}>
          {ogImage ? (
            <div className="admin-thumb-wrap">
              <Image
                src={ogImage}
                alt="OG preview"
                width={400}
                height={210}
                className="admin-thumb-preview"
                unoptimized
              />
              <button
                type="button"
                className="admin-form-thumb-remove"
                onClick={(e) => { e.stopPropagation(); onChange({ ogImage: "" }); }}
              >
                Remove
              </button>
            </div>
          ) : (
            <>
              <div className="admin-upload-zone-icon">🖼</div>
              <div className="admin-upload-zone-text">Click to <span>upload share image</span></div>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="admin-file-hidden" onChange={handleUpload} />
        <span className="admin-hint">
          <strong>Recommended: 1200 × 630 px (1.91:1)</strong> · JPG, PNG or WebP, under ~300 KB.
          Used for LinkedIn, X/Twitter, WhatsApp, Slack, iMessage previews. Keep important text near the centre — corners get cropped on some platforms.
        </span>
      </div>

      <div className="admin-actions-row">
        <button type="button" disabled={saving} onClick={onSave} className="admin-btn admin-btn-primary">
          {saving ? "Saving…" : "Save"}
        </button>
        {saved && <span className="admin-seo-saved-tick">✓ Saved</span>}
      </div>
    </div>
  );
}
