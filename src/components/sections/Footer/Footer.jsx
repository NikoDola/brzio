import './Footer.css';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer__container">
        <div className="footer__top">
          <span className="footer__logo">brzio</span>

          <a
            href="https://instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            className="footer__instagram"
            aria-label="Instagram"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="2"
                y="2"
                width="20"
                height="20"
                rx="6"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <circle
                cx="12"
                cy="12"
                r="4.5"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
            </svg>
            Instagram
          </a>
        </div>

        <div className="footer__contact">
          <div className="footer__contact-item">
            <span className="footer__contact-label">Техничка поддршка</span>
            <a href="tel:+38974222858" className="footer__contact-number">
              389-74-222-858
            </a>
          </div>
          <div className="footer__contact-item">
            <span className="footer__contact-label">Нарачки</span>
            <a href="tel:+38978808596" className="footer__contact-number">
              389-78-808-596
            </a>
          </div>
        </div>

        <p className="footer__copyright">
          © {year} brzio. Сите права задржани.
        </p>
      </div>
    </footer>
  );
}
