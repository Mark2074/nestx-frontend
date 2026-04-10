import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../api/nestxApi";
import type { CSSProperties } from "react";

const LOGO_SRC = "/legal/nestx-horizontal-dark.png";

type NavItem = {
  label: string;
  path: string;
};

const items: NavItem[] = [
  { label: "Search", path: "/app/search" },
  { label: "Notifications", path: "/app/notifications" },
  { label: "Chat", path: "/app/chat" },
  { label: "Live", path: "/app/live" }, // diventa dropdown
  { label: "Tokens", path: "/app/tokens" },
  { label: "Profile", path: "/app/profile" }, // già dropdown
  { label: "Rules", path: "/app/rules" },
];

type SidebarIdentity = {
  avatar: string;
  username: string;
  accountType: string;
  userId: string;
};

function readSidebarIdentity(): SidebarIdentity {
  try {
    return {
      avatar: localStorage.getItem("avatar") || "",
      username:
        localStorage.getItem("displayName") ||
        localStorage.getItem("username") ||
        "Me",
      accountType: (localStorage.getItem("accountType") || "").toLowerCase(),
      userId: localStorage.getItem("userId") || "",
    };
  } catch {
    return {
      avatar: "",
      username: "Me",
      accountType: "",
      userId: "",
    };
  }
}

export default function ProfileLeftPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const [identity, setIdentity] = useState<SidebarIdentity>(() => readSidebarIdentity());
  const avatar = identity.avatar;
  const username = identity.username;
  const meId = identity.userId;

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [liveMenuOpen, setLiveMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [chatUnreadCount, setChatUnreadCount] = useState<number>(0);

  const isAdmin = identity.accountType === "admin";

  function hasSessionToken() {
    try {
      return !!localStorage.getItem("token");
    } catch {
      return false;
    }
  }

  async function refreshUnreadCount() {
    if (!hasSessionToken()) {
      setUnreadCount(0);
      return;
    }

    try {
      const c = await api.getUnreadNotificationsCount();
      setUnreadCount(Number.isFinite(c) ? c : 0);
    } catch {
      setUnreadCount(0);
    }
  }

  async function refreshChatUnreadCount() {
    if (!hasSessionToken() || !meId) {
      setChatUnreadCount(0);
      return;
    }

    try {
      const res: any = await api.listConversations();
      const list = Array.isArray(res) ? res : (res?.data || []);

      let total = 0;

      for (const c of list) {
        const explicitUnread = Number(
          c?.unreadCount ?? c?.unreadMessagesCount ?? c?.unread ?? NaN
        );

        if (Number.isFinite(explicitUnread) && explicitUnread > 0) {
          total += explicitUnread;
          continue;
        }

        const lm = c?.lastMessage;
        if (!lm) continue;

        const isIncoming = String(lm.senderId || "") !== String(meId || "");
        const isForMe = String(lm.recipientId || "") === String(meId || "");
        const isUnread = !lm.readAt;

        if (isIncoming && isForMe && isUnread) {
          total += 1;
        }
      }

      setChatUnreadCount(total);
    } catch {
      setChatUnreadCount(0);
    }
  }

  useEffect(() => {
    const syncIdentity = () => {
      setIdentity(readSidebarIdentity());
    };

    syncIdentity();

    window.addEventListener("nx:identity-updated", syncIdentity);
    window.addEventListener("focus", syncIdentity);
    window.addEventListener("storage", syncIdentity);

    return () => {
      window.removeEventListener("nx:identity-updated", syncIdentity);
      window.removeEventListener("focus", syncIdentity);
      window.removeEventListener("storage", syncIdentity);
    };
  }, []);

  useEffect(() => {
    const runRefresh = () => {
      if (!hasSessionToken()) {
        setUnreadCount(0);
        setChatUnreadCount(0);
        return;
      }

      void refreshUnreadCount();
      void refreshChatUnreadCount();
    };

    runRefresh();

    const onUpd = () => {
      runRefresh();
    };

    window.addEventListener("nx:notifications-updated", onUpd);
    window.addEventListener("nx:identity-updated", onUpd);
    window.addEventListener("focus", onUpd);

    const t = window.setInterval(() => {
      runRefresh();
    }, 5000);

    return () => {
      window.removeEventListener("nx:notifications-updated", onUpd);
      window.removeEventListener("nx:identity-updated", onUpd);
      window.removeEventListener("focus", onUpd);
      window.clearInterval(t);
    };
  }, [meId]);

  function isActive(path: string) {
    // active “startsWith” per gruppi (/app/profile e /app/profile/:id)
    return loc.pathname === path || loc.pathname.startsWith(path + "/");
  }

  async function handleLogout() {
    try {
      // frontend-only logout rapido (backend logout già esiste in api, ma SX per ora non fa business)
      localStorage.removeItem("token");
    } finally {
      window.location.href = "/";
    }
  }

  return (
    <div
      style={{
        border: "none",
        background: "transparent",
        overflow: "visible",
      }}
    >
            {/* Header */}
      <div style={{ padding: 14 }}>

        <img
          src={LOGO_SRC}
          alt="NestX"
          onClick={isAdmin ? () => nav("/admin/dashboard") : undefined}
          style={{
            height: 70,
            width: "auto",
            opacity: 0.95,
            cursor: isAdmin ? "pointer" : "default",
            userSelect: "none",
          }}
          title={isAdmin ? "Back to Admin Dashboard" : "NestX"}
        />

        {/* User (Home) */}
        <button
          onClick={() => nav("/app/profile")}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "12px 12px",
            borderRadius: 14,
            fontWeight: 900,
            cursor: "pointer",
            border: "none",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.92)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 12,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.10)",
              overflow: "hidden",
              flex: "0 0 auto",
            }}
          >
            {avatar ? (
              <img
                src={avatar}
                alt="me"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : null}
          </div>

          <div
            style={{
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {username}
          </div>
        </button>
      </div>

      {/* Nav */}
      <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((it) => {
          const active = isActive(it.path);
          const isProfile = it.path === "/app/profile";
          const isLive = it.path === "/app/live";
          const isNotifications = it.path === "/app/notifications";
          const isChat = it.path === "/app/chat";

          const btnStyle: CSSProperties = {
            width: "100%",
            textAlign: "left",
            padding: "10px 12px",
            borderRadius: 12,
            fontWeight: 900,
            cursor: "pointer",
            border: "none",
            background: active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.02)",
            color: "rgba(255,255,255,0.92)",
            opacity: active ? 1 : 0.9,
            position: "relative",
          };

          if (!isProfile && !isLive) {
            return (
              <button
                key={it.label}
                onClick={() => {
                  setProfileMenuOpen(false);
                  setLiveMenuOpen(false);
                  nav(it.path);
                }}
                style={btnStyle}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span>{it.label}</span>

                  {isNotifications && unreadCount > 0 ? (
                    <span
                      style={{
                        minWidth: 22,
                        height: 22,
                        padding: "0 8px",
                        borderRadius: 999,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 950,
                        background: "rgba(255,255,255,0.18)",
                        color: "rgba(255,255,255,0.92)",
                      }}
                    >
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  ) : isChat && chatUnreadCount > 0 ? (
                    <span
                      style={{
                        minWidth: 22,
                        height: 22,
                        padding: "0 8px",
                        borderRadius: 999,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 950,
                        background: "rgba(255,255,255,0.18)",
                        color: "rgba(255,255,255,0.92)",
                      }}
                    >
                      {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
                    </span>
                  ) : null}
                </div>
              </button>
            );
          }

          if (isLive) {
            return (
              <div key={it.label} style={{ position: "relative" }}>
                <button
                  onClick={() => {
                    setProfileMenuOpen(false);
                    setLiveMenuOpen((v) => !v);
                  }}
                  style={btnStyle}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <span>Live</span>
                    <span style={{ opacity: 0.75 }}>{liveMenuOpen ? "▴" : "▾"}</span>
                  </div>
                </button>

                {liveMenuOpen ? (
                  <div
                    style={{
                        marginTop: 8,
                        width: "100%",
                        border: "1px solid rgba(255,255,255,0.14)",
                        background: "rgba(20,20,20,0.96)",
                        borderRadius: 12,
                        overflowY: "auto",
                        maxHeight: 200,
                        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                    }}
                  >
                    {[
                      { label: "Discover", onClick: () => nav("/app/live") },
                      { label: "Create live", onClick: () => nav("/app/live/create") },
                    ].map((x) => (
                      <button
                        key={x.label}
                        onClick={() => {
                          setLiveMenuOpen(false);
                          x.onClick();
                        }}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "10px 12px",
                          fontWeight: 800,
                          cursor: "pointer",
                          border: "none",
                          background: "transparent",
                          color: "rgba(255,255,255,0.92)",
                        }}
                      >
                        {x.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          }

          return (
            <div key={it.label} style={{ position: "relative" }}>
              <button
                onClick={() => {
                  setLiveMenuOpen(false);
                  setProfileMenuOpen((v) => !v);
                }}
                style={btnStyle}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span>Profile</span>
                  <span style={{ opacity: 0.75 }}>{profileMenuOpen ? "▴" : "▾"}</span>
                </div>
              </button>

              {profileMenuOpen ? (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: "calc(100% + 8px)",
                    width: "100%",
                    zIndex: 50,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(20,20,20,0.96)",
                    borderRadius: 12,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",

                    maxHeight: 320,
                    overflowY: "auto",
                  }}
                >
                  {[
                    {
                      label: "Edit profile",
                      onClick: () => {
                        sessionStorage.setItem("nx:open-edit-profile", "1");
                        nav("/app/profile");
                        setTimeout(() => window.dispatchEvent(new Event("nx:edit-profile")), 0);
                      },
                    },
                    { label: "Verification", onClick: () => nav("/app/profile/verification") },
                    { label: "Creator / Payout", onClick: () => nav("/app/profile/manage") },
                    { label: "Privacy & Security", onClick: () => nav("/app/profile/privacy") },
                    { label: "Connections", onClick: () => nav("/app/profile/connections") },
                    { label: "VIP", onClick: () => nav("/app/profile/vip-feed") },
                  ].map((x) => (
                    <button
                      key={x.label}
                      onClick={() => {
                        setProfileMenuOpen(false);
                        x.onClick();
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 12px",
                        fontWeight: 800,
                        cursor: "pointer",
                        border: "none",
                        background: "transparent",
                        color: "rgba(255,255,255,0.92)",
                      }}
                    >
                      {x.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: 12,
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <button
          onClick={handleLogout}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 12,
            fontWeight: 900,
            cursor: "pointer",
            border: "none",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.92)",
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}
