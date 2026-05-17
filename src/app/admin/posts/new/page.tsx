import Link from "next/link";
import { listGameFolders } from "@/lib/content";
import PostForm from "../PostForm";

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const initialType = type === "game" ? "game" : "blog";
  const gameFolders = await listGameFolders();

  return (
    <div className="admin-content">
      <Link href="/admin/posts" className="admin-back-link">← Posts & Games</Link>
      <div className="admin-section-header">
        <h1 className="admin-section-title">
          New {initialType === "game" ? "Game" : "Blog Post"}
        </h1>
      </div>
      <div className="admin-card">
        <PostForm initialType={initialType} gameFolders={gameFolders} />
      </div>
    </div>
  );
}
