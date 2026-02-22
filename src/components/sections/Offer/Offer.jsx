import Button from '@/components/ui/Button/Button';
import './Offer.css';

const tiers = [
  {
    qty: '1 парче',
    price: '680 ден',
    note: null,
    featured: false,
    qtyParam: 1,
  },
  {
    qty: '2 парчиња',
    price: '1.200 ден',
    note: 'Заштеди 160 ден',
    featured: false,
    qtyParam: 2,
  },
  {
    qty: '3 парчиња',
    price: '1.700 ден',
    note: 'Најдобра понуда',
    featured: true,
    qtyParam: 3,
  },
];

export default function Offer() {
  return (
    <section className="offer" id="offer">
      <div className="offer__container">
        <p className="offer__label">Цени</p>
        <h2 className="offer__title">Избери ја твојата количина</h2>
        <p className="offer__note">
          Ограничени количини. Нарачај на време.
        </p>

        <div className="offer__tiers">
          {tiers.map((t, i) => (
            <div key={i} className={`offer__tier ${t.featured ? 'offer__tier--featured' : ''}`}>
              {t.featured && (
                <span className="offer__badge">Најдобра понуда</span>
              )}
              <h3 className="offer__qty">{t.qty}</h3>
              <p className="offer__price">{t.price}</p>
              {t.note && !t.featured && (
                <p className="offer__saving">{t.note}</p>
              )}
              <Button href={`/?qty=${t.qtyParam}#contact`} variant={t.featured ? 'primary' : 'secondary'}>
                Порачај
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
