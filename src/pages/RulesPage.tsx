import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

type RuleLink = {
  label: string;
  href: string;
};

export default function RulesPage() {
  const nav = useNavigate();

  const links = useMemo<RuleLink[]>(
    () => [
      { label: "0) Introduction — What is NestX", href: "/rules/en/index.html" },
      { label: "1) Platform Rules (Core Rules)", href: "/rules/en/platform-rules.html" },
      { label: "2) Account Types & Status", href: "/rules/en/accounts.html" },
      { label: "3) Tokens & Economy (Overview)", href: "/rules/en/tokens.html" },
      { label: "4) Live, Events & CAM", href: "/rules/en/live-events.html" },
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

      <div style={{ marginTop: 22 }}>
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