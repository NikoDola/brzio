import Button from "@/components/ui/Button";
import "./OrderSuccessPage.css";

export default function OrderCancelPage() {
  return (
    <div className="order-cancel-page">
      <div className="order-cancel-inner">
        <div className="order-cancel-icon">←</div>
        <h1 className="order-cancel-title">Payment Cancelled</h1>
        <p className="order-cancel-desc">
          No worries — your order was not placed and you have not been charged.
          You can go back and try again whenever you&apos;re ready.
        </p>
        <div className="order-cancel-actions">
          <Button href="/services" variant="primary">
            Try Again
          </Button>
          <Button href="/" variant="ghost">
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
