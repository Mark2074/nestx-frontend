const LOGO_SRC = "/legal/nestx-horizontal-dark.png";

export default function NestXAppsPage() {
  return (
    <div style={pageStyle}>
      <div style={contentStyle}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <img src={LOGO_SRC} alt="NestX" style={logoStyle} />
        </div>

        <div style={panelStyle}>
          <h1 style={titleStyle}>NestX Full Experience</h1>

          <div style={copyStyle}>
            <p style={paragraphStyle}>
              The full NestX app will include social features, live features, and future advanced systems.
            </p>
            <p style={paragraphStyle}>Download links will be available soon.</p>
          </div>

          <div style={actionsStyle}>
            <button type="button" disabled style={disabledButtonStyle}>
              <span>Download Full App</span>
              <span style={comingSoonStyle}>Coming soon</span>
            </button>

            <a href="/" style={primaryLinkStyle}>
              Continue on Web
            </a>
          </div>

          <div style={noteStyle}>
            The store version includes only the social experience.
          </div>
        </div>
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 22,
  boxSizing: "border-box",
} as const;

const contentStyle = {
  width: "100%",
  maxWidth: 720,
  margin: "0 auto",
  boxSizing: "border-box",
} as const;

const logoStyle = {
  height: 64,
  width: "auto",
  maxWidth: "82%",
  objectFit: "contain",
} as const;

const panelStyle = {
  width: "100%",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 16,
  padding: 18,
  background: "rgba(255,255,255,0.03)",
  boxSizing: "border-box",
  textAlign: "center",
} as const;

const titleStyle = {
  margin: 0,
  color: "white",
  fontSize: 24,
  lineHeight: 1.2,
  fontWeight: 900,
} as const;

const copyStyle = {
  marginTop: 14,
  color: "rgba(255,255,255,0.82)",
  fontSize: 15,
  lineHeight: 1.55,
} as const;

const paragraphStyle = {
  margin: "0 0 8px",
} as const;

const actionsStyle = {
  display: "grid",
  gap: 10,
  marginTop: 20,
  width: "100%",
  boxSizing: "border-box",
} as const;

const disabledButtonStyle = {
  width: "100%",
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.58)",
  fontWeight: 900,
  cursor: "not-allowed",
} as const;

const comingSoonStyle = {
  flex: "0 0 auto",
  fontSize: 12,
  fontWeight: 900,
  opacity: 0.82,
  textTransform: "uppercase",
} as const;

const primaryLinkStyle = {
  width: "100%",
  boxSizing: "border-box",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "12px 14px",
  borderRadius: 12,
  border: "none",
  background: "white",
  color: "#050505",
  fontWeight: 900,
  textDecoration: "none",
} as const;

const noteStyle = {
  marginTop: 16,
  color: "rgba(255,255,255,0.64)",
  fontSize: 13,
  lineHeight: 1.45,
} as const;
