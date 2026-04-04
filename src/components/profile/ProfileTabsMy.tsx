import { useEffect, useState } from "react";
import { api } from "../../api/nestxApi";
import type { MeProfile } from "../../api/nestxApi";
import PostCard from "../feed/PostCard";
import EventCard from "../feed/EventCard";
import ProfileEventBannerCard from "./ProfileEventBannerCard";

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

export default function ProfileTabsMy({ me }: { me: MeProfile }) {
  const [tab, setTab] = useState<"posts" | "following" | "oldLive">("posts");

  // --- Token info UI (first experience) ---
  const TOKEN_INFO_VERSION = 1;

  const [tokenInfoChecked, setTokenInfoChecked] = useState(false);
  const [dismissedOnce, setDismissedOnce] = useState(false);

  const acceptedVersion = Number((me as any)?.tokenInfoAcceptedVersion || 0);
  const acceptedAt = (me as any)?.tokenInfoAcceptedAt || null;

  const showTokenInfo =
    (!acceptedAt || acceptedVersion < TOKEN_INFO_VERSION) &&
    !dismissedOnce;

  async function handleTokenInfoOk() {
    if (!tokenInfoChecked) return;

    try {
      const data = await api.tokenInfoAccept();
      (me as any).tokenInfoAcceptedAt = data?.tokenInfoAcceptedAt || new Date().toISOString();
      (me as any).tokenInfoAcceptedVersion = data?.tokenInfoAcceptedVersion || TOKEN_INFO_VERSION;
    } catch {
      return;
    }

    setDismissedOnce(true);
    setTokenInfoChecked(false);
  }

  const [posts, setPosts] = useState<any[] | null>(null);
  const [postsErr, setPostsErr] = useState<string>("");
  const [following, setFollowing] = useState<any[] | null>(null);
  const [followingErr, setFollowingErr] = useState<string>("");
  const [bannerEvent, setBannerEvent] = useState<any | null>(null);
  const [oldLive, setOldLive] = useState<any[] | null>(null);
  const [oldLiveErr, setOldLiveErr] = useState<string>("");
  const [hasOldLive, setHasOldLive] = useState<boolean>(false);
  const [mutedIds, setMutedIds] = useState<Set<string>>(new Set());
  const [followingRefreshTick, setFollowingRefreshTick] = useState(0);
  const [deletedPostIds, setDeletedPostIds] = useState<Set<string>>(new Set());

  async function loadPosts() {
    if (tab !== "posts") return;
    setPostsErr("");
    setPosts(null);
    try {
      const data = await api.myPosts();

      const items = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.posts)
        ? (data as any).posts
        : Array.isArray((data as any)?.items)
        ? (data as any).items
        : [];

      setDeletedPostIds(new Set());
      setPosts(items.map((p: any) => ({ ...p })));
    } catch (e: any) {
      setPostsErr("error");
    }
  }

  useEffect(() => {
    void loadPosts();
  }, [tab]);

  useEffect(() => {
    const onPostsUpdated = () => {
      if (tab === "posts") {
        void loadPosts();
      } else {
        setTab("posts");
      }
    };

    window.addEventListener("nx:posts-updated", onPostsUpdated);
    return () => window.removeEventListener("nx:posts-updated", onPostsUpdated);
  }, [tab]);

  useEffect(() => {
    async function loadBanner() {
      if (tab !== "posts") return;
      try {
        const ev = await api.profileEventBanner(me._id);
        setBannerEvent(ev);
      } catch {
        setBannerEvent(null);
      }
    }
    loadBanner();
  }, [tab, me._id]);

  useEffect(() => {
    async function loadFollowing() {
      if (tab !== "following") return;
      setFollowingErr("");
      setFollowing(null);
      try {
        const data = await api.followingMixed();
        setFollowing(data);
      } catch (e: any) {
        setFollowingErr("error");
      }
    }
    loadFollowing();
  }, [tab, followingRefreshTick]);

  useEffect(() => {
    async function loadMuted() {
      if (tab !== "following") return;
      try {
        const ids: string[] = await api.mutedList();
        setMutedIds(new Set(ids.map(String)));
      } catch {
        setMutedIds(new Set());
      }
    }
    loadMuted();
  }, [tab]);

  useEffect(() => {
    async function loadOldLive() {
      if (tab !== "oldLive") return;
      setOldLiveErr("");
      setOldLive(null);
      try {
        const items = await api.oldLive(me._id);
        setOldLive(items);
      } catch (e: any) {
        setOldLiveErr("error");
      }
    }
    loadOldLive();
  }, [tab, me._id]);

  useEffect(() => {
    async function probeOldLive() {
      try {
        const items = await api.oldLive(me._id);
        setHasOldLive(items.length > 0);
      } catch {
        setHasOldLive(false);
      }
    }
    probeOldLive();
  }, [me._id]);

  function getPostAuthorId(it: any): string {
    const post = it?.data ?? it;
    const a = post?.authorId;

    if (a && typeof a === "object" && a._id) return String(a._id);
    if (typeof a === "string") return String(a);
    if (post?.author?._id) return String(post.author._id);
    if (post?.userId) return String(post.userId);

    return "";
  }

  const tokenInfoBanner = showTokenInfo ? (
    <div
      style={{
        marginTop: 12,
        marginBottom: 12,
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.04)",
        padding: 14,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 14,
      }}
    >
      <div>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>Tokens</div>
        <div style={{ opacity: 0.85, fontSize: 13, lineHeight: 1.35 }}>
          ✔ Tokens are redeemable only by verified creators.
        </div>

        <label
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            marginTop: 10,
            opacity: 0.9,
          }}
        >
          <input
            type="checkbox"
            checked={tokenInfoChecked}
            onChange={(e) => setTokenInfoChecked(e.target.checked)}
          />
          <span style={{ fontSize: 13 }}>
            I understand that tokens are redeemable only by verified creators.
          </span>
        </label>
      </div>

      <button
        onClick={handleTokenInfoOk}
        disabled={!tokenInfoChecked}
        style={{
          padding: "10px 14px",
          borderRadius: 12,
          fontWeight: 900,
          cursor: !tokenInfoChecked ? "not-allowed" : "pointer",
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(255,255,255,0.08)",
          color: "white",
          opacity: !tokenInfoChecked ? 0.55 : 1,
        }}
      >
        ✔ OK
      </button>
    </div>
  ) : null;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <TabButton active={tab === "posts"} label="Posts" onClick={() => setTab("posts")} />
        <TabButton
          active={tab === "following"}
          label="Following feed"
          onClick={() => {
            if (tab === "following") setFollowingRefreshTick((v) => v + 1);
            else setTab("following");
          }}
        />
        {hasOldLive ? (
          <TabButton active={tab === "oldLive"} label="Old live" onClick={() => setTab("oldLive")} />
        ) : null}
      </div>

      <div style={{ marginTop: 14 }}>
        {tab === "posts" ? (
          <div>
            {tokenInfoBanner}
            {bannerEvent ? (
              <div style={{ marginBottom: 12 }}>
                <ProfileEventBannerCard event={bannerEvent} />
              </div>
            ) : null}

            {postsErr ? (
              <div>
                <p style={{ opacity: 0.8, marginBottom: 10 }}>Publish your first post.</p>
              </div>
            ) : posts === null ? (
              <p>Caricamento post…</p>
            ) : posts.length === 0 ? (
              <div>
                <p style={{ opacity: 0.8, marginBottom: 10 }}>Publish your first post.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {posts
                  .filter((p: any) => !deletedPostIds.has(String(p?._id)))
                  .map((p: any, idx: number) => (
                    <PostCard
                      key={p?._id || idx}
                      item={{ type: "posts", data: p }}
                      me={me}
                      context="myPosts"
                      onPostDeleted={(postId: string) =>
                        setDeletedPostIds((prev) => new Set([...Array.from(prev), String(postId)]))
                      }
                    />
                  ))}
              </div>
            )}
          </div>
        ) : tab === "following" ? (
          <div>
            {followingErr ? (
              <p style={{ opacity: 0.8 }}>Start following someone.</p>
            ) : following === null ? (
              <p>Loading following feed…</p>
            ) : following.length === 0 ? (
              <p style={{ opacity: 0.8 }}>Start following someone.</p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {following
                  .filter((it: any) => {
                    const t = String(it?.type || "");
                    const isPost = t === "post" || t === "posts";
                    if (!isPost) return true;

                    const authorId = getPostAuthorId(it);
                    if (!authorId) return true;

                    return !mutedIds.has(authorId);
                  })
                  .map((it: any, idx: number) => {
                    const t = String(it?.type || "").toLowerCase();

                    if (t === "post" || t === "posts") {
                      return <PostCard key={it.data?._id || idx} item={it} me={me as any} />;
                    }

                    if (
                      t === "event" ||
                      t === "events" ||
                      t === "event_scheduled" ||
                      t === "scheduled_event"
                    ) {
                      return <EventCard key={it.data?._id || it.data?.eventId || idx} item={it} />;
                    }

                    return null;
                  })}
              </div>
            )}
          </div>
        ) : tab === "oldLive" ? (
          <div>
            {oldLiveErr ? (
              <p style={{ color: "#ffb3b3" }}>Error Old Live: {oldLiveErr}</p>
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

                if (finished.length === 0) return <p style={{ opacity: 0.8 }}>No past lives.</p>;

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
                      const raw = ev?.data?.data ?? ev?.data ?? ev;   // anti-wrapper
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
