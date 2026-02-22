import Button from '@/components/ui/Button/Button';
import './Solution.css';

const steps = [
  {
    number: '01',
    title: 'Прикачи го',
    text: 'На клучевите, ранецот, паричникот или автомобилот.',
  },
  {
    number: '02',
    title: 'Отвори Find My',
    text: 'Апликацијата е веќе на твојот iPhone. Бесплатна и вградена.',
  },
  {
    number: '03',
    title: 'Виж ја локацијата',
    text: 'Во реално време. Без претплата. Без компликации.',
  },
];

export default function Solution() {
  return (
    <section className="solution" id="solution">
      <div className="solution__container">
        <p className="solution__label">Решението е едноставно</p>
        <h2 className="solution__title">Три чекори. Тоа е сè.</h2>

        <div className="solution__steps">
          {steps.map((s, i) => (
            <div key={i} className="solution__step">
              <span className="solution__number">{s.number}</span>
              <h3 className="solution__step-title">{s.title}</h3>
              <p className="solution__step-text">{s.text}</p>
            </div>
          ))}
        </div>

        <Button href="#contact">Порачај веднаш</Button>
      </div>
    </section>
  );
}
