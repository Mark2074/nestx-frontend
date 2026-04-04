import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

type UserItem = {
  _id: string;
  username?: string;
  displayName?: string;
  avatar?: string;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

function authFetch(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem("token");

  return fetch(API_BASE + url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Request failed");
    }
    return res.json();
  });
}

export default function ProfileConnectionsPage() {
  const nav = useNavigate();
  function getMyIdFromToken() {
    try {
      const t = localStorage.getItem("token") || "";
      const payload = t.split(".")[1];
      if (!payload) return null;
      const json = JSON.parse(atob(payload));
      return json.userId || null;
    } catch {
      return null;
    }
  }

  const myId = getMyIdFromToken();

  const location = useLocation();

  function pickInitialTab(): "following" | "followers" {
    const sp = new URLSearchParams(location.search || "");
    const qTab = (sp.get("tab") || "").toLowerCase();
    if (qTab === "followers") return "followers";
    if (qTab === "following") return "following";

    const st: any = (location as any).state || {};
    if (st?.tab === "followers") return "followers";
    if (st?.tab === "following") return "following";

    return "following";
  }

  const [tab, setTab] = useState<"following" | "followers">(pickInitialTab());
  const [following, setFollowing] = useState<UserItem[]>([]);
  const [followers, setFollowers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // sync tab from URL/state when arriving here
    setTab(pickInitialTab());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  useEffect(() => {
    if (!myId) return;
    loadAll();
  }, [myId]);

  async function loadAll() {
    try {
      setLoading(true);

      const [followingRes, followersRes] = await Promise.all([
        authFetch(`/follow/${myId}/following`),
        authFetch(`/follow/${myId}/followers`),
      ]);

      setFollowing(followingRes.data?.users || []);
      setFollowers(followersRes.data?.users || []);
    } finally {
      setLoading(false);
    }
  }

  async function handleUnfollow(userId: string) {
    await authFetch(`/follow/${userId}`, { method: "DELETE" });
    setFollowing((prev) => prev.filter((u) => u._id !== userId));
  }

  if (!myId) {
    return (
      <div style={{ padding: 20 }}>
        <p>User not available.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: 20, maxWidth: 820, margin: "0 auto" }}>
        <h1>Connections</h1>
        <p>Loading…</p>
      </div>
    );
  }

  const list = tab === "following" ? following : followers;

  return (
    <div style={{ padding: 20, maxWidth: 820, margin: "0 auto" }}>
      <h1>Connections</h1>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button
          onClick={() => setTab("following")}
          style={{
            fontWeight: 800,
            opacity: tab === "following" ? 1 : 0.6,
          }}
        >
          Following ({following.length})
        </button>

        <button
          onClick={() => setTab("followers")}
          style={{
            fontWeight: 800,
            opacity: tab === "followers" ? 1 : 0.6,
          }}
        >
          Followers ({followers.length})
        </button>
      </div>

      {/* List */}
      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
        {list.length === 0 ? (
          <p style={{ opacity: 0.7 }}>No users.</p>
        ) : (
          list.map((u) => (
            <div
              key={u._id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 10,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <Avatar avatar={u.avatar} />

              <div
                style={{ flex: 1, cursor: "pointer" }}
                onClick={() => nav(`/app/profile/${u._id}`)}
              >
                {u.displayName || u.username || "User"}
              </div>

              {tab === "following" ? (
                <button
                  onClick={() => handleUnfollow(u._id)}
                  style={{ fontWeight: 800 }}
                >
                  Unfollow
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Avatar({ avatar }: { avatar?: string }) {
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        overflow: "hidden",
        background: "rgba(255,255,255,0.1)",
        flex: "0 0 auto",
      }}
    >
      {avatar ? (
        <img
          src={avatar}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : null}
    </div>
  );
}
