import Button from "@/components/ui/Button";
import "./OrderSuccessPage.css";

export default function OrderSuccessPage() {
  return (
    <div className="order-success-page">
      <div className="order-success-inner">
        <div className="order-success-icon">✓</div>
        <p className="order-success-eyebrow">Payment Confirmed</p>
        <h1 className="order-success-title">
          Order Received!
        </h1>
        <p className="order-success-desc">
          Thank you for your order. Your payment was processed successfully.
          Our designer will review your brief and get in touch within{" "}
          <strong>1 business day</strong>.
        </p>

        <div className="order-success-steps">
          <p className="order-success-steps-title">What Happens Next</p>
          <div className="order-success-step-list">
            <div className="order-success-step">
              <div className="order-success-step-num">1</div>
              Check your email inbox — you&apos;ll receive a Stripe payment
              receipt shortly.
            </div>
            <div className="order-success-step">
              <div className="order-success-step-num">2</div>
              Our designer reviews your brief and may reach out with questions
              within 1 business day.
            </div>
            <div className="order-success-step">
              <div className="order-success-step-num">3</div>
              Your first logo concept will be delivered via email in 1–2
              business days.
            </div>
            <div className="order-success-step">
              <div className="order-success-step-num">4</div>
              Have a reference image? Email it to{" "}
              <a
                href="mailto:nikodola@gmail.com"
                className="order-success-gold-link"
              >
                nikodola@gmail.com
              </a>{" "}
              with your order subject.
            </div>
          </div>
        </div>

        <div className="order-success-actions">
          <Button href="/our-work" variant="primary">
            See Our Portfolio
          </Button>
          <Button href="/" variant="ghost">
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
