import React from "react";
import { useNavigate } from "react-router-dom";
import FedCompactPostCard from "../feed/FedCompactPostCard";
import { api } from "../../api/nestxApi";
import type { MeProfile } from "../../api/nestxApi";

export default function FedRightWidget({ me }: { me: MeProfile | null }) {
  const navigate = useNavigate();
  const [items, setItems] = React.useState<any[]>([]);
  const [busy, setBusy] = React.useState(false);

  const emailVerified = Boolean(me?.emailVerifiedAt);

  React.useEffect(() => {
    let alive = true;

    if (!emailVerified) {
      setItems([]);
      setBusy(false);
      return () => {
        alive = false;
      };
    }

    (async () => {
      setBusy(true);
      try {
        const list = await api.fed();
        if (!alive) return;
        const arr = Array.isArray(list) ? list : [];
        setItems(arr.slice(0, 4));
      } catch {
        if (!alive) return;
        setItems([]);
      } finally {
        if (alive) setBusy(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [emailVerified]);

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 16,
        background: "rgba(255,255,255,0.03)",
        padding: 10,
      }}
    >
      <div
        onClick={() => navigate("/app/fed")}
        style={{
          fontWeight: 900,
          cursor: "pointer",
          userSelect: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
        title="Open FED"
      >
        FED <span style={{ opacity: 0.6, fontWeight: 800 }}>›</span>
      </div>

      <div
        style={{
          marginTop: 10,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {!emailVerified ? (
          <div style={{ opacity: 0.8, fontSize: 13 }}>Available after email verification.</div>
        ) : busy ? (
          <div style={{ opacity: 0.8, fontSize: 13 }}>Loading…</div>
        ) : items.length === 0 ? (
          <div style={{ opacity: 0.8, fontSize: 13 }}>No suggestions yet…</div>
        ) : (
          items.map((it) => (
            <FedCompactPostCard
              key={String((it?.data ?? it)?._id || Math.random())}
              item={it}
              onOpen={(postId) => navigate(`/app/post/${postId}`)}
            />
          ))
        )}
      </div>
    </div>
  );
}