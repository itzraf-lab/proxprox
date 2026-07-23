import * as React from "react"
import { ShieldCheck, FileCheck2 } from "lucide-react"

/** Five-pointed star polygon points centered at (cx, cy), one vertex pointing up. */
function starPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2
    const rad = i % 2 === 0 ? r : r * 0.42
    pts.push(`${(cx + rad * Math.cos(angle)).toFixed(3)},${(cy + rad * Math.sin(angle)).toFixed(3)}`)
  }
  return pts.join(" ")
}

/**
 * Emblem of the European Union: a circle of twelve golden stars on a blue
 * field, rendered inline so no external asset is required.
 */
export function EuEmblem({ className }: { className?: string }) {
  const cx = 45
  const cy = 30
  const ringRadius = 19
  const starRadius = 5

  return (
    <svg
      viewBox="0 0 90 60"
      role="img"
      aria-label="Flag of the European Union"
      className={className}
    >
      <rect width="90" height="60" fill="#003399" />
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (2 * Math.PI * i) / 12 - Math.PI / 2
        return (
          <polygon
            key={i}
            points={starPoints(cx + ringRadius * Math.cos(angle), cy + ringRadius * Math.sin(angle), starRadius)}
            fill="#FFCC00"
          />
        )
      })}
    </svg>
  )
}

function BadgeShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 border-2 bg-card px-5 py-4 shadow-sm">
      {children}
    </div>
  )
}

/**
 * Enterprise compliance certifications shown in the main page footer:
 * GDPR (with the EU emblem), ISO/IEC 27001 and SOC 2 Type II.
 */
export function ComplianceBadges() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {/* GDPR */}
      <BadgeShell>
        <EuEmblem className="h-10 w-[60px] shrink-0 border border-black/20" />
        <div className="min-w-0">
          <p className="font-mono text-sm font-bold uppercase tracking-wider text-foreground">GDPR Compliant</p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            EU Data Protection Certified
          </p>
        </div>
      </BadgeShell>

      {/* ISO 27001 */}
      <BadgeShell>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-primary bg-primary/10">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="font-mono text-sm font-bold uppercase tracking-wider text-foreground">ISO/IEC 27001</p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Information Security Certified
          </p>
        </div>
      </BadgeShell>

      {/* SOC 2 Type II */}
      <BadgeShell>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-primary bg-primary/10">
          <FileCheck2 className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="font-mono text-sm font-bold uppercase tracking-wider text-foreground">SOC 2 Type II</p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Audited Security Controls
          </p>
        </div>
      </BadgeShell>
    </div>
  )
}
