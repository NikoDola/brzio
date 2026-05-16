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
            A team of professional logo designers specializing in brand identity
            and visual design. Over a decade of experience across 36 countries.
          </p>
          <div className="footer-socials">
            <a
              href="https://www.facebook.com/Logoprofessionals"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-social-link"
              aria-label="Facebook"
            >
              f
            </a>
            <a
              href="https://www.instagram.com/logoprofessionals/"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-social-link"
              aria-label="Instagram"
            >
              IG
            </a>
            <a
              href="https://www.linkedin.com/in/igor-dolovski-438a45103/"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-social-link"
              aria-label="LinkedIn"
            >
              in
            </a>
          </div>
        </div>

        <div>
          <p className="footer-col-title">Navigation</p>
          <ul className="footer-links">
            <li><Link href="/">Home</Link></li>
            <li><Link href="/our-work">Our Work</Link></li>
            <li><Link href="/about-us">About Us</Link></li>
            <li><Link href="/services">Services</Link></li>
            <li><Link href="/contact-us">Contact</Link></li>
          </ul>
        </div>

        <div>
          <p className="footer-col-title">Contact</p>
          <div className="footer-contact-item">
            <span>Email</span>
            <a href="mailto:nikodola@gmail.com">nikodola@gmail.com</a>
          </div>
          <div className="footer-contact-item">
            <span>Location</span>
            <p>Bitola, North Macedonia</p>
          </div>
          <div className="footer-contact-item">
            <span>Instagram</span>
            <a
              href="https://www.instagram.com/layer3studio/"
              target="_blank"
              rel="noopener noreferrer"
            >
              @layer3studio
            </a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p className="footer-copy">
          © {new Date().getFullYear()} Digital Nectar. All Rights Reserved.
        </p>
        <div className="footer-policy">
          <Link href="/cookie-policy">Data Protection Policy</Link>
        </div>
      </div>
    </footer>
  );
}
