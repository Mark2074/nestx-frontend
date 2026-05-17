import React from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/nestxApi";
import {
  EVENT_CATEGORY_OPTIONS,
  categoryMatchesSelection,
  getEventDisplayCategory,
} from "../utils/eventCategories";

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
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const list = await api.advServe({ placement: "feed", limit: 50 });
        if (!alive) return;
        const arr = Array.isArray(list) ? list : [];
        setItems(arr);
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
    return base.filter((it) => categoryMatchesSelection(it, selectedCategories));
  }, [items, selectedCategories]);

  const toggleCategory = (value: string) => {
    setSelectedCategories((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
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

        <button type="button" onClick={() => setSelectedCategories([])} style={clearBtnStyle}>
          Reset
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        {EVENT_CATEGORY_OPTIONS.map((item) => {
          const active = selectedCategories.includes(item.value);
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => toggleCategory(item.value)}
              style={categoryFilterStyle(active)}
            >
              {item.label}
            </button>
          );
        })}
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
            const categoryLabel = getEventDisplayCategory(it);
            const metaLine = [categoryLabel, pickPriceLabel(it)].filter(Boolean).join(" - ");

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

const categoryFilterStyle = (active: boolean) =>
  ({
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: active ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.03)",
    color: "white",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
  } as const);

const clearBtnStyle = {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "transparent",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
} as const;
