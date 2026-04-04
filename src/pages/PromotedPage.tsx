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

function parseDateMs(v: any) {
  const s = str(v);
  if (!s) return null;
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : null;
}

// best-effort: try to infer contentContext from localStorage (no BE call, no ping-pong)
function inferContentContext(): "neutral" | "hot" | "" {
  try {
    const keys = [
      "contentContext",
      "nestx.contentContext",
      "appSettings.contentContext",
      "nestx.appSettings.contentContext",
    ];
    for (const k of keys) {
      const v = str(localStorage.getItem(k));
      if (!v) continue;
      const vv = v.toLowerCase();
      if (vv === "neutral") return "neutral";
      if (vv === "hot") return "hot";
      if (vv === "no_hot" || vv === "nohot" || vv === "non_hot" || vv === "nonhot") return "neutral";
    }
  } catch {}
  return "";
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

function isNoHot(it: any) {
  const scope = pickContentScope(it);
  return scope === "NO_HOT" || scope === "NEUTRAL";
}

function sortByEndsAtAscNullLast(a: any, b: any) {
  const ams = parseDateMs(a?.endsAt);
  const bms = parseDateMs(b?.endsAt);
  if (ams == null && bms == null) return 0;
  if (ams == null) return 1;
  if (bms == null) return -1;
  return ams - bms;
}

export default function PromotedPage() {
  const nav = useNavigate();
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const defaultTab = React.useMemo<"HOT" | "NO_HOT">(() => {
    const ctx = inferContentContext();
    // rule: if neutral -> default NO_HOT
    if (ctx === "neutral") return "NO_HOT";
    return "HOT";
  }, []);

  const [tab, setTab] = React.useState<"HOT" | "NO_HOT">(defaultTab);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const list = await api.advServe({ placement: "feed", limit: 50 });
        if (!alive) return;
        const arr = Array.isArray(list) ? list : [];
        setItems(arr);

        // default tab rule:
        // - if only NO_HOT exists -> NO_HOT
        // - else HOT (unless inferred neutral already set)
        const hasHot = arr.some((x: any) => !isNoHot(x));
        const hasNoHot = arr.some((x: any) => isNoHot(x));

        if (!hasHot && hasNoHot) {
          setTab("NO_HOT");
        } else {
          // if user is neutral we already start NO_HOT; keep it.
          // otherwise default HOT
          const ctx = inferContentContext();
          if (ctx !== "neutral") setTab("HOT");
        }
      } catch {
        if (!alive) return;
        setItems([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const filtered = React.useMemo(() => {
    const base = (items || []).slice().sort(sortByEndsAtAscNullLast);
    if (tab === "NO_HOT") return base.filter((it) => isNoHot(it));
    return base.filter((it) => !isNoHot(it));
  }, [items, tab]);

    const tabBtn = (active: boolean, kind: "HOT" | "NO_HOT") => {
    const isHot = kind === "HOT";
    const border = isHot ? "rgba(255,80,80,0.45)" : "rgba(70,210,120,0.45)";
    const bgActive = isHot ? "rgba(255,80,80,0.12)" : "rgba(70,210,120,0.12)";
    const bgIdle = "rgba(255,255,255,0.03)";
    return {
      padding: "7px 10px",
      borderRadius: 999,
      border: `1px solid ${border}`,
      background: active ? bgActive : bgIdle,
      cursor: "pointer",
      fontWeight: 900,
      fontSize: 12,
      letterSpacing: 0.2,
      userSelect: "none" as const,
    };
  };

  const go = async (it: any) => {
    const targetType = str(it?.targetType);
    const targetId = str(it?.targetId);
    const targetUrl = str(it?.targetUrl);

    const unavailable = targetType === "event" && !targetId;
    if (unavailable) return;

    try {
      if (it?._id) await api.advClick(String(it._id));
    } catch {}

    // rule: event -> /app/live/:eventId
    if (targetType === "event" && targetId) {
      nav(`/app/live/${targetId}`);
      return;
    }

    // fallback: convert /app/events/:id -> /app/live/:id
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
    <div style={{ padding: 20, maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ marginTop: 0, marginBottom: 6 }}>Promoted</h1>
          <div style={{ opacity: 0.75, fontSize: 13 }}>All active promotions.</div>
        </div>

        <div style={{ display: "inline-flex", gap: 8 }}>
          <div style={tabBtn(tab === "HOT","HOT")} onClick={() => setTab("HOT")}>
            HOT
          </div>
          <div style={tabBtn(tab === "NO_HOT","NO_HOT")} onClick={() => setTab("NO_HOT")}>
            NO_HOT
          </div>
        </div>
      </div>

      {loading ? <div style={{ opacity: 0.8, marginTop: 12 }}>Loading…</div> : null}

      {!loading && filtered.length === 0 ? (
        <div style={{ opacity: 0.8, marginTop: 12 }}>No promoted items yet.</div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 10,
            marginTop: 12,
          }}
        >
          {filtered.map((it) => {
            const targetType = str(it?.targetType);
            const targetId = str(it?.targetId);
            const unavailable = targetType === "event" && !targetId;

            const thumb = pickThumb(it);
            const username = pickUsername(it) || "Promoted";
            const description = pickDescription(it);
            const metaLine = pickPriceLabel(it); // only FREE / PAID (tab already filters HOT/NO_HOT)

            const letter = upper(username).slice(0, 1) || "P";

            return (
              <div
                key={String(it?._id || `${username}-${Math.random()}`)}
                onClick={() => go(it)}
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 14,
                  overflow: "hidden",
                  background: "rgba(255,255,255,0.03)",
                  cursor: unavailable ? "not-allowed" : "pointer",
                  opacity: unavailable ? 0.65 : 1,
                  padding: 10,
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                }}
                title={unavailable ? "Unavailable" : ""}
              >
                {/* avatar/cover */}
                {thumb ? (
                  <img
                    src={thumb}
                    alt="adv"
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 14,
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
                      borderRadius: 14,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      flex: "0 0 auto",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 1000,
                      letterSpacing: 0.5,
                      opacity: 0.9,
                    }}
                  >
                    {letter}
                  </div>
                )}

                {/* text */}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 1000,
                      lineHeight: 1.1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {username}
                  </div>

                  {unavailable ? (
                    <div style={{ marginTop: 4, fontSize: 12, opacity: 0.8 }}>Unavailable</div>
                  ) : description ? (
                    <div
                      style={{
                        marginTop: 4,
                        opacity: 0.82,
                        fontSize: 13,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {description}
                    </div>
                  ) : null}

                  <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>{metaLine}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}