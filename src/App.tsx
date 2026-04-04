import { useNavigate } from "react-router-dom";

const LOGO_SRC = "/legal/nestx-horizontal-dark.png";

function App() {
  const nav = useNavigate();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 22,
      }}
    >
      <div
        style={{
          maxWidth: 820,
          width: "100%",
          textAlign: "center",
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: 18 }}>
          <img
            src={LOGO_SRC}
            alt="NestX"
            style={{ height: 128, width: "auto",maxWidth: 420 }}
          />
        </div>

        {/* Claim */}
        <h1
          style={{
            fontSize: 28,
            fontWeight: 900,
            marginBottom: 10,
          }}
        >
          Not a room. A presence.
        </h1>

        {/* Descrizione */}
        <p
          style={{
            fontSize: 16,
            opacity: 0.9,
            lineHeight: 1.55,
            marginBottom: 22,
          }}
        >
          <b>NestX</b> — NestX — the social platform where you can truly express yourself.
          <br />
          Discover real people, follow those who interest you, and live Live events.
          <br />
          Or publish content, build your audience, and turn your presence into opportunities.
        </p>

        {/* CTA */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          <button
            onClick={() => nav("/auth?mode=register")}
            style={primaryBtnStyle}
          >
            Register
          </button>

          <button
            onClick={() => nav("/auth?mode=login")}
            style={secondaryBtnStyle}
          >
            Login
          </button>
        </div>

        {/* Link secondario */}
        <button
          onClick={() => nav("/discover")}
          style={{
            border: "none",
            background: "transparent",
            color: "white",
            textDecoration: "underline",
            cursor: "pointer",
            fontSize: 13,
            opacity: 0.85,
          }}
        >
          Learn more
        </button>
                {/* Footer legale */}
        <div
          style={{
            marginTop: 24,
            display: "flex",
            justifyContent: "center",
            gap: 18,
            flexWrap: "wrap",
            fontSize: 13,
            opacity: 0.85,
          }}
        >
          <a
            href="/legal/terms.html"
            style={{ color: "white", textDecoration: "underline" }}
          >
            Terms
          </a>
          <a
            href="/legal/privacy.html"
            style={{ color: "white", textDecoration: "underline" }}
          >
            Privacy
          </a>
        </div>
      </div>
    </div>
  );
}

const primaryBtnStyle = {
  padding: "10px 16px",
  borderRadius: 12,
  fontWeight: 900,
  cursor: "pointer",
} as const;

const secondaryBtnStyle = {
  padding: "10px 16px",
  borderRadius: 12,
  fontWeight: 900,
  cursor: "pointer",
  background: "transparent",
  color: "white",
  border: "1px solid rgba(255,255,255,0.14)",
  opacity: 0.92,
} as const;

export default App;
