import * as React from "react"

/**
 * The Qillin brand mark — the same artwork as public/favicon.svg, inlined so
 * it can be rendered anywhere in the app UI without a network fetch.
 */
export function QillinLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 180 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Qillin logo"
    >
      {/* Qillin brand tile (Sharp Teal primary) */}
      <rect width="180" height="180" rx="36" fill="#009999" />
      {/* Android antennae */}
      <line x1="66" y1="74" x2="52" y2="52" stroke="#FFFFFF" strokeWidth="10" strokeLinecap="round" />
      <line x1="114" y1="74" x2="128" y2="52" stroke="#FFFFFF" strokeWidth="10" strokeLinecap="round" />
      {/* Android dome head */}
      <path d="M45 114 A45 45 0 0 1 135 114 Z" fill="#FFFFFF" />
      {/* Qillin ring as the robot's eye */}
      <circle cx="90" cy="89" r="19" stroke="#009999" strokeWidth="12" />
    </svg>
  )
}
