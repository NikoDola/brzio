import Link from "next/link";
import { notFound } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="od-row">
      <span className="od-key">{label}</span>
      <span className="od-val">{String(value)}</span>
    </div>
  );
}

function formatDate(ts: FirebaseFirestore.Timestamp | null) {
  if (!ts) return "—";
  return ts.toDate().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await adminDb.collection("orders").doc(id).get();
  if (!doc.exists) notFound();

  const o = doc.data()!;
  const isLogo = o.type === "logo";
  const isBranding = o.type === "branding";
  const isWebsite = o.type === "website";

  const statusColor =
    o.status === "paid" ? "admin-badge-green"
    : o.status === "pending" ? "admin-badge-gold"
    : "admin-badge-gray";

  return (
    <div className="admin-content">
      <Link href="/admin/orders" className="admin-back-link">← All Orders</Link>

      <div className="admin-section-header">
        <div>
          <h1 className="admin-section-title">{o.companyName || o.clientName || "Order"}</h1>
          <div className="admin-od-header">
            <span className={`admin-badge ${statusColor}`}>{o.status}</span>
            <span className="admin-badge admin-badge-blue">{o.type}</span>
            {o.tier && <span className="admin-od-tier-note">— {o.tier}</span>}
          </div>
        </div>
        <div className="admin-od-price-block">
          <div className="admin-od-price">${((o.amount ?? 0) / 100).toFixed(2)}</div>
          <div className="admin-od-date">{formatDate(o.createdAt ?? null)}</div>
        </div>
      </div>

      <div className="od-grid">
        <div className="admin-card od-section">
          <div className="od-section-title">Client</div>
          <Row label="Name" value={o.clientName} />
          <Row label="Email" value={o.clientEmail} />
        </div>

        <div className="admin-card od-section">
          <div className="od-section-title">Payment</div>
          <Row label="Stripe Session" value={o.stripeSessionId} />
          <Row label="Payment Intent" value={o.stripePaymentIntentId} />
          <Row label="Amount" value={o.amount ? `$${(o.amount / 100).toFixed(2)}` : null} />
          <Row label="Paid At" value={o.paidAt ? formatDate(o.paidAt) : null} />
        </div>

        {isLogo && (
          <div className="admin-card od-section admin-od-section--full">
            <div className="od-section-title">Logo Brief</div>
            <Row label="Company" value={o.companyName} />
            <Row label="Industry" value={o.industry} />
            <Row label="Logo Name" value={o.logoName} />
            <Row label="Description" value={o.description} />
            <Row label="Incorporate" value={o.incorporate} />
            <Row label="Avoid" value={o.avoid} />
            <Row label="Color Prefs" value={o.colorPrefs} />
            <Row label="Style Prefs" value={o.stylePrefs} />
          </div>
        )}

        {isBranding && (
          <div className="admin-card od-section admin-od-section--full">
            <div className="od-section-title">Branding Brief</div>
            <Row label="Company" value={o.companyName} />
            <Row label="Industry" value={o.industry} />
            <Row label="Tagline" value={o.tagline} />
            <Row label="Description" value={o.description} />
            <Row label="Services" value={Array.isArray(o.services) ? o.services.join(", ") : o.services} />
            <Row label="Style" value={Array.isArray(o.styles) ? o.styles.join(", ") : o.styles} />
            <Row label="Colors" value={o.colorPrefs} />
            <Row label="Additional Notes" value={o.notes} />
          </div>
        )}

        {isWebsite && (
          <div className="admin-card od-section admin-od-section--full">
            <div className="od-section-title">Website Brief</div>
            <Row label="Business Name" value={o.companyName} />
            <Row label="Website Type" value={o.websiteType} />
            <Row label="Description" value={o.description} />
            <Row label="Pages" value={Array.isArray(o.pages) ? o.pages.join(", ") : o.pages} />
            <Row label="Style" value={o.style} />
            <Row label="Features" value={Array.isArray(o.features) ? o.features.join(", ") : o.features} />
            <Row label="Color Prefs" value={o.colorPrefs} />
            <Row label="Additional Notes" value={o.notes} />
          </div>
        )}
      </div>
    </div>
  );
}
