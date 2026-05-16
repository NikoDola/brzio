import Link from "next/link";
import TeamForm from "../TeamForm";

export default function NewTeamMemberPage() {
  return (
    <div className="admin-content">
      <Link href="/admin/team" className="admin-back-link">← Team Members</Link>
      <div className="admin-section-header">
        <h1 className="admin-section-title">Add Team Member</h1>
      </div>
      <div className="admin-card">
        <TeamForm />
      </div>
    </div>
  );
}
