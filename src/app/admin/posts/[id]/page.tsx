import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, listGameFolders } from "@/lib/content";
import PostForm from "../PostForm";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [post, gameFolders] = await Promise.all([getPost(id), listGameFolders()]);
  if (!post) notFound();

  const livePath = post.type === "game" ? `/games/${post.slug}` : `/blog/${post.slug}`;

  return (
    <div className="admin-content">
      <Link href="/admin/posts" className="admin-back-link">← Posts & Games</Link>
      <div className="admin-section-header">
        <h1 className="admin-section-title">Edit {post.type === "game" ? "Game" : "Blog Post"}</h1>
        {post.published && (
          <Link
            href={livePath}
            target="_blank"
            className="admin-btn admin-btn-outline"
          >
            View Live ↗
          </Link>
        )}
      </div>
      <div className="admin-card">
        <PostForm initial={post} gameFolders={gameFolders} />
      </div>
    </div>
  );
}
