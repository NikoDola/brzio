import Link from "next/link";
import { getPosts } from "@/lib/content";
import { getViewsByType } from "@/lib/views";
import PostsList from "./PostsList";

export default async function AdminPostsPage() {
  const [posts, blogViews, portfolioViews] = await Promise.all([
    getPosts(),
    getViewsByType("blog"),
    getViewsByType("portfolio"),
  ]);

  const rows = posts.map((p) => ({
    id: p.id,
    type: p.type,
    title: p.title,
    slug: p.slug,
    thumbnail: p.thumbnail,
    teamMember: p.teamMember,
    published: p.published,
    createdAt: p.createdAt,
    views: (p.type === "blog" ? blogViews[p.slug] : portfolioViews[p.slug]) ?? 0,
  }));

  return (
    <div className="admin-content">
      <div className="admin-section-header">
        <h1 className="admin-section-title">Blog & Portfolio</h1>
        <Link href="/admin/posts/new" className="admin-btn admin-btn-primary">+ New Post</Link>
      </div>

      {posts.length === 0 ? (
        <div className="admin-empty">
          <div className="admin-empty-icon">📝</div>
          <div className="admin-empty-text">No posts yet. Create your first one.</div>
        </div>
      ) : (
        <PostsList posts={rows} />
      )}
    </div>
  );
}
