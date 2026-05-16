import Link from "next/link";
import { getTeam } from "@/lib/content";
import PostForm from "../PostForm";

export default async function NewPostPage() {
  const team = await getTeam();
  return (
    <div className="admin-content">
      <Link href="/admin/posts" className="admin-back-link">← Blog & Portfolio</Link>
      <div className="admin-section-header">
        <h1 className="admin-section-title">New Post</h1>
      </div>
      <div className="admin-card">
        <PostForm team={team.map((m) => ({ id: m.id, name: m.name, slug: m.slug }))} />
      </div>
    </div>
  );
}
