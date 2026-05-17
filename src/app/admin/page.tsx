import Link from "next/link";
import { getPosts } from "@/lib/content";

export default async function AdminDashboard() {
  const posts = await getPosts();
  const games = posts.filter((p) => p.type === "game");
  const blog = posts.filter((p) => p.type === "blog");

  return (
    <div className="admin-content">
      <div className="admin-section-header admin-section-header--tight">
        <h1 className="admin-section-title">Dashboard</h1>
      </div>
      <p className="admin-section-sub">Welcome to the Brzio admin.</p>

      <div className="admin-dashboard-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-value">{games.length}</div>
          <div className="admin-stat-label">Games</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value">{blog.length}</div>
          <div className="admin-stat-label">Blog Posts</div>
        </div>
      </div>

      <div className="admin-section-header admin-section-header--medium">
        <h2 className="admin-section-title admin-section-title-sm">Quick Actions</h2>
      </div>
      <div className="admin-actions-row">
        <Link href="/admin/posts/new?type=game" className="admin-btn admin-btn-primary">+ New Game</Link>
        <Link href="/admin/posts/new?type=blog" className="admin-btn admin-btn-outline">+ New Blog Post</Link>
        <Link href="/admin/posts" className="admin-btn admin-btn-outline">All Posts</Link>
      </div>
    </div>
  );
}
