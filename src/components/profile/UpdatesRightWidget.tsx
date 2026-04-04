import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

type UpdateItem = {
  id: string;
  text: string;
  createdAt: string;
};

export default function UpdatesRightWidget() {
  const [update, setUpdate] = useState<UpdateItem | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);

        const res = await fetch("/api/updates/serve");
        const data = await res.json();

        if (!mounted) return;

        if (data?.status === "success" && data.data) {
          setUpdate(data.data);
        } else {
          setUpdate(null);
        }
      } catch (err) {
        console.error("Updates widget error:", err);
        setUpdate(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [location.pathname]); // 🔥 cambia ad ogni navigazione

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 16,
        background: "rgba(255,255,255,0.03)",
        padding: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ fontWeight: 900 }}>Updates</div>
        <div style={{ fontSize: 13, opacity: 0.6 }}>Platform news</div>
      </div>

      <div
        style={{
          marginTop: 10,
          borderRadius: 12,
          border: "1px dashed rgba(255,255,255,0.14)",
          padding: 12,
          minHeight: 60,
          display: "flex",
          alignItems: "center",
          fontSize: 14,
          lineHeight: 1.4,
        }}
      >
        {loading && "Loading..."}
        {!loading && !update && "No updates available."}
        {!loading && update && update.text}
      </div>
    </div>
  );
}