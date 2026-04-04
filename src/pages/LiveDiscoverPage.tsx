import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/nestxApi";
import { COUNTRIES } from "../constants/countries";

type LiveItem = any;

type TabScope = "HOT" | "NO_HOT";

const PROFILE_TYPE_OPTIONS = ["male", "female", "couple", "gay", "trans"] as const;

const LANGUAGE_OPTIONS = ["it", "en", "fr", "de", "es", "pt", "ro", "pl"] as const;

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function formatMaybeDate(v: any) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function getEventId(item: any): string {
  return String(item?._id || item?.id || item?.eventId || "");
}

function getCreatorName(item: any): string {
  return (
    item?.creator?.username ||
    item?.creator?.displayName ||
    item?.creatorId?.username ||
    item?.creatorId?.displayName ||
    item?.creatorUsername ||
    item?.creatorDisplayName ||
    "Unknown"
  );
}

function getCreatorProfileId(item: any): string {
  return (
    item?.creator?.id ||
    item?.creator?._id ||
    item?.creatorId?._id ||
    item?.creatorId ||
    ""
  );
}

function getCreatorAvatar(item: any): string {
  return (
    item?.creator?.avatar ||
    item?.creator?.avatarUrl ||
    item?.creator?.photoUrl ||
    item?.creatorId?.avatar ||
    item?.creatorId?.avatarUrl ||
    item?.creatorAvatarUrl ||
    item?.creatorAvatar ||
    ""
  );
}

function getCover(item: any): string {
  return (
    item?.coverImage ||
    item?.coverUrl ||
    item?.cover ||
    ""
  );
}

function getPriceTokens(item: any): number {
  const v = item?.ticketPriceTokens;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function getStatus(item: any): string {
  return String(item?.status || "scheduled");
}

function getMaxSeats(item: any): number | null {
  const v =
    item?.maxSeats ??
    item?.data?.maxSeats ??
    item?.seats ??
    item?.data?.seats ??
    null;

  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export default function LiveDiscoverPage() {
  const nav = useNavigate();

  const isVip = localStorage.getItem("isVip") === "1";

  const [tab, setTab] = useState<TabScope>("NO_HOT");
  const [status, setStatus] = useState<"all" | "live" | "scheduled">("all");

  const [q, setQ] = useState("");
  const [profileType, setProfileType] = useState<string>("");
  const [country, setCountry] = useState<string>("");

  const [language, setLanguage] = useState<string>("");

  const [page, setPage] = useState(1);
  const limit = 20;

  const [items, setItems] = useState<LiveItem[]>([]);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const queryParams = useMemo(() => {
    const params: any = {
      q,
      status,
      page,
      limit,
      contentScope: tab,
    };

    if (profileType.trim()) params.profileType = profileType.trim().toLowerCase();
    if (country.trim()) params.country = country.trim().toLowerCase();

    if (isVip && language.trim()) {
      params.language = language.trim().toLowerCase();
    }

    return params;
  }, [q, status, page, limit, tab, profileType, country, language, isVip]);

  async function load() {
    setLoading(true);
    setErr("");

    try {
      const res = await api.liveSearch(queryParams);
      setItems(Array.isArray(res?.items) ? res.items : []);
      setTotal(Number(res?.total || 0));
      setLastUpdatedAt(Date.now());
    } catch (e: any) {
      setItems([]);
      setTotal(0);
      setLastUpdatedAt(Date.now());
      setErr(String(e?.message || "Failed to load live search"));
    } finally {
      setLoading(false);
    }
  }

  // reload when params change
    // reload when params change (immediate)
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryParams]);

  // auto-refresh (every 10s) only when tab is visible and not currently loading
  useEffect(() => {
    if (!autoRefresh) return;

    const tick = () => {
      if (document.visibilityState !== "visible") return;
      if (loading) return;
      load();
    };

    const id = window.setInterval(tick, 30_000);

    const onVis = () => {
      if (document.visibilityState === "visible") {
        // refresh immediately when user returns to the tab
        tick();
      }
    };

    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, loading, queryParams]);

  const canPrev = page > 1;
  const canNext = page * limit < total;

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>Live</div>
          <div style={{ opacity: 0.85, marginTop: 4 }}>
            Discover what’s live now — or scheduled next.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setTab("HOT")}
            style={tabBtnStyle(tab === "HOT")}
          >
            CAM (HOT)
          </button>
          <button
            type="button"
            onClick={() => setTab("NO_HOT")}
            style={tabBtnStyle(tab === "NO_HOT")}
          >
            EVENTS (NO_HOT)
          </button>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          marginTop: 14,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 14,
          padding: 12,
          background: "rgba(255,255,255,0.04)",
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            placeholder="Search title / creator..."
            style={inputStyle}
          />

          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as any);
            }}
            style={selectStyle}
            aria-label="Status filter"
          >
            <option value="all">Live + Scheduled</option>
            <option value="live">Live only</option>
            <option value="scheduled">Scheduled only</option>
          </select>

          <select
            value={profileType}
            onChange={(e) => {
              setPage(1);
              setProfileType(e.target.value);
            }}
            style={selectStyle}
            aria-label="Profile type filter"
          >
            <option value="">All profile types</option>
            {PROFILE_TYPE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>

          <select
            value={country}
            onChange={(e) => {
              setPage(1);
              setCountry(e.target.value);
            }}
            style={selectStyle}
            aria-label="Country filter"
          >
            <option value="">All countries</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c.toLowerCase()}>
                {c}
              </option>
            ))}
          </select>

          {isVip ? (
            <select
              value={language}
              onChange={(e) => {
                setPage(1);
                setLanguage(e.target.value);
              }}
              style={selectStyle}
              aria-label="Language filter"
            >
              <option value="">All languages</option>
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.toUpperCase()}
                </option>
              ))}
            </select>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setQ("");
              setProfileType("");
              setCountry("");
              setLanguage("");
              setStatus("all");
              setPage(1);
            }}
            style={ghostBtnStyle}
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => setAutoRefresh((v) => !v)}
            style={secondaryBtnStyle}
          >
            Auto refresh: {autoRefresh ? "ON" : "OFF"}
          </button>

          {lastUpdatedAt ? (
            <div style={{ alignSelf: "center", opacity: 0.7, fontSize: 12, fontWeight: 800 }}>
              Updated: {new Date(lastUpdatedAt).toLocaleTimeString()}
            </div>
          ) : null}
        </div>

        {err ? (
          <div style={{ marginTop: 10, color: "salmon", fontWeight: 800 }}>
            {err}
          </div>
        ) : null}
      </div>

      {/* Results */}
      <div style={{ marginTop: 14 }}>
        <div style={{ opacity: 0.85, fontSize: 13, marginBottom: 10 }}>
          Showing <b>{items.length}</b> items {total ? <>of <b>{total}</b></> : null}
        </div>

        {loading && !items.length ? (
          <div style={{ opacity: 0.85, padding: 14 }}>Loading...</div>
        ) : null}

        {!loading && !items.length ? (
          <div style={{ opacity: 0.85, padding: 14 }}>
            No results.
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(3, 1fr)",
          }}
        >
          {items.map((it: any) => {
            const id = getEventId(it);
            const title = String(it?.title || "Live");
            const creatorName = getCreatorName(it);
            const avatarUrl = getCreatorAvatar(it);
            const coverUrl = getCover(it);
            const st = getStatus(it);
            const price = getPriceTokens(it);
            const maxSeats = getMaxSeats(it);
            const scope = String(it?.contentScope || it?.data?.contentScope || tab);
            const userProfileId = getCreatorProfileId(it);

            const rawDate =
              it?.startedAt ||
              it?.startTime ||
              it?.startAt ||
              it?.createdAt ||
              it?.updatedAt;

            const when = formatMaybeDate(rawDate);

            return (
              <div
                key={id || Math.random().toString(16).slice(2)}
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 16,
                  overflow: "hidden",
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                {/* TOP: clickable -> details */}
                <div
                  onClick={() => {
                    if (!id) return;

                    try {
                      sessionStorage.setItem(
                        `nx_live_meta_${id}`,
                        JSON.stringify({
                          id,
                          title,
                          creatorName,
                          avatarUrl,
                          coverUrl,
                          status: st,
                          scope,
                          price,
                          when,
                        })
                      );
                    } catch {}

                    nav(`/app/live/${id}`);
                  }}
                  role="button"
                  tabIndex={0}
                  style={{
                    cursor: id ? "pointer" : "default",
                    display: "grid",
                    gridTemplateColumns: "1fr 92px",
                    alignItems: "stretch",
                    minHeight: 140,
                    borderBottom: "1px solid rgba(255,255,255,0.10)",
                  }}
                  title={id ? "Open live" : ""}
                >
                  {/* Avatar square (fills left) */}
                  <div
                    style={{
                      aspectRatio: "1 / 1",
                      width: "100%",
                      background: "rgba(255,255,255,0.06)",
                      borderRight: "1px solid rgba(255,255,255,0.10)",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 950,
                          opacity: 0.85,
                          fontSize: 20,
                        }}
                      >
                        {(creatorName || "U").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Badges column (right) */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      padding: 10,
                      background: "rgba(0,0,0,0.12)",
                    }}
                  >
                    <span style={badgeStyle(st === "live" ? "LIVE" : "SCHEDULED")}>
                      {st === "live" ? "LIVE" : "SCHEDULED"}
                    </span>

                    <span style={scopeBadgeStyle(scope === "HOT" ? "HOT" : "NO_HOT")}>
                      {scope === "HOT" ? "HOT" : "NO_HOT"}
                    </span>

                    <span style={priceBadgeStyle(price === 0 ? "FREE" : "PAID")}>
                      {price === 0 ? "FREE" : "PAID"}
                    </span>

                    {st !== "live" && price > 0 && maxSeats ? (
                      <span
                        style={{
                          padding: "6px 10px",
                          borderRadius: 999,
                          fontWeight: 900,
                          fontSize: 12,
                          border: "1px solid rgba(255,255,255,0.14)",
                          background: "rgba(255,255,255,0.06)",
                          opacity: 0.95,
                        }}
                        title="Max seats"
                      >
                        {maxSeats} seats
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Bottom compact section */}
                  <div style={{ padding: "10px 12px 12px 12px" }}>
                    {/* Top row: name + title */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        minWidth: 0,
                      }}
                    >
                      {/* Creator */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!userProfileId) return;
                          nav(`/app/profile/${userProfileId}`);
                        }}
                        style={{
                          border: "none",
                          background: "transparent",
                          padding: 0,
                          cursor: userProfileId ? "pointer" : "default",
                          color: "inherit",
                          fontWeight: 900,
                          fontSize: 13,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          flex: "1 1 auto",
                          textAlign: "left",
                        }}
                      >
                        {creatorName}
                      </button>

                      {/* Title */}
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          opacity: 0.85,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          flex: "0 0 auto",
                          maxWidth: "55%",
                          textAlign: "right",
                        }}
                      >
                        {title}
                      </div>
                    </div>

                    {/* Description compact */}
                    {it?.description ? (
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 12,
                          opacity: 0.75,
                          lineHeight: 1.3,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {it.description}
                      </div>
                    ) : null}
                  </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, gap: 10, flexWrap: "wrap" }}>
          <div style={{ opacity: 0.85, fontSize: 13 }}>
            Page <b>{page}</b>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              disabled={!canPrev || loading}
              onClick={() => setPage((p) => clamp(p - 1, 1, 999999))}
              style={secondaryBtnStyle}
            >
              Prev
            </button>
            <button
              type="button"
              disabled={!canNext || loading}
              onClick={() => setPage((p) => p + 1)}
              style={secondaryBtnStyle}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const tabBtnStyle = (active: boolean) =>
  ({
    padding: "10px 12px",
    borderRadius: 12,
    fontWeight: 900,
    cursor: "pointer",
    border: "1px solid rgba(255,255,255,0.14)",
    background: active ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.04)",
    color: "white",
    opacity: active ? 1 : 0.92,
  } as const);

const inputStyle = {
  flex: "1 1 280px",
  minWidth: 240,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.05)",
  color: "white",
  outline: "none",
} as const;

const selectStyle = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(20,20,20,0.65)",
  color: "white",
  outline: "none",
  cursor: "pointer",
} as const;

const secondaryBtnStyle = {
  padding: "10px 12px",
  borderRadius: 12,
  fontWeight: 900,
  cursor: "pointer",
  opacity: 0.92,
  background: "transparent",
  color: "white",
  border: "1px solid rgba(255,255,255,0.14)",
} as const;

const ghostBtnStyle = {
  padding: "10px 12px",
  borderRadius: 12,
  fontWeight: 900,
  cursor: "pointer",
  opacity: 0.85,
  background: "transparent",
  color: "white",
  border: "1px solid rgba(255,255,255,0.10)",
} as const;

const badgeStyle = (kind: "LIVE" | "SCHEDULED") =>
  ({
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: kind === "LIVE" ? "rgba(0,255,160,0.10)" : "rgba(255,255,255,0.06)",
  } as const);

const scopeBadgeStyle = (kind: "HOT" | "NO_HOT") =>
  ({
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: kind === "HOT" ? "rgba(255,80,120,0.10)" : "rgba(120,255,200,0.10)",
  } as const);

const priceBadgeStyle = (kind: "FREE" | "PAID") =>
  ({
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: kind === "FREE" ? "rgba(120,180,255,0.10)" : "rgba(255,200,120,0.10)",
  } as const);
