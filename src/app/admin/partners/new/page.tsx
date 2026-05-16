import Link from "next/link";
import PartnerForm from "../PartnerForm";

export default function NewPartnerPage() {
  return (
    <div className="admin-content">
      <Link href="/admin/partners" className="admin-back-link">← Partners</Link>
      <div className="admin-section-header">
        <h1 className="admin-section-title">Add Partner</h1>
      </div>
      <div className="admin-card">
        <PartnerForm />
      </div>
    </div>
  );
}
