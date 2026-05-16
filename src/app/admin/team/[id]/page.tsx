import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeamMember } from "@/lib/content";
import TeamForm from "../TeamForm";

export default async function EditTeamMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await getTeamMember(id);
  if (!member) notFound();

  return (
    <div className="admin-content">
      <Link href="/admin/team" className="admin-back-link">← Team Members</Link>
      <div className="admin-section-header">
        <h1 className="admin-section-title">Edit Team Member</h1>
      </div>
      <div className="admin-card">
        <TeamForm initial={member} />
      </div>
    </div>
  );
}
