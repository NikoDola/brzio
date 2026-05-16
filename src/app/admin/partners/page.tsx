import Link from "next/link";
import { getPartners } from "@/lib/content";
import PartnerList from "./PartnerList";

export default async function AdminPartnersPage() {
  const partners = await getPartners();

  return (
    <div className="admin-content">
      <div className="admin-section-header">
        <h1 className="admin-section-title">Partners</h1>
        <Link href="/admin/partners/new" className="admin-btn admin-btn-primary">+ Add Partner</Link>
      </div>
      <p className="admin-section-sub">
        Logos shown in the &ldquo;Trusted by brands worldwide&rdquo; carousel. If no image is uploaded, the first letter of the name is used as a thumbnail.
      </p>

      {partners.length === 0 ? (
        <div className="admin-empty">
          <div className="admin-empty-icon">🤝</div>
          <div className="admin-empty-text">No partners yet. Add your first one.</div>
        </div>
      ) : (
        <PartnerList partners={partners} />
      )}
    </div>
  );
}
