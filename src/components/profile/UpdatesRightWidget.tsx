import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

type UpdateItem = {
  _id?: string;
  id?: string;
  text: string;
  createdAt?: string;
};

const RAW_BASE = import.meta.env.VITE_API_BASE_URL || "";
const API_BASE = RAW_BASE.endsWith("/api") ? RAW_BASE : `${RAW_BASE}/api`;

export default function UpdatesRightWidget() {
  const [update, setUpdate] = useState<UpdateItem | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);

        const res = await fetch(`${API_BASE}/updates/serve`, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        let data: any = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }

        if (!mounted) return;

        if (!res.ok) {
          setUpdate(null);
          return;
        }

        const payload = data?.data ?? data ?? null;

        if (payload && typeof payload === "object" && payload.text) {
          setUpdate(payload);
        } else {
          setUpdate(null);
        }
      } catch (err) {
        console.error("Updates widget error:", err);
        if (mounted) setUpdate(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [location.pathname]);

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