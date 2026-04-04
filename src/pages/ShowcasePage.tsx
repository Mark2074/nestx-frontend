import React from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/nestxApi";

function str(v: any) {
  return String(v ?? "").trim();
}
function upper(v: any) {
  const s = str(v);
  return s ? s.toUpperCase() : "";
}

function pickThumb(it: any) {
  return str(it?.mediaUrl) || "";
}
function pickUsername(it: any) {
  return (
    str(it?.creatorDisplayName) ||
    str(it?.creatorUsername) ||
    str(it?.creator?.displayName) ||
    str(it?.creator?.username) ||
    "Unknown user"
  );
}
function pickCreatorId(it: any) {
  return (
    str(it?.creatorId) ||
    str(it?.creator?._id) ||
    str(it?.creator?.id) ||
    ""
  );
}
function pickText(it: any) {
  return str(it?.text) || "";
}

export default function ShowcasePage() {
  const nav = useNavigate();

  const [items, setItems] = React.useState<any[]>([]);
  const [page, setPage] = React.useState(1);
  const [pages, setPages] = React.useState(1);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(
    async (nextPage: number) => {
      setBusy(true);
      try {
        const res = await api.showcaseAll(nextPage, 20);
        const list = Array.isArray(res?.items) ? res.items : [];

        setItems((prev) => (nextPage === 1 ? list : [...prev, ...list]));
        setPage(Number(res?.page ?? nextPage));
        setPages(Number(res?.pages ?? 1));
      } catch {
        if (nextPage === 1) setItems([]);
      } finally {
        setBusy(false);
      }
    },
    []
  );

  React.useEffect(() => {
    load(1);
  }, [load]);

  const go = async (it: any) => {
    let creatorId = pickCreatorId(it);

    try {
      if (it?._id) {
        const cid = await api.showcaseClick(String(it._id));
        if (cid) creatorId = String(cid).trim();
      }
    } catch {}

    if (creatorId) nav(`/app/profile/${creatorId}`);
  };

  const canLoadMore = page < pages;

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Showcase</h1>
        <div style={{ opacity: 0.75, fontSize: 13 }}>Approved VIP items</div>
      </div>

      {items.length === 0 ? (
        <div style={{ marginTop: 14, opacity: 0.8 }}>{busy ? "Loading…" : "No showcase items yet."}</div>
      ) : (
        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          {items.map((it, idx) => {
            const thumb = pickThumb(it);
            const username = pickUsername(it);
            const title = str(it?.title);
            const text = pickText(it);
            const letter = upper(username).slice(0, 1) || "S";

            return (
              <div
                key={String(it?._id || `${idx}`)}
                onClick={() => go(it)}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  cursor: "pointer",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.03)",
                  padding: 12,
                }}
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt="showcase"
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 16,
                      objectFit: "cover",
                      flex: "0 0 auto",
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(255,255,255,0.06)",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 16,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      flex: "0 0 auto",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 1000,
                      fontSize: 18,
                      opacity: 0.9,
                    }}
                  >
                    {letter}
                  </div>
                )}

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        fontWeight: 1000,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {username}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>SHOWCASE</div>
                  </div>

                  {title ? (
                    <div style={{ marginTop: 4, fontWeight: 900, opacity: 0.95 }}>{title}</div>
                  ) : null}

                  {text ? (
                    <div style={{ marginTop: 4, opacity: 0.82 }}>{text}</div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 14, display: "flex", gap: 12, alignItems: "center" }}>
        {canLoadMore ? (
          <button
            onClick={() => load(page + 1)}
            disabled={busy}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {busy ? "Loading…" : "Load more"}
          </button>
        ) : null}
      </div>
    </div>
  );
}