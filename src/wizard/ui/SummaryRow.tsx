"use client"
import "./SummaryRow.css"

interface SummaryRowProps {
  label:     string
  value:     string
  highlight?: boolean
}

export default function SummaryRow({ label, value, highlight }: SummaryRowProps) {
  return (
    <div className="summary-row">
      <span className="summary-row__label">{label}</span>
      <span className={`summary-row__value${highlight ? " summary-row__value--highlight" : ""}`}>{value}</span>
    </div>
  )
}
