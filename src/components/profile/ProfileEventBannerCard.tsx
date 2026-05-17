import { useNavigate } from "react-router-dom";

function getEventId(item: any): string {
  return String(item?._id || item?.id || item?.eventId || "");
}

function getStatus(item: any): string {
  return String(item?.status || item?.data?.status || "scheduled").toLowerCase();
}

function getPriceTokens(item: any): number {
  const v = item?.ticketPriceTokens ?? item?.data?.ticketPriceTokens ?? item?.priceTokens ?? 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const CATEGORY_LABELS: Record<string, string> = {
  nsfw: "NSFW",
  technology_ai: "Technology & AI",
  finance_investing: "Finance & Investing",
  business: "Business & Entrepreneurship",
  science: "Science & Research",
  history_culture: "History & Culture",
  psychology: "Psychology & Mind",
  gaming: "Gaming",
  live_shows: "Live Shows",
  comedy: "Comedy",
  storytelling: "Storytelling",
  fitness: "Fitness & Health",
  food: "Food & Cooking",
  travel: "Travel",
  daily_life: "Daily Life",
  fashion: "Fashion & Style",
  tutorials: "Tutorials & How-To",
  art: "Art & Drawing",
  design: "Design & Creative",
  diy: "DIY & Makers",
  coding: "Coding & Development",
  qa_chat: "Q&A / Chat",
  community: "Community Talk",
  debate: "Opinions & Debate",
  coaching: "Advice / Coaching",
  news: "News & Commentary",
  announcements: "Events & Announcements",
  experimental: "Experimental",
};

function getCategoryLabel(item: any): string {
  const key = String(item?.category || item?.eventCategory || item?.data?.category || "")
    .trim()
    .toLowerCase();
  if (!key || key === "general") return "";
  return CATEGORY_LABELS[key] || titleCase(key.replace(/[_-]+/g, " "));
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

  const categoryLabel = getCategoryLabel(event);

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
      onClick={() => {
        if (!id) return;
        nav(`/app/live/${id}`);
      }}
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 16,
        overflow: "hidden",
        background: "rgba(255,255,255,0.04)",
        cursor: id ? "pointer" : "default",
        width: "100%",
        display: "grid",
        gridTemplateColumns: "140px 1fr",
        minHeight: 140,
      }}
    >
      <div
        style={{
          width: 140,
          height: 140,
          background: "rgba(255,255,255,0.06)",
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

      <div
        style={{
          padding: 14,
          display: "grid",
          gap: 8,
          alignContent: "center",
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontWeight: 950,
            fontSize: 13,
            color: "#ff4d4d",
            letterSpacing: 0.7,
            textTransform: "uppercase",
          }}
        >
          EVENT
        </div>

        <div
          style={{
            fontWeight: 950,
            fontSize: 16,
            lineHeight: 1.2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>

        {desc ? (
          <div
            style={{
              opacity: 0.84,
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

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
            {badge(isLive ? "LIVE" : "SCHEDULED", "live")}
          {categoryLabel ? badge(categoryLabel, "hot") : null}
            {badge(isFree ? "FREE" : "PAID", "free")}
          </div>
      </div>
    </div>
  );
}
