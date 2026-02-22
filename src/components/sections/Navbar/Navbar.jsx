'use client';

import { useState } from 'react';
import './Navbar.css';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const close = () => setIsOpen(false);

  return (
    <nav className="navbar">
      <div className="navbar__container">
        <a href="#hero" className="navbar__logo">
          brzio
        </a>

        <button
          className={`navbar__burger ${isOpen ? 'navbar__burger--open' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          <span className="navbar__burger-line" />
          <span className="navbar__burger-line" />
          <span className="navbar__burger-line" />
        </button>

        <ul className={`navbar__menu ${isOpen ? 'navbar__menu--open' : ''}`}>
          <li>
            <a href="#hero" onClick={close}>
              Почетна
            </a>
          </li>
          <li>
            <a href="#how-to-connect" onClick={close}>
              Поврзување
            </a>
          </li>
          <li>
            <a href="#how-it-works" onClick={close}>
              Како функционира
            </a>
          </li>
          <li>
            <a href="#contact" onClick={close} className="navbar__cta">
              Порачај
            </a>
          </li>
        </ul>
      </div>
    </nav>
  );
}
