import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type NotificationItem } from "../api/nestxApi";

function fmtTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function targetPath(n: NotificationItem): string | null {
  const t = normalizeType(n.type);
  const d: any = (n as any).data || {};

  // live-related notifications -> open live detail
  if (
    (t.includes("ticket") && t.includes("purchase")) ||
    (t.includes("ticket") && t.includes("refund")) ||
    t === "event_cancelled" ||
    t === "event_finished"
  ) {
    const eventId =
      d.eventId ||
      d.event?._id ||
      d.event?.id ||
      (n.targetType === "event" ? n.targetId : null);

    return eventId ? `/app/live/${eventId}` : null;
  }

  const tid = n.targetId || null;
  if (!tid) return null;

  if (n.targetType === "user") return `/app/profile/${tid}`;
  if (n.targetType === "post") return `/app/post/${tid}`;
  if (n.targetType === "event") return `/app/event/${tid}`;
  if (n.targetType === "ticket") return null;

  return null;
}

function actorLabel(n: NotificationItem): string {
  const a: any = n.actorId;
  if (a && typeof a === "object") {
    return a.displayName || a.username || "Someone";
  }
  const d: any = (n as any).data;
  if (d && (d.actorUsername || d.actorDisplayName)) return d.actorDisplayName || d.actorUsername;
  return "Someone";
}

function actorIdString(n: NotificationItem): string | null {
  const a: any = n.actorId;
  if (!a) return null;
  if (typeof a === "string") return a;
  if (typeof a === "object" && a._id) return String(a._id);
  return null;
}

function actorAvatarUrl(n: NotificationItem): string | null {
  const a: any = n.actorId;
  if (a && typeof a === "object" && a.avatar) return String(a.avatar);
  return null;
}

function normalizeType(t: string): string {
  return String(t || "").trim().toLowerCase();
}

function notificationText(n: NotificationItem): string {
  const raw = String(n.message || "").trim();
  const a = actorLabel(n);

  const t = normalizeType(n.type);

  if (t === "social_follow_request" || t === "follow_request") return `${a} sent you a follow request`;
  if (t === "social_new_follower") return `${a} started following you`;
  if (t === "social_follow_accepted") return `${a} accepted your follow request`;

  // legacy (current backend)
  if (t === "post_like" || t === "social_post_liked") return `${a} liked your post`;
  if (t === "post_comment" || t === "social_post_commented") return `${a} commented on your post`;

  // creator rejected: standard safe message, no admin detail exposed
  if (t === "system_creator_rejected" || t === "system_creator_verification_rejected") {
    return "Your creator application was not approved due to a violation of NestX policies.";
  }

  // heuristic fallback: if we have a post target and type contains like/comment keywords
  if (n.targetType === "post") {
    if (t.includes("like")) return `${a} liked your post`;
    if (t.includes("comment")) return `${a} commented on your post`;
  }

  return raw || "Notification";
}

function notificationExtra(n: NotificationItem): string {
  const t = normalizeType(n.type);
  const d: any = (n as any).data || {};

  if (t === "ticket_purchased") {
    const parts: string[] = [];

    if (d.eventTitle) parts.push(`Event: ${d.eventTitle}`);
    if (d.ticketId) parts.push(`Ticket ID: ${d.ticketId}`);
    if (d.priceTokens != null) parts.push(`Price: ${Number(d.priceTokens)}`);
    if (d.scope) parts.push(`Scope: ${String(d.scope)}`);

    return parts.join(" • ");
  }

  // profile/totem verification rejected: show admin note if present
  const verificationRejectionTypes = new Set([
    "system_profile_verification_rejected",
    "system_totem_verification_rejected",
  ]);

  if (verificationRejectionTypes.has(t)) {
    const note = String(
      d.adminNote ||
      d.note ||
      d.reason ||
      d.rejectionReason ||
      d.rejectedReason ||
      ""
    ).trim();

    if (note) return `Admin note: ${note}`;
  }

  // creator rejected: no raw admin note shown to user
  if (t === "system_creator_rejected" || t === "system_creator_verification_rejected") {
    return "";
  }

  return "";
}

function isNotificationDeletable(n: NotificationItem): boolean {
  const t = normalizeType(n.type);

  // backend/system persistence wins
  if (n.isPersistent === true) return false;

  // admin/system/platform decisions
  if (t.startsWith("system_")) return false;
  if (t.startsWith("admin_")) return false;

  // creator / vip / verification / moderation outcomes
  if (
    t === "adv_approved" ||
    t === "adv_rejected" ||
    t === "vetrina_approved" ||
    t === "vetrina_rejected"
  ) {
    return false;
  }

  // payment / ticket / token history
  if (
    t === "ticket_purchased" ||
    t === "ticket_refunded" ||
    t === "token_received"
  ) {
    return false;
  }

  return true;
}

export default function NotificationsPage() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);

  const unreadCount = useMemo(() => items.filter((x) => !x.isRead).length, [items]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.getNotifications({ limit: 50 });
      setItems(res.items);
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
      window.dispatchEvent(new Event("nx:notifications-updated"));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function markRead(id: string) {
    try {
      await api.readNotification(id);
      setItems((prev) => prev.map((x) => (x._id === id ? { ...x, isRead: true, readAt: new Date().toISOString() } : x)));
    } finally {
      window.dispatchEvent(new Event("nx:notifications-updated"));
    }
  }

  async function markAllRead() {
    setBusyId("__all__");
    try {
      await api.readAllNotifications();
      const now = new Date().toISOString();
      setItems((prev) => prev.map((x) => (x.isRead ? x : { ...x, isRead: true, readAt: now })));
    } finally {
      setBusyId(null);
      window.dispatchEvent(new Event("nx:notifications-updated"));
    }
  }

  async function del(id: string) {
    setBusyId(id);
    try {
      await api.deleteNotification(id);
      setItems((prev) => prev.filter((x) => x._id !== id));
    } catch (e) {
      console.error(e);
    } finally {
      setBusyId(null);
      window.dispatchEvent(new Event("nx:notifications-updated"));
    }
  }

  function actorIdValue(n: NotificationItem): string | null {
    const a: any = n.actorId;
    if (!a) return null;
    if (typeof a === "string") return a;
    if (typeof a === "object" && a._id) return String(a._id);
    return null;
  }

  async function acceptFollowRequest(n: NotificationItem) {
    const followerId = actorIdValue(n) || (n.targetType === "user" ? String(n.targetId || "") : "");
    if (!followerId) return;

    setBusyId(n._id);
    try {
      await api.acceptFollowRequest(followerId);
      // dopo accept: la notifica può sparire o diventare read -> qui la eliminiamo
      await api.deleteNotification(n._id);
      setItems((prev) => prev.filter((x) => x._id !== n._id));
    } catch (e) {
      console.error(e);
    } finally {
      setBusyId(null);
      window.dispatchEvent(new Event("nx:notifications-updated"));
    }
  }

  const containerStyle: React.CSSProperties = {
    padding: 18,
    maxWidth: 860,
    margin: "0 auto",
  };

  return (
    <div style={containerStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Notifications</h1>

        <button
          onClick={markAllRead}
          disabled={loading || busyId === "__all__" || unreadCount === 0}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            fontWeight: 900,
            cursor: unreadCount === 0 ? "not-allowed" : "pointer",
            border: "none",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.92)",
            opacity: unreadCount === 0 ? 0.5 : 1,
          }}
        >
          Mark all as read
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 18, opacity: 0.8 }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 18, opacity: 0.8 }}>No notifications.</div>
      ) : (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((n) => {
            const isUnread = !n.isRead;
            const t = normalizeType(n.type);
            const isFollowRequest = t === "social_follow_request" || t === "follow_request";
            const isBusy = busyId === n._id;
            const aId = actorIdString(n);
            const aName = actorLabel(n);
            const aAvatar = actorAvatarUrl(n);
            const canDelete = isNotificationDeletable(n);

            return (
              <div
                key={n._id}
                onClick={async () => {
                  if (!n.isRead) await markRead(n._id);
                  const p = targetPath(n);
                  if (p) nav(p);
                }}
                role="button"
                tabIndex={0}
                style={{
                  borderRadius: 14,
                  padding: 14,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: isUnread ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      {isUnread ? (
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            background: "rgba(255,255,255,0.92)",
                            display: "inline-block",
                            flex: "0 0 auto",
                          }}
                        />
                      ) : null}

                      {/* Avatar */}
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 999,
                          overflow: "hidden",
                          background: "rgba(255,255,255,0.10)",
                          flex: "0 0 auto",
                        }}
                      >
                        {aAvatar ? (
                          <img
                            src={aAvatar}
                            alt={aName}
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                          />
                        ) : null}
                      </div>

                      {/* Text + clickable actor */}
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: isUnread ? 950 : 850,
                            color: "rgba(255,255,255,0.92)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {aId ? (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                nav(`/app/profile/${aId}`);
                              }}
                              style={{ textDecoration: "underline", cursor: "pointer" }}
                              title="Open profile"
                            >
                              {aName}
                            </span>
                          ) : (
                            <span>{aName}</span>
                          )}
                          <span style={{ opacity: 0.9 }}> — {notificationText(n).replace(aName, "").trim().replace(/^[—\-:\s]+/, "")}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
                      {fmtTime(n.createdAt)}
                    </div>

                    {notificationExtra(n) ? (
                      <div style={{ marginTop: 6, fontSize: 13, opacity: 0.88, wordBreak: "break-word" }}>
                        {notificationExtra(n)}
                      </div>
                    ) : null}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
                    {isFollowRequest ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void acceptFollowRequest(n);
                        }}
                        disabled={isBusy}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 12,
                          fontWeight: 950,
                          cursor: isBusy ? "not-allowed" : "pointer",
                          border: "none",
                          background: "rgba(0,200,120,0.20)",
                          color: "rgba(255,255,255,0.92)",
                          opacity: isBusy ? 0.6 : 1,
                        }}
                      >
                        Accept
                      </button>
                    ) : null}

                    {canDelete ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void del(n._id);
                        }}
                        disabled={isBusy}
                        title="Delete notification"
                        style={{
                          padding: "8px 10px",
                          borderRadius: 12,
                          fontWeight: 950,
                          cursor: isBusy ? "not-allowed" : "pointer",
                          border: "none",
                          background: "rgba(255,255,255,0.08)",
                          color: "rgba(255,255,255,0.92)",
                          opacity: isBusy ? 0.6 : 1,
                        }}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
