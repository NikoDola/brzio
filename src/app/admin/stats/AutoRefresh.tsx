"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Periodically re-fetches the (force-dynamic) stats page so the "Currently
// Playing" view stays current. Read-only: it never writes to the database.
export default function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
