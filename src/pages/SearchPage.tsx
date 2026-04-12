import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type MeProfile, type SearchType } from "../api/nestxApi";
import SearchFilters from "../components/search/SearchFilters";
import PostCard from "../components/feed/PostCard";
import EventCard from "../components/feed/EventCard";

type Tab = "posts" | "users" | "events";

export default function SearchPage() {
  const nav = useNavigate();

  const [me, setMe] = useState<MeProfile | null>(null);
  const isVip = me?.isVip === true;
  const isAdmin = me?.accountType === "admin";
  const canUseVipFilters = isVip || isAdmin;

  const [tab, setTab] = useState<Tab>("posts");

  const [q, setQ] = useState("");
  const [profileType, setProfileType] = useState<string>("");
  const [country, setCountry] = useState<string>("");
  const [language, setLanguage] = useState<string>("");

  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  const [users, setUsers] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    api.meProfile()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  // reset page su cambio criteri (tab + query + filtri)
  useEffect(() => {
    setPage(1);
  }, [tab, q, profileType, country, language]);

  const effectiveFilters = useMemo(() => {
    const f = {
      profileType: profileType.trim() || null,
      country: country.trim() || null,
      language: language.trim() || null,
    };

    if (tab === "events") {
      // base+vip+admin: profileType/country ok
      // language: VIP or admin
      if (!canUseVipFilters) f.language = null;
      return f;
    }

    // posts/users: advanced filters allowed for VIP or admin
    if (!canUseVipFilters) {
      f.profileType = null;
      f.country = null;
      f.language = null;
    }

    return f;
  }, [tab, profileType, country, language, canUseVipFilters]);

  const canRunWithoutQ = useMemo(() => {
    const hasAnyFilter = !!(
      effectiveFilters.profileType ||
      effectiveFilters.country ||
      effectiveFilters.language
    );

    if (!hasAnyFilter) return false;

    if (tab === "events") {
      return !!(
        effectiveFilters.profileType ||
        effectiveFilters.country ||
        effectiveFilters.language
      );
    }

    return canUseVipFilters;
  }, [
    tab,
    canUseVipFilters,
    effectiveFilters.profileType,
    effectiveFilters.country,
    effectiveFilters.language,
  ]);

  async function runSearch() {
    const canRun = !!q.trim() || canRunWithoutQ;

    if (!canRun) {
      setUsers([]);
      setPosts([]);
      setEvents([]);
      return;
    }

    setErr("");
    setLoading(true);

    try {
      const res = await api.socialSearch({

        q,
        type: tab as SearchType,
        page,
        limit: 10,
        profileType: effectiveFilters.profileType,
        country: effectiveFilters.country,
        language: effectiveFilters.language,
      });

      setUsers(Array.isArray(res.users) ? res.users : []);
      const myId = String((me && (me as any)._id) ? (me as any)._id : "");
      // tolgo i miei post dalla ricerca (solo tab posts)
      const rawPosts = Array.isArray(res.posts) ? res.posts : [];
      const filteredPosts = myId
        ? rawPosts.filter((p: any) => {
            const authorId =
              String(p?.authorId?._id || p?.authorId || "");
            return authorId !== myId;
          })
        : rawPosts;

      setPosts(filteredPosts);
      setEvents(Array.isArray(res.events) ? res.events : []);
    } catch (e: any) {
      setUsers([]);
      setPosts([]);
      setEvents([]);
      setErr(String(e?.message || "Search failed"));
    } finally {
      setLoading(false);
    }
  }

  // auto-run anche con q vuota SOLO quando le regole lo consentono (users/events con filtri)
  useEffect(() => {
    const canRun = !!q.trim() || canRunWithoutQ;

    if (!canRun) {
      setUsers([]);
      setPosts([]);
      setEvents([]);
      return;
    }

    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tab,
    page,
    q,
    canRunWithoutQ,
    effectiveFilters.profileType,
    effectiveFilters.country,
    effectiveFilters.language,
  ]);

  const activeList = tab === "users" ? users : tab === "posts" ? posts : events;

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 12 }}>Search</h1>

      {/* Search box */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.04)",
            color: "inherit",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") runSearch();
          }}
        />
        <button
          onClick={() => runSearch()}
          disabled={(!q.trim() && !canRunWithoutQ) || loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.06)",
            color: "inherit",
            cursor: "pointer",
            opacity: ((!q.trim() && !canRunWithoutQ) || loading) ? 0.6 : 1,
          }}
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {(["posts", "users", "events"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.15)",
              background: tab === t ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <SearchFilters
        tab={tab}
        isVip={isVip}
        isAdmin={isAdmin}
        profileType={profileType}
        country={country}
        language={language}
        setProfileType={setProfileType}
        setCountry={setCountry}
        setLanguage={setLanguage}
      />
      {err ? (
        <div style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(255,0,0,0.35)", marginBottom: 12 }}>
          {err}
        </div>
      ) : null}

      {/* Results */}
      {(!q.trim() && !canRunWithoutQ) ? (
        <div style={{ opacity: 0.7 }}>Type something to search.</div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ opacity: 0.8 }}>
              Showing {activeList.length} result{activeList.length === 1 ? "" : "s"}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.05)",
                  color: "inherit",
                  cursor: "pointer",
                  opacity: page <= 1 || loading ? 0.6 : 1,
                }}
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={loading || activeList.length < 10}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.05)",
                  color: "inherit",
                  cursor: "pointer",
                  opacity: loading || activeList.length < 10 ? 0.6 : 1,
                }}
              >
                Next
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {tab === "users" &&
              users.map((u) => (
                <div
                  key={u._id}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.03)",
                    cursor: "pointer",
                  }}
                  onClick={() => nav(`/app/profile/${u._id}`)}
                  title="Open profile"
                >
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 999,
                      overflow: "hidden",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      flexShrink: 0,
                    }}
                  >
                    {u.avatar ? (
                      <img
                        src={String(u.avatar)}
                        alt="avatar"
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    ) : null}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {u.displayName || "User"}
                    </div>
                    <div
                      style={{
                        opacity: 0.75,
                        marginTop: 4,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {u.bio || ""}
                    </div>
                  </div>
                </div>
                </div>
              ))}

            {tab === "posts" &&
              posts.map((p) => (
                <PostCard
                  key={String(p?._id || Math.random())}
                  item={{ type: "posts", data: p }}
                  me={me}
                  context="feed"
                />
              ))}

            {tab === "events" &&
              events.map((ev) => (
                <EventCard
                  key={String(ev?._id || ev?.id || ev?.eventId || Math.random())}
                  item={{ data: ev }}
                  variant="scheduled"
                />
              ))}
          </div>
        </>
      )}
    </div>
  );
}
