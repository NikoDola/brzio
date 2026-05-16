import Link from "next/link";
import { adminDb } from "@/lib/firebase/admin";
import { getPosts, getTeam, getPartners } from "@/lib/content";

async function getOrdersCount() {
  try {
    const snap = await adminDb.collection("orders").count().get();
    return snap.data().count;
  } catch {
    return 0;
  }
}

export default async function AdminDashboard() {
  const [orders, posts, team, partners] = await Promise.all([
    getOrdersCount(),
    getPosts(),
    getTeam(),
    getPartners(),
  ]);
  const reviewsCount = partners.filter((p) => p.review && p.review.trim()).length;

  return (
    <div className="admin-content">
      <div className="admin-section-header admin-section-header--tight">
        <h1 className="admin-section-title">Dashboard</h1>
      </div>
      <p className="admin-section-sub">Welcome to the Digital Nectar admin.</p>

      <div className="admin-dashboard-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-value">{orders}</div>
          <div className="admin-stat-label">Total Orders</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value">{posts.length}</div>
          <div className="admin-stat-label">Blog / Portfolio Posts</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value">{team.length}</div>
          <div className="admin-stat-label">Team Members</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value">{partners.length}</div>
          <div className="admin-stat-label">Partners</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value">{reviewsCount}</div>
          <div className="admin-stat-label">Partners With Reviews</div>
        </div>
      </div>

      <div className="admin-section-header admin-section-header--medium">
        <h2 className="admin-section-title admin-section-title-sm">Quick Actions</h2>
      </div>
      <div className="admin-actions-row">
        <Link href="/admin/posts/new" className="admin-btn admin-btn-primary">+ New Post</Link>
        <Link href="/admin/team/new" className="admin-btn admin-btn-outline">+ Add Team Member</Link>
        <Link href="/admin/partners/new" className="admin-btn admin-btn-outline">+ Add Partner</Link>
        <Link href="/admin/orders" className="admin-btn admin-btn-outline">View Orders</Link>
      </div>
    </div>
  );
}
