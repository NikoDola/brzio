'use client';

import { useState, useRef, useEffect } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import emailjs from '@emailjs/browser';
import Input from '@/components/ui/Input/Input';
import Textarea from '@/components/ui/Textarea/Textarea';
import Button from '@/components/ui/Button/Button';
import './ContactForm.css';

const TIERS = [
  { qty: 1, label: '1 парче', price: '680 ден' },
  { qty: 2, label: '2 парчиња', price: '1.200 ден' },
  { qty: 3, label: '3 парчиња', price: '1.700 ден' },
];

const initialState = {
  name: '',
  lastName: '',
  streetAddress: '',
  contactNumber: '',
  message: '',
};

export default function ContactForm() {
  const [form, setForm] = useState(initialState);
  const [quantity, setQuantity] = useState(1);
  const [recaptchaToken, setRecaptchaToken] = useState(null);
  const [status, setStatus] = useState('idle');
  const recaptchaRef = useRef(null);

  // Read ?qty= from URL on mount and pre-select
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = parseInt(params.get('qty'), 10);
    if (q === 2 || q === 3) setQuantity(q);
  }, []);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const selectedTier = TIERS.find((t) => t.qty === quantity);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!recaptchaToken) {
      alert('Ве молиме потврдете дека не сте робот.');
      return;
    }

    setStatus('loading');

    try {
      await emailjs.send(
        process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID,
        process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID,
        {
          from_name: `${form.name} ${form.lastName}`,
          quantity: `${selectedTier.label} – ${selectedTier.price}`,
          street_address: form.streetAddress,
          contact_number: form.contactNumber,
          message: form.message,
        },
        process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY
      );

      setStatus('success');
      setForm(initialState);
      recaptchaRef.current?.reset();
      setRecaptchaToken(null);
    } catch {
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <section className="contact-form" id="contact">
        <div className="contact-form__container">
          <div className="contact-form__success">
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
              <circle cx="28" cy="28" r="28" fill="var(--primary-color)" />
              <path
                d="M16 28 L24 36 L40 20"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h2>Нарачката е примена!</h2>
            <p>Ќе ве контактираме наскоро на бројот кој го оставивте.</p>
            <Button onClick={() => setStatus('idle')}>Нова нарачка</Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="contact-form" id="contact">
      <div className="contact-form__container">
        <p className="contact-form__label">Плаќање при достава</p>
        <h2 className="contact-form__title">Порачај со плаќање при достава</h2>
        <p className="contact-form__subtitle">Ќе ве контактираме за потврда.</p>

        <form className="contact-form__form" onSubmit={handleSubmit} noValidate>

          {/* Quantity selector */}
          <div className="contact-form__qty-group">
            <p className="contact-form__qty-label">Количина</p>
            <div className="contact-form__qty-options">
              {TIERS.map((t) => (
                <button
                  key={t.qty}
                  type="button"
                  className={`contact-form__qty-option ${quantity === t.qty ? 'contact-form__qty-option--active' : ''}`}
                  onClick={() => setQuantity(t.qty)}
                >
                  <span className="contact-form__qty-name">{t.label}</span>
                  <span className="contact-form__qty-price">{t.price}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="contact-form__row">
            <Input
              label="Име"
              name="name"
              required
              value={form.name}
              onChange={handleChange}
              placeholder="Вашето име"
            />
            <Input
              label="Презиме"
              name="lastName"
              required
              value={form.lastName}
              onChange={handleChange}
              placeholder="Вашето презиме"
            />
          </div>

          <Input
            label="Адреса за достава"
            name="streetAddress"
            required
            value={form.streetAddress}
            onChange={handleChange}
            placeholder="Улица, број, град"
          />

          <Input
            label="Контакт број"
            name="contactNumber"
            type="tel"
            required
            value={form.contactNumber}
            onChange={handleChange}
            placeholder="+389 __ ___ ___"
          />

          <Textarea
            label="Порака (незадолжително)"
            name="message"
            value={form.message}
            onChange={handleChange}
            placeholder="Дополнителни информации за нарачката..."
          />

          <div className="contact-form__recaptcha">
            <ReCAPTCHA
              ref={recaptchaRef}
              sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}
              onChange={setRecaptchaToken}
            />
          </div>

          {status === 'error' && (
            <p className="contact-form__error">
              Се случи грешка. Обидете се повторно или јавете се на нашиот број.
            </p>
          )}

          <Button type="submit">
            {status === 'loading' ? 'Испраќање...' : 'Испрати нарачка'}
          </Button>
        </form>
      </div>
    </section>
  );
}
