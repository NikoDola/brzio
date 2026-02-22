import './HowItWorks.css';

const steps = [
  {
    title: 'Поврзување за 1 минута',
    text: 'Вклучи го. Отвори Find My. Готово.',
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="18" cy="18" r="16" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M12 18 L16 22 L24 14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Локација ако се изгуби',
    text: 'Ја гледаш на картата преку милиони iPhone уреди.',
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 3C12.5 3 8 7.5 8 13C8 21 18 33 18 33C18 33 28 21 28 13C28 7.5 23.5 3 18 3Z" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="18" cy="13" r="4" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    ),
  },
  {
    title: 'Звучен сигнал ако е во близина',
    text: 'До 15 метри — натерај го да запиштит и пронајди го.',
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 22 L14 22 L20 8 L26 28 L30 22 L34 22" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  return (
    <section className="how-it-works" id="how-it-works">
      <div className="how-it-works__container">
        <p className="how-it-works__label">Без техничко знаење</p>
        <h2 className="how-it-works__title">Како функционира?</h2>

        <div className="how-it-works__steps">
          {steps.map((s, i) => (
            <div key={i} className="how-it-works__step">
              <div className="how-it-works__icon">{s.icon}</div>
              <h3 className="how-it-works__step-title">{s.title}</h3>
              <p className="how-it-works__step-text">{s.text}</p>
            </div>
          ))}
        </div>

        <div className="how-it-works__battery">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="5" width="15" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <rect x="3" y="7" width="8" height="6" rx="1" fill="currentColor" opacity="0.5" />
            <path d="M16 8 L16 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Батерија: 4–8 месеци. Лесна за замена.
        </div>
      </div>
    </section>
  );
}
