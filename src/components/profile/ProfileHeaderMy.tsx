import { persistLocalIdentity } from "../../api/nestxApi";
import type { MeProfile } from "../../api/nestxApi";
import EmailVerifyBanner from "../EmailVerifyBanner";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import SuspensionBanner from "../SuspensionBanner";

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

export default function ProfileHeaderMy({
  me,
  setMe,
  composerOpen,
  setComposerOpen,
  resetComposer,
}: {
  me: MeProfile;
  setMe: React.Dispatch<React.SetStateAction<MeProfile | null>>;
  composerOpen: boolean;
  setComposerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  resetComposer: () => void;
}) {
  const cover = me.coverImage || "";
  const avatar = me.avatar || "";
  const name = me.displayName || me.username || "No name";

  const verificationUrl = String((me as any)?.verificationPublicVideoUrl || "").trim();
  const canShowVerificationVideo =
    Boolean(me?.isVerified || (me as any)?.verifiedUser) &&
    String((me as any)?.verificationStatus || "").toLowerCase() === "approved" &&
    !!verificationUrl;

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const [verifOpen, setVerifOpen] = useState(false);

  const navigate = useNavigate();

  // ✅ Base API robusta: evita /api/api
  const RAW_BASE = import.meta.env.VITE_API_BASE_URL || "";
  const API_BASE = RAW_BASE.endsWith("/api") ? RAW_BASE : `${RAW_BASE}/api`;

  async function uploadImage(file: File, scope: "avatar" | "cover") {
    const fd = new FormData();
    fd.append("file", file); // ✅ solo file (scope in query)

    const res = await fetch(`${API_BASE}/media/upload?scope=${scope}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
      },
      body: fd,
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.message || "Upload failed");
    }
    return json?.data?.url; // mediaRoutes ritorna { url }
  }

  async function patchProfile(patch: Record<string, any>) {
    if (!patch || Object.keys(patch).length === 0) {
      throw new Error("Empty payload");
    }
    const res = await fetch(`${API_BASE}/profile/update`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
      },
      body: JSON.stringify(patch),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message || "Profile update failed");
    return json;
  }

  function buildFullProfilePatch(overrides: Record<string, any>) {
    return {
      // campi "base" che quasi sicuramente esistono nel backend update
      displayName: me.displayName ?? "",
      bio: (me as any).bio ?? "",
      profileType: (me as any).profileType ?? "",
      language: (me as any).language ?? "",
      area: (me as any).area ?? "",

      // privacy se presente (non fa male se ignorata)
      isPrivate: (me as any).isPrivate ?? false,

      // media
      avatar: me.avatar ?? "",
      coverImage: me.coverImage ?? "",

      // override finale (avatar/cover)
      ...overrides,
    };
  }

  const followerCount = me.followerCount ?? 0;
  const followingCount = me.followingCount ?? 0;

  return (
    <>
      <SuspensionBanner me={me} />
      <EmailVerifyBanner me={me} />

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
        <div
          onClick={() => coverInputRef.current?.click()}
          style={{
            width: "100%",
            aspectRatio: "3 / 1",
            background: "rgba(255,255,255,0.06)",
            overflow: "hidden",
            cursor: "pointer",
          }}
        >
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.currentTarget.value = "";
              if (!file) return;

              try {
                const url = await uploadImage(file, "cover");
                if (!url) throw new Error("Upload returned empty url");

                await patchProfile(buildFullProfilePatch({ coverImage: url }));

                const next = { ...me, coverImage: url };
                setMe(next);
                persistLocalIdentity(next);
              } catch (err: any) {
                alert(err?.message || "Cover upload failed");
              }
            }}
          />
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
          <div
            style={{
              display: "flex",
              gap: 16,
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <div
              onClick={() => avatarInputRef.current?.click()}
              style={{
                width: 96,
                height: 96,
                flex: "0 0 96px",
                borderRadius: 16,
                overflow: "hidden",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                marginTop: -48,
                cursor: "pointer",
              }}
            >
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.currentTarget.value = "";
                  if (!file) return;

                  try {
                    const url = await uploadImage(file, "avatar");
                    if (!url) throw new Error("Upload returned empty url");

                    await patchProfile(buildFullProfilePatch({ avatar: url }));

                    const next = { ...me, avatar: url };
                    setMe(next);
                    persistLocalIdentity(next);
                  } catch (err: any) {
                    alert(err?.message || "Avatar upload failed");
                  }
                }}
              />
              {avatar ? (
                <img
                  src={avatar}
                  alt="avatar"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : null}
            </div>

            <div style={{ flex: "1 1 320px", minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                }}
              >

                <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, flex: "1 1 260px" }}>
                  <h2 style={{ margin: 0, lineHeight: 1.15, wordBreak: "break-word" }}>{name}</h2>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {me.isVip ? <PillBadge>VIP</PillBadge> : null}
                    {(me.isVerified || (me as any)?.verifiedUser) ? (
                      <IconBadge title="Verified" bg="#2ecc71" glyph="✓" />
                    ) : null}
                    {me.isCreator ? <IconBadge title="Creator" bg="#3498db" glyph="★" /> : null}
                    {(me as any).isCreatorMonetizable ? (
                      <IconBadge title="Payout approved" bg="#16a34a" glyph="$" />
                    ) : null}
                    {me.isPrivate ? <PillBadge>PRIVATE</PillBadge> : null}
                  </div>
                </div>

                {canShowVerificationVideo ? (
                  <div style={{ flex: "0 0 auto", marginLeft: "auto" }}>
                    <button
                      type="button"
                      onClick={() => setVerifOpen(true)}
                      title="Verification video"
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: 14,
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
                  </div>
                ) : null}
              </div>

              <div
                style={{
                  marginTop: 6,
                  opacity: 0.85,
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                {me.profileType ? <span>Type: {me.profileType}</span> : null}
                {me.language ? <span>Language: {me.language}</span> : null}
                {me.area ? (
                  <span>
                    Area: {me.area.charAt(0).toUpperCase() + me.area.slice(1)}
                  </span>
                ) : null}
              </div>

              {me.bio ? (
                <p style={{ marginTop: 10, marginBottom: 0, whiteSpace: "pre-wrap" }}>
                  {me.bio}
                </p>
              ) : (
                <p style={{ marginTop: 10, marginBottom: 0, opacity: 0.6 }}>
                  No bio yet.
                </p>
              )}
            </div>
          </div>

          {/* Contatori */}
          <div style={{ marginTop: 14, display: "flex", gap: 18 }}>
            <div
              onClick={() => navigate("/app/profile/connections?tab=followers")}
              style={{ cursor: "pointer" }}
              title="View followers"
            >
              <b>{followerCount}</b> follower
            </div>

            <div
              onClick={() => navigate("/app/profile/connections?tab=following")}
              style={{ cursor: "pointer" }}
              title="View following"
            >
              <b>{followingCount}</b> following
            </div>
          </div>

          {/* CTA My Profile */}
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => {
                setComposerOpen((v) => {
                  const next = !v;
                  if (!next) resetComposer();
                  return next;
                });
              }}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {composerOpen ? "Close" : "Create post"}
            </button>
          </div>
        </div>
      </div>
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
    </>
  );
}
