"use client"
import "./Button.css"

interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: "primary" | "secondary" | "ghost" | "danger"
  size?: "sm" | "md" | "lg"
  disabled?: boolean
  /** Looks disabled but still receives clicks (used to trigger validation errors). */
  softDisabled?: boolean
  type?: "button" | "submit"
  fullWidth?: boolean
  icon?: React.ReactNode
  pulse?: boolean
}

export default function Button({ children, onClick, variant = "primary", size = "md", disabled = false, softDisabled = false, type = "button", fullWidth = false, icon, pulse = false }: ButtonProps) {
  const looksDisabled = disabled || softDisabled
  const className = [
    "btn",
    `btn--${variant}`,
    `btn--${size}`,
    looksDisabled  ? "btn--disabled"   : "",
    fullWidth      ? "btn--full-width" : "",
    pulse && !looksDisabled ? "btn--pulse" : "",
  ].filter(Boolean).join(" ")

  return (
    <button
      type={type}
      className={className}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <span className="btn__icon">{icon}</span>}
      {children}
    </button>
  )
}
