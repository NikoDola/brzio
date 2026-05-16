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
    // Only verify with the server when a session cookie is likely set.
    // 99%+ of visitors aren't admins; skip the network round-trip for them.
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
          <li><Link href="/our-work">Our Work</Link></li>
          <li><Link href="/about-us">About Us</Link></li>
          <li><Link href="/our-team">Our Team</Link></li>
          <li><Link href="/blog">Blog</Link></li>
          <li><Link href="/services">Services</Link></li>
          <li><Link href="/contact-us">Contact</Link></li>
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
        <Link href="/" onClick={() => setMenuOpen(false)}>Home</Link>
        <Link href="/our-work" onClick={() => setMenuOpen(false)}>Our Work</Link>
        <Link href="/about-us" onClick={() => setMenuOpen(false)}>About Us</Link>
        <Link href="/our-team" onClick={() => setMenuOpen(false)}>Our Team</Link>
        <Link href="/blog" onClick={() => setMenuOpen(false)}>Blog</Link>
        <Link href="/services" onClick={() => setMenuOpen(false)}>Services</Link>
        <Link href="/contact-us" onClick={() => setMenuOpen(false)}>Contact</Link>
        {isAdmin && (
          <Link href="/admin" onClick={() => setMenuOpen(false)}>Admin</Link>
        )}
      </div>
    </>
  );
}
