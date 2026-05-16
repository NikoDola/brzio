"use client"
import { Fragment, useState, useEffect } from "react"
import "./ProgressBar.css"
import { T } from "../sections/tokens"

interface ProgressBarProps {
  steps:        string[]
  current:      number
  maxReached?:  number
  onStepClick?: (index: number) => void
}

export default function ProgressBar({ steps, current, maxReached, onStepClick }: ProgressBarProps) {
  const [hovered, setHovered]   = useState<number | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const highWater = maxReached ?? current

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1000)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  if (isMobile) {
    return (
      <div className="progress-bar progress-bar--mobile">
        {steps.map((label, i) => {
          const done      = i !== current && (i < current || i <= highWater)
          const active    = i === current
          const clickable = done && !!onStepClick

          return (
            <Fragment key={i}>
              <div
                className={`progress-step${clickable ? " progress-step--clickable" : ""}`}
                onClick={clickable ? () => onStepClick!(i) : undefined}
                onMouseEnter={() => clickable && setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                <div className={[
                  "progress-step__circle",
                  done    ? "progress-step__circle--done"    : "",
                  active  ? "progress-step__circle--active"  : "",
                  hovered === i ? "progress-step__circle--hovered" : "",
                ].filter(Boolean).join(" ")}>
                  <span className={[
                    "progress-step__number",
                    done   ? "progress-step__number--done"   : "",
                    active ? "progress-step__number--active" : "",
                  ].filter(Boolean).join(" ")}>{i + 1}</span>
                </div>
                <div className="progress-step__label-row progress-step__label-row--mobile">
                  {active && <span className="progress-step__label progress-step__label--active">{label}</span>}
                </div>
              </div>
              {i < steps.length - 1 && (
                <div className={`progress-connector${i < highWater ? " progress-connector--done" : ""}`} />
              )}
            </Fragment>
          )
        })}
      </div>
    )
  }

  return (
    <div className="progress-bar">
      {steps.map((label, i) => {
        const done      = i !== current && (i < current || i <= highWater)
        const active    = i === current
        const clickable = done && !!onStepClick

        return (
          <Fragment key={i}>
            <div
              className={`progress-step${clickable ? " progress-step--clickable" : ""}`}
              onClick={clickable ? () => onStepClick(i) : undefined}
              onMouseEnter={() => clickable && setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className={[
                "progress-step__circle",
                done   ? "progress-step__circle--done"    : "",
                active ? "progress-step__circle--active"  : "",
                hovered === i ? "progress-step__circle--hovered" : "",
              ].filter(Boolean).join(" ")}>
                <span className={[
                  "progress-step__number",
                  done   ? "progress-step__number--done"   : "",
                  active ? "progress-step__number--active" : "",
                ].filter(Boolean).join(" ")}>{i + 1}</span>
              </div>
              <div className="progress-step__label-row">
                {done && (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="progress-step__check">
                    <path d="M2 6l3 3 5-5" stroke={T.color.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                <span className={[
                  "progress-step__label",
                  active ? "progress-step__label--active" : "",
                  done   ? "progress-step__label--done"   : "",
                ].filter(Boolean).join(" ")}>{label}</span>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className={`progress-connector progress-connector--desktop${i < highWater ? " progress-connector--done" : ""}`} />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}
