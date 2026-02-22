import './Trust.css';

const points = [
  {
    title: 'Плаќање при достава',
    text: 'Прво го добиваш. Потоа плаќаш. Без ризик.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="8" width="28" height="18" rx="3" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M2 14 L30 14" stroke="currentColor" strokeWidth="2" />
        <rect x="6" y="18" width="8" height="3" rx="1" fill="currentColor" opacity="0.4" />
      </svg>
    ),
  },
  {
    title: 'Испорака 1–2 дена',
    text: 'Низ цела Македонија. Брзо и сигурно.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 20 L2 10 L18 10 L18 20 Z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />
        <path d="M18 13 L26 13 L30 20 L30 24 L18 24 Z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />
        <circle cx="8" cy="23" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="24" cy="23" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    ),
  },
  {
    title: 'Едноставна употреба',
    text: 'Нема апликации за инсталирање. Работи со Find My.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M10 16 L14 20 L22 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Поддршка на купувачите',
    text: 'Достапни сме за прашања пред и по нарачката.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 10 C6 6 10 4 16 4 C22 4 26 6 26 10 C26 16 20 20 16 22 C12 20 6 16 6 10Z" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M16 26 L16 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="16" cy="28" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
];

export default function Trust() {
  return (
    <section className="trust" id="trust">
      <div className="trust__container">
        <p className="trust__label">Зошто да нарачаш кај нас</p>
        <h2 className="trust__title">Купување без стрес</h2>

        <div className="trust__grid">
          {points.map((p, i) => (
            <div key={i} className="trust__item">
              <div className="trust__icon">{p.icon}</div>
              <div>
                <h3 className="trust__item-title">{p.title}</h3>
                <p className="trust__item-text">{p.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
