"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const dashboardLink = { href: "/admin", label: "Dashboard", icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".7"/><rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".7"/><rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".4"/><rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".4"/></svg> };
const postsLink = { href: "/admin/posts", label: "Posts & Games", icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="2" rx="1" fill="currentColor"/><rect x="1" y="7" width="14" height="2" rx="1" fill="currentColor" opacity=".7"/><rect x="1" y="12" width="8" height="2" rx="1" fill="currentColor" opacity=".4"/></svg> };
const seoLink = { href: "/admin/seo", label: "SEO & Social", icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" fill="none" opacity=".7"/><path d="M2 8h12M8 2c2 1.8 2 10.2 0 12M8 2c-2 1.8-2 10.2 0 12" stroke="currentColor" strokeWidth="1.2" opacity=".5" fill="none"/></svg> };
const statsLink = { href: "/admin/stats", label: "Game Analytics", icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="9" width="3" height="5.5" rx="1" fill="currentColor" opacity=".5"/><rect x="6.5" y="5" width="3" height="9.5" rx="1" fill="currentColor" opacity=".7"/><rect x="11.5" y="2" width="3" height="12.5" rx="1" fill="currentColor"/></svg> };

export default function AdminSidebar({ isDev }: { isDev: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  const nav = [
    {
      section: "Content",
      links: isDev ? [dashboardLink, postsLink, seoLink, statsLink] : [dashboardLink],
    },
  ];

  async function handleLogout() {
    await fetch("/api/admin-auth", { method: "DELETE" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-logo">
        <div className="admin-sidebar-logo-mark">B</div>
        <div className="admin-sidebar-brand">Brzio Admin</div>
      </div>

      <nav className="admin-sidebar-nav">
        {nav.map((section) => (
          <div key={section.section} className="admin-nav-section">
            <div className="admin-nav-section-label">{section.section}</div>
            {section.links.map((link) => {
              const isActive = link.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`admin-nav-link${isActive ? " active" : ""}`}
                >
                  {link.icon}
                  {link.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="admin-sidebar-footer">
        <Link href="/" className="admin-logout-btn">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 8h12M8 2l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Leave Admin
        </Link>
        <button onClick={handleLogout} className="admin-logout-btn">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M11 4l4 4-4 4M15 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M6 2H2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
