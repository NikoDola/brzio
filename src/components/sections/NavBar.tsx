"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import BrandLogo from "@/components/ui/BrandLogo";
import "./NavBar.css";

export default function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!document.cookie.includes("admin_session=")) return;
    fetch("/api/admin-check")
      .then((res) => res.json())
      .then((data) => setIsAdmin(Boolean(data.isAdmin)))
      .catch(() => setIsAdmin(false));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <>
      <nav className={`navbar ${scrolled ? "scrolled" : ""}`}>
        <Link href="/" className="navbar-logo" onClick={() => setMenuOpen(false)}>
          <BrandLogo />
        </Link>

        <ul className="navbar-links">
          <li><Link href="/">Games</Link></li>
          <li><Link href="/blog">Blog</Link></li>
          {isAdmin && <li><Link href="/admin">Admin</Link></li>}
        </ul>

        <button
          className={`nav-hamburger ${menuOpen ? "open" : ""}`}
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          <span />
          <span />
          <span />
        </button>
      </nav>

      <div className={`mobile-menu ${menuOpen ? "open" : ""}`}>
        <Link href="/" onClick={() => setMenuOpen(false)}>Games</Link>
        <Link href="/blog" onClick={() => setMenuOpen(false)}>Blog</Link>
        {isAdmin && (
          <Link href="/admin" onClick={() => setMenuOpen(false)}>Admin</Link>
        )}
      </div>
    </>
  );
}
