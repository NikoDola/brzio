"use client";

import { useState, useRef } from "react";
import dynamic from "next/dynamic";
import { Input, Textarea } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { sendContactEmail } from "@/lib/emailjs";
import "./ContactPage.css";

const ReCAPTCHA = dynamic(
  () => import("react-google-recaptcha"),
  { ssr: false },
) as unknown as typeof import("react-google-recaptcha").default;

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const recaptchaRef = useRef<any>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCaptchaVerify = async (token: string | null) => {
    if (!token) return;
    setSending(true);
    setError("");
    try {
      await sendContactEmail(form);
      setSuccess(true);
      setForm({ name: "", email: "", subject: "", message: "" });
      recaptchaRef.current?.reset();
    } catch {
      setError("Something went wrong. Please try again or email us directly.");
      recaptchaRef.current?.reset();
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    recaptchaRef.current?.execute();
  };

  return (
    <div className="contact-page">
      {/* Hero */}
      <div className="contact-hero">
        <div className="contact-hero-inner">
          <p className="contact-hero-eyebrow">Get In Touch</p>
          <h1 className="contact-hero-title">
            Let&apos;s Build
            <br />
            Something Great
          </h1>
          <p className="contact-hero-subtitle">
            Have a project in mind? We&apos;d love to hear about it. Send us a
            message and we&apos;ll get back to you as soon as possible.
          </p>
        </div>
      </div>

      {/* Main layout */}
      <div className="contact-main">
        {/* Form */}
        <div className="contact-form-section">
          <h2 className="contact-form-title">Send a Message</h2>
          <p className="contact-form-sub">
            Fill out the form below and we&apos;ll respond within 1–2 business
            days.
          </p>

          {success ? (
            <div className="contact-success">
              <span>✓</span>
              Message sent! We&apos;ll be in touch soon.
            </div>
          ) : (
            <form className="contact-form" onSubmit={handleSubmit}>
              <div className="contact-form-row">
                <Input
                  label="Your Name"
                  name="name"
                  placeholder="John Smith"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
                <Input
                  label="Email Address"
                  name="email"
                  type="email"
                  placeholder="john@example.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <Input
                label="Subject"
                name="subject"
                placeholder="Logo design for my startup"
                value={form.subject}
                onChange={handleChange}
                required
              />

              <Textarea
                label="Message"
                name="message"
                placeholder="Tell us about your project — what industry, what style, any references..."
                value={form.message}
                onChange={handleChange}
                required
                rows={6}
              />

              <div className="is-hidden">
                <ReCAPTCHA
                  ref={recaptchaRef}
                  size="invisible"
                  sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? ""}
                  onChange={handleCaptchaVerify}
                  onExpired={() => recaptchaRef.current?.reset()}
                  theme="dark"
                />
              </div>

              {error && <p className="contact-error-msg">{error}</p>}

              <div className="contact-submit-row">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={sending}
                >
                  {sending ? "Sending..." : "Send Message"}
                </Button>
              </div>
            </form>
          )}

          <p className="contact-recaptcha-notice">
            This site is protected by reCAPTCHA and the Google{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy Policy
            </a>{" "}
            and{" "}
            <a
              href="https://policies.google.com/terms"
              target="_blank"
              rel="noopener noreferrer"
            >
              Terms of Service
            </a>{" "}
            apply.
          </p>
        </div>

        {/* Info */}
        <div className="contact-info">
          <h3 className="contact-info-title">Contact Info</h3>

          <div className="contact-info-item">
            <div className="contact-info-item-label">Email</div>
            <div className="contact-info-item-value">
              <a href="mailto:nikodola@gmail.com">
                nikodola@gmail.com
              </a>
            </div>
          </div>

          <div className="contact-info-item">
            <div className="contact-info-item-label">Location</div>
            <div className="contact-info-item-value">
              Bitola, North Macedonia
              <br />
              Progres 12
            </div>
          </div>

          <div className="contact-info-item">
            <div className="contact-info-item-label">Response Time</div>
            <div className="contact-info-item-value">1–2 business days</div>
          </div>

          <div className="contact-info-item">
            <div className="contact-info-item-label">First Design Delivery</div>
            <div className="contact-info-item-value">1–2 business days</div>
          </div>

          <div className="contact-socials">
            <a
              href="https://www.facebook.com/Logoprofessionals/"
              target="_blank"
              rel="noopener noreferrer"
              className="contact-social-link"
            >
              Facebook
            </a>
            <a
              href="https://www.instagram.com/logoprofessionals/"
              target="_blank"
              rel="noopener noreferrer"
              className="contact-social-link"
            >
              Instagram
            </a>
            <a
              href="https://www.linkedin.com/in/igor-dolovski-438a45103/"
              target="_blank"
              rel="noopener noreferrer"
              className="contact-social-link"
            >
              LinkedIn
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
