import './HowToConnect.css';

const cards = [
  {
    title: 'Клучеви',
    text: 'Паника пред работа.\nТри минути барање.\nТоа е минато.',
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="13" cy="13" r="8" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="13" cy="13" r="3.5" fill="currentColor" opacity="0.25" />
        <path d="M19 19 L31 31" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M26 28 L26 31 M29 25 L29 28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Автомобил',
    text: 'Знаеш каде е секогаш.\nДополнителна сигурност.\nМир без напор.',
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 22 L8 14 L28 14 L30 22 L30 28 L6 28 Z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />
        <path d="M10 14 L12 8 L24 8 L26 14" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
        <circle cx="11" cy="27" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="25" cy="27" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    ),
  },
  {
    title: 'Дете',
    text: 'Знаеш каде е во секој момент.\nБез јавување. Без чекање.\nСамо мир.',
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="18" cy="10" r="5" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M10 30 C10 22 26 22 26 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M18 15 L18 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Миленик',
    text: 'Излезе надвор и не се врати.\nОтвори Find My.\nПронајди го брзо.',
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 6 C12 6 6 10 6 16 C6 20 9 23 12 25 L18 31 L24 25 C27 23 30 20 30 16 C30 10 24 6 18 6Z" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="18" cy="16" r="4" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    ),
  },
];

export default function Problem() {
  return (
    <section className="problem" id="problem">
      <div className="problem__container">
        <h2 className="problem__title">За работите што ви значат најмногу.</h2>
        <p className="problem__subtitle">
          Клучеви. Автомобил. Дете. Миленик.<br />
          Секогаш знаете каде се.
        </p>
        <div className="problem__cards">
          {cards.map((c, i) => (
            <div key={i} className="problem__card">
              <div className="problem__icon">{c.icon}</div>
              <h3 className="problem__card-title">{c.title}</h3>
              <p className="problem__card-text">
                {c.text.split('\n').map((line, j) => (
                  <span key={j}>{line}<br /></span>
                ))}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
