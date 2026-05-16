"use client";

import { useRef, useState } from "react";
import type { ContentBlock } from "@/lib/content";

const BLOCK_LABELS: Record<ContentBlock["type"], string> = {
  section: "Text Section",
  banner: "Banner Image",
  split: "Image + Text",
  "card-grid": "Card Grid",
  highlight: "Highlight Block",
  quote: "Pull Quote",
  compare: "Compare Slider",
};

const BLOCK_DEFAULTS: { [K in ContentBlock["type"]]: Extract<ContentBlock, { type: K }> } = {
  section: { type: "section", heading: "", body: "" },
  banner: { type: "banner", src: "", alt: "" },
  split: { type: "split", layout: "left", src: "", alt: "", heading: "", body: "" },
  "card-grid": { type: "card-grid", cards: [{ src: "", heading: "", body: "" }] },
  highlight: { type: "highlight", variant: "green", heading: "", body: "" },
  quote: { type: "quote", text: "" },
  compare: { type: "compare", before: "", after: "", beforeLabel: "Before", afterLabel: "After" },
};

interface BlockBuilderProps {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  onUpload: (file: File) => Promise<string>;
}

function ImageUploadField({
  value,
  onChange,
  onUpload,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  onUpload: (file: File) => Promise<string>;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = await onUpload(file);
      onChange(path);
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div className="admin-field">
      {label && <label className="admin-label">{label}</label>}
      <div
        className="admin-upload-zone admin-block-img-zone"
        onClick={() => ref.current?.click()}
      >
        {value ? (
          <div className="admin-block-img-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" />
            <button
              type="button"
              className="admin-block-img-remove"
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
            >
              ×
            </button>
          </div>
        ) : uploading ? (
          <span className="admin-upload-zone-text">Uploading…</span>
        ) : (
          <span className="admin-upload-zone-text">Click to <span>upload image</span></span>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" className="admin-file-hidden" onChange={handleFile} />
    </div>
  );
}

function BlockEditor({
  block,
  onChange,
  onUpload,
}: {
  block: ContentBlock;
  onChange: (b: ContentBlock) => void;
  onUpload: (file: File) => Promise<string>;
}) {
  function patch(fields: Partial<Record<string, unknown>>) {
    onChange({ ...block, ...fields } as ContentBlock);
  }

  switch (block.type) {
    case "section":
      return (
        <div className="admin-block-fields">
          <div className="admin-field">
            <label className="admin-label">Heading <span className="admin-hint">(optional)</span></label>
            <input
              className="admin-input"
              value={block.heading ?? ""}
              onChange={(e) => patch({ heading: e.target.value })}
              placeholder="Section heading…"
            />
          </div>
          <div className="admin-field">
            <label className="admin-label">Body Text *</label>
            <textarea
              className="admin-textarea admin-textarea--sm"
              value={block.body}
              onChange={(e) => patch({ body: e.target.value })}
              placeholder="Write paragraphs here. Separate with a blank line for a new paragraph."
            />
          </div>
        </div>
      );

    case "banner":
      return (
        <div className="admin-block-fields">
          <ImageUploadField value={block.src} onChange={(v) => patch({ src: v })} onUpload={onUpload} label="Image *" />
          <div className="admin-field">
            <label className="admin-label">Alt Text <span className="admin-hint">(optional)</span></label>
            <input
              className="admin-input"
              value={block.alt ?? ""}
              onChange={(e) => patch({ alt: e.target.value })}
              placeholder="Image description for accessibility"
            />
          </div>
        </div>
      );

    case "split":
      return (
        <div className="admin-block-fields">
          <div className="admin-field">
            <label className="admin-label">Image Position</label>
            <div className="admin-toggle-group">
              <button
                type="button"
                className={`admin-toggle-option${block.layout === "left" ? " selected" : ""}`}
                onClick={() => patch({ layout: "left" })}
              >
                Image Left
              </button>
              <button
                type="button"
                className={`admin-toggle-option${block.layout === "right" ? " selected" : ""}`}
                onClick={() => patch({ layout: "right" })}
              >
                Image Right
              </button>
            </div>
          </div>
          <ImageUploadField value={block.src} onChange={(v) => patch({ src: v })} onUpload={onUpload} label="Image *" />
          <div className="admin-field">
            <label className="admin-label">Alt Text <span className="admin-hint">(optional)</span></label>
            <input
              className="admin-input"
              value={block.alt ?? ""}
              onChange={(e) => patch({ alt: e.target.value })}
              placeholder="Image description"
            />
          </div>
          <div className="admin-field">
            <label className="admin-label">Heading <span className="admin-hint">(optional)</span></label>
            <input
              className="admin-input"
              value={block.heading ?? ""}
              onChange={(e) => patch({ heading: e.target.value })}
              placeholder="Side heading…"
            />
          </div>
          <div className="admin-field">
            <label className="admin-label">Body Text *</label>
            <textarea
              className="admin-textarea admin-textarea--sm"
              value={block.body}
              onChange={(e) => patch({ body: e.target.value })}
              placeholder="Text beside the image…"
            />
          </div>
        </div>
      );

    case "card-grid": {
      const cards = block.cards;
      function updateCard(i: number, key: string, value: string) {
        const next = cards.map((c, j) => j === i ? { ...c, [key]: value } : c);
        patch({ cards: next });
      }
      function addCard() { patch({ cards: [...cards, { src: "", heading: "", body: "" }] }); }
      function removeCard(i: number) { patch({ cards: cards.filter((_, j) => j !== i) }); }

      return (
        <div className="admin-block-fields">
          <div className="admin-block-cards-list">
            {cards.map((card, i) => (
              <div key={i} className="admin-block-card-item">
                <div className="admin-block-card-header">
                  <span className="admin-block-card-num">Card {i + 1}</span>
                  <button type="button" className="admin-block-card-remove" onClick={() => removeCard(i)}>×</button>
                </div>
                <ImageUploadField
                  value={card.src ?? ""}
                  onChange={(v) => updateCard(i, "src", v)}
                  onUpload={onUpload}
                  label="Image (optional)"
                />
                <div className="admin-field">
                  <label className="admin-label">Heading *</label>
                  <input
                    className="admin-input"
                    value={card.heading}
                    onChange={(e) => updateCard(i, "heading", e.target.value)}
                    placeholder="Card heading…"
                  />
                </div>
                <div className="admin-field">
                  <label className="admin-label">Body Text</label>
                  <textarea
                    className="admin-textarea admin-textarea--sm"
                    value={card.body}
                    onChange={(e) => updateCard(i, "body", e.target.value)}
                    placeholder="Card body text…"
                  />
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" onClick={addCard}>
            + Add Card
          </button>
        </div>
      );
    }

    case "highlight":
      return (
        <div className="admin-block-fields">
          <div className="admin-field">
            <label className="admin-label">Accent Color</label>
            <div className="admin-toggle-group">
              <button
                type="button"
                className={`admin-toggle-option${block.variant !== "rose" ? " selected" : ""}`}
                onClick={() => patch({ variant: "green" })}
              >
                Green
              </button>
              <button
                type="button"
                className={`admin-toggle-option${block.variant === "rose" ? " selected" : ""}`}
                onClick={() => patch({ variant: "rose" })}
              >
                Rose
              </button>
            </div>
          </div>
          <div className="admin-field">
            <label className="admin-label">Heading *</label>
            <input
              className="admin-input"
              value={block.heading}
              onChange={(e) => patch({ heading: e.target.value })}
              placeholder="Highlight heading…"
            />
          </div>
          <div className="admin-field">
            <label className="admin-label">Body Text *</label>
            <textarea
              className="admin-textarea admin-textarea--sm"
              value={block.body}
              onChange={(e) => patch({ body: e.target.value })}
              placeholder="Highlight content…"
            />
          </div>
        </div>
      );

    case "quote":
      return (
        <div className="admin-block-fields">
          <div className="admin-field">
            <label className="admin-label">Quote Text *</label>
            <textarea
              className="admin-textarea admin-textarea--sm"
              value={block.text}
              onChange={(e) => patch({ text: e.target.value })}
              placeholder="The pull quote text…"
            />
          </div>
        </div>
      );

    case "compare":
      return (
        <div className="admin-block-fields">
          <ImageUploadField value={block.before} onChange={(v) => patch({ before: v })} onUpload={onUpload} label="Before Image *" />
          <div className="admin-field">
            <label className="admin-label">Before Label <span className="admin-hint">(optional)</span></label>
            <input
              className="admin-input"
              value={block.beforeLabel ?? ""}
              onChange={(e) => patch({ beforeLabel: e.target.value })}
              placeholder="Before"
            />
          </div>
          <ImageUploadField value={block.after} onChange={(v) => patch({ after: v })} onUpload={onUpload} label="After Image *" />
          <div className="admin-field">
            <label className="admin-label">After Label <span className="admin-hint">(optional)</span></label>
            <input
              className="admin-input"
              value={block.afterLabel ?? ""}
              onChange={(e) => patch({ afterLabel: e.target.value })}
              placeholder="After"
            />
          </div>
        </div>
      );

    default:
      return null;
  }
}

export default function BlockBuilder({ blocks, onChange, onUpload }: BlockBuilderProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  function addBlock(type: ContentBlock["type"]) {
    const newBlock = { ...BLOCK_DEFAULTS[type] } as ContentBlock;
    const next = [...blocks, newBlock];
    onChange(next);
    setOpenIdx(next.length - 1);
  }

  function updateBlock(i: number, block: ContentBlock) {
    onChange(blocks.map((b, j) => (j === i ? block : b)));
  }

  function removeBlock(i: number) {
    onChange(blocks.filter((_, j) => j !== i));
    setOpenIdx((prev) => {
      if (prev === i) return null;
      if (prev !== null && prev > i) return prev - 1;
      return prev;
    });
  }

  function moveUp(i: number) {
    if (i === 0) return;
    const next = [...blocks];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    onChange(next);
    setOpenIdx(i - 1);
  }

  function moveDown(i: number) {
    if (i === blocks.length - 1) return;
    const next = [...blocks];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    onChange(next);
    setOpenIdx(i + 1);
  }

  function blockPreview(block: ContentBlock): string {
    if (block.type === "section" && block.heading) return block.heading;
    if (block.type === "split" && block.heading) return block.heading;
    if (block.type === "quote") return `"${block.text.slice(0, 50)}${block.text.length > 50 ? "…" : ""}"`;
    if (block.type === "highlight") return block.heading;
    if (block.type === "card-grid") return `${block.cards.length} card${block.cards.length !== 1 ? "s" : ""}`;
    return "";
  }

  return (
    <div>
      {blocks.length > 0 && (
        <div className="admin-blocks">
          {blocks.map((block, i) => (
            <div key={i} className="admin-block">
              <div className="admin-block-header" onClick={() => setOpenIdx(openIdx === i ? null : i)}>
                <span className="admin-block-type-badge">{BLOCK_LABELS[block.type]}</span>
                {blockPreview(block) && (
                  <span className="admin-block-preview">{blockPreview(block)}</span>
                )}
                <div className="admin-block-controls" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="admin-block-ctrl-btn"
                    onClick={() => moveUp(i)}
                    disabled={i === 0}
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="admin-block-ctrl-btn"
                    onClick={() => moveDown(i)}
                    disabled={i === blocks.length - 1}
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="admin-block-ctrl-btn admin-block-ctrl-delete"
                    onClick={() => removeBlock(i)}
                    title="Remove block"
                  >
                    ×
                  </button>
                </div>
                <span className="admin-block-chevron">{openIdx === i ? "▲" : "▼"}</span>
              </div>
              {openIdx === i && (
                <BlockEditor block={block} onChange={(b) => updateBlock(i, b)} onUpload={onUpload} />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="admin-block-add">
        <div className="admin-block-add-label">Add Block</div>
        <div className="admin-block-add-types">
          {(Object.keys(BLOCK_LABELS) as ContentBlock["type"][]).map((type) => (
            <button
              key={type}
              type="button"
              className="admin-block-add-type-btn"
              onClick={() => addBlock(type)}
            >
              + {BLOCK_LABELS[type]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
