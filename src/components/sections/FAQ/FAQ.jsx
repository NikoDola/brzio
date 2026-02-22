'use client';

import { useState } from 'react';
import './FAQ.css';

const faqs = [
  {
    q: 'Дали е оригинален Apple AirTag?',
    a: 'Не. Ова е компатибилен уред кој работи со Apple Find My мрежата. Не е официјален Apple производ.',
  },
  {
    q: 'Работи ли со Android телефони?',
    a: 'Не. Уредот работи само со iPhone. Потребен е iOS 14.5 или понова верзија.',
  },
  {
    q: 'Колку трае батеријата?',
    a: 'Помеѓу 4 и 8 месеци, во зависност од употребата. Батеријата е стандардна CR2032 и лесно се менува.',
  },
  {
    q: 'Колку трае доставата?',
    a: '1 до 2 работни дена низ цела Македонија. Плаќањето е при достава.',
  },
];

export default function FAQ() {
  const [open, setOpen] = useState(null);

  return (
    <section className="faq" id="faq">
      <div className="faq__container">
        <p className="faq__label">Прашања и одговори</p>
        <h2 className="faq__title">Имаш прашање?</h2>

        <div className="faq__list">
          {faqs.map((item, i) => (
            <div
              key={i}
              className={`faq__item ${open === i ? 'faq__item--open' : ''}`}
            >
              <button
                className="faq__question"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
              >
                {item.q}
                <span className="faq__arrow" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 6 L8 11 L13 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </button>
              <div className="faq__answer">
                <p>{item.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
