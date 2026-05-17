import "./admin.css";
import AdminSidebar from "./AdminSidebar";

export const metadata = { title: "Admin — Brzio", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const isDev = process.env.NODE_ENV !== "production";
  return (
    <div className="admin-shell">
      <AdminSidebar isDev={isDev} />
      <main className="admin-main">
        {children}
      </main>
    </div>
  );
}
