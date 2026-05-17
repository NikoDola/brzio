import Link from "next/link";
import { getPosts } from "@/lib/content";
import PostsList from "./PostsList";

export default async function AdminPostsPage() {
  const posts = await getPosts();

  const rows = posts.map((p) => ({
    id: p.id,
    type: p.type,
    title: p.title,
    slug: p.slug,
    thumbnail: p.thumbnail,
    published: p.published,
    createdAt: p.createdAt,
    gameSlug: p.gameSlug ?? null,
  }));

  return (
    <div className="admin-content">
      <div className="admin-section-header">
        <h1 className="admin-section-title">Posts & Games</h1>
        <div className="admin-actions-row">
          <Link href="/admin/posts/new?type=game" className="admin-btn admin-btn-primary">+ New Game</Link>
          <Link href="/admin/posts/new?type=blog" className="admin-btn admin-btn-outline">+ New Blog Post</Link>
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="admin-empty">
          <div className="admin-empty-icon">🎮</div>
          <div className="admin-empty-text">No posts yet. Create your first one.</div>
        </div>
      ) : (
        <PostsList posts={rows} />
      )}
    </div>
  );
}
