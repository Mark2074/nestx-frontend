import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

const ACCOUNT_DELETION_URL = "https://legal.nestx.live/account-deletion.html";
const CHILD_SAFETY_URL = "https://legal.nestx.live/child-safety.html";

type RuleLink = {
  label: string;
  href: string;
};

type LegalEntry = {
  title: string;
  summary: string[];
  href: string;
  buttonLabel: string;
};

export default function RulesPage() {
  const nav = useNavigate();

  const links = useMemo<RuleLink[]>(
    () => [
      { label: "0) Introduction — What is NestX", href: "/rules/en/index.html" },
      { label: "1) Platform Rules (Core Rules)", href: "/rules/en/platform-rules.html" },
      { label: "2) Account Types & Status", href: "/rules/en/accounts.html" },
      { label: "3) Tokens & Economy (Overview)", href: "/rules/en/tokens.html" },
      { label: "4) Live & Events", href: "/rules/en/live-events.html" },
      { label: "5) ADV & Promotion System", href: "/rules/en/adv.html" },
      { label: "6) Showcase / Vetrina", href: "/rules/en/showcase.html" },
      { label: "7) Verification & Authenticity", href: "/rules/en/verification.html" },
      { label: "8) Moderation & Safety", href: "/rules/en/moderation.html" },
      { label: "9) Creator Terms & Monetization", href: "/rules/en/9_CREATOR_TERMS_AND_MONETIZATION.html" },
      { label: "Terms of Service", href: "/rules/en/terms.html" },
      { label: "Privacy Policy", href: "/rules/en/privacy.html" },
    ],
    []
  );

  const legalEntries = useMemo<LegalEntry[]>(
    () => [
      {
        title: "Account Deletion",
        href: ACCOUNT_DELETION_URL,
        buttonLabel: "Open account deletion page",
        summary: [
          "Users can permanently delete their NestX account directly from the application settings or profile section.",
          "When an account deletion request is submitted, the account enters a pending deletion state for up to 30 days.",
          "Deleted data includes profile information, posts and uploaded content associated with the account, followers and following relationships, and personal account preferences and settings.",
          "Security logs, moderation and abuse-prevention records, and technical records required for legal compliance and fraud prevention may be retained temporarily.",
          "For privacy-related requests, contact privacy@nestx.live.",
        ],
      },
      {
        title: "Child Safety Standards",
        href: CHILD_SAFETY_URL,
        buttonLabel: "Open child safety page",
        summary: [
          "NestX is intended for users aged 18 and over.",
          "NestX has a zero-tolerance policy for child sexual abuse material, sexual exploitation of minors, grooming, or any content involving minors in sexual or exploitative contexts.",
          "Users can report accounts, posts, media, or other content that may violate safety rules. Reports are reviewed and may result in content removal, account restrictions, account suspension, or escalation where required.",
          "Content suspected to involve minors, exploitation, abuse, or illegal activity may be removed or restricted. Accounts involved in such activity may be suspended or permanently removed.",
          "Child safety and abuse prevention contact: safety@nestx.live.",
        ],
      },
    ],
    []
  );

  return (
    <div style={{ padding: 20, maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ margin: "6px 0 10px" }}>Rules</h1>
      <p style={{ opacity: 0.8, marginTop: 0 }}>
        Open a section to read the full rules. These pages open in a new tab.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 10,
          marginTop: 14,
        }}
      >
        {links.map((x) => (
          <button
            key={x.href}
            onClick={() => window.open(x.href, "_blank", "noopener,noreferrer")}
            style={{
              textAlign: "left",
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,.12)",
              background: "rgba(255,255,255,.05)",
              color: "rgba(255,255,255,.92)",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {x.label}
          </button>
        ))}
      </div>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>Privacy and Safety Information</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          {legalEntries.map((entry) => (
            <article
              key={entry.href}
              style={{
                padding: 16,
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,.12)",
                background: "rgba(255,255,255,.05)",
                color: "rgba(255,255,255,.92)",
              }}
            >
              <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>{entry.title}</h3>
              <div style={{ display: "grid", gap: 8 }}>
                {entry.summary.map((text) => (
                  <p key={text} style={{ margin: 0, opacity: 0.82, lineHeight: 1.55, fontSize: 14 }}>
                    {text}
                  </p>
                ))}
              </div>
              <button
                type="button"
                onClick={() => window.open(entry.href, "_blank", "noopener,noreferrer")}
                style={{
                  marginTop: 14,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.08)",
                  color: "white",
                  fontWeight: 900,
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "center",
                }}
              >
                {entry.buttonLabel}
              </button>
            </article>
          ))}
        </div>
      </section>

      <div style={{ marginTop: 22, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={() => nav("/apps")}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          NestX Apps
        </button>

        <button
          onClick={() => nav("/app/bug-report")}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "none",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Report a bug
        </button>
      </div>
    </div>
  );
}
