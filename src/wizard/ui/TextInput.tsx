"use client"
import "./TextInput.css"

interface TextInputProps {
  label:        string
  placeholder?: string
  value:        string
  onChange:     (v: string) => void
  required?:    boolean
  hint?:        string
  error?:       string
  multiline?:   boolean
  rows?:        number
}

export default function TextInput({ label, placeholder, value, onChange, required, hint, error, multiline, rows = 5 }: TextInputProps) {
  const fieldClassName = [
    "text-input__field",
    multiline ? "text-input__field--multiline" : "",
    error     ? "text-input__field--error"     : "",
  ].filter(Boolean).join(" ")

  return (
    <div className="text-input">
      <div className="text-input__header">
        <label className="text-input__label">
          {label}{required && <span className="text-input__required">*</span>}
        </label>
        {hint && <span className="text-input__hint">{hint}</span>}
      </div>
      {multiline
        ? <textarea rows={rows} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={fieldClassName} />
        : <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={fieldClassName} />
      }
      {error && <span className="text-input__error">{error}</span>}
    </div>
  )
}
