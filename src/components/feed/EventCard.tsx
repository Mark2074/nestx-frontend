import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CSSProperties } from "react";
import { api } from "../../api/nestxApi";

type EventCardProps = {
  item: any;
  variant?: "scheduled" | "oldLive";
};

export default function EventCard({ item, variant = "scheduled" }: EventCardProps) {
  const nav = useNavigate();

  const baseEv = item?.data?.data ?? item?.data ?? item;
  const baseId = String(baseEv?._id || baseEv?.eventId || baseEv?.id || "");

  const [hydratedEv, setHydratedEv] = useState<any | null>(null);

  useEffect(() => {
    let alive = true;

    setHydratedEv(null);

    const hasDisplayName = !!String(baseEv?.creator?.displayName || "").trim();
    const hasAvatar = !!String(baseEv?.creator?.avatar || "").trim();

    if (!baseId || (hasDisplayName && hasAvatar)) {
      return () => {
        alive = false;
      };
    }

    (async () => {
      try {
        const full: any = await api.eventGet(baseId);
        const fullEv = full?.data ?? full?.event ?? full;

        if (!alive) return;

        setHydratedEv({
          ...baseEv,
          ...fullEv,
          creator: fullEv?.creator ?? baseEv?.creator ?? null,
          creatorId: fullEv?.creatorId ?? baseEv?.creatorId ?? null,
          creatorDisplayName: fullEv?.creatorDisplayName ?? baseEv?.creatorDisplayName,
          creatorUsername: fullEv?.creatorUsername ?? baseEv?.creatorUsername,
          creatorAvatarUrl: fullEv?.creatorAvatarUrl ?? baseEv?.creatorAvatarUrl,
        });
      } catch {
        if (!alive) return;
        setHydratedEv(baseEv);
      }
    })();

    return () => {
      alive = false;
    };
  }, [baseId, item]);

  const ev = useMemo(() => hydratedEv ?? baseEv, [hydratedEv, baseEv]);
 
  const id = String(ev?._id || ev?.eventId || ev?.id || "");
  const creatorName =
    ev?.creator?.displayName ||
    ev?.creatorId?.displayName ||
    ev?.creatorDisplayName ||
    ev?.creator?.username ||
    ev?.creatorId?.username ||
    ev?.creatorUsername ||
    "Unknown";

  const avatarUrl =
    ev?.creator?.avatar ||
    ev?.creatorId?.avatar ||
    ev?.creatorAvatarUrl ||
    "";

  const title = String(ev?.title || "Live");
  const desc = String(ev?.description || "");

  const status = String(ev?.status || "scheduled").toLowerCase();

  // badges (scheduled)
  const isLive = status === "running" || status === "live";
  const scopeRaw = String(ev?.contentScope || ev?.scope || "").toUpperCase();
  const isHot = scopeRaw === "HOT" || ev?.isHot === true;

  const price = Number(ev?.ticketPriceTokens ?? ev?.priceTokens ?? 0);
  const isFree = !Number.isFinite(price) || price <= 0;

  // --- old live fields ---
  // Preferisci data LIVE reale, poi fallback su start schedulato
  const startRaw =
    ev?.live?.startedAt ||
    ev?.startTime ||
    ev?.startedAt ||
    ev?.startAt ||
    ev?.createdAt ||
    null;

  const liveOnLabel = startRaw ? new Date(startRaw).toLocaleDateString() : null;

  const peakViewers =
    ev?.viewerCount ??
    ev?.peakViewers ??
    ev?.maxPeakViewers ??
    ev?.maxPeak ??
    ev?.peak ??
    ev?.maxViewers ??
    null;

  // image priority:
  // 1) live thumb (future)
  // 2) event cover
  // 3) creator avatar (current)
  const liveImageUrl =
    ev?.liveThumbUrl ||
    ev?.liveThumbnailUrl ||
    ev?.live?.thumbUrl ||
    ev?.live?.thumbnailUrl ||
    "";

  const coverImageUrl =
    ev?.coverImageUrl ||
    ev?.coverImage ||
    ev?.imageUrl ||
    "";

  const imageUrl =
    isLive || status === "finished" || status === "ended"
      ? (liveImageUrl || coverImageUrl || avatarUrl || "")
      : (avatarUrl || coverImageUrl || "");

  function badge(text: string, tone: "live" | "hot" | "free") {
    const map: Record<string, CSSProperties> = {
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
          letterSpacing: 0.2,
          whiteSpace: "nowrap",
          ...(map[tone] || {}),
        }}
      >
        {text}
      </span>
    );
  }

  // -------------------------
  // OLD LIVE VARIANT
  // -------------------------
  if (variant === "oldLive") {
    return (
      <div
        onClick={() => {
          // old lives: non si rientra nel live room
          return;
        }}
        role="button"
        tabIndex={0}
        style={{
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
          overflow: "hidden",
          background: "rgba(255,255,255,0.04)",
          cursor: id ? "pointer" : "default",
        }}
      >
        {/* Image (square) */}
        <div
          style={{
            width: "100%",
            aspectRatio: "1 / 1",
            background: "rgba(255,255,255,0.06)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
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
                fontSize: 28,
              }}
            >
              {(creatorName || "U").slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: "12px 12px 14px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div
              style={{
                fontWeight: 950,
                fontSize: 14,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                minWidth: 0,
                flex: "1 1 auto",
              }}
              title={title}
            >
              {title}
            </div>

            {peakViewers != null ? (
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  opacity: 0.9,
                  whiteSpace: "nowrap",
                  flex: "0 0 auto",
                }}
                title="Peak viewers"
              >
                Peak: <span style={{ fontWeight: 950 }}>{String(peakViewers)}</span>
              </div>
            ) : null}
          </div>

          {desc ? (
            <div
              style={{
                marginTop: 6,
                fontSize: 12,
                opacity: 0.78,
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

          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", opacity: 0.85, fontSize: 12 }}>
            {liveOnLabel ? <div>Live on <b>{liveOnLabel}</b></div> : null}
          </div>
        </div>
      </div>
    );
  }

  // -------------------------
  // SCHEDULED VARIANT (CURRENT)
  // -------------------------
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 16,
        overflow: "hidden",
        background: "rgba(255,255,255,0.04)",
        cursor: id ? "pointer" : "default",
      }}
    >
      {/* TOP: avatar square + badges column (click -> live details) */}
      <div
        onClick={() => {
          if (!id) return;
          nav(`/app/live/${id}`);
        }}
        role="button"
        tabIndex={0}
        style={{
          display: "grid",
          gridTemplateColumns: "84px 1fr",
          gap: 0,
          alignItems: "stretch",
          minHeight: 84,
        }}
      >
        {/* Avatar square */}
        <div
          style={{
            width: 84,
            minWidth: 84,
            height: 84,
            background: "rgba(255,255,255,0.06)",
            borderRight: "1px solid rgba(255,255,255,0.10)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
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
              }}
            >
              {(creatorName || "U").slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        <div
          style={{
            padding: "10px 12px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontWeight: 900,
                fontSize: 13,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                flex: "1 1 auto",
                textAlign: "left",
              }}
              title={creatorName}
            >
              {creatorName}
            </div>

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
              title={title}
            >
              {title}
            </div>
          </div>

          {desc ? (
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
              {desc}
            </div>
          ) : null}

          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {badge(isLive ? "EVENT LIVE" : "EVENT SCHEDULED", "live")}
            {badge(isHot ? "HOT" : "NO_HOT", "hot")}
            {badge(isFree ? "FREE" : "PAID", "free")}
          </div>
        </div>
      </div>
    </div>
  );
}