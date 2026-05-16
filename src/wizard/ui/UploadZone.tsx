"use client"
import { useState, useRef } from "react"
import "./UploadZone.css"

interface UploadZoneProps {
  file:   File | null
  onFile: (f: File) => void
}

export default function UploadZone({ file, onFile }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }

  const classes = [
    "upload-zone",
    dragging ? "upload-zone--dragging" : "",
    file ? "upload-zone--has-file" : "",
  ].filter(Boolean).join(" ")

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={classes}
    >
      <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.svg,.ai,.pdf,.eps" style={{ display: "none" }}
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />

      {file ? (
        <>
          <div className="upload-zone__icon upload-zone__icon--filled">
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M13 3v14M7 11l6 6 6-6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><rect x="4" y="20" width="18" height="2.5" rx="1.25" fill="#fff"/></svg>
          </div>
          <div>
            <div className="upload-zone__filename">{file.name}</div>
            <div className="upload-zone__filesize">{(file.size / 1024).toFixed(1)} KB · Click to replace</div>
          </div>
        </>
      ) : (
        <>
          <div className="upload-zone__icon upload-zone__icon--empty">
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M13 17V3M7 9l6-6 6 6" stroke="var(--color-text-muted)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><rect x="4" y="20" width="18" height="2.5" rx="1.25" fill="var(--color-border)"/></svg>
          </div>
          <div>
            <div className="upload-zone__heading">Drop your logo here</div>
            <div className="upload-zone__subheading">or click to browse</div>
            <div className="upload-zone__formats">JPG · PNG · SVG · AI · PDF · EPS</div>
          </div>
        </>
      )}
    </div>
  )
}
