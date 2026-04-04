import React from "react";
import { api } from "../api/nestxApi";
import type { MeProfile } from "../api/nestxApi";
import PostCard from "../components/feed/PostCard";

export default function FedPage() {
  const [items, setItems] = React.useState<any[]>([]);
  const [me, setMe] = React.useState<MeProfile | null>(null);
  const [busy, setBusy] = React.useState(true);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      setBusy(true);
      try {
        const [list, rawMe] = await Promise.all([
          api.fed(),
          api.meProfile().catch(() => null),
        ]);

        if (!alive) return;

        const arr = Array.isArray(list) ? list : [];
        const profile = (rawMe as any)?.profile ?? rawMe ?? null;

        setItems(arr);
        setMe(profile as MeProfile | null);
      } catch {
        if (!alive) return;
        setItems([]);
        setMe(null);
      } finally {
        if (alive) setBusy(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <h1 style={{ margin: 0 }}>FED</h1>
        <div style={{ opacity: 0.75, fontSize: 13 }}>Suggested posts</div>
      </div>

      {busy ? (
        <div style={{ marginTop: 14, opacity: 0.8 }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ marginTop: 14, opacity: 0.8 }}>No suggestions yet.</div>
      ) : (
        <div
          style={{
            marginTop: 14,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {items.map((it: any, idx: number) => {
            const post = it?.data ?? it;
            const key = String(post?._id || idx);

            return (
              <PostCard
                key={key}
                item={it}
                me={me}
                context="feed"
              />
            );
          })}
        </div>
      )}
    </div>
  );
}