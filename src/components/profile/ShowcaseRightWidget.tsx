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
  return str(it?.mediaUrl) || str(it?.creatorAvatarUrl) || "";
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
function pickText(it: any) {
  return str(it?.text) || "";
}

export default function ShowcaseRightWidget() {
  const nav = useNavigate();
  const [item, setItem] = React.useState<any | null>(null);

  React.useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const it = await api.showcaseServe();
        if (!alive) return;
        setItem(it || null);
      } catch {
        if (!alive) return;
        setItem(null);
      }
    };

    load();
    const t = window.setInterval(load, 12000);

    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  const go = async () => {
    if (!item) return;

    let creatorId = str(item?.creatorId);

    try {
      if (item?._id) {
        const cid = await api.showcaseClick(String(item._id));
        if (cid) creatorId = cid;
      }
    } catch {}

    if (creatorId) nav(`/app/profile/${creatorId}`);
  };

  const thumb = item ? pickThumb(item) : "";
  const username = item ? pickUsername(item) : "Showcase";
  const title = str(item?.title);
  const text = item ? pickText(item) : "";
  const letter = upper(username).slice(0, 1) || "S";

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 14,
        background: "rgba(255,255,255,0.03)",
        padding: 10,
      }}
    >
      <div
        onClick={() => nav("/app/showcase")}
        style={{
          fontWeight: 1000,
          cursor: "pointer",
          userSelect: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
        title="Open Showcase"
      >
        Showcase <span style={{ opacity: 0.6, fontWeight: 900 }}>›</span>
      </div>

      {!item ? (
        <div style={{ marginTop: 10, opacity: 0.8, fontSize: 13 }}>No showcase items yet.</div>
      ) : (
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          <div
            onClick={go}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              cursor: "pointer",
              padding: "6px 6px",
              borderRadius: 12,
            }}
          >
            {thumb ? (
              <img
                src={thumb}
                alt="showcase"
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

              {title ? (
                <div
                  style={{
                    marginTop: 3,
                    fontSize: 12.5,
                    opacity: 0.92,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontWeight: 900,
                  }}
                >
                  {title}
                </div>
              ) : null}

              {text ? (
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
                  {text}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}