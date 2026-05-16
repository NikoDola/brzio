"use client";
import { useEffect } from "react";

export default function H2LineEffect() {
  useEffect(() => {
    const h2s = Array.from(document.querySelectorAll("h2")).filter(
      (el) => !el.closest(".lc-root")
    );

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    h2s.forEach((h2) => observer.observe(h2));
    return () => observer.disconnect();
  }, []);

  return null;
}
