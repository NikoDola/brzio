import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export type ViewType = "blog" | "portfolio" | "team";
const ALLOWED: ViewType[] = ["blog", "portfolio", "team"];

function docId(type: ViewType, slug: string) {
  return `${type}_${slug}`;
}

export function isValidViewType(t: unknown): t is ViewType {
  return typeof t === "string" && (ALLOWED as string[]).includes(t);
}

export async function recordView(type: ViewType, slug: string): Promise<void> {
  if (!slug || typeof slug !== "string" || slug.length > 200) return;
  try {
    await adminDb.collection("pageViews").doc(docId(type, slug)).set(
      {
        type,
        slug,
        count: FieldValue.increment(1),
        lastViewedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } catch {
    /* analytics must never break the page */
  }
}

/** Returns a map of slug → view count for every page of the given type. */
export async function getViewsByType(type: ViewType): Promise<Record<string, number>> {
  try {
    const snap = await adminDb.collection("pageViews").where("type", "==", type).get();
    const out: Record<string, number> = {};
    snap.forEach((d) => {
      const data = d.data();
      if (data?.slug) out[data.slug] = data.count ?? 0;
    });
    return out;
  } catch {
    return {};
  }
}
