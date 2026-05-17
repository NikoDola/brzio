"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { ContentBlock, PostType } from "@/lib/content";
import BlockBuilder from "./BlockBuilder";

interface PostData {
  id?: string;
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  blocks?: ContentBlock[];
  thumbnail?: string;
  gallery?: string[];
  type?: PostType;
  tags?: string[];
  published?: boolean;
  gameSlug?: string;
}

async function uploadFile(file: File, folder: string): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const data = await res.json();
  return data.path as string;
}

interface PostFormProps {
  initial?: PostData;
  initialType?: PostType;
  gameFolders: string[];
}

export default function PostForm({ initial, initialType, gameFolders }: PostFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    slug: initial?.slug ?? "",
    excerpt: initial?.excerpt ?? "",
    content: initial?.content ?? "",
    blocks: initial?.blocks ?? ([] as ContentBlock[]),
    thumbnail: initial?.thumbnail ?? "",
    gallery: initial?.gallery ?? ([] as string[]),
    type: (initial?.type ?? initialType ?? "blog") as PostType,
    tags: initial?.tags?.join(", ") ?? "",
    published: initial?.published ?? false,
    gameSlug: initial?.gameSlug ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const thumbRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function autoSlug(title: string) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  const uploadFolder = form.type === "game" ? "games" : "blog";
  const isGame = form.type === "game";

  async function handleThumbUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = await uploadFile(file, uploadFolder);
    set("thumbnail", path);
  }

  async function handleGalleryUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const paths = await Promise.all(files.map((f) => uploadFile(f, uploadFolder)));
    set("gallery", [...form.gallery, ...paths]);
  }

  async function handleBlockUpload(file: File): Promise<string> {
    return uploadFile(file, uploadFolder);
  }

  function removeGalleryItem(idx: number) {
    set("gallery", form.gallery.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        gameSlug: isGame ? (form.gameSlug || form.slug) : undefined,
      };
      const url = initial?.id ? `/api/posts/${initial.id}` : "/api/posts";
      const method = initial?.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Save failed.");
        return;
      }
      router.push("/admin/posts");
      router.refresh();
    } catch {
      setError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const isVideo = (src: string) => /\.(mp4|webm|mov)$/i.test(src);

  return (
    <form onSubmit={handleSubmit} className="admin-form">

      <div className="admin-field">
        <label className="admin-label">Post Type</label>
        <div className="admin-toggle-group">
          <button type="button" className={`admin-toggle-option${form.type === "blog" ? " selected" : ""}`} onClick={() => set("type", "blog")}>
            Blog Post
          </button>
          <button type="button" className={`admin-toggle-option${form.type === "game" ? " selected" : ""}`} onClick={() => set("type", "game")}>
            Game
          </button>
        </div>
        <span className="admin-hint">
          {isGame
            ? "Appears on the home page game grid and at /games/<slug>"
            : "Appears on /blog"}
        </span>
      </div>

      <div className="admin-field-row">
        <div className="admin-field">
          <label className="admin-label">Title *</label>
          <input
            className="admin-input" required
            value={form.title}
            onChange={(e) => {
              set("title", e.target.value);
              if (!initial?.id) set("slug", autoSlug(e.target.value));
            }}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label">URL Slug *</label>
          <input className="admin-input" required value={form.slug} onChange={(e) => set("slug", e.target.value)} />
          <span className="admin-hint">
            {isGame ? `/games/${form.slug || "..."}` : `/blog/${form.slug || "..."}`}
          </span>
        </div>
      </div>

      {isGame && (
        <div className="admin-field">
          <label className="admin-label">Game Folder *</label>
          {gameFolders.length > 0 ? (
            <select
              className="admin-select"
              required
              value={form.gameSlug || form.slug}
              onChange={(e) => set("gameSlug", e.target.value)}
            >
              <option value="">— Select a game folder —</option>
              {gameFolders.map((folder) => (
                <option key={folder} value={folder}>{folder}</option>
              ))}
            </select>
          ) : (
            <input
              className="admin-input"
              required
              value={form.gameSlug}
              onChange={(e) => set("gameSlug", e.target.value)}
              placeholder="planet-merge"
            />
          )}
          <span className="admin-hint">
            Folder inside <code>/public/games/</code> containing the game&apos;s <code>index.html</code>.
          </span>
        </div>
      )}

      <div className="admin-field">
        <label className="admin-label">Tags (comma separated)</label>
        <input className="admin-input" value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder={isGame ? "e.g. Puzzle, Casual, Merge" : "e.g. Devlog, Update"} />
      </div>

      <div className="admin-field">
        <label className="admin-label">Excerpt / Short Description</label>
        <textarea className="admin-textarea admin-textarea--sm" value={form.excerpt} onChange={(e) => set("excerpt", e.target.value)} placeholder="One or two sentences that appear on the card preview." />
      </div>

      <div className="admin-field">
        <label className="admin-label">Thumbnail / Cover Image</label>
        <div className="admin-upload-zone" onClick={() => thumbRef.current?.click()}>
          {form.thumbnail ? (
            <div className="admin-thumb-wrap">
              <Image
                src={form.thumbnail}
                alt="Thumbnail"
                width={400}
                height={200}
                className="admin-thumb-preview"
                unoptimized
              />
              <button
                type="button"
                className="admin-form-thumb-remove"
                onClick={(e) => { e.stopPropagation(); set("thumbnail", ""); }}
              >
                Remove
              </button>
            </div>
          ) : (
            <>
              <div className="admin-upload-zone-icon">🖼</div>
              <div className="admin-upload-zone-text">Click to <span>upload cover image</span></div>
            </>
          )}
        </div>
        <input ref={thumbRef} type="file" accept="image/*,video/*" className="admin-file-hidden" onChange={handleThumbUpload} />
      </div>

      <div className="admin-field">
        <label className="admin-label">
          {isGame ? "Description Blocks" : "Content Blocks"}
        </label>
        <span className="admin-hint" style={{ display: "block", marginBottom: 12 }}>
          {isGame
            ? "Optional. Shown below the game (e.g. how-to-play, story, credits)."
            : "Build your article layout by adding and arranging blocks below."}
        </span>
        <BlockBuilder
          blocks={form.blocks}
          onChange={(b) => set("blocks", b)}
          onUpload={handleBlockUpload}
        />
      </div>

      {!isGame && (
        <div className="admin-field">
          <label className="admin-label">Gallery <span className="admin-hint">(optional — extra images / videos)</span></label>
          <div className="admin-upload-zone" onClick={() => galleryRef.current?.click()}>
            <div className="admin-upload-zone-icon">📂</div>
            <div className="admin-upload-zone-text">Click to <span>add gallery files</span> (images or video)</div>
          </div>
          <input ref={galleryRef} type="file" accept="image/*,video/*" multiple className="admin-file-hidden" onChange={handleGalleryUpload} />
          {form.gallery.length > 0 && (
            <div className="admin-thumb-list">
              {form.gallery.map((src, i) => (
                <div key={i} className="admin-thumb">
                  {isVideo(src) ? (
                    <video src={src} muted />
                  ) : (
                    <Image src={src} alt="" fill style={{ objectFit: "cover" }} unoptimized />
                  )}
                  <button type="button" className="admin-thumb-remove" onClick={() => removeGalleryItem(i)}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="admin-field">
        <label className="admin-label">Visibility</label>
        <div className="admin-toggle-group">
          <button type="button" className={`admin-toggle-option${!form.published ? " selected" : ""}`} onClick={() => set("published", false)}>
            Draft
          </button>
          <button type="button" className={`admin-toggle-option${form.published ? " selected" : ""}`} onClick={() => set("published", true)}>
            Published
          </button>
        </div>
      </div>

      {error && <div className="admin-error-msg">{error}</div>}

      <div className="admin-actions-row">
        <button type="submit" disabled={saving} className="admin-btn admin-btn-primary">
          {saving ? "Saving…" : initial?.id ? "Save Changes" : "Create"}
        </button>
        <button type="button" onClick={() => router.back()} className="admin-btn admin-btn-outline">Cancel</button>
      </div>
    </form>
  );
}
