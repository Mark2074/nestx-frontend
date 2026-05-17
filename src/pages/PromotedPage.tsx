import React from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/nestxApi";
import {
  EVENT_CATEGORY_OPTIONS,
  categoryMatchesSelection,
  getEventDisplayCategory,
} from "../utils/eventCategories";

type PaymentFilter = "all" | "paid" | "free";

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
  const [paymentFilter, setPaymentFilter] = React.useState<PaymentFilter>("all");
  const [categoryMenuOpen, setCategoryMenuOpen] = React.useState(false);
  const categoryMenuRef = React.useRef<HTMLDivElement | null>(null);

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

  React.useEffect(() => {
    if (!categoryMenuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const menu = categoryMenuRef.current;
      if (!menu || menu.contains(event.target as Node)) return;
      setCategoryMenuOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [categoryMenuOpen]);

  const filtered = React.useMemo(() => {
    const base = (items || []).slice().sort(sortByEndsAtAscNullLast);
    return base.filter((it) => {
      if (!categoryMatchesSelection(it, selectedCategories)) return false;

      const isPaid = pickPriceLabel(it) === "PAID";
      if (paymentFilter === "paid") return isPaid;
      if (paymentFilter === "free") return !isPaid;
      return true;
    });
  }, [items, selectedCategories, paymentFilter]);

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

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)}
            style={selectStyle}
            aria-label="Payment filter"
          >
            <option value="all">All prices</option>
            <option value="paid">Paid</option>
            <option value="free">Free</option>
          </select>

          <div ref={categoryMenuRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setCategoryMenuOpen((v) => !v)}
              style={categoryMenuButtonStyle}
              aria-expanded={categoryMenuOpen}
            >
              Category filters{selectedCategories.length ? ` (${selectedCategories.length})` : ""}
            </button>

            {categoryMenuOpen ? (
              <div style={categoryMenuStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div style={{ fontWeight: 950, fontSize: 13 }}>Categories</div>
                  <button type="button" onClick={() => setSelectedCategories([])} style={menuResetBtnStyle}>
                    Reset
                  </button>
                </div>

                <div style={{ marginTop: 8, display: "grid", gap: 4, maxHeight: 310, overflowY: "auto" }}>
                  {EVENT_CATEGORY_OPTIONS.map((item) => {
                    const active = selectedCategories.includes(item.value);
                    return (
                      <label key={item.value} style={categoryOptionStyle(active)}>
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleCategory(item.value)}
                        />
                        <span>{item.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}
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

const categoryMenuButtonStyle = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.05)",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
} as const;

const categoryMenuStyle = {
  position: "absolute",
  right: 0,
  top: "calc(100% + 8px)",
  zIndex: 20,
  width: 280,
  padding: 10,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(18,18,18,0.98)",
  boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
} as const;

const categoryOptionStyle = (active: boolean) =>
  ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 9px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 850,
    fontSize: 13,
    background: active ? "rgba(255,255,255,0.10)" : "transparent",
  } as const);

const menuResetBtnStyle = {
  padding: "5px 8px",
  borderRadius: 9,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "transparent",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 12,
} as const;

const selectStyle = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(20,20,20,0.65)",
  color: "white",
  outline: "none",
  cursor: "pointer",
  fontWeight: 900,
} as const;
