import { getSeoMap, SEO_ROUTES } from "@/lib/content";
import SeoForm from "./SeoForm";

export default async function AdminSeoPage() {
  const map = await getSeoMap();

  const entries = SEO_ROUTES.map((r) => ({
    path: r.path,
    label: r.label,
    entry: map[r.path] ?? { title: "", description: "", ogImage: "" },
  }));

  return (
    <div className="admin-content">
      <div className="admin-section-header">
        <h1 className="admin-section-title">SEO & Social Previews</h1>
      </div>
      <p className="admin-section-sub">
        Per-page meta titles, descriptions, and Open Graph images. Changes are saved to <code>src/content/seo.json</code> and must be git-committed to deploy.
      </p>

      <SeoForm initial={entries} />
    </div>
  );
}
