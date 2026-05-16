// components/form/TagsInput.tsx
"use client";
import "./TagsInput.css"

type TagsInputProps = {
  tags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
};

import { useState, KeyboardEvent } from "react";

export function TagsInput({ tags, onAddTag, onRemoveTag }: TagsInputProps) {
  const [tagInput, setTagInput] = useState("");

  const addTag = () => {
    const tagToAdd = tagInput.trim();
    if (tagToAdd && !tags.includes(tagToAdd)) {
      onAddTag(tagToAdd);
      setTagInput("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // If comma is entered, add the tag and clear input
    if (value.endsWith(',')) {
      const tagToAdd = value.slice(0, -1).trim();
      if (tagToAdd && !tags.includes(tagToAdd)) {
        onAddTag(tagToAdd);
        setTagInput("");
      }
    } else {
      setTagInput(value);
    }
  };

  return (
    <div className="form-section">
      <h3 className="section-title">Hashtags</h3>
      <div className="tags-input-wrapper">
        <div className="tags-container">
          {tags.map((tag) => (
            <span key={tag} className="tag">
              #{tag}
              <button
                type="button"
                className="tag-remove"
                onClick={() => onRemoveTag(tag)}
                aria-label={`Remove tag ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="tag-input-group">
          <input
            type="text"
            value={tagInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Add tags (use comma or enter)"
          />
        </div>
      </div>
    </div>
  );
}