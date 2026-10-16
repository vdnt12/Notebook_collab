import React from 'react'

interface NotebookLogoProps {
  size?: number
  className?: string
  color?: string
}

export function NotebookLogo({ size = 20, className = '', color = 'currentColor' }: NotebookLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-label="Notebook logo"
    >
      {/* Offset back page */}
      <path d="M7 3h11a2 2 0 0 1 2 2v13" opacity="0.4" />
      {/* Front notebook container */}
      <rect x="3" y="6" width="14" height="15" rx="2" />
      {/* Clean vertical spine */}
      <path d="M7 6v15" />
      {/* Minimal bookmark / page ribbon */}
      <path d="M11 6v5l2-1.5 2 1.5V6" fill="currentColor" fillOpacity="0.15" />
    </svg>
  )
}
