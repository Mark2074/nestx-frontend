import LiveRightPanel from "./LiveRightPanel";

export default function HostPanelPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        width: 400,
        maxWidth: 400,
        background: "#050505",
        color: "white",
        padding: 10,
        boxSizing: "border-box",
        overflowX: "hidden",
        overflowY: "auto",
      }}
    >
      <div style={{ width: "100%", display: "grid", gap: 10 }}>
        <LiveRightPanel />
      </div>
    </div>
  );
}