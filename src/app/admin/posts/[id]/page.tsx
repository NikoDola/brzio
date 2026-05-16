import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, getTeam } from "@/lib/content";
import PostForm from "../PostForm";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [post, team] = await Promise.all([getPost(id), getTeam()]);
  if (!post) notFound();

  return (
    <div className="admin-content">
      <Link href="/admin/posts" className="admin-back-link">← Blog & Portfolio</Link>
      <div className="admin-section-header">
        <h1 className="admin-section-title">Edit Post</h1>
        {post.published && (
          <Link
            href={post.type === "blog" ? `/blog/${post.slug}` : `/portfolio/${post.slug}`}
            target="_blank"
            className="admin-btn admin-btn-outline"
          >
            View Live ↗
          </Link>
        )}
      </div>
      <div className="admin-card">
        <PostForm initial={post} team={team.map((m) => ({ id: m.id, name: m.name, slug: m.slug }))} />
      </div>
    </div>
  );
}
