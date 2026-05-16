"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const dashboardLink = { href: "/admin", label: "Dashboard", icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".7"/><rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".7"/><rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".4"/><rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".4"/></svg> };
const postsLink = { href: "/admin/posts", label: "Blog & Portfolio", icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="2" rx="1" fill="currentColor"/><rect x="1" y="7" width="14" height="2" rx="1" fill="currentColor" opacity=".7"/><rect x="1" y="12" width="8" height="2" rx="1" fill="currentColor" opacity=".4"/></svg> };
const teamLink = { href: "/admin/team", label: "Team Members", icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="5.5" cy="5" r="3" fill="currentColor" opacity=".7"/><path d="M0 13c0-2.76 2.46-5 5.5-5S11 10.24 11 13H0Z" fill="currentColor" opacity=".7"/><circle cx="12" cy="4.5" r="2.5" fill="currentColor" opacity=".4"/><path d="M10.5 12.5c0-1.93 1.12-3.57 2.75-4.39A5.5 5.5 0 0 1 16 12.5h-5.5Z" fill="currentColor" opacity=".4"/></svg> };
const partnersLink = { href: "/admin/partners", label: "Partners & Reviews", icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="5" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" fill="none" opacity=".7"/><circle cx="11" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" fill="none" opacity=".5"/></svg> };
const ordersLink = { href: "/admin/orders", label: "All Orders", icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" opacity=".7"/><path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> };
const seoLink = { href: "/admin/seo", label: "SEO & Social", icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" fill="none" opacity=".7"/><path d="M2 8h12M8 2c2 1.8 2 10.2 0 12M8 2c-2 1.8-2 10.2 0 12" stroke="currentColor" strokeWidth="1.2" opacity=".5" fill="none"/></svg> };

export default function AdminSidebar({ isDev }: { isDev: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  const nav = [
    {
      section: "Content",
      links: isDev ? [dashboardLink, postsLink, teamLink, partnersLink, seoLink] : [dashboardLink],
    },
    {
      section: "Orders",
      links: [ordersLink],
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
        <div className="admin-sidebar-logo-mark">LP</div>
        <div className="admin-sidebar-brand">Admin Panel</div>
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
