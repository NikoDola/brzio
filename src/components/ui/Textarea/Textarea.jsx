import './Textarea.css';

export default function Textarea({
  label,
  name,
  value,
  onChange,
  placeholder,
  rows = 4,
}) {
  return (
    <div className="textarea-group">
      {label && (
        <label className="textarea-label" htmlFor={name}>
          {label}
        </label>
      )}
      <textarea
        className="textarea-field"
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
      />
    </div>
  );
}
