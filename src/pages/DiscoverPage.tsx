import { useNavigate } from "react-router-dom";

const LOGO_SRC = "/legal/nestx-horizontal-dark.png";

export default function DiscoverPage() {
  const nav = useNavigate();

  return (
    <div style={{ minHeight: "100vh", padding: 22, display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 980 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, paddingTop: 12 }}>
          <img src={LOGO_SRC} alt="NestX" style={{ height: 128, width: "auto", maxWidth: 420, }} />
        </div>

        <div style={{ marginTop: 18, textAlign: "center" }}>
          <div style={{ fontWeight: 900, fontSize: 22 }}>Not a room. A presence.</div>
          <div style={{ marginTop: 10, fontSize: 16, opacity: 0.92 }}>
            What you can do on NestX
          </div>
        </div>

        <div style={{ padding: 16 }}>
          <p style={{ marginTop: 0, opacity: 0.9 }}>
            On NestX, you can experience the platform in two ways:
             discovering and following, or publishing and building your presence.
          </p>

          <h3 style={h3Style}>If you want to discover and follow others</h3>
          <ul style={ulStyle}>
            <li>Follow profiles you are genuinely interested in  </li>
            <li>Browse a real and constantly updated feed</li>
            <li>Join Live events  </li>
            <li>Discover new profiles without wasting time</li>
          </ul>

          <h3 style={h3Style}>If you want to publish and build your presence</h3>
          <p style={{ opacity: 0.9 }}>
            NestX gives you real tools to grow your presence:
          </p>
          <ul style={ulStyle}>
            <li>Publish content (photos, videos, posts)</li>
            <li>Build an audience over time</li>
            <li>Turn your audience into participation through Live events</li>
            <li>Grow steadily, without relying on a single moment</li>
          </ul>

          <h3 style={h3Style}>Why NestX</h3>
          <p style={{ opacity: 0.9 }}>
            NestX was created with a simple idea:
            a complete and coherent profile, with real content people want to discover and follow.
          </p>
          <p style={{ opacity: 0.9 }}>Here, you can:</p>
          <ul style={ulStyle}>
            <li>Publish content that represents who you are  </li>
            <li>Build an audience that truly follows you</li>
            <li>Create Live events or join other creators’ events</li>
            <li>Monetize over time, based on what you share and how you choose to evolve</li>
          </ul>

          <p style={{ opacity: 0.9 }}>
            On NestX, you are free to express yourself without judgment.
            Labels and prejudices stay out — respect for people and rules comes first.
          </p>
          <p style={{ opacity: 0.9 }}>
            You choose what and how to share.
            We provide the space, the tools, and an ecosystem designed to help your presence grow.
          </p>
          <p style={{ opacity: 0.9, marginBottom: 0 }}>
            NestX brings everything together.  
            One profile. One coherent presence. A real audience.
          </p>
        </div>

        <div style={{ padding: 16 }}>
          <h3 style={{ ...h3Style, marginTop: 0 }}>Freedom and clear rules</h3>
          <p style={{ opacity: 0.9 }}>
            NestX is an open space, guided by clear rules.
          </p>
          <p style={{ opacity: 0.9, marginBottom: 0 }}>
            Respect is part of the platform: for people, for the community, and for the boundaries defined in the Terms.  
            This helps maintain a cleaner, more authentic, and sustainable ecosystem over time.
          </p>
        </div>

        <div style={{ padding: 16 }}>
          <h3 style={{ ...h3Style, marginTop: 0 }}>A platform in evolution</h3>
          <p style={{ opacity: 0.9, marginBottom: 0 }}>
            NestX grows together with its community.  
            We are building new opportunities for creators and followers: advanced tools, premium features, and new ways to enhance content.
          </p>
        </div>

        <div style={{ marginTop: 18, textAlign: "center" }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Start here.</div>
          <div style={{ opacity: 0.9, marginTop: 8 }}>
            Create your profile or log in to your account.
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <button onClick={() => nav("/auth?mode=register")} style={primaryBtnStyle}>Register</button>
            <button onClick={() => nav("/auth?mode=login")} style={secondaryBtnStyle}>Login</button>
          </div>
        </div>

        <div style={{ marginTop: 18, display: "flex", justifyContent: "center", gap: 18, flexWrap: "wrap", fontSize: 13, opacity: 0.85 }}>
          <a href="/legal/terms.html" style={linkStyle}>Terms</a>
          <a href="/legal/privacy.html" style={linkStyle}>Privacy</a>
        </div>
      </div>
    </div>
  );
}

const h3Style = {
  marginTop: 14,
  marginBottom: 8,
  fontWeight: 900,
} as const;

const ulStyle = {
  marginTop: 6,
  marginBottom: 10,
  lineHeight: 1.65,
  opacity: 0.9,
} as const;

const linkStyle = {
  color: "white",
  textDecoration: "underline",
} as const;

const primaryBtnStyle = {
  padding: "10px 14px",
  borderRadius: 12,
  fontWeight: 900,
  cursor: "pointer",
} as const;

const secondaryBtnStyle = {
  padding: "10px 14px",
  borderRadius: 12,
  fontWeight: 900,
  cursor: "pointer",
  opacity: 0.92,
  background: "transparent",
  color: "white",
  border: "1px solid rgba(255,255,255,0.14)",
} as const;
