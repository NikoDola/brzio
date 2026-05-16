import "./UnderConstruction.css";

interface UnderConstructionProps {
  title?: string;
  message?: string;
}

export default function UnderConstruction({
  title = "Under Construction",
  message = "We are working hard to bring you something great. Please check back soon.",
}: UnderConstructionProps) {
  return (
    <section className="under-construction">
      <div className="under-construction-inner">
        <div className="under-construction-icon" aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M10 50 L32 12 L54 50 Z"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <line x1="32" y1="26" x2="32" y2="38" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <circle cx="32" cy="44" r="2" fill="currentColor" />
          </svg>
        </div>
        <h1 className="under-construction-title">{title}</h1>
        <p className="under-construction-message">{message}</p>
      </div>
    </section>
  );
}
