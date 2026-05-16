"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface TeamMemberData {
  id?: string;
  name?: string;
  slug?: string;
  role?: string;
  bio?: string;
  quote?: string;
  image?: string;
  heroBg?: string;
  instagram?: string;
  website?: string;
  order?: number;
}

async function uploadFile(file: File, folder: string): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const data = await res.json();
  return data.path as string;
}

export default function TeamForm({ initial }: { initial?: TeamMemberData }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    slug: initial?.slug ?? "",
    role: initial?.role ?? "",
    bio: initial?.bio ?? "",
    quote: initial?.quote ?? "",
    image: initial?.image ?? "",
    heroBg: initial?.heroBg ?? "",
    instagram: initial?.instagram ?? "",
    website: initial?.website ?? "",
    order: initial?.order ?? 99,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const profileRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<HTMLInputElement>(null);

  function set(key: string, value: string | number) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function autoSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  async function handleProfileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = await uploadFile(file, "team");
    set("image", path);
  }

  async function handleBgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = await uploadFile(file, "team");
    set("heroBg", path);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const url = initial?.id ? `/api/team/${initial.id}` : "/api/team";
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
      router.push("/admin/team");
      router.refresh();
    } catch {
      setError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="admin-form">
      <div className="admin-field-row">
        <div className="admin-field">
          <label className="admin-label">Full Name *</label>
          <input
            className="admin-input" required
            value={form.name}
            onChange={(e) => {
              set("name", e.target.value);
              if (!initial?.id) set("slug", autoSlug(e.target.value));
            }}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label">URL Slug *</label>
          <input className="admin-input" required value={form.slug} onChange={(e) => set("slug", e.target.value)} />
          <span className="admin-hint">/about-us/{form.slug || "..."}</span>
        </div>
      </div>

      <div className="admin-field">
        <label className="admin-label">Role / Title *</label>
        <input className="admin-input" required value={form.role} onChange={(e) => set("role", e.target.value)} />
      </div>

      <div className="admin-field">
        <label className="admin-label">Short Quote</label>
        <input className="admin-input" value={form.quote} onChange={(e) => set("quote", e.target.value)} placeholder="e.g. Great design speaks louder than words." />
      </div>

      <div className="admin-field">
        <label className="admin-label">Bio</label>
        <textarea className="admin-textarea" value={form.bio} onChange={(e) => set("bio", e.target.value)} />
      </div>

      <div className="admin-field-row">
        <div className="admin-field">
          <label className="admin-label">Instagram URL</label>
          <input className="admin-input" type="url" value={form.instagram} onChange={(e) => set("instagram", e.target.value)} />
        </div>
        <div className="admin-field">
          <label className="admin-label">Personal Website</label>
          <input className="admin-input" type="url" value={form.website} onChange={(e) => set("website", e.target.value)} />
        </div>
      </div>

      <div className="admin-field">
        <label className="admin-label">Display Order</label>
        <input className="admin-input admin-input--sm" type="number" value={form.order} onChange={(e) => set("order", parseInt(e.target.value) || 99)} />
        <span className="admin-hint">Lower numbers appear first (e.g. 1, 2, 3)</span>
      </div>

      <div className="admin-field-row">
        <div className="admin-field">
          <label className="admin-label">Profile Photo</label>
          <div className="admin-upload-zone" onClick={() => profileRef.current?.click()}>
            {form.image ? (
              <Image src={form.image} alt="Profile" width={200} height={120} style={{ objectFit: "cover", borderRadius: 8 }} unoptimized />
            ) : (
              <>
                <div className="admin-upload-zone-icon">📸</div>
                <div className="admin-upload-zone-text">Click to <span>upload photo</span></div>
              </>
            )}
          </div>
          <input ref={profileRef} type="file" accept="image/*" className="admin-file-hidden" onChange={handleProfileUpload} />
        </div>

        <div className="admin-field">
          <label className="admin-label">Hero Background</label>
          <div className="admin-upload-zone" onClick={() => bgRef.current?.click()}>
            {form.heroBg ? (
              <Image src={form.heroBg} alt="Hero BG" width={200} height={120} style={{ objectFit: "cover", borderRadius: 8 }} unoptimized />
            ) : (
              <>
                <div className="admin-upload-zone-icon">🖼</div>
                <div className="admin-upload-zone-text">Click to <span>upload hero image</span></div>
              </>
            )}
          </div>
          <input ref={bgRef} type="file" accept="image/*" className="admin-file-hidden" onChange={handleBgUpload} />
        </div>
      </div>

      {error && <div className="admin-error-msg">{error}</div>}

      <div className="admin-actions-row">
        <button type="submit" disabled={saving} className="admin-btn admin-btn-primary">
          {saving ? "Saving…" : initial?.id ? "Save Changes" : "Add Member"}
        </button>
        <button type="button" onClick={() => router.back()} className="admin-btn admin-btn-outline">Cancel</button>
      </div>
    </form>
  );
}
