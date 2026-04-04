
type MediaItem = { type: "image" | "video"; url: string };

function pickMedia(post: any): MediaItem | null {
  const out: MediaItem[] = [];

  // new: media[]
  const m = post?.media;
  if (Array.isArray(m)) {
    for (const it of m) {
      const url = String(it?.url || "").trim();
      if (!url) continue;
      const type = it?.type === "video" ? "video" : "image";
      out.push({ type, url });
    }
  }

  // legacy arrays
  const legacyImages = Array.isArray(post?.images) ? post.images : [];
  for (const u of legacyImages) {
    const url = String(u || "").trim();
    if (url) out.push({ type: "image", url });
  }

  const legacyVideos = Array.isArray(post?.videos) ? post.videos : [];
  for (const u of legacyVideos) {
    const url = String(u || "").trim();
    if (url) out.push({ type: "video", url });
  }

  // legacy singles
  const img1 = String(post?.image || post?.imageUrl || "").trim();
  if (img1) out.push({ type: "image", url: img1 });

  const vid1 = String(post?.video || post?.videoUrl || "").trim();
  if (vid1) out.push({ type: "video", url: vid1 });

  // de-dup
  const seen = new Set<string>();
  const uniq = out.filter((x) => x.url && !seen.has(x.url) && (seen.add(x.url), true));

  return uniq[0] || null;
}

export default function FedCompactPostCard({
  item,
  onOpen,
}: {
  item: any;
  onOpen?: (postId: string) => void;
}) {
  const post = item?.data ?? item;
  const postId = String(post?._id || "");
  const media = pickMedia(post);

  const authorNameRaw =
    post?.authorId?.displayName ||
    post?.authorDisplayName ||
    post?.authorId?.username ||
    post?.authorUsername ||
    "";

  const authorName = String(authorNameRaw || "").trim() || "User";

  const text = String(post?.text || "").trim();

  const handleOpen = () => {
    if (!postId) return;
    onOpen?.(postId);
  };

  return (
    <button
      type="button"
      onClick={handleOpen}
      style={{
        width: "100%",
        textAlign: "left",
        border: "none",                 // ✅ niente contorno card
        background: "transparent",      // ✅ niente card bg
        padding: 0,                     // ✅ riga compatta
        cursor: postId ? "pointer" : "default",
        color: "inherit",
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {/* thumb (come promoted) */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            overflow: "hidden",
            flex: "0 0 auto",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
            display: "grid",
            placeItems: "center",
            fontWeight: 900,
            opacity: 0.9,
          }}
        >
          {media?.type === "image" ? (
            <img
              src={media.url}
              alt=""
              draggable={false}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : media?.type === "video" ? (
            <div>🎥</div>
          ) : (
            <div style={{ opacity: 0.6 }}>—</div>
          )}
        </div>

        {/* text */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontWeight: 900,
              lineHeight: 1.1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={authorName}
          >
            {authorName}
          </div>

          {text ? (
            <div
              style={{
                marginTop: 4,
                fontSize: 13,
                opacity: 0.82,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={text}
            >
              {text}
            </div>
          ) : (
            <div style={{ marginTop: 4, fontSize: 13, opacity: 0.65 }}>
              {media ? "Media post" : "No text"}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}