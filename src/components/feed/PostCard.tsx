import React from "react";
import { useNavigate } from "react-router-dom";
import { api, mapApiErrorMessage, getApiRetryAfterMs, formatRetryAfterLabel } from "../../api/nestxApi";

type PostCardProps = {
  item: any;
  me?: {
    _id: string;
    accountType?: string;
    isVip?: boolean;
  } | null;
  context?: "myPosts" | "feed" | "otherProfile";
  onPostDeleted?: (postId: string) => void;
};

function formatMaybeDate(v: any) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

const REPORT_REASON_OPTIONS = [
  { value: "minor_involved", label: "Minor involved" },
  { value: "illegal_content", label: "Illegal content" },
  { value: "violent_or_gore_content", label: "Violent or gore content" },
  { value: "violent_extremism_or_propaganda", label: "Violent extremism or propaganda" },
  { value: "harassment_or_threats", label: "Harassment or threats" },
  { value: "spam_or_scam", label: "Spam or scam" },
  { value: "impersonation_or_fake", label: "Impersonation or fake" },
  { value: "other", label: "Other" },
];

export default function PostCard({
  item,
  me,
  context,
  onPostDeleted,
}: PostCardProps) {
  const navigate = useNavigate();
  const post = item?.data ?? item;
  const postId = String(post?._id || "");
  const [likeCount, setLikeCount] = React.useState<number>(post?.likeCount ?? 0);
  const [likedByMe, setLikedByMe] = React.useState<boolean>(!!post?.likedByMe);
  const [likeBusy, setLikeBusy] = React.useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = React.useState(false);
  const [commentsBusy, setCommentsBusy] = React.useState(false);
  const [comments, setComments] = React.useState<any[]>([]);
  const [commentText, setCommentText] = React.useState("");
  const [commentCountLocal, setCommentCountLocal] = React.useState<number>(post?.commentCount ?? 0);
  const [commentErr, setCommentErr] = React.useState("");
  const [commentRetryUntil, setCommentRetryUntil] = React.useState<number | null>(null);
  const poll = post?.poll || null;
  const [viewer, setViewer] = React.useState<{ url: string; type: "image" | "video" } | null>(null);
  const [viewerIsVip, setViewerIsVip] = React.useState<boolean>(Boolean(me?.isVip));
  const [reportOpen, setReportOpen] = React.useState(false);
  const [reportReasonCode, setReportReasonCode] = React.useState("other");
  const [reportNote, setReportNote] = React.useState("");
  const [reportBusy, setReportBusy] = React.useState(false);
  const [commentReportOpen, setCommentReportOpen] = React.useState(false);
  const [commentReportTargetId, setCommentReportTargetId] = React.useState("");
  const [commentReportReasonCode, setCommentReportReasonCode] = React.useState("other");
  const [commentReportNote, setCommentReportNote] = React.useState("");
  const [commentReportBusy, setCommentReportBusy] = React.useState(false);

  // media[] (new) + legacy fallback
  const mediaItems: Array<{ type: "image" | "video"; url: string }> = React.useMemo(() => {
    const out: Array<{ type: "image" | "video"; url: string }> = [];

    const m = post?.media;
    if (Array.isArray(m)) {
      for (const it of m) {
        const url = String(it?.url || "");
        if (!url) continue;
        const type = it?.type === "video" ? "video" : "image";
        out.push({ type, url });
      }
    }

    // legacy: images/videos fields
    const legacyImages = Array.isArray(post?.images) ? post.images : [];
    for (const u of legacyImages) {
      const url = String(u || "");
      if (url) out.push({ type: "image", url });
    }

    const legacyVideos = Array.isArray(post?.videos) ? post.videos : [];
    for (const u of legacyVideos) {
      const url = String(u || "");
      if (url) out.push({ type: "video", url });
    }

    // legacy singles (best-effort)
    const img1 = String(post?.image || post?.imageUrl || "");
    if (img1) out.push({ type: "image", url: img1 });

    const vid1 = String(post?.video || post?.videoUrl || "");
    if (vid1) out.push({ type: "video", url: vid1 });

    // de-dup + max 6
    const seen = new Set<string>();
    const uniq = out.filter((x) => {
      if (!x.url || seen.has(x.url)) return false;
      seen.add(x.url);
      return true;
    });

    return uniq.slice(0, 6);
  }, [post]);

  const [pollLocal, setPollLocal] = React.useState<any>(poll);
  const [pollBusy, setPollBusy] = React.useState(false);
  const [myVoteIndex, setMyVoteIndex] = React.useState<number | null>(null);

  React.useEffect(() => {
    setPollLocal(poll);
    const initialVote = typeof poll?.myVoteIndex === "number" ? poll.myVoteIndex : null;
    setMyVoteIndex(initialVote);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post]);

  const pollEndsAt = pollLocal?.endsAt ? new Date(pollLocal.endsAt) : null;
  const pollIsClosed =
    !!pollEndsAt && !Number.isNaN(pollEndsAt.getTime()) && Date.now() >= pollEndsAt.getTime();

  const pollTotalVotes =
    pollLocal && Array.isArray(pollLocal.options)
      ? pollLocal.options.reduce((sum: number, o: any) => sum + (Number(o?.votesCount) || 0), 0)
      : 0;

  // sync commentCount tra tutte le PostCard (feed / profilo) senza refresh
  React.useEffect(() => {
    const handler = (ev: any) => {
      const detail = ev?.detail || {};
      if (String(detail.postId) !== String(postId)) return;
      if (typeof detail.commentCount === "number") setCommentCountLocal(detail.commentCount);
    };

    window.addEventListener("nestx:post-commentcount", handler as any);
    return () => window.removeEventListener("nestx:post-commentcount", handler as any);
  }, [post]);

  React.useEffect(() => {
    setCommentCountLocal(post?.commentCount ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post]);

  React.useEffect(() => {
    setLikeCount(post?.likeCount ?? 0);
    setLikedByMe(!!post?.likedByMe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, post?.likeCount, post?.likedByMe]);

  const onOpenComments = () => {
    setCommentErr("");
    setIsCommentsOpen(true);
  };

  React.useEffect(() => {
    if (typeof me?.isVip === "boolean") {
      setViewerIsVip(Boolean(me.isVip));
      return;
    }

    let alive = true;

    (async () => {
      try {
        const profile = await api.meProfile();
        if (!alive) return;
        setViewerIsVip(Boolean(profile?.isVip));
      } catch {
        if (!alive) return;
        setViewerIsVip(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [me?.isVip]);

  const onToggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!postId) return;

    // anti double-click / race
    if (likeBusy) return;
    setLikeBusy(true);

    const prevLiked = likedByMe;
    const prevCount = likeCount;

    // ✅ optimistic update immediato
    const nextLiked = !prevLiked;
    const nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1));
    setLikedByMe(nextLiked);
    setLikeCount(nextCount);

    try {
      const data = await api.togglePostLike(postId);

      // backend "nuovo" dovrebbe ritornare: { status, liked, likeCount }
      const serverCount =
        typeof data?.likeCount === "number"
          ? data.likeCount
          : typeof data?.post?.likeCount === "number"
            ? data.post.likeCount
            : null;

      const serverLiked =
        typeof data?.liked === "boolean"
          ? data.liked
          : null;

      if (typeof serverCount === "number") setLikeCount(serverCount);
      if (typeof serverLiked === "boolean") setLikedByMe(serverLiked);
    } catch (err) {
      console.warn("like error", err);
      // rollback se fallisce
      setLikedByMe(prevLiked);
      setLikeCount(prevCount);
    } finally {
      setLikeBusy(false);
    }
  };

  const onVotePoll = async (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!postId) return;
    if (!pollLocal?.question) return;
    if (pollIsClosed) return;

    const isVip = !!me?.isVip;

    // Base: se ha già votato, non può cambiare
    if (myVoteIndex !== null && myVoteIndex !== idx && !isVip) {
      alert("You can’t change your vote (VIP only).");
      return;
    }

    if (pollBusy) return;
    setPollBusy(true);

    try {
      const res: any = await api.votePoll(postId, idx);

      if (res?.poll) setPollLocal(res.poll);
      if (typeof res?.myVoteIndex === "number") setMyVoteIndex(res.myVoteIndex);
      else setMyVoteIndex(idx);
    } catch (err: any) {
      const msg =
        err?.data?.message ||
        err?.data?.error ||
        err?.message ||
        "Vote failed";
      alert(msg);
    } finally {
      setPollBusy(false);
    }
  };

  const loadComments = React.useCallback(async () => {
    if (!postId) return;
    setCommentsBusy(true);
    try {
      const data = await api.getPostComments(postId, 1, 50);
      setComments(Array.isArray(data?.items) ? data.items : []);
    } finally {
      setCommentsBusy(false);
    }
  }, [postId]);

  React.useEffect(() => {
    if (isCommentsOpen) loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCommentsOpen, loadComments]);

  const onAddComment = async () => {
    if (commentRetryUntil && Date.now() < commentRetryUntil) return;

    const t = String(commentText || "").trim();
    if (!t || !postId) return;

    setCommentsBusy(true);
    setCommentErr("");

    try {
      const data = await api.addPostComment(postId, { text: t });
      setCommentText("");

      await loadComments();

      const nextCount =
        typeof data?.commentCount === "number"
          ? data.commentCount
          : commentCountLocal + 1;

      setCommentCountLocal(nextCount);

      window.dispatchEvent(
        new CustomEvent("nestx:post-commentcount", {
          detail: { postId, commentCount: nextCount },
        })
      );
    } catch (e: any) {
      const retryAfterMs = getApiRetryAfterMs(e);
      if (retryAfterMs) {
        setCommentRetryUntil(Date.now() + retryAfterMs);
      }

      setCommentErr(
        mapApiErrorMessage(e, "Comment failed") +
          formatRetryAfterLabel(retryAfterMs)
      );
    } finally {
      setCommentsBusy(false);
    }
  };

  const onDeleteComment = async (commentId: string) => {
    if (!postId) return;

    if (!viewerIsVip) {
      alert("Only VIP users can delete comments.");
      return;
    }

    if (!confirm("Delete this comment?")) return;

    setCommentsBusy(true);
    try {
      await api.deletePostComment(postId, commentId);
      setComments((arr) =>
        arr.map((c) =>
          String(c?._id) === String(commentId)
            ? { ...c, isDeleted: true }
            : c
        )
      );

      const nextCount = Math.max(0, commentCountLocal - 1);
      setCommentCountLocal(nextCount);

      window.dispatchEvent(
        new CustomEvent("nestx:post-commentcount", {
          detail: { postId, commentCount: nextCount },
        })
      );
    } finally {
      setCommentsBusy(false);
    }
  };

  const onOpenReportPost = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!postId) return;
    setReportReasonCode("other");
    setReportNote("");
    setReportOpen(true);
  };

  const onSubmitReportPost = async () => {
    if (!postId || reportBusy) return;

    setReportBusy(true);
    try {
      await api.reportPost({
        targetPostId: postId,
        reasonCode: reportReasonCode,
        note: reportNote,
      });
      setReportOpen(false);
      alert("Report sent.");
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Report failed");
    } finally {
      setReportBusy(false);
    }
  };

  const onOpenReportComment = (commentId: string) => {
    if (!commentId) return;
    setCommentReportTargetId(String(commentId));
    setCommentReportReasonCode("other");
    setCommentReportNote("");
    setCommentReportOpen(true);
  };

  const onSubmitReportComment = async () => {
    if (!commentReportTargetId || commentReportBusy) return;

    setCommentReportBusy(true);
    try {
      await api.reportComment({
        targetCommentId: commentReportTargetId,
        reasonCode: commentReportReasonCode,
        note: commentReportNote,
      });
      setCommentReportOpen(false);
      setCommentReportTargetId("");
      alert("Report sent.");
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Report failed");
    } finally {
      setCommentReportBusy(false);
    }
  };

  const rawDate =
    item?.publishedAt ||
    post?.publishedAt ||
    post?.createdAt ||
    post?.updatedAt;

  const dateText = formatMaybeDate(rawDate);

  const authorDisplayName =
    post?.authorId?.displayName ||
    post?.authorDisplayName ||
    post?.authorId?.username ||
    post?.authorUsername ||
    "User";

  const authorUsername =
    post?.authorId?.username ||
    post?.authorUsername ||
    "";
  
  const authorId = String(
    post?.authorId?._id ||
    post?.authorId ||              // <-- se è già stringa
    post?.authorUserId ||          // <-- fallback eventuale
    post?.author?._id ||           // <-- fallback eventuale
    ""
  );
  const myUserId = String(me?._id || "");
  const isMyPost = !!myUserId && myUserId === authorId;

  const ctx = context || "feed"; // fallback: this component is mainly used in feed
  const canNavigateToProfile =
    ctx === "feed" && !!authorId && !isMyPost;

  const goToAuthorProfile = (e?: any) => {
    if (!canNavigateToProfile) return;
    if (e?.stopPropagation) e.stopPropagation();
    navigate(`/app/profile/${authorId}`);
  };

  const canDeletePost = context === "myPosts" && isMyPost;

  const moderationStatus = String(post?.moderation?.status || "visible");
  const moderationIsDeleted = post?.moderation?.isDeleted === true;
  const showUnderReviewBadge =
    isMyPost &&
    !moderationIsDeleted &&
    moderationStatus !== "visible";

  const shouldOpenPostDetail = context === "feed" || !context;
  const allowInlineMediaViewer = mediaItems.length > 1;

  const openPostDetail = () => {
    if (!postId) return;
    if (!shouldOpenPostDetail) return;
    navigate(`/app/post/${postId}`);
  };

    const onDeletePost = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!postId) return;
      if (!confirm("Delete this post?")) return;

      try {
        await api.deletePost(postId);
        onPostDeleted?.(postId);
      } catch (e: any) {
        alert(e?.response?.data?.message || e?.message || "Delete failed");
      }
    };

  const avatarUrl =
    post?.authorId?.avatar ||
    post?.authorAvatarUrl ||
    "";

  const stopCtx = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const togglePlay = (el: HTMLVideoElement | null) => {
    if (!el) return;
    try {
      if (el.paused) el.play();
      else el.pause();
    } catch {}
  };

  return (
    <div
      onClick={openPostDetail}
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 14,
        padding: 12,
        background: "rgba(255,255,255,0.03)",
        cursor: shouldOpenPostDetail ? "pointer" : "default",
      }}
    >
            <div
        onClick={goToAuthorProfile}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 8,
          cursor: canNavigateToProfile ? "pointer" : "default",
          userSelect: "none",
        }}
        title={canNavigateToProfile ? "View profile" : undefined}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            overflow: "hidden",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
            flex: "0 0 34px",
            cursor: canNavigateToProfile ? "pointer" : "default",
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : null}
        </div>

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 900,
              lineHeight: 1.1,
              cursor: canNavigateToProfile ? "pointer" : "default",
            }}
          >
            {authorDisplayName}
          </div>

          <div style={{ opacity: 0.75, fontSize: 12, marginTop: 2 }}>
            {authorUsername ? `@${authorUsername} · ` : ""}
            Post{dateText ? ` · ${dateText}` : ""}
          </div>
        </div>
      </div>
      {showUnderReviewBadge ? (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 8,
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid rgba(255,200,120,0.35)",
            background: "rgba(255,200,120,0.10)",
            color: "rgba(255,230,180,0.95)",
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          Hidden – under review
        </div>
      ) : null}
      {post.text && (
        <p style={{ margin: "8px 0", whiteSpace: "pre-wrap" }}>{post.text}</p>
      )}

      {/* Media */}
      {mediaItems.length ? (
        <div
          style={{
            marginTop: 10,
            display: "flex",
            gap: 10,
            justifyContent: mediaItems.length <= 3 ? "center" : "flex-start",
            overflowX: mediaItems.length > 3 ? "auto" : "hidden",
            paddingBottom: mediaItems.length > 3 ? 6 : 0,
          }}
        >
          {mediaItems.map((m, idx) => (
            <div
              key={`${m.url}-${idx}`}
              onContextMenu={stopCtx}
              style={{
                width: mediaItems.length === 1 ? "100%" : 260,
                height: 350,
                aspectRatio: mediaItems.length === 1 ? "4 / 3" : undefined,
                maxHeight: mediaItems.length === 1 ? 520 : undefined,
                borderRadius: 14,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.25)",
                position: "relative",
                cursor: m.type === "video" && mediaItems.length === 1 ? "default" : "pointer",
                userSelect: "none",
                flex: "0 0 auto",
              }}
              title="Open"
              onClick={() => {
                if (shouldOpenPostDetail) {
                  if (allowInlineMediaViewer) {
                    setViewer({ url: m.url, type: m.type === "video" ? "video" : "image" });
                    return;
                  }

                  openPostDetail();
                  return;
                }

                if (m.type === "image") return;
                if (m.type === "video" && mediaItems.length === 1) return;
                if (m.type === "video") setViewer({ url: m.url, type: "video" });
              }}
            >
              {m.type === "video" ? (
                mediaItems.length === 1 ? (
                  <VideoTile url={m.url} onTogglePlay={togglePlay} />
                ) : (
                  <VideoPreviewTile
                    url={m.url}
                    onOpen={() => {
                      if (shouldOpenPostDetail) {
                        if (allowInlineMediaViewer) {
                          setViewer({ url: m.url, type: "video" });
                          return;
                        }

                        openPostDetail();
                        return;
                      }

                      setViewer({ url: m.url, type: "video" });
                    }}
                    stopCtx={stopCtx}
                  />
                )
              ) : (
                <div
                  onClick={(e) => {
                    e.stopPropagation();

                    if (shouldOpenPostDetail) {
                      if (allowInlineMediaViewer) {
                        setViewer({ url: m.url, type: "image" });
                        return;
                      }

                      openPostDetail();
                      return;
                    }

                    setViewer({ url: m.url, type: "image" });
                  }}
                  onContextMenu={stopCtx}
                  style={{ display: "block", width: "100%", height: "100%" }}
                  title="Open"
                >
                  <img
                    src={m.url}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    onContextMenu={stopCtx}
                    style={{ width: "100%", height: "100%", objectFit: mediaItems.length === 1 ? "contain" : "cover", display: "block", background: "rgba(0,0,0,0.35)" }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {viewer ? (
        <div
          onClick={() => setViewer(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            onContextMenu={stopCtx}
            style={{
              width: "min(920px, 96vw)",
              maxHeight: "90vh",
              borderRadius: 16,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(20,20,20,0.98)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "flex-end", padding: 12 }}>
              <button
                onClick={() => setViewer(null)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>

            <div style={{ padding: 12 }}>
              {viewer.type === "image" ? (
                <img
                  src={viewer.url}
                  alt="preview"
                  draggable={false}
                  onContextMenu={stopCtx}
                  style={{
                    width: "100%",
                    maxHeight: "78vh",
                    objectFit: "contain",
                    display: "block",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.03)",
                  }}
                />
              ) : (
                <video
                  src={viewer.url}
                  controls
                  controlsList="nodownload"
                  onContextMenu={stopCtx}
                  style={{
                    width: "100%",
                    maxHeight: "78vh",
                    display: "block",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.03)",
                  }}
                />
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Poll */}
      {poll?.question ? (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>{poll.question}</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(Array.isArray(pollLocal?.options) ? pollLocal.options : []).map((opt: any, idx: number) => {
              const votes = Number(opt?.votesCount) || 0;
              const pct = pollTotalVotes > 0 ? Math.round((votes / pollTotalVotes) * 100) : 0;

              return (
                <div
                  key={idx}
                  onClick={(e) => onVotePoll(idx, e)}
                  style={{
                    border: myVoteIndex === idx ? "1px solid rgba(255,255,255,0.55)" : "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 12,
                    padding: 10,
                    background: "rgba(0,0,0,0.12)",
                    cursor: pollIsClosed ? "default" : "pointer",
                    opacity: pollBusy ? 0.7 : 1,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 800 }}>{opt?.text || `Option ${idx + 1}`}</div>
                    <div style={{ opacity: 0.85, fontWeight: 800 }}>
                      {pct}% · {votes}
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      height: 8,
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.10)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: "rgba(255,255,255,0.35)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 8, opacity: 0.75, fontSize: 12 }}>
            {pollIsClosed ? (
              <span>Poll closed.</span>
            ) : pollEndsAt ? (
              <span>Ends at {pollEndsAt.toLocaleString()}.</span>
            ) : (
              <span>No end date.</span>
            )}{" "}
            <span>· Total votes: {pollTotalVotes}</span>
          </div>

          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 12 }}>
            {pollIsClosed
              ? "Voting is closed."
              : myVoteIndex === null
                ? "Tap an option to vote."
                : (me?.isVip ? "Tap another option to change vote (VIP)." : "Vote submitted.")}
          </div>
        </div>
      ) : null}

      <div
        onClick={onOpenComments}
        style={{ cursor: "pointer" }}
      >
        {/* ...contenuto card... */}

        <div style={{ display: "flex", gap: 16, marginTop: 10, opacity: 0.9, fontSize: 13 }}>
          <button
            type="button"
            onClick={(e) => {
              if (isMyPost) {
                e.stopPropagation();
                return;
              }
              onToggleLike(e);
            }}
            disabled={likeBusy || isMyPost}
            style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", padding: 0 }}
            aria-label="Like"
            title={isMyPost ? "You can’t like your own post" : "Like"}
          >
            {likedByMe ? "❤️" : "🤍"} {likeCount}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenComments();
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              padding: 0,
            }}
            aria-label="Comments"
            title="Comments"
          >
            💬 {commentCountLocal}
          </button>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 8, opacity: 0.9, fontSize: 13 }}>
          {canDeletePost ? (
            <button
              type="button"
              onClick={onDeletePost}
              style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", padding: 0 }}
              title="Delete post"
            >
              🗑️ Delete
            </button>
          ) : null}

          {!isMyPost ? (
            <>
              <button
                type="button"
                onClick={onOpenReportPost}
                style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", padding: 0 }}
                title="Report post"
              >
                ⚠️ Report
              </button>
            </>
          ) : null}
        </div>
        {isCommentsOpen && (
          <div
            onClick={() => setIsCommentsOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: 16,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: 560,
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(20,20,20,0.95)",
                padding: 14,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontWeight: 900 }}>Comments</div>
                <button
                  type="button"
                  onClick={() => setIsCommentsOpen(false)}
                  style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontSize: 18 }}
                  aria-label="Close"
                  title="Close"
                >
                  ✕
                </button>
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a comment..."
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.06)",
                    color: "inherit",
                  }}
                  disabled={commentsBusy || !!(commentRetryUntil && Date.now() < commentRetryUntil)}
                />
                <button
                  type="button"
                  onClick={onAddComment}
                  disabled={
                    commentsBusy ||
                    !String(commentText || "").trim() ||
                    !!(commentRetryUntil && Date.now() < commentRetryUntil)
                  }
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Send
                </button>
              </div>

              {commentErr ? (
                <div style={{ marginBottom: 10, color: "#ffb3b3", fontWeight: 800 }}>
                  {commentErr}
                </div>
              ) : null}

              {commentsBusy ? (
                <div style={{ opacity: 0.8 }}>Loading…</div>
              ) : comments.length === 0 ? (
                <div style={{ opacity: 0.8 }}>No comments yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 420, overflow: "auto" }}>
                  {comments.map((c) => {
                    const cid = String(c?._id || "");

                    const cAuthorId = String(
                      c?.authorId?._id ||
                      c?.authorId ||
                      ""
                    );

                    const cAuthorName =
                      c?.authorId?.displayName ||
                      c?.authorId?.username ||
                      "User";

                    const cAvatar = c?.authorId?.avatar || "";

                    // ⬇️ usa SOLO il flag deciso dal backend
                    const canDelete = Boolean((c as any)?.canDelete) && viewerIsVip;

                    const commentModerationStatus = String(c?.moderation?.status || "visible");
                    const commentIsDeleted = c?.isDeleted === true || c?.moderation?.isDeleted === true;
                    const isMyComment = !!myUserId && myUserId === cAuthorId;
                    const showCommentUnderReviewBadge =
                      isMyComment &&
                      !commentIsDeleted &&
                      commentModerationStatus !== "visible";

                    return (
                      <div key={cid} style={{ border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, padding: 10 }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <div style={{ width: 28, height: 28, borderRadius: 999, overflow: "hidden", background: "rgba(255,255,255,0.08)" }}>
                            {cAvatar ? <img src={cAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
                          </div>
                          <div
                            style={{
                              fontWeight: 900,
                              fontSize: 13,
                              cursor: cAuthorId ? "pointer" : "default",
                              textDecoration: cAuthorId ? "underline" : "none",
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (cAuthorId) {
                                navigate(`/app/profile/${cAuthorId}`);
                              }
                            }}
                            title={cAuthorId ? "View profile" : undefined}
                          >
                            {cAuthorName}
                          </div>

                          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                            {!isMyComment && !c?.isDeleted ? (
                              <button
                                type="button"
                                onClick={() => onOpenReportComment(cid)}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "inherit",
                                  cursor: "pointer",
                                  opacity: 0.9,
                                }}
                                title="Report comment"
                              >
                                ⚠️
                              </button>
                            ) : null}

                            {canDelete ? (
                              <button
                                type="button"
                                onClick={() => onDeleteComment(cid)}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "inherit",
                                  cursor: "pointer",
                                  opacity: 0.9,
                                }}
                                title="Delete comment"
                              >
                                🗑️
                              </button>
                            ) : null}
                          </div>
                        </div>

                        {c?.isDeleted ? (
                          <div style={{ marginTop: 6, opacity: 0.65, fontStyle: "italic" }}>
                            Comment removed
                          </div>
                        ) : (
                          <>
                            {showCommentUnderReviewBadge ? (
                              <div
                                style={{
                                  marginTop: 6,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  padding: "5px 9px",
                                  borderRadius: 999,
                                  border: "1px solid rgba(255,200,120,0.35)",
                                  background: "rgba(255,200,120,0.10)",
                                  color: "rgba(255,230,180,0.95)",
                                  fontSize: 11,
                                  fontWeight: 800,
                                }}
                              >
                                Hidden – under review
                              </div>
                            ) : null}

                            {c?.text ? (
                              <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
                                {c.text}
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {reportOpen ? (
        <div
          onClick={() => {
            if (!reportBusy) setReportOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 460,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(20,20,20,0.98)",
              padding: 16,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 12 }}>
              Report post
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 6 }}>
                Reason
              </div>
              <select
                value={reportReasonCode}
                onChange={(e) => setReportReasonCode(e.target.value)}
                disabled={reportBusy}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                  color: "inherit",
                }}
              >
                {REPORT_REASON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 6 }}>
                Note (optional)
              </div>
              <textarea
                value={reportNote}
                onChange={(e) => setReportNote(e.target.value)}
                disabled={reportBusy}
                rows={4}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                  color: "inherit",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                disabled={reportBusy}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={onSubmitReportPost}
                disabled={reportBusy}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {reportBusy ? "Sending..." : "Send report"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {commentReportOpen ? (
        <div
          onClick={() => {
            if (!commentReportBusy) setCommentReportOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10001,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 460,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(20,20,20,0.98)",
              padding: 16,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 12 }}>
              Report comment
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 6 }}>
                Reason
              </div>
              <select
                value={commentReportReasonCode}
                onChange={(e) => setCommentReportReasonCode(e.target.value)}
                disabled={commentReportBusy}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                  color: "inherit",
                }}
              >
                {REPORT_REASON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 6 }}>
                Note (optional)
              </div>
              <textarea
                value={commentReportNote}
                onChange={(e) => setCommentReportNote(e.target.value)}
                disabled={commentReportBusy}
                rows={4}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                  color: "inherit",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setCommentReportOpen(false)}
                disabled={commentReportBusy}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={onSubmitReportComment}
                disabled={commentReportBusy}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {commentReportBusy ? "Sending..." : "Send report"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function VideoTile({
  url,
  onTogglePlay,
}: {
  url: string;
  onTogglePlay: (el: HTMLVideoElement | null) => void;
}) {
  const ref = React.useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);

    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, [url]);

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{ width: "100%", height: "100%", position: "relative", background: "black" }}
      onClick={(e) => {
        // click sul video = play/pause (senza controls => niente download in nessun browser)
        e.preventDefault();
        e.stopPropagation();
        onTogglePlay(ref.current);
      }}
      title="Play / Pause"
    >
      <video
        ref={ref}
        src={url}
        playsInline
        preload="metadata"
        controls={false}
        // IMPORTANT: contain + background black = niente crop, bande nere automatiche
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          background: "black",
          display: "block",
        }}
      />

      {/* overlay play icon */}
      {!isPlaying ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 999,
              background: "rgba(0,0,0,0.55)",
              border: "1px solid rgba(255,255,255,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: 900,
              color: "white",
            }}
          >
            ▶
          </div>
        </div>
      ) : null}
    </div>
  );
}

function VideoPreviewTile({
  url,
  onOpen,
  stopCtx,
}: {
  url: string;
  onOpen: () => void;
  stopCtx: (e: any) => void;
}) {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      onContextMenu={stopCtx}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        background: "black",
        overflow: "hidden",
      }}
      title="Open"
    >
      <video
        src={url}
        muted
        playsInline
        preload="metadata"
        onContextMenu={stopCtx}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          background: "black",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: 999,
            background: "rgba(0,0,0,0.55)",
            border: "1px solid rgba(255,255,255,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            fontWeight: 900,
            color: "white",
          }}
        >
          ▶
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 8,
          right: 8,
          padding: "4px 8px",
          borderRadius: 999,
          background: "rgba(0,0,0,0.45)",
          border: "1px solid rgba(255,255,255,0.18)",
          fontSize: 12,
          pointerEvents: "none",
        }}
      >
        Open
      </div>
    </div>
  );
}
