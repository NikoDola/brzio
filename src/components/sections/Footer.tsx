import Link from "next/link";
import BrandLogo from "@/components/ui/BrandLogo";
import "./Footer.css";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <div className="footer-brand-name">
            <BrandLogo />
          </div>
          <p className="footer-brand-desc">
            Free browser mini-games. Quick to load, easy to learn, hard to put down.
            No download, no sign-up.
          </p>
        </div>

        <div>
          <p className="footer-col-title">Navigation</p>
          <ul className="footer-links">
            <li><Link href="/">Games</Link></li>
            <li><Link href="/blog">Blog</Link></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <p className="footer-copy">
          © {new Date().getFullYear()} Brzio. All Rights Reserved.
        </p>
      </div>
    </footer>
  );
}
