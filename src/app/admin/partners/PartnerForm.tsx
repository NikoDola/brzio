"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ReactCountryFlag from "react-country-flag";
import { COUNTRIES } from "@/lib/countries";

interface PartnerData {
  id?: string;
  clientName?: string;
  company?: string;
  image?: string;
  url?: string;
  review?: string;
  country?: string;
}

async function uploadFile(file: File, folder: string): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const data = await res.json();
  return data.path as string;
}

export default function PartnerForm({ initial }: { initial?: PartnerData }) {
  const router = useRouter();
  const [form, setForm] = useState({
    clientName: initial?.clientName ?? "",
    company: initial?.company ?? "",
    image: initial?.image ?? "",
    url: initial?.url ?? "",
    review: initial?.review ?? "",
    country: initial?.country ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const imageRef = useRef<HTMLInputElement>(null);

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = await uploadFile(file, "partners");
    set("image", path);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const url = initial?.id ? `/api/partners/${initial.id}` : "/api/partners";
      const method = initial?.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Save failed.");
        return;
      }
      router.push("/admin/partners");
      router.refresh();
    } catch {
      setError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const fallbackLetter = (form.company || form.clientName).charAt(0).toUpperCase() || "?";

  return (
    <form onSubmit={handleSubmit} className="admin-form">
      <div className="admin-field-row">
        <div className="admin-field">
          <label className="admin-label">Client Name</label>
          <input
            className="admin-input"
            value={form.clientName}
            onChange={(e) => set("clientName", e.target.value)}
            placeholder="e.g. Hof Retief"
          />
          <span className="admin-hint">The person you worked with. Shown on the review card.</span>
        </div>
        <div className="admin-field">
          <label className="admin-label">Company Name *</label>
          <input
            className="admin-input" required
            value={form.company}
            onChange={(e) => set("company", e.target.value)}
            placeholder="e.g. Biorugged"
          />
          <span className="admin-hint">The brand shown in the carousel.</span>
        </div>
      </div>

      <div className="admin-field-row">
        <div className="admin-field">
          <label className="admin-label">Location (Country)</label>
          <div className="admin-country-row">
            <select
              className="admin-select"
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
            >
              <option value="">— None —</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
            {form.country && (
              <span className="admin-country-flag">
                <ReactCountryFlag countryCode={form.country} svg style={{ width: "28px", height: "auto" }} />
              </span>
            )}
          </div>
          <span className="admin-hint">Optional. Shown as a flag next to the client name on reviews.</span>
        </div>
        <div className="admin-field">
          <label className="admin-label">Website URL</label>
          <input
            className="admin-input" type="url"
            value={form.url}
            onChange={(e) => set("url", e.target.value)}
            placeholder="https://example.com"
          />
          <span className="admin-hint">Optional. Logo links here when clicked.</span>
        </div>
      </div>

      <div className="admin-field">
        <label className="admin-label">Client Logo</label>
        <div className="admin-upload-zone" onClick={() => imageRef.current?.click()}>
          {form.image ? (
            <Image src={form.image} alt="Partner logo" width={200} height={120} style={{ objectFit: "contain", borderRadius: 8 }} unoptimized />
          ) : (
            <>
              <div className="admin-partner-letter admin-partner-letter--lg">
                {fallbackLetter}
              </div>
              <div className="admin-upload-zone-text">Click to <span>upload logo</span></div>
            </>
          )}
        </div>
        <input ref={imageRef} type="file" accept="image/*" className="admin-file-hidden" onChange={handleImageUpload} />
        <span className="admin-hint">
          Optional. If empty, this partner is hidden from the &ldquo;Trusted by brands worldwide&rdquo; carousel.
        </span>
      </div>

      <div className="admin-field">
        <label className="admin-label">Client Review</label>
        <textarea
          className="admin-textarea"
          value={form.review}
          onChange={(e) => set("review", e.target.value)}
          placeholder="Optional. If filled in, this partner appears in the Client Reviews section on the home page."
        />
        <span className="admin-hint">
          Leave empty to hide this partner from the reviews section. The logo still shows in the carousel.
        </span>
      </div>

      {error && <div className="admin-error-msg">{error}</div>}

      <div className="admin-actions-row">
        <button type="submit" disabled={saving} className="admin-btn admin-btn-primary">
          {saving ? "Saving…" : initial?.id ? "Save Changes" : "Add Partner"}
        </button>
        <button type="button" onClick={() => router.back()} className="admin-btn admin-btn-outline">Cancel</button>
      </div>
    </form>
  );
}
