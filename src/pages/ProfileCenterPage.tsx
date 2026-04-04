import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, mapApiErrorMessage, getApiRetryAfterMs, formatRetryAfterLabel, persistLocalIdentity } from "../api/nestxApi";
import type { MeProfile, FollowRelationship, RecentReportLiveItem } from "../api/nestxApi";
import PostCard from "../components/feed/PostCard";
import EventCard from "../components/feed/EventCard";
import ProfileEventBannerCard from "../components/profile/ProfileEventBannerCard";
import type { CSSProperties } from "react";
import ProfileHeaderMy from "../components/profile/ProfileHeaderMy";
import ProfileComposer from "../components/profile/ProfileComposer";
import ProfileTabsMy from "../components/profile/ProfileTabsMy";
import ProfileEditorCard from "../components/profile/ProfileEditorCard";

type PublicProfile = {
  _id: string;
  username?: string;
  displayName?: string;
  avatar?: string; // se backend manda avatarUrl, lo mappiamo in api
  avatarUrl?: string;
  coverImage?: string;
  bio?: string;
  isPrivate: boolean;
  

  profileType?: string;
  language?: string;
  area?: string;

  followerCount?: number;
  followingCount?: number;

  isVip?: boolean;
  isVerified?: boolean;
  isCreator?: boolean;
  isCreatorMonetizable?: boolean;
  verifiedUser?: boolean;
  verificationStatus?: string; // "approved" | "pending" | ...
  verificationPublicVideoUrl?: string;
};

const REPORT_REASON_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "minor_involved", label: "Minor involved" },
  { value: "illegal_content", label: "Illegal content" },
  { value: "violent_or_gore_content", label: "Violent or gore content" },
  { value: "violent_extremism_or_propaganda", label: "Violent extremism or propaganda" },
  { value: "harassment_or_threats", label: "Harassment or threats" },
  { value: "spam_or_scam", label: "Spam or scam" },
  { value: "impersonation_or_fake", label: "Impersonation or fake" },
  { value: "other", label: "Other" },
];

function PillBadge({ children }: { children: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.18)",
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      {children}
    </span>
  );
}

function IconBadge({
  title,
  bg,
  glyph,
}: {
  title: string;
  bg: string;
  glyph: string;
}) {
  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 18,
        height: 18,
        borderRadius: "50%",
        background: bg,
        color: "#fff",
        fontSize: 12,
        fontWeight: 900,
      }}
    >
      {glyph}
    </span>
  );
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {

  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        fontWeight: 800,
        cursor: "pointer",
        border: "1px solid rgba(255,255,255,0.12)",
        background: active ? "rgba(255,255,255,0.12)" : "transparent",
        color: "white",
      }}
    >
      {label}
    </button>
  );
}

export default function ProfileCenterPage() {
  const { id } = useParams();
  const isMe = !id;

  const [me, setMe] = useState<MeProfile | null>(null);
  const [err, setErr] = useState<string>("");

  const isVip = !!me?.isVip;

  const [composerOpen, setComposerOpen] = useState(false);
  const [composerType, setComposerType] = useState<"text" | "poll">("text");
  const [composerBusy, setComposerBusy] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [composerError, setComposerError] = useState<string>("");
  const [composerRetryUntil, setComposerRetryUntil] = useState<number | null>(null);

  useEffect(() => {
    if (!isMe) return;

    const shouldOpen = sessionStorage.getItem("nx:open-edit-profile") === "1";
    if (!shouldOpen) return;

    sessionStorage.removeItem("nx:open-edit-profile");
    setIsEditingProfile(true);
    setComposerOpen(false);
  }, [isMe]);
  
  const [postText, setPostText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // poll
  const [pollQuestion, setPollQuestion] = useState("");

  useEffect(() => {
    if (composerType === "poll" && selectedFiles.length) {
      setSelectedFiles([]);
    }
  }, [composerType]);

  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [pollDays, setPollDays] = useState<number>(1);

  useEffect(() => {
    const handler = () => {
      setIsEditingProfile(true);
      setComposerOpen(false);
    };

    window.addEventListener("nx:edit-profile", handler);
    return () => window.removeEventListener("nx:edit-profile", handler);
  }, []);

  function resetComposer() {
    setComposerType("text");
    setPostText("");
    setPollQuestion("");
    setPollOptions(["", ""]);
    setPollDays(1);
    setSelectedFiles([]);
  }

  function addPollOption() {
    setPollOptions((arr) => {
      if (arr.length >= 6) return arr;
      return [...arr, ""];
    });
  }

  function removePollOption(idx: number) {
    setPollOptions((arr) => {
      if (arr.length <= 2) return arr;
      return arr.filter((_, i) => i !== idx);
    });
  }

  function updatePollOption(idx: number, val: string) {
    setPollOptions((arr) => arr.map((x, i) => (i === idx ? val : x)));
  }

  async function handleSubmitPost() {
    if (composerBusy) return;
    if (composerRetryUntil && Date.now() < composerRetryUntil) return;
    setComposerBusy(true);
    setComposerError("");

    try {
      if (composerType === "text") {
        const t = String(postText || "").trim();
        const files = (Array.isArray(selectedFiles) ? selectedFiles : []).slice(0, 3);

        if (!t && !files.length) {
          setComposerError("Text or media is required.");
          return;
        }

        // ✅ upload media first (max 3)
        let media: Array<{ type: "image" | "video"; url: string }> = [];
        if (files.length) {
          try {
            media = await api.uploadPostMedia(files);
          } catch (e: any) {
            setComposerError(e?.message || "Media upload failed");
            return;
          }
        }

        await api.createPost({ text: t, media });
        resetComposer();
        setComposerOpen(false);
        window.dispatchEvent(new Event("nx:posts-updated"));
        return;
      }

      // poll
      if (selectedFiles.length) {
        setComposerError("Poll posts can’t include media.");
        return;
      }

      if (!isVip) {
        setComposerError("Polls are a VIP feature.");
        return;
      }

      const q = String(pollQuestion || "").trim();
      const opts = (pollOptions || []).map((x) => String(x || "").trim()).filter(Boolean);

      if (!q) {
        setComposerError("Question is required.");
        return;
      }
      if (opts.length < 2) {
        setComposerError("Add at least 2 options.");
        return;
      }
      if (opts.length > 6) {
        setComposerError("Max 6 options.");
        return;
      }

      const days = Math.min(7, Math.max(1, Number(pollDays) || 1));

      await api.createPost({
        text: String(postText || "").trim(), // optional
        poll: {
          question: q,
          options: opts,
          durationDays: days,
        },
      });

      resetComposer();
      setComposerOpen(false);
      window.dispatchEvent(new Event("nx:posts-updated"));
    } catch (e: any) {
      const retryAfterMs = getApiRetryAfterMs(e);
      if (retryAfterMs) {
        setComposerRetryUntil(Date.now() + retryAfterMs);
      }

      setComposerError(
        mapApiErrorMessage(e, "Failed to create post") +
          formatRetryAfterLabel(retryAfterMs)
      );
    } finally {
      setComposerBusy(false);
    }
  }
  
  useEffect(() => {
    async function load() {
      setErr("");
      setMe(null);

      if (!isMe) return;

      try {
        const raw = await api.meProfile();

        // supporta sia {status:"ok", profile:{...}} che payload diretto
        const profile = (raw as any)?.profile ?? raw;

        setMe(profile as MeProfile);
        persistLocalIdentity(profile as MeProfile);
      } catch (e: any) {
        setErr("error");
      }
    }
    load();
  }, [isMe]);

  // --- profilo altrui ---
  if (!isMe) {
    return <OtherProfileView userId={String(id)} />;
  }

  // --- error ---
  if (err) {
    return (
      <div style={{ padding: 20 }}>
        <h1>My Profile</h1>
        <p style={{ color: "#ffb3b3" }}>Errore: {err}</p>
        <p>
          Go to <b>/auth</b> to login.
        </p>
      </div>
    );
  }

  // --- loading ---
  if (!me) {
    return (
      <div style={{ padding: 20 }}>
        <h1>My Profile</h1>
        <p>Caricamento profilo…</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 820, margin: "0 auto" }}>
      <ProfileHeaderMy
        me={me}
        setMe={setMe}
        composerOpen={composerOpen}
        setComposerOpen={setComposerOpen}
        resetComposer={resetComposer}
      />

      {isEditingProfile && (
        <ProfileEditorCard
          me={me}
          setMe={setMe}
          onClose={() => setIsEditingProfile(false)}
        />
      )}

      {!isEditingProfile && (
        <>
          {/* Composer */}
          <ProfileComposer
            composerOpen={composerOpen}
            composerType={composerType}
            setComposerType={setComposerType}
            composerBusy={composerBusy || !!(composerRetryUntil && Date.now() < composerRetryUntil)}
            handleSubmitPost={handleSubmitPost}
            resetComposer={resetComposer}
            setComposerOpen={setComposerOpen}
            isVip={isVip}
            postText={postText}
            setPostText={setPostText}
            pollQuestion={pollQuestion}
            setPollQuestion={setPollQuestion}
            pollOptions={pollOptions}
            pollDays={pollDays}
            setPollDays={setPollDays}
            addPollOption={addPollOption}
            removePollOption={removePollOption}
            updatePollOption={updatePollOption}
            selectedFiles={selectedFiles}
            setSelectedFiles={setSelectedFiles}
            composerError={composerError}
            setComposerError={setComposerError}
          />
          {/* Tabs */}
          <ProfileTabsMy me={me} />
        </>
      )}
    </div>
  );
}

function OtherProfileView({ userId }: { userId: string }) {
  const [p, setP] = useState<PublicProfile | null>(null);
  const [rel, setRel] = useState<FollowRelationship>("none");
  const [err, setErr] = useState<string>("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const navigate = useNavigate();
  const [reportUserOpen, setReportUserOpen] = useState(false);
  const [reportUserReasonCode, setReportUserReasonCode] = useState("other");
  const [reportUserNote, setReportUserNote] = useState("");
  const [reportUserBusy, setReportUserBusy] = useState(false);
  const [reportRecentLives, setReportRecentLives] = useState<RecentReportLiveItem[]>([]);
  const [reportRecentLivesLoading, setReportRecentLivesLoading] = useState(false);
  const [reportSelectedEventId, setReportSelectedEventId] = useState<string>("");
    // --- DONATE modal state ---
  const [donateOpen, setDonateOpen] = useState(false);
  const [donateAmount, setDonateAmount] = useState<string>("10");
  const [donateBusy, setDonateBusy] = useState(false);
  const [donateError, setDonateError] = useState<string>("");

  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const [verifOpen, setVerifOpen] = useState(false);
  const [reportMode, setReportMode] = useState<"generic" | "live">("generic");
  
  const menuItemStyle: CSSProperties = {
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    fontWeight: 800,
    cursor: "pointer",
    border: "none",
    background: "transparent",
    color: "white",
  };

  const isBlocked = rel === "blocked_by_me" || rel === "blocked_me";

  const canSeePosts = useMemo(() => {
    if (!p) return false;
    if (isBlocked) return false;
    if (isMuted) return false;

    if (rel === "accepted") return true;
    if (rel === "none" && p.isPrivate === false) return true;

    return false;
  }, [p, rel, isBlocked, isMuted]);

  const canSeeEventCard = useMemo(() => {
    if (!p) return false;
    if (isBlocked) return false;
    if (isMuted) return false;
    // se profilo pubblico: visibile anche senza follow
    if (p.isPrivate === false) return true;
    // se privato: solo accepted
    return rel === "accepted";
  }, [p, rel, isBlocked, isMuted]);
  const canSeeOldLive = useMemo(() => rel === "accepted", [rel]);

  function normalizeRelStatus(raw: any): FollowRelationship {
    const s = String(raw || "").toLowerCase();

    if (s === "pending" || s === "requested" || s === "request_sent" || s === "outgoing_pending") return "pending";
    if (s === "accepted" || s === "following") return "accepted";
    if (s === "none" || s === "not_following") return "none";
    if (s === "blocked_by_me") return "blocked_by_me";
    if (s === "blocked_me") return "blocked_me";

    // fallback: non rompere UI
    return "none";
  }

  function fmtRecentLiveDate(dt?: string | null) {
    if (!dt) return "—";
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  }

  useEffect(() => {
    async function load() {
      setErr("");
      setP(null);
      setRel("none");
      setNotFound(false);
      setForbidden(false);

      try {
        // 1) profilo pubblico
        const prof = await api.publicProfile(userId);
        setP(prof);

        // 2) relationship
        const r = await api.followRelationship(userId);
        setRel(normalizeRelStatus(r?.status));
        try {
          const res: any = await api.mutedList(); // ora {status, data:[{id,...}]}
          const list = Array.isArray(res) ? res : (res?.data || []);
          const ids = list.map((x: any) => String(x?.id ?? x?._id ?? x)).filter(Boolean);
          setIsMuted(ids.includes(String(userId)));
        } catch {
          setIsMuted(false);
        }
      } catch (e: any) {
        const status =
          e?.response?.status ||
          e?.status ||
          e?.data?.statusCode ||
          e?.cause?.response?.status;

        if (status === 404) {
          setErr("");
          setNotFound(true);
          return;
        }
        if (status === 403) {
          setErr("");
          setForbidden(true);
          return;
        }

        setErr("error");
      }
    }
    load();
  }, [userId]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (t?.closest?.("[data-menu-root='actions']")) return;
      setIsMenuOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  async function refreshRelationshipAndProfile() {
    const [r, prof] = await Promise.all([
      api.followRelationship(userId),
      api.publicProfile(userId),
    ]);
    const status = normalizeRelStatus(r?.status);
    setRel(status);
    setP(prof);
  }

  async function handleMuteToggle() {
    try {
      if (isMuted) {
        await api.unmuteUser(userId);
        setIsMuted(false);
      } else {
        await api.muteUser(userId);
        setIsMuted(true);
      }
    } catch (e: any) {
      alert("Mute failed");
    }
  }

  async function handleFollow() {
    try {
      await api.followUser(userId);
      await refreshRelationshipAndProfile();
    } catch (e: any) {
      alert("Follow failed");
    }
  }

  async function handleCancelRequest() {
    if (!confirm("Annullare la richiesta di follow?")) return;
    try {
      await api.cancelFollowRequest(userId);
      // aggiorna relazione + profilo
      await refreshRelationshipAndProfile();
    } catch (e: any) {
      alert("Cancel request failed");
    }
  }

  async function handleUnfollow() {
    if (!confirm("Unfollow this user?")) return;
    try {
      await api.unfollowUser(userId);
      await refreshRelationshipAndProfile();
    } catch (e: any) {
      alert("Unfollow failed");
    }
  }

  function handleMessage() {
    navigate(`/app/chat?user=${encodeURIComponent(String(userId))}`);
  }

  function handleDonate() {
    // recipient must be VIP (target profile)
    if (!p?.isVip) {
      alert("You can only donate to VIP profiles.");
      return;
    }

    setDonateError("");
    setDonateAmount("10");
    setDonateOpen(true);
  }

  async function confirmDonate() {
    if (donateBusy) return;

    setDonateError("");

    if (!p?.isVip) {
      setDonateError("You can only donate to VIP profiles.");
      return;
    }

    const amt = Math.floor(Number(donateAmount));
    if (!Number.isFinite(amt) || amt <= 0) {
      setDonateError("Invalid amount.");
      return;
    }

    setDonateBusy(true);
    try {
      await api.donateTokens(userId, amt);

      setDonateOpen(false);
      setDonateAmount("10");
      alert("Donation sent.");
    } catch (err: any) {
      const retryAfterMs = getApiRetryAfterMs(err);
      setDonateError(
        mapApiErrorMessage(err, "Donation failed.") +
          formatRetryAfterLabel(retryAfterMs)
      );
    } finally {
      setDonateBusy(false);
    }
  }

  async function handleBlockToggle() {
    if (!confirm("Block this user?")) return;

    try {
      await api.blockUser(userId);

      // ✅ FIX: non restare su /profile/:id dopo block (evita fetch 403/404 → "Errore: error" e "Action failed")
      navigate("/app/profile", { replace: true });
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        "Action failed";
      alert(msg);
    }
  }

  async function handleOpenReport() {
    setReportMode("generic");
    setReportUserReasonCode("other");
    setReportUserNote("");
    setReportSelectedEventId("");
    setReportRecentLives([]);
    setReportUserOpen(true);

    try {
      setReportRecentLivesLoading(true);
      const items = await api.reportRecentLives(userId, 10);
      setReportRecentLives(Array.isArray(items) ? items : []);
    } catch {
      setReportRecentLives([]);
    } finally {
      setReportRecentLivesLoading(false);
    }
  }

  async function handleSubmitReport() {
    if (reportUserBusy) return;

    setReportUserBusy(true);
    try {
      await api.reportUser({
        targetUserId: userId,
        reasonCode: reportUserReasonCode,
        note: reportUserNote,
        contextType: reportMode === "live" && reportSelectedEventId ? "live" : null,
        contextId: reportMode === "live" && reportSelectedEventId ? reportSelectedEventId : null,
      });
      setReportUserOpen(false);
      alert("Report sent.");
    } catch (e: any) {
      console.error("REPORT_USER_FAILED", e);
      alert(e?.message || "Report failed");
    } finally {
      setReportUserBusy(false);
    }
  }

  if (notFound) {
    return (
      <div style={{ padding: 20, maxWidth: 820, margin: "0 auto" }}>
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 16,
            padding: 16,
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Account not found</h2>
          <p style={{ opacity: 0.85 }}>
            This account is no longer available.
          </p>
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div style={{ padding: 20, maxWidth: 820, margin: "0 auto" }}>
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 16,
            padding: 16,
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Profile not available</h2>
          <p style={{ opacity: 0.85 }}>
            You can’t access this profile.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => navigate("/app/home")}
              style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 800, cursor: "pointer" }}
            >
              Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- error ---
  if (err) {
    return (
      <div style={{ padding: 20, maxWidth: 820, margin: "0 auto" }}>
        <h1>Profilo utente</h1>
        <p style={{ color: "#ffb3b3" }}>Errore: {err}</p>
      </div>
    );
  }

  // --- loading ---
  if (!p) {
    return (
      <div style={{ padding: 20, maxWidth: 820, margin: "0 auto" }}>
        <h1>Profilo utente</h1>
        <p>Caricamento profilo…</p>
      </div>
    );
  }

  // --- blocked ---
  if (isBlocked) {
    return (
      <div style={{ padding: 20, maxWidth: 820, margin: "0 auto" }}>
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 16,
            padding: 16,
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Profilo non disponibile</h2>
          <p style={{ opacity: 0.85 }}>
            {rel === "blocked_me"
              ? "You can’t view this profile."
              : "You blocked this user."}
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {rel === "blocked_by_me" ? (
              <button
                onClick={handleBlockToggle}
                style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 800, cursor: "pointer" }}
              >
                Sblocca
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const cover = p.coverImage || "";
  const avatar = (p.avatarUrl || p.avatar) || "";
  const name = p.displayName || p.username || "Senza nome";
  const verificationUrl = String((p as any)?.verificationPublicVideoUrl || "").trim();
  const canShowVerificationVideo =
    Boolean(p?.isVerified) &&
    String(p?.verificationStatus || "").toLowerCase() === "approved" &&
    !!verificationUrl;

  const followerCount = p.followerCount ?? 0;
  const followingCount = p.followingCount ?? 0;

  return (
    <div style={{ padding: 20, maxWidth: 820, margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
          overflow: "hidden",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        {/* Cover */}
        <div style={{ height: 160, background: "rgba(255,255,255,0.06)" }}>
          {cover ? (
            <img
              src={cover}
              alt="cover"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : null}
        </div>

        {/* Avatar + info */}
        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: 16,
                overflow: "hidden",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                marginTop: -48,
              }}
            >
              {avatar ? (
                <img
                  src={avatar}
                  alt="avatar"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : null}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <h2 style={{ margin: 0 }}>{name}</h2>

                {p.isVip ? <PillBadge>VIP</PillBadge> : null}
                {(p.isVerified || (p as any)?.verifiedUser) ? (
                  <IconBadge title="Verified" bg="#2ecc71" glyph="✓" />
                ) : null}
                {p.isCreator ? <IconBadge title="Creator" bg="#3498db" glyph="★" /> : null}
                {p.isCreatorMonetizable ? (
                  <IconBadge title="Payout approved" bg="#16a34a" glyph="$" />
                ) : null}
                {p.isPrivate ? <PillBadge>PRIVATE</PillBadge> : null}

                {/* menu azioni (unificato) */}
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                  {/* Verification video preview (public only if verified) */}
                  {canShowVerificationVideo ? (
                    <button
                      type="button"
                      onClick={() => setVerifOpen(true)}
                      title="Verification video"
                      style={{
                        width: 96,
                        height: 96,
                        borderRadius: 16,
                        overflow: "hidden",
                        padding: 0,
                        border: "1px solid rgba(255,255,255,0.22)",
                        background: "rgba(255,255,255,0.06)",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <video
                        src={verificationUrl}
                        muted
                        playsInline
                        preload="metadata"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    </button>
                  ) : null}

                  {/* menu azioni (unificato) */}
                  <div data-menu-root="actions" style={{ position: "relative" }}>
                    <button
                      onClick={() => setIsMenuOpen((v) => !v)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        fontWeight: 900,
                        cursor: "pointer",
                        opacity: 0.9,
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "rgba(255,255,255,0.06)",
                        color: "white",
                      }}
                      title="Actions"
                    >
                      ⋯
                    </button>

                    {isMenuOpen ? (
                      <div
                        style={{
                          position: "absolute",
                          right: 0,
                          top: "calc(100% + 8px)",
                          minWidth: 180,
                          zIndex: 50,
                          border: "1px solid rgba(255,255,255,0.14)",
                          background: "rgba(20,20,20,0.96)",
                          borderRadius: 12,
                          overflow: "hidden",
                          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                        }}
                      >
                        <button
                          onClick={() => {
                            setIsMenuOpen(false);
                            handleBlockToggle();
                          }}
                          style={menuItemStyle}
                        >
                          {rel === ("blocked_by_me" as FollowRelationship) ? "Unblock" : "Block"}
                        </button>

                        <button
                          onClick={() => {
                            setIsMenuOpen(false);
                            handleMuteToggle();
                          }}
                          style={menuItemStyle}
                        >
                          {isMuted ? "Unmute" : "Mute"}
                        </button>

                        <button
                          onClick={() => {
                            setIsMenuOpen(false);
                            handleOpenReport();
                          }}
                          style={menuItemStyle}
                        >
                          Report
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

              </div>

              <div style={{ marginTop: 6, opacity: 0.85, display: "flex", gap: 12, flexWrap: "wrap" }}>
                {p.profileType ? <span>Tipo: {p.profileType}</span> : null}
                {p.language ? <span>Lingua: {p.language}</span> : null}
                {p.area ? <span>Area: {p.area}</span> : null}
              </div>

              {p.bio ? (
                <p style={{ marginTop: 10, marginBottom: 0, whiteSpace: "pre-wrap" }}>
                  {p.bio}
                </p>
              ) : (
                <p style={{ marginTop: 10, marginBottom: 0, opacity: 0.6 }}>
                  Nessuna bio.
                </p>
              )}

              {/* Messaggi privacy/pending */}
              {p.isPrivate && rel === "pending" ? (
                <p style={{ marginTop: 10, opacity: 0.9 }}>
                  <b>Richiesta di follow inviata</b> · Questo profilo è privato
                </p>
              ) : p.isPrivate && rel === "none" ? (
                <p style={{ marginTop: 10, opacity: 0.9 }}>
                  <b>Questo profilo è privato</b>
                </p>
              ) : null}
            </div>
          </div>

          {/* Contatori */}
          <div style={{ marginTop: 14, display: "flex", gap: 18 }}>
            <div>
              <b>{followerCount}</b> follower
            </div>
            <div>
              <b>{followingCount}</b> following
            </div>
          </div>

          {/* CTA profilo altrui */}
          <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>

            {rel === "none" ? (
              <button
                onClick={handleFollow}
                style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 800, cursor: "pointer" }}
              >
                Follow
              </button>
            ) : rel === "pending" ? (
              <button
                onClick={handleCancelRequest}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                  opacity: 0.9,
                }}
                title="Annulla richiesta di follow"
              >
                Richiesta inviata · Annulla
              </button>
            ) : rel === "accepted" ? (
              <button
                onClick={handleUnfollow}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                  opacity: 0.95,
                }}
              >
                Unfollow
              </button>
            ) : null}

            <button
              onClick={handleMessage}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                fontWeight: 800,
                cursor: "pointer",
                opacity: 0.95,
              }}
            >
              Message
            </button>

            {/* Donate (only if target profile is VIP) */}
            {p?.isVip ? (
            <button
              type="button"
              onClick={handleDonate}
              title="Donate Tokens"
              style={{
                marginLeft: "auto",
                width: 48,
                height: 44,
                borderRadius: 12,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                lineHeight: 0,
                background: "rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.22)",
                color: "rgba(255,255,255,0.92)",
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                aria-hidden="true"
                style={{ display: "block" }}
              >
                <circle
                  cx="12"
                  cy="12"
                  r="8.5"
                  fill="rgba(255,255,255,0.06)"
                  stroke="rgba(255,255,255,0.70)"
                  strokeWidth="1.8"
                />
                <path
                  d="M9 10h6M10 13.2h4"
                  stroke="rgba(255,255,255,0.85)"
                  strokeWidth="2.0"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            ) : null}
          </div>
          {/* Donate Modal */}
          {donateOpen ? (
            <div
              onClick={() => {
                if (!donateBusy) setDonateOpen(false);
              }}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.55)",
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
                overflowY: "auto",
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "min(420px, calc(100vw - 32px))",
                  boxSizing: "border-box",
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(20,20,20,0.98)",
                  padding: 16,
                  boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
                  color: "white",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>Donate tokens</div>
                  <div
                    style={{
                      marginLeft: "auto",
                      opacity: 0.8,
                      fontSize: 12,
                      maxWidth: 180,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      textAlign: "right",
                    }}
                    title={p?.displayName || p?.username || "VIP"}
                  >
                    to <b>{p?.displayName || p?.username || "VIP"}</b>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <label style={{ display: "block", fontWeight: 800, fontSize: 12, opacity: 0.9 }}>
                    Amount (tokens)
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={donateAmount}
                    disabled={donateBusy}
                    onChange={(e) => setDonateAmount(e.target.value)}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      marginTop: 6,
                      padding: "12px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.16)",
                      background: "rgba(255,255,255,0.06)",
                      color: "white",
                      fontWeight: 800,
                      outline: "none",
                    }}
                  />

                  {donateError ? (
                    <div style={{ marginTop: 10, color: "#ffb3b3", fontWeight: 800, fontSize: 13 }}>
                      {donateError}
                    </div>
                  ) : null}
                </div>

                <div style={{ marginTop: 14, display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    disabled={donateBusy}
                    onClick={() => setDonateOpen(false)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      fontWeight: 900,
                      cursor: donateBusy ? "not-allowed" : "pointer",
                      border: "1px solid rgba(255,255,255,0.14)",
                      background: "transparent",
                      color: "white",
                      opacity: donateBusy ? 0.6 : 0.95,
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={
                      donateBusy ||
                      !p?.isVip ||
                      !Number.isFinite(Number(donateAmount)) ||
                      Math.floor(Number(donateAmount)) <= 0
                    }
                    onClick={confirmDonate}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      fontWeight: 900,
                      cursor:
                        donateBusy ||
                        !p?.isVip ||
                        !Number.isFinite(Number(donateAmount)) ||
                        Math.floor(Number(donateAmount)) <= 0
                          ? "not-allowed"
                          : "pointer",
                      border: "1px solid rgba(255,255,255,0.14)",
                      background: "rgba(255,255,255,0.12)",
                      color: "white",
                      opacity:
                        donateBusy ||
                        !p?.isVip ||
                        !Number.isFinite(Number(donateAmount)) ||
                        Math.floor(Number(donateAmount)) <= 0
                          ? 0.6
                          : 1,
                    }}
                  >
                    {donateBusy ? "Sending…" : "Send"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Verification Video Modal */}
      {verifOpen ? (
        <div
          onClick={() => setVerifOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(720px, calc(100vw - 32px))",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(20,20,20,0.98)",
              padding: 12,
              boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
            }}
          >
            <video
              src={verificationUrl}
              controls
              autoPlay
              style={{
                width: "100%",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.03)",
              }}
            />
          </div>
        </div>
      ) : null}

      {reportUserOpen ? (
        <div
          onClick={() => {
            if (!reportUserBusy) setReportUserOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 460,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(20,20,20,0.98)",
              padding: 16,
              boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 12 }}>
              Report user
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 6 }}>
                Reason
              </div>
              <select
                value={reportUserReasonCode}
                onChange={(e) => setReportUserReasonCode(e.target.value)}
                disabled={reportUserBusy}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
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
                Report type
              </div>

              <select
                value={reportMode}
                onChange={(e) => {
                  const next = e.target.value === "live" ? "live" : "generic";
                  setReportMode(next);
                  if (next !== "live") {
                    setReportSelectedEventId("");
                  }
                }}
                disabled={reportUserBusy}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                }}
              >
                <option value="generic">Generic user report</option>
                <option value="live">Specific live</option>
              </select>
            </div>

            {reportMode === "live" ? (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 6 }}>
                  Related live
                </div>

                {reportRecentLivesLoading ? (
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.04)",
                      opacity: 0.85,
                    }}
                  >
                    Loading recent lives...
                  </div>
                ) : reportRecentLives.length === 0 ? (
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.04)",
                      opacity: 0.78,
                    }}
                  >
                    No recent lives in the last 7 days.
                  </div>
                ) : (
                  <select
                    value={reportSelectedEventId}
                    onChange={(e) => setReportSelectedEventId(e.target.value)}
                    disabled={reportUserBusy}
                    size={Math.min(reportRecentLives.length, 6)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.06)",
                      color: "white",
                      minHeight: 180,
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="">Select a live</option>
                    {reportRecentLives.map((live) => {
                      const start = live.startAt ? fmtRecentLiveDate(live.startAt) : "—";
                      const title = live.title || "Untitled live";
                      const type = String(live.type || "public");

                      return (
                        <option key={live.eventId} value={live.eventId}>
                          {title} | {type} | {start}
                        </option>
                      );
                    })}
                  </select>
                )}

                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.72 }}>
                  Select the related live event.
                </div>
              </div>
            ) : null}

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 6 }}>
                Note (optional)
              </div>
              <textarea
                value={reportUserNote}
                onChange={(e) => setReportUserNote(e.target.value)}
                disabled={reportUserBusy}
                rows={4}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setReportUserOpen(false)}
                disabled={reportUserBusy}
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
                onClick={handleSubmitReport}
                disabled={reportUserBusy}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {reportUserBusy ? "Sending..." : "Send report"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Tabs profilo altrui */}
      <OtherProfileTabs
        userId={userId}
        userName={String(p?.username || p?.displayName || "This user")}
        canSeePosts={canSeePosts}
        canSeeEventCard={canSeeEventCard}
        canSeeOldLive={canSeeOldLive}
        profileAvatarUrl={avatar}
      />
    </div>
    
  );
}

function OtherProfileTabs({
  userId,
  userName,
  canSeePosts,
  canSeeEventCard,
  canSeeOldLive,
  profileAvatarUrl,
}: {
  userId: string;
  userName?: string;
  canSeePosts: boolean;
  canSeeEventCard: boolean;
  canSeeOldLive: boolean;
  profileAvatarUrl?: string;
}) {
  const [tab, setTab] = useState<"posts" | "oldLive">("posts");

  const [posts, setPosts] = useState<any[] | null>(null);
  const [postsErr, setPostsErr] = useState<string>("");
  const userLabel = String(userName || "This user");

  const [bannerEvent, setBannerEvent] = useState<any | null>(null);

  const [oldLive, setOldLive] = useState<any[] | null>(null);
  const [oldLiveErr, setOldLiveErr] = useState<string>("");
  const [hasOldLive, setHasOldLive] = useState<boolean>(false);

  // banner evento: SOLO se accepted (da memo)
  useEffect(() => {
    async function loadBanner() {
      if (tab !== "posts") return;
      if (!canSeeEventCard) {
        setBannerEvent(null);
        return;
      }
      try {
        const ev = await api.profileEventBanner(userId);
        setBannerEvent(ev);
      } catch {
        setBannerEvent(null);
      }
    }
    loadBanner();
  }, [tab, userId, canSeeEventCard]);

  // posts altri utenti
  useEffect(() => {
    async function loadPosts() {
      if (tab !== "posts") return;
      setPostsErr("");
      setPosts(null);

      if (!canSeePosts) {
        setPosts([]);
        return;
      }

      try {
        const data = await api.userPosts(userId);
        setPosts(data);
      } catch (e: any) {
        setPostsErr("error");
      }
    }
    loadPosts();
  }, [tab, userId, canSeePosts]);

  // old live tab visibility probe (solo se accepted)
  useEffect(() => {
    async function probeOldLive() {
      if (!canSeeOldLive) {
        setHasOldLive(false);
        return;
      }
      try {
        const items = await api.oldLive(userId);
        setHasOldLive(items.length > 0);
      } catch {
        setHasOldLive(false);
      }
    }
    probeOldLive();
  }, [userId, canSeeOldLive]);

  // old live load
  useEffect(() => {
    async function loadOldLive() {
      if (tab !== "oldLive") return;
      setOldLiveErr("");
      setOldLive(null);

      if (!canSeeOldLive) {
        setOldLive([]);
        return;
      }

      try {
        const items = await api.oldLive(userId);
        setOldLive(items);
      } catch (e: any) {
        setOldLiveErr("error");
      }
    }
    loadOldLive();
  }, [tab, userId, canSeeOldLive]);

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <TabButton active={tab === "posts"} label="Posts" onClick={() => setTab("posts")} />
        {hasOldLive ? (
          <TabButton active={tab === "oldLive"} label="Old Live" onClick={() => setTab("oldLive")} />
        ) : null}
      </div>

      <div style={{ marginTop: 14 }}>
        {tab === "posts" ? (
          <div>
            {bannerEvent ? (
              <div style={{ marginBottom: 12 }}>
                <ProfileEventBannerCard event={bannerEvent} profileAvatarUrl={profileAvatarUrl || ""} />
              </div>
            ) : null}

            {!canSeePosts ? (
              <p style={{ opacity: 0.8 }}>{userLabel} hasn’t posted anything yet.</p>
            ) : postsErr ? (
              <p style={{ color: "#ffb3b3" }}>Errore Post: {postsErr}</p>
            ) : posts === null ? (
              <p>Loading posts…</p>
            ) : posts.length === 0 ? (
              <p style={{ opacity: 0.8 }}>{userLabel} hasn’t posted anything yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {posts.map((p: any, idx: number) => (
                  <PostCard key={p?._id || idx} item={{ type: "posts", data: p }} />
                ))}
              </div>
            )}
          </div>
        ) : tab === "oldLive" ? (
          <div>
            {!canSeeOldLive ? (
              <p style={{ opacity: 0.9 }}>Questo contenuto non è visibile.</p>
            ) : oldLiveErr ? (
              <p style={{ color: "#ffb3b3" }}>Errore Old Live: {oldLiveErr}</p>
            ) : oldLive === null ? (
              <p>Caricamento old live…</p>
            ) : (
              (() => {
                const finished = (oldLive || [])
                  .slice()
                  .sort((a: any, b: any) => {
                    const ad =
                      a?.live?.endedAt ||
                      a?.endedAt ||
                      a?.updatedAt ||
                      a?.createdAt ||
                      0;

                    const bd =
                      b?.live?.endedAt ||
                      b?.endedAt ||
                      b?.updatedAt ||
                      b?.createdAt ||
                      0;

                    return new Date(bd).getTime() - new Date(ad).getTime();
                  });

                if (finished.length === 0)
                  return <p style={{ opacity: 0.8 }}>No past lives.</p>;

                return (
                  <div
                    style={{
                      display: "grid",
                      gap: 12,
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      alignItems: "stretch",
                    }}
                  >
                    {finished.map((ev: any, idx: number) => {
                      const raw = ev?.data?.data ?? ev?.data ?? ev;

                      const key =
                        String(raw?._id || raw?.id || "") ||
                        String(raw?.live?.roomId || "") ||
                        `oldlive-${idx}`;

                      return <EventCard key={key} item={ev} variant="oldLive" />;
                    })}
                  </div>
                );
              })()
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
