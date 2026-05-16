"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { ContentBlock } from "@/lib/content";
import BlockBuilder from "./BlockBuilder";

interface TeamMember { id: string; name: string; slug: string; }
interface PostData {
  id?: string;
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  blocks?: ContentBlock[];
  thumbnail?: string;
  gallery?: string[];
  type?: "blog" | "portfolio";
  teamMember?: string | null;
  tags?: string[];
  published?: boolean;
}

function parseHtmlToBlocks(html: string): ContentBlock[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.querySelector("div")!;
  const blocks: ContentBlock[] = [];

  function extractCards(grid: Element): ContentBlock {
    const cards = Array.from(grid.querySelectorAll(".bp-card")).map((card) => {
      const img = card.querySelector("img");
      const heading = card.querySelector("h3")?.textContent?.trim() ?? "";
      const body = Array.from(card.querySelectorAll(".bp-card-body p"))
        .map((p) => p.textContent?.trim() ?? "").filter(Boolean).join("\n\n");
      return { src: img?.getAttribute("src") ?? undefined, heading, body };
    });
    return { type: "card-grid", cards };
  }

  function processEl(el: Element) {
    const tag = el.tagName;
    const cls = el.getAttribute("class") ?? "";

    if (tag === "SECTION" && cls.includes("bp-section")) {
      const heading = el.querySelector(":scope > h2")?.textContent?.trim() ?? "";
      const body = Array.from(el.querySelectorAll(":scope > p"))
        .map((p) => p.textContent?.trim() ?? "").filter(Boolean).join("\n\n");
      if (heading || body) blocks.push({ type: "section", heading: heading || undefined, body });
      const nestedGrid = el.querySelector(":scope > .bp-grid");
      if (nestedGrid) blocks.push(extractCards(nestedGrid));
      return;
    }

    if (tag === "DIV" && cls.includes("bp-banner")) {
      const img = el.querySelector("img");
      if (img) blocks.push({ type: "banner", src: img.getAttribute("src") ?? "", alt: img.getAttribute("alt") ?? undefined });
      return;
    }

    if (tag === "DIV" && cls.includes("bp-split")) {
      const layout: "left" | "right" = cls.includes("bp-split--reverse") ? "right" : "left";
      const img = el.querySelector(".bp-split-image img");
      const heading = el.querySelector(".bp-split-text h3")?.textContent?.trim() ?? "";
      const body = Array.from(el.querySelectorAll(".bp-split-text p"))
        .map((p) => p.textContent?.trim() ?? "").filter(Boolean).join("\n\n");
      blocks.push({ type: "split", layout, src: img?.getAttribute("src") ?? "", alt: img?.getAttribute("alt") ?? undefined, heading: heading || undefined, body });
      return;
    }

    if (tag === "DIV" && cls.includes("bp-grid") && !cls.includes("bp-split")) {
      blocks.push(extractCards(el));
      return;
    }

    if (tag === "DIV" && cls.includes("bp-highlight")) {
      const variant = cls.includes("bp-highlight--rose") ? "rose" as const : "green" as const;
      const heading = el.querySelector("h2")?.textContent?.trim() ?? "";
      const body = Array.from(el.querySelectorAll("p"))
        .map((p) => p.textContent?.trim() ?? "").filter(Boolean).join("\n\n");
      blocks.push({ type: "highlight", variant, heading, body });
      return;
    }

    if (tag === "BLOCKQUOTE" && cls.includes("bp-quote")) {
      blocks.push({ type: "quote", text: el.textContent?.trim() ?? "" });
      return;
    }

    if (tag === "DIV" && el.hasAttribute("data-compare")) {
      blocks.push({
        type: "compare",
        before: el.getAttribute("data-before") ?? "",
        after: el.getAttribute("data-after") ?? "",
        beforeLabel: el.getAttribute("data-before-label") ?? undefined,
        afterLabel: el.getAttribute("data-after-label") ?? undefined,
        beforeAlt: el.getAttribute("data-before-alt") ?? undefined,
        afterAlt: el.getAttribute("data-after-alt") ?? undefined,
      });
      return;
    }
  }

  for (const el of Array.from(root.children)) processEl(el);
  return blocks;
}

async function uploadFile(file: File, folder: string): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const data = await res.json();
  return data.path as string;
}

export default function PostForm({ initial, team }: { initial?: PostData; team: TeamMember[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    slug: initial?.slug ?? "",
    excerpt: initial?.excerpt ?? "",
    content: initial?.content ?? "",
    blocks: initial?.blocks ?? [] as ContentBlock[],
    thumbnail: initial?.thumbnail ?? "",
    gallery: initial?.gallery ?? [] as string[],
    type: (initial?.type ?? "blog") as "blog" | "portfolio",
    teamMember: initial?.teamMember ?? null as string | null,
    tags: initial?.tags?.join(", ") ?? "",
    published: initial?.published ?? false,
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

  const uploadFolder = form.type === "portfolio" ? "portfolio" : "blog";

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
          <button type="button" className={`admin-toggle-option${form.type === "portfolio" ? " selected" : ""}`} onClick={() => set("type", "portfolio")}>
            Portfolio Item
          </button>
        </div>
        <span className="admin-hint">
          {form.type === "blog"
            ? "Appears on /blog"
            : "Appears in the portfolio grid and on the assigned team member's profile page"}
        </span>
      </div>

      <div className="admin-field">
        <label className="admin-label">
          Team Member {form.type === "portfolio" ? "*" : <span className="admin-hint">(optional)</span>}
        </label>
        <select
          className="admin-select"
          required={form.type === "portfolio"}
          value={form.teamMember ?? ""}
          onChange={(e) => set("teamMember", e.target.value || null)}
        >
          <option value="">— None —</option>
          {team.map((m) => (
            <option key={m.id} value={m.slug}>{m.name}</option>
          ))}
        </select>
        <span className="admin-hint">
          {form.type === "portfolio"
            ? "Required. This item will appear on the selected team member's profile page."
            : "Optional — used to attribute the post to a team member."}
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
            {form.type === "blog" ? `/blog/${form.slug || "..."}` : `/portfolio/${form.slug || "..."}`}
          </span>
        </div>
      </div>

      <div className="admin-field">
        <label className="admin-label">Tags (comma separated)</label>
        <input className="admin-input" value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="e.g. Logo Design, Branding, Typography" />
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
        <label className="admin-label">Content Blocks</label>
        <span className="admin-hint" style={{ display: "block", marginBottom: 12 }}>
          Build your article layout by adding and arranging blocks below.
        </span>
        {form.content && form.blocks.length === 0 && (
          <div className="admin-legacy-notice">
            <span>This post was created with legacy HTML. Convert it to blocks to edit it visually.</span>
            <button
              type="button"
              className="admin-btn admin-btn-outline admin-btn-sm"
              onClick={() => {
                const converted = parseHtmlToBlocks(form.content);
                if (converted.length > 0) {
                  set("blocks", converted);
                }
              }}
            >
              Convert to Blocks
            </button>
          </div>
        )}
        <BlockBuilder
          blocks={form.blocks}
          onChange={(b) => set("blocks", b)}
          onUpload={handleBlockUpload}
        />
      </div>

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
          {saving ? "Saving…" : initial?.id ? "Save Changes" : "Create Post"}
        </button>
        <button type="button" onClick={() => router.back()} className="admin-btn admin-btn-outline">Cancel</button>
      </div>
    </form>
  );
}
