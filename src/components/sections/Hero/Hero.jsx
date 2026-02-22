import Button from '@/components/ui/Button/Button';
import './Hero.css';

const bullets = [
  'Работи со iPhone',
  'Плаќање при достава',
  'Испорака 1–2 дена',
  'Цена 680 ден',
];

export default function Hero() {
  return (
    <section className="hero" id="hero">
      <div className="hero__visual">
        <div className="hero__device">
          <svg
            width="160"
            height="160"
            viewBox="0 0 160 160"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="80" cy="80" r="76" stroke="rgba(255,255,255,0.25)" strokeWidth="2" fill="rgba(255,255,255,0.08)" />
            <circle cx="80" cy="80" r="54" stroke="rgba(255,255,255,0.35)" strokeWidth="2" fill="rgba(255,255,255,0.12)" />
            <circle cx="80" cy="80" r="32" fill="rgba(255,255,255,0.9)" />
            <circle cx="80" cy="80" r="14" fill="white" />
            <circle cx="80" cy="80" r="6" fill="var(--primary-color)" />
          </svg>
        </div>
        <p className="hero__visual-badge">Компатибилен со Apple Find My</p>
      </div>

      <div className="hero__content">
        <p className="hero__pre-text">Компатибилен со iPhone и Apple Find My</p>
        <h1 className="hero__headline">
          Никогаш повеќе не барај клучеви, паричник или автомобил
        </h1>

        <ul className="hero__bullets">
          {bullets.map((b, i) => (
            <li key={i} className="hero__bullet">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="9" fill="var(--primary-color)" />
                <path d="M5 9L8 12L13 6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {b}
            </li>
          ))}
        </ul>

        <Button href="#contact">Порачај веднаш</Button>
      </div>
    </section>
  );
}
