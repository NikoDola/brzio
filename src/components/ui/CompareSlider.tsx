"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface CompareSliderProps {
  before: string;
  after: string;
  beforeAlt?: string;
  afterAlt?: string;
  beforeLabel?: string;
  afterLabel?: string;
}

export default function CompareSlider({
  before,
  after,
  beforeAlt = "Before",
  afterAlt = "After",
  beforeLabel = "Before",
  afterLabel = "After",
}: CompareSliderProps) {
  const [pos, setPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, pct)));
  }, []);

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!draggingRef.current) return;
      const clientX = "touches" in e ? e.touches[0]?.clientX : e.clientX;
      if (clientX != null) updateFromClientX(clientX);
    };
    const stop = () => { draggingRef.current = false; };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("touchmove", handleMove, { passive: true });
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchend", stop);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchend", stop);
    };
  }, [updateFromClientX]);

  const start = (clientX: number) => {
    draggingRef.current = true;
    updateFromClientX(clientX);
  };

  return (
    <div
      ref={containerRef}
      className="compare-slider"
      onMouseDown={(e) => start(e.clientX)}
      onTouchStart={(e) => { const t = e.touches[0]; if (t) start(t.clientX); }}
      role="slider"
      aria-label="Drag to compare before and after"
      aria-valuenow={Math.round(pos)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - 5));
        else if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + 5));
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={before} alt={beforeAlt} className="compare-slider-image" draggable={false} />
      <div
        className="compare-slider-after-wrap"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt={afterAlt} className="compare-slider-image" draggable={false} />
      </div>
      <span className="compare-slider-label compare-slider-label--before">{beforeLabel}</span>
      <span className="compare-slider-label compare-slider-label--after">{afterLabel}</span>
      <div className="compare-slider-handle" style={{ left: `${pos}%` }}>
        <span className="compare-slider-grip" aria-hidden="true">⇆</span>
      </div>
    </div>
  );
}
