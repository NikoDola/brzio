"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeletePartnerBtn({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setLoading(true);
    await fetch(`/api/partners/${id}`, { method: "DELETE" });
    router.refresh();
    setLoading(false);
  }

  return (
    <button onClick={handleDelete} disabled={loading} className="admin-btn admin-btn-danger admin-btn-sm">
      {loading ? "…" : "Delete"}
    </button>
  );
}
