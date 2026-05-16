import Link from "next/link";
import { getTeam } from "@/lib/content";
import { getViewsByType } from "@/lib/views";
import TeamList from "./TeamList";

export default async function AdminTeamPage() {
  const [members, teamViews] = await Promise.all([getTeam(), getViewsByType("team")]);

  const rows = members.map((m) => ({
    id: m.id,
    name: m.name,
    slug: m.slug,
    role: m.role,
    image: m.image,
    order: m.order ?? 0,
    views: teamViews[m.slug] ?? 0,
  }));

  return (
    <div className="admin-content">
      <div className="admin-section-header">
        <h1 className="admin-section-title">Team Members</h1>
        <Link href="/admin/team/new" className="admin-btn admin-btn-primary">+ Add Member</Link>
      </div>

      {members.length === 0 ? (
        <div className="admin-empty">
          <div className="admin-empty-icon">👥</div>
          <div className="admin-empty-text">No team members yet. Add your first one.</div>
        </div>
      ) : (
        <TeamList members={rows} />
      )}
    </div>
  );
}
