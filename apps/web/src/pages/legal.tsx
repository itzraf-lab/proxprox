import * as React from "react"
import { Shell } from "@/components/layout"
import { EyeOff, ScrollText } from "lucide-react"

const LAST_UPDATED = "September 13, 2026"

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="text-xl font-bold uppercase tracking-wider text-foreground border-b border-border pb-3 mb-4">
        {title}
      </h2>
      <div className="space-y-4 text-sm sm:text-base leading-7 text-muted-foreground">{children}</div>
    </section>
  )
}

export default function Legal() {
  return (
    <Shell>
      <div className="flex-1 overflow-y-auto">
        <div className="border-b bg-sidebar/30">
          <div className="mx-auto max-w-4xl px-6 py-16 lg:px-8">
            <h1 className="text-4xl font-bold tracking-tight text-foreground uppercase sm:text-5xl">
              Privacy Policy <span className="text-primary">&amp;</span> Terms of Service
            </h1>
            <p className="mt-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Last updated: {LAST_UPDATED}
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-4xl px-6 py-16 lg:px-8 space-y-16">
          {/* ── Privacy Policy ─────────────────────────────────────────── */}
          <div className="space-y-10">
            <div className="flex items-center gap-3 font-mono text-sm font-bold uppercase tracking-widest text-primary">
              <EyeOff className="h-5 w-5" /> Part I — Privacy Policy
            </div>

            <Section id="privacy-overview" title="1. What we collect">
              <p>
                Qillin is built around one principle: your conversations are yours. We collect the
                minimum data required to operate the service:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <span className="text-foreground font-semibold">Account data</span> — your name,
                  email address, and a hashed password, used to authenticate you.
                </li>
                <li>
                  <span className="text-foreground font-semibold">Usage metadata</span> — per-request
                  token counts, model identifiers, timestamps, and computed cost in Qredits. This is
                  used solely to meter and bill your usage.
                </li>
                <li>
                  <span className="text-foreground font-semibold">API key fingerprints</span> — we
                  store your API keys so they can authenticate requests, and attribute spend to them.
                </li>
                <li>
                  <span className="text-foreground font-semibold">Payment metadata</span> — for each
                  top-up: the amount in Rupiah, timestamps, status, and the payer's payment
                  issuer (e.g. GoPay or a bank) as reported by the payment gateway. We never see or
                  store your GoPay PIN, wallet balance, or bank credentials.
                </li>
              </ul>
            </Section>

            <Section id="privacy-no-logging" title="2. Zero message logging">
              <p>
                Prompts, completions, and any other message content pass through Qillin in memory
                and are <span className="text-foreground font-semibold">never written to disk, a
                database, or a log file</span>. We cannot read, review, or recover your message
                content — it simply does not exist on our systems once a request completes.
              </p>
              <p>
                The only record of a request is its anonymized usage metadata (tokens, model, cost),
                retained to power your billing and request log.
              </p>
            </Section>

            <Section id="privacy-sharing" title="3. Sharing &amp; third parties">
              <p>
                Your prompts are transmitted to the upstream model providers configured on this
                instance in order to fulfil your requests; those providers' own data policies apply
                to that transmission. Top-up payments are processed over QRIS through a GoPay
                merchant gateway; the act of paying shares whatever your payment app discloses to
                the merchant (such as your name and issuer) under GoPay's and QRIS's own terms.
                Beyond that, we do not sell, rent, or share your personal data or usage data with
                any third party.
              </p>
            </Section>

            <Section id="privacy-security" title="4. Security">
              <p>
                Passwords are stored only as salted hashes, API keys are scoped to your account, and
                each user's data is isolated from every other user. Access to the underlying
                infrastructure is restricted to system administrators.
              </p>
            </Section>

            <Section id="privacy-rights" title="5. Your rights">
              <p>
                You may request a copy or deletion of your account data at any time by contacting
                the instance administrator. Deleting your account removes your profile, API keys,
                and associated usage records.
              </p>
            </Section>
          </div>

          {/* ── Terms of Service ───────────────────────────────────────── */}
          <div className="space-y-10">
            <div className="flex items-center gap-3 font-mono text-sm font-bold uppercase tracking-widest text-primary">
              <ScrollText className="h-5 w-5" /> Part II — Terms of Service
            </div>

            <Section id="terms-service" title="1. The service">
              <p>
                Qillin provides an OpenAI-compatible API proxy that routes your requests to
                third-party large language model providers under a single account and API key.
                Access is granted on a prepaid, pay-as-you-go basis using Qredits (Qr).
              </p>
            </Section>

            <Section id="terms-qredits" title="2. Qredits &amp; billing">
              <p>
                <span className="text-foreground font-semibold">1 Qredit (Qr) equals $1 USD of AI
                usage</span> at the model rates listed in the model catalog. Usage is metered per
                token and deducted from your balance as requests complete.
              </p>
              <p>
                <span className="text-foreground font-semibold">Topping up $1 USD credits your
                account with 2 Qr</span> — a standing 2× bonus on every deposit. Qredits are
                non-refundable, non-transferable, and have no cash value outside the platform, but
                they never expire.
              </p>
              <p>
                When your balance is exhausted, requests will be rejected until you top up again.
                You can review every deduction in your request log.
              </p>
            </Section>

            <Section id="terms-topups" title="3. Topping up (QRIS)">
              <p>
                Top-ups are paid in Indonesian Rupiah (IDR) via QRIS at a fixed rate of{" "}
                <span className="text-foreground font-semibold">Rp 16.000 = $1 = 2 Qr</span>{" "}
                (Rp 8.000 per Qredit), with a minimum of Rp 8.000 per top-up. You always confirm
                the exact Rupiah amount in your own payment app before paying — we never charge
                you directly.
              </p>
              <p>
                Each top-up generates a unique QRIS code that{" "}
                <span className="text-foreground font-semibold">expires after 5 minutes</span>.
                Scan and pay it within that window; your balance is credited automatically once
                the payment is confirmed by the payment gateway, usually within seconds of paying.
                A QRIS code can only be paid once, and each code is valid for exactly one top-up.
              </p>
              <p>
                If your payment completed but your balance did not update — for example because
                the payment settled after the code expired —{" "}
                <span className="text-foreground font-semibold">
                  contact us at{" "}
                  <a href="mailto:eruudev4@gmail.com" className="text-primary underline underline-offset-2">
                    eruudev4@gmail.com
                  </a>{" "}
                  with proof of payment
                </span>{" "}
                and we will credit your account manually. A completed payment is never forfeited.
              </p>
              <p>
                Because Qredits are topped up at a promotional 2× rate, completed payments are
                final and <span className="text-foreground font-semibold">non-refundable</span>,
                except where a payment was completed but never credited and cannot be remedied.
              </p>
            </Section>

            <Section id="terms-acceptable-use" title="4. Acceptable use">
              <p>
                You agree not to use the service for anything unlawful, harmful, or abusive —
                including generating illegal content, attacking third-party systems, or
                circumventing provider safety controls. We may suspend accounts that violate these
                terms or the acceptable-use policies of upstream providers.
              </p>
            </Section>

            <Section id="terms-availability" title="5. Availability &amp; liability">
              <p>
                The service is provided "as is" and "as available". Model availability, latency, and
                output quality depend on upstream providers and may change without notice. To the
                maximum extent permitted by law, Qillin is not liable for indirect or consequential
                damages arising from use of the service.
              </p>
            </Section>

            <Section id="terms-changes" title="6. Changes to these terms">
              <p>
                We may update this Privacy Policy and Terms of Service from time to time. Material
                changes will be announced on this page with a revised "last updated" date; continued
                use of the service after changes take effect constitutes acceptance.
              </p>
            </Section>
          </div>
        </div>
      </div>
    </Shell>
  )
}
