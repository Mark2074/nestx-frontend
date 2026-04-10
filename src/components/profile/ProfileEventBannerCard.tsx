import { useNavigate } from "react-router-dom";

function getEventId(item: any): string {
  return String(item?._id || item?.id || item?.eventId || "");
}

function getScope(item: any): "HOT" | "NO_HOT" {
  const scope = String(item?.contentScope || item?.data?.contentScope || item?.scope || "").toUpperCase();
  return scope === "HOT" ? "HOT" : "NO_HOT";
}

function getStatus(item: any): string {
  return String(item?.status || item?.data?.status || "scheduled").toLowerCase();
}

function getPriceTokens(item: any): number {
  const v = item?.ticketPriceTokens ?? item?.data?.ticketPriceTokens ?? item?.priceTokens ?? 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function ProfileEventBannerCard({
    event,
    profileAvatarUrl,
  }: {
    event: any;
    profileAvatarUrl?: string;
  }) {
  const nav = useNavigate();

  const id = getEventId(event);

  const pick = (...vals: any[]) => {
    for (const v of vals) {
      const s = String(v || "").trim();
      if (s) return s;
    }
    return "";
  };

  // ✅ priorità: avatar profilo → avatar creator → cover (se un giorno la useremo)
  const avatarUrl = pick(
    profileAvatarUrl,
    event?.creatorAvatarUrl,
    event?.coverUrl
  );

  const title = String(event?.title || "Live");
  const desc = String(event?.description || "");

  const status = getStatus(event);
  const isLive = status === "running" || status === "live";

  const scope = getScope(event);
  const isHot = scope === "HOT";

  const price = getPriceTokens(event);
  const isFree = price <= 0;

  function badge(text: string, tone: "live" | "hot" | "free") {
    const map: Record<string, React.CSSProperties> = {
      live: {
        border: "1px solid rgba(34,197,94,0.35)",
        background: "rgba(34,197,94,0.14)",
        color: "rgba(220,255,235,0.95)",
      },
      hot: {
        border: "1px solid rgba(239,68,68,0.35)",
        background: "rgba(239,68,68,0.14)",
        color: "rgba(255,230,230,0.95)",
      },
      free: {
        border: "1px solid rgba(99,102,241,0.35)",
        background: "rgba(99,102,241,0.14)",
        color: "rgba(235,235,255,0.95)",
      },
    };

    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "6px 10px",
          borderRadius: 999,
          fontWeight: 950,
          fontSize: 12,
          whiteSpace: "nowrap",
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          ...(map[tone] || {}),
        }}
      >
        {text}
      </span>
    );
  }

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 16,
        overflow: "hidden",
        background: "rgba(255,255,255,0.04)",
        cursor: id ? "pointer" : "default",
        width: "100%",
      }}
    >
      {/* TOP (click -> live details) */}
      <div
        onClick={() => {
          if (!id) return;
          nav(`/app/live/${id}`);
        }}
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(160px, 1fr) 132px",
          alignItems: "stretch",
          minHeight: 120,
        }}
      >
        {/* Avatar square */}
        <div
          style={{
            width: "100%",
            minHeight: 120,
            background: "rgba(255,255,255,0.06)",
            borderRight: "1px solid rgba(255,255,255,0.10)",
            overflow: "hidden",
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
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
              }}
            >
              {String(event?.creatorDisplayName || title || "U").slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        {/* Badges */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            alignItems: "center",
            justifyContent: "flex-start", // 👈 top
            padding: 10,
            background: "rgba(0,0,0,0.12)",
          }}
        >
          {/* EVENT label (red, no badge) */}
          <div
            style={{
              fontWeight: 950,
              fontSize: 16,
              letterSpacing: 0.8,
              color: "#ff4d4d",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            EVENT
          </div>

          {/* status badge */}
          {badge(isLive ? "LIVE" : "SCHEDULED", "live")}

          {/* other badges */}
          {badge(isHot ? "HOT" : "NO_HOT", "hot")}
          {badge(isFree ? "FREE" : "PAID", "free")}
        </div>
      </div>

      {/* BOTTOM compact */}
      <div style={{ padding: "10px 12px 12px 12px" }}>
        {/* Title first row (left), creator as small meta if available */}
        <div
          style={{
            fontWeight: 950,
            fontSize: 14,
            lineHeight: 1.2,
            wordBreak: "break-word",
          }}
        >
          {title}
        </div>

        {desc ? (
          <div
            style={{
              marginTop: 6,
              opacity: 0.88,
              fontSize: 13,
              lineHeight: 1.35,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {desc}
          </div>
        ) : null}
      </div>
    </div>
  );
}