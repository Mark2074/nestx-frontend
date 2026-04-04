import React from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/nestxApi";

function str(v: any) {
  return String(v ?? "").trim();
}

function upper(v: any) {
  const s = str(v);
  return s ? s.toUpperCase() : "";
}

function pickThumb(it: any) {
  return (
    str(it?.creatorAvatarUrl) ||
    str(it?.creatorCoverUrl) ||
    str(it?.coverUrl) ||
    str(it?.avatarUrl) ||
    str(it?.ownerAvatarUrl) ||
    str(it?.ownerCoverUrl) ||
    str(it?.mediaUrl) ||
    ""
  );
}

function pickUsername(it: any) {
  return (
    str(it?.creatorUsername) ||
    str(it?.creatorName) ||
    str(it?.username) ||
    str(it?.ownerUsername) ||
    str(it?.ownerName) ||
    str(it?.title) ||
    ""
  );
}

function pickDescription(it: any) {
  return str(it?.text) || str(it?.description) || "";
}

function pickContentScope(it: any) {
  const raw =
    str(it?.contentScope) ||
    str(it?.content) ||
    str(it?.eventContentScope) ||
    str(it?.meta?.contentScope) ||
    "";
  const v = raw.toLowerCase();
  if (v === "hot") return "HOT";
  if (v === "no_hot" || v === "nohot" || v === "non_hot" || v === "nonhot" || v === "neutral") return "NO_HOT";
  return raw ? raw.toUpperCase() : "";
}

function pickPriceLabel(it: any) {
  const priceTokensRaw =
    it?.ticketPriceTokens ??
    it?.priceTokens ??
    it?.price ??
    it?.eventTicketPriceTokens ??
    it?.meta?.ticketPriceTokens ??
    it?.meta?.priceTokens;

  const n = Number(priceTokensRaw ?? 0);
  return Number.isFinite(n) && n > 0 ? "PAID" : "FREE";
}

function buildMetaLine(it: any) {
  const scope = pickContentScope(it) || "NO_HOT";
  const price = pickPriceLabel(it);
  return `${scope} · ${price}`;
}

export default function AdvRightWidget() {
  const nav = useNavigate();
  const [items, setItems] = React.useState<any[]>([]);

  React.useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        // NEW: server-side FAIR rotation (returns 4 items)
        const list = await api.advServeFour({ placement: "feed", limit: 4 });
        if (!alive) return;

        const arr = Array.isArray(list) ? list : [];
        setItems(arr);
      } catch {
        if (!alive) return;
        setItems([]);
      }
    };

    load();
    const t = window.setInterval(load, 10000);

    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  const visible = React.useMemo(() => {
    return Array.isArray(items) ? items : [];
  }, [items]);

  const go = async (it: any) => {
    const targetType = str(it?.targetType);
    const targetId = str(it?.targetId);
    const targetUrl = str(it?.targetUrl);

    const unavailable = targetType === "event" && !targetId;
    if (unavailable) return;

    try {
      if (it?._id) await api.advClick(String(it._id));
    } catch {}

    if (targetType === "event" && targetId) {
      nav(`/app/live/${targetId}`);
      return;
    }

    if (targetUrl.startsWith("/app/events/")) {
      const id = targetUrl.replace("/app/events/", "").trim();
      if (id) {
        nav(`/app/live/${id}`);
        return;
      }
    }

    if (targetUrl) nav(targetUrl);
  };

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 14,
        background: "rgba(255,255,255,0.03)",
        padding: 10,
      }}
    >
      {/* header clickable */}
      <div
        onClick={() => nav("/app/promoted")}
        style={{
          fontWeight: 1000,
          cursor: "pointer",
          userSelect: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
        title="Open Promoted"
      >
        Promoted <span style={{ opacity: 0.6, fontWeight: 900 }}>›</span>
      </div>

      {visible.length === 0 ? (
        <div style={{ marginTop: 10, opacity: 0.8, fontSize: 13 }}>No promoted items yet.</div>
      ) : (
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          {visible.map((it, idx) => {
            const targetType = str(it?.targetType);
            const targetId = str(it?.targetId);
            const unavailable = targetType === "event" && !targetId;

            const thumb = pickThumb(it);
            const username = pickUsername(it) || "Promoted";
            const description = pickDescription(it);
            const metaLine = buildMetaLine(it);

            const letter = upper(username).slice(0, 1) || "P";

            return (
              <div
                key={String(it?._id || `${idx}-${username}`)}
                onClick={() => go(it)}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  cursor: unavailable ? "not-allowed" : "pointer",
                  opacity: unavailable ? 0.6 : 1,
                  padding: "6px 6px",
                  borderRadius: 12,
                }}
                title={unavailable ? "Unavailable" : ""}
              >
                {/* small thumb */}
                {thumb ? (
                  <img
                    src={thumb}
                    alt="adv"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      objectFit: "cover",
                      flex: "0 0 auto",
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(255,255,255,0.06)",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      flex: "0 0 auto",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 1000,
                      letterSpacing: 0.4,
                      opacity: 0.9,
                    }}
                  >
                    {letter}
                  </div>
                )}

                {/* reddit-like labels */}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 1000,
                      lineHeight: 1.05,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: 13,
                    }}
                  >
                    {username}
                  </div>

                  {unavailable ? (
                    <div style={{ marginTop: 3, fontSize: 12, opacity: 0.8 }}>Unavailable</div>
                  ) : description ? (
                    <div
                      style={{
                        marginTop: 3,
                        fontSize: 12.5,
                        opacity: 0.82,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {description}
                    </div>
                  ) : null}

                  <div style={{ marginTop: 3, fontSize: 11.5, opacity: 0.7 }}>{metaLine}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}