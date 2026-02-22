import './Button.css';

export default function Button({ children, onClick, type = 'button', variant = 'primary', href }) {
  if (href) {
    return (
      <a href={href} className={`btn btn--${variant}`}>
        {children}
      </a>
    );
  }
  return (
    <button type={type} onClick={onClick} className={`btn btn--${variant}`}>
      {children}
    </button>
  );
}
