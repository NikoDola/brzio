import './Input.css';

export default function Input({
  label,
  name,
  type = 'text',
  required = false,
  value,
  onChange,
  placeholder,
}) {
  return (
    <div className="input-group">
      {label && (
        <label className="input-label" htmlFor={name}>
          {label}
          {required && <span className="input-required">*</span>}
        </label>
      )}
      <input
        className="input-field"
        id={name}
        name={name}
        type={type}
        required={required}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </div>
  );
}
