"use client";

import { useEffect } from "react";

interface ViewTrackerProps {
  type: "blog" | "portfolio" | "team";
  slug: string;
}

export default function ViewTracker({ type, slug }: ViewTrackerProps) {
  useEffect(() => {
    if (!slug) return;
    const key = `viewed:${type}:${slug}`;
    if (typeof window !== "undefined" && sessionStorage.getItem(key)) return;

    fetch("/api/track-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, slug }),
      keepalive: true,
    }).catch(() => {});

    if (typeof window !== "undefined") sessionStorage.setItem(key, "1");
  }, [type, slug]);

  return null;
}
