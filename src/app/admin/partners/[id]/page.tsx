import Link from "next/link";
import { notFound } from "next/navigation";
import { getPartner } from "@/lib/content";
import PartnerForm from "../PartnerForm";

export default async function EditPartnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const partner = await getPartner(id);
  if (!partner) notFound();

  return (
    <div className="admin-content">
      <Link href="/admin/partners" className="admin-back-link">← Partners</Link>
      <div className="admin-section-header">
        <h1 className="admin-section-title">Edit Partner</h1>
      </div>
      <div className="admin-card">
        <PartnerForm initial={partner} />
      </div>
    </div>
  );
}
