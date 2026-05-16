import Link from "next/link";
import "./CookiePolicyPage.css";

const LAST_UPDATED = "May 15, 2026";

interface CookieRow {
  name: string;
  provider: string;
  purpose: string;
  duration: string;
  category: "Strictly necessary" | "Security" | "Payments" | "Site features";
}

const COOKIES: CookieRow[] = [
  {
    name: "admin_session",
    provider: "Digital Nectar (this site)",
    purpose:
      "Keeps an approved team member signed in to the admin area. Regular visitors never receive this cookie.",
    duration: "7 days",
    category: "Strictly necessary",
  },
  {
    name: "_GRECAPTCHA (and related)",
    provider: "Google reCAPTCHA",
    purpose:
      "Detects automated bots on the contact form and the services order form, so we do not get spammed or attacked.",
    duration: "About 6 months",
    category: "Security",
  },
  {
    name: "Stripe cookies",
    provider: "Stripe",
    purpose:
      "Used by Stripe to securely process your payment once you reach the checkout screen. These cookies are set on stripe.com, not on this site.",
    duration: "Varies (set by Stripe)",
    category: "Payments",
  },
  {
    name: "Firebase Auth tokens",
    provider: "Google Firebase",
    purpose:
      "Only relevant to the admin login flow. Stored locally in the browser when an admin signs in with Google.",
    duration: "Until you sign out or clear storage",
    category: "Strictly necessary",
  },
  {
    name: "viewed:<type>:<slug>",
    provider: "Digital Nectar (this site)",
    purpose:
      "Stored in your browser's sessionStorage so we only count one page view per session, per article. Not a cookie, anonymous, never sent to a server.",
    duration: "Until you close the browser tab",
    category: "Site features",
  },
];

export default function CookiePolicyPage() {
  return (
    <main className="cookie-page">
      <div className="cookie-hero">
        <div className="cookie-hero-inner">
          <p className="cookie-eyebrow">Cookie Policy</p>
          <h1 className="cookie-title">
            What we store on your device, and why.
          </h1>
          <p className="cookie-updated">Last updated: {LAST_UPDATED}</p>
        </div>
      </div>

      <article className="cookie-body">
        <div className="cookie-body-inner">
          <section className="cookie-section">
            <p className="cookie-lede">
              We try to keep this short and plain. Digital Nectar does not run
              advertising trackers, does not sell your data, and does not use
              third-party analytics that profile you across the internet. The
              cookies and browser storage listed below exist for one reason
              only: to make the site work and keep it safe.
            </p>
          </section>

          <section className="cookie-section">
            <h2 className="cookie-h2">What is a cookie?</h2>
            <p>
              A cookie is a small text file a website saves in your browser so
              it can remember something about your visit. Some are set by the
              site you are on (first-party), others by services the site uses
              (third-party). The same applies to similar tools like
              localStorage and sessionStorage, which are also browser storage,
              just under a different name.
            </p>
          </section>

          <section className="cookie-section">
            <h2 className="cookie-h2">What we use, and what we do not</h2>

            <div className="cookie-callout cookie-callout--good">
              <strong>We do use</strong>
              <ul>
                <li>A session cookie that keeps team members signed in to the admin area.</li>
                <li>Google reCAPTCHA on forms, so bots cannot abuse them.</li>
                <li>Stripe on the payment page, so checkout actually works.</li>
                <li>A small sessionStorage flag that prevents inflated page-view counts.</li>
              </ul>
            </div>

            <div className="cookie-callout cookie-callout--bad">
              <strong>We do not use</strong>
              <ul>
                <li>Advertising or retargeting cookies. None.</li>
                <li>Cross-site tracking pixels (no Facebook Pixel, no TikTok pixel, none of that).</li>
                <li>Google Analytics or other behavioral analytics that profile visitors.</li>
                <li>Any cookie that sells, rents, or shares your data with a third party.</li>
              </ul>
            </div>
          </section>

          <section className="cookie-section">
            <h2 className="cookie-h2">Cookies and storage in detail</h2>
            <div className="cookie-list">
              {COOKIES.map((c) => (
                <div key={c.name} className="cookie-card">
                  <div className="cookie-card-head">
                    <div className="cookie-card-name">{c.name}</div>
                    <div className="cookie-card-tag">{c.category}</div>
                  </div>
                  <dl className="cookie-card-meta">
                    <div>
                      <dt>Set by</dt>
                      <dd>{c.provider}</dd>
                    </div>
                    <div>
                      <dt>Purpose</dt>
                      <dd>{c.purpose}</dd>
                    </div>
                    <div>
                      <dt>Lifetime</dt>
                      <dd>{c.duration}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </section>

          <section className="cookie-section">
            <h2 className="cookie-h2">Your choices</h2>
            <p>
              You can delete cookies and clear browser storage at any time
              through your browser settings. If you do this, the admin sign-in
              will be cleared (only relevant to our team), and your view-count
              dedupe will reset (you will count as a new visitor next time).
            </p>
            <p>
              We cannot reasonably turn off reCAPTCHA, because without it the
              contact form and the order form would be overwhelmed by automated
              bots within hours. If you prefer not to use reCAPTCHA, you can
              email us directly at{" "}
              <a className="cookie-link" href="mailto:nikodola@gmail.com">
                nikodola@gmail.com
              </a>{" "}
              instead of submitting the form.
            </p>
            <p>
              For Stripe, payment processing requires Stripe to set cookies on
              their own domain during checkout. We do not control those
              cookies. Their policy is at{" "}
              <a
                className="cookie-link"
                href="https://stripe.com/cookie-settings"
                target="_blank"
                rel="noopener noreferrer"
              >
                stripe.com/cookie-settings
              </a>
              .
            </p>
          </section>

          <section className="cookie-section">
            <h2 className="cookie-h2">Third parties we rely on</h2>
            <ul className="cookie-thirdparty">
              <li>
                <strong>Stripe</strong> for payment processing.{" "}
                <a
                  className="cookie-link"
                  href="https://stripe.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy policy
                </a>
                .
              </li>
              <li>
                <strong>Google reCAPTCHA</strong> for bot detection on forms.{" "}
                <a
                  className="cookie-link"
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy policy
                </a>
                .
              </li>
              <li>
                <strong>Google Firebase</strong> for the admin login (Google
                Sign-In) and for storing order records on our server.{" "}
                <a
                  className="cookie-link"
                  href="https://firebase.google.com/support/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy policy
                </a>
                .
              </li>
              <li>
                <strong>EmailJS</strong> for delivering contact-form messages
                to our inbox.{" "}
                <a
                  className="cookie-link"
                  href="https://www.emailjs.com/legal/privacy-policy/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy policy
                </a>
                .
              </li>
              <li>
                <strong>Vercel</strong> hosts the site. Vercel may log basic
                server-level information (IP, user agent) for security and
                uptime monitoring.{" "}
                <a
                  className="cookie-link"
                  href="https://vercel.com/legal/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy policy
                </a>
                .
              </li>
            </ul>
          </section>

          <section className="cookie-section">
            <h2 className="cookie-h2">Changes to this policy</h2>
            <p>
              If we change anything material about how we use cookies, we will
              update the date at the top of this page. The current version is
              dated {LAST_UPDATED}.
            </p>
          </section>

          <section className="cookie-section">
            <h2 className="cookie-h2">Contact</h2>
            <p>
              Questions, concerns, or a request to remove your data? Write to{" "}
              <a className="cookie-link" href="mailto:nikodola@gmail.com">
                nikodola@gmail.com
              </a>{" "}
              and we will respond personally. No ticket queue, no autoresponder.
            </p>
            <p className="cookie-back">
              <Link href="/" className="cookie-link">
                Back to home
              </Link>
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
