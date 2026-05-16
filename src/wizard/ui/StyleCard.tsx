"use client"
import { useState, useEffect } from "react"
import "./StyleCard.css"

interface StyleCardProps {
  label:    string
  sublabel?: string
  selected: boolean
  onClick:  () => void
  children: React.ReactNode
  index:    number
  dimmed?:  boolean
}

export default function StyleCard({ label, sublabel, selected, onClick, children, index, dimmed }: StyleCardProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), index * 80)
    return () => clearTimeout(t)
  }, [index])

  const classes = [
    "style-card",
    visible ? "style-card--visible" : "",
    selected ? "style-card--selected" : "",
    dimmed ? "style-card--dimmed" : "",
  ].filter(Boolean).join(" ")

  return (
    <div onClick={onClick} className={classes}>
      {selected && (
        <div className="style-card__check">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      )}
      <div className="style-card__preview">
        {children}
      </div>
      <div className="style-card__footer">
        <div className="style-card__label">{label}</div>
        {sublabel && <div className="style-card__sublabel">{sublabel}</div>}
      </div>
    </div>
  )
}
