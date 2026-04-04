import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "../api/nestxApi";

type UserItem = {
  id: string;
  displayName?: string;
  username?: string;
  avatar?: string;
};

function normalizeUserList(input: any): UserItem[] {
  if (!Array.isArray(input)) return [];

  // caso A: già oggetti user
  if (input.length === 0) return [];
  if (typeof input[0] === "object" && input[0] !== null) {
    return input
      .map((x: any) => ({
        id: String(x.id || x._id || ""),
        displayName: x.displayName,
        username: x.username,
        avatar: x.avatar,
      }))
      .filter((u: UserItem) => !!u.id);
  }

  // caso B: string[] (ids)
  if (typeof input[0] === "string") {
    return (input as string[])
      .map((id) => ({ id: String(id) }))
      .filter((u) => !!u.id);
  }

  return [];
}

export default function ProfilePrivacySecurityPage() {
  const nav = useNavigate();

  const [blocked, setBlocked] = useState<UserItem[]>([]);
  const [muted, setMuted] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const loc = useLocation();
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState<string>("");
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    loadAll();
  }, [loc.pathname]);

  async function loadAll() {
    try {
      setLoading(true);

      const [blockedRes, mutedRes] = await Promise.all([
        api.blockedList(),
        api.mutedList(),
      ]);

      setBlocked(normalizeUserList(blockedRes));
      setMuted(normalizeUserList(mutedRes));
    } finally {
      setLoading(false);
    }
  }

  async function handleUnblock(userId: string) {
    await api.unblockUser(userId);
    setBlocked((prev) => prev.filter((u) => u.id !== userId));
  }

  async function handleUnmute(userId: string) {
    await api.unmuteUser(userId);
    setMuted((prev) => prev.filter((u) => u.id !== userId));
  }

  async function handleDeleteAccount() {
    setDelErr("");

    const ok =
      confirmText.trim().toUpperCase() === "DELETE" &&
      window.confirm("This will request account deletion. Your data will be scheduled for removal. Continue?");

    if (!ok) {
      setDelErr('Please type "DELETE" in the field to confirm account deletion.');
      return;
    }

    setDelBusy(true);
    try {
      await api.deleteAccount();

      try {
        localStorage.removeItem("token");
        localStorage.removeItem("accountType");
        localStorage.removeItem("username");
        localStorage.removeItem("avatar");
        localStorage.removeItem("auth_block");
        localStorage.removeItem("auth_block_until");
        localStorage.removeItem("auth_block_reason");
      } catch {}

      nav("/auth?mode=login&deleted=1", { replace: true });
    } catch (e: any) {
      setDelErr(e?.message || "Delete account failed");
    } finally {
      setDelBusy(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 20, maxWidth: 820, margin: "0 auto" }}>
        <h1>Privacy & Security</h1>
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 820, margin: "0 auto" }}>
      <h1>Privacy & Security</h1>

      {/* BLOCKED */}
      <section style={{ marginTop: 30 }}>
        <h2>Blocked users</h2>

        {blocked.length === 0 ? (
          <p style={{ opacity: 0.7 }}>No blocked users.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {blocked.map((u) => (
              <div
                key={u.id}
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

                <div style={{ flex: 1 }}>
                  {u.displayName || u.username || "User"}
                </div>

                <button
                  onClick={() => handleUnblock(u.id)}
                  style={{ fontWeight: 800 }}
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MUTED */}
      <section style={{ marginTop: 40 }}>
        <h2>Muted users</h2>

        {muted.length === 0 ? (
          <p style={{ opacity: 0.7 }}>No muted users.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {muted.map((u) => (
              <div
                key={u.id}
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
                  onClick={() => nav(`/app/profile/${u.id}`)}
                >
                  {u.displayName || u.username || "User"}
                </div>

                <button
                  onClick={() => handleUnmute(u.id)}
                  style={{ fontWeight: 800 }}
                >
                  Unmute
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
      {/* DANGER ZONE */}
      <section style={{ marginTop: 50 }}>
        <h2 style={{ color: "rgba(255,120,120,1)" }}>Danger zone</h2>

        <div
          style={{
            marginTop: 10,
            padding: 14,
            borderRadius: 14,
            border: "1px solid rgba(255,120,120,0.30)",
            background: "rgba(255,120,120,0.08)",
          }}
        >
          <div style={{ fontWeight: 900 }}>Delete account</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 8 }}>
            To confirm deletion, type <b>DELETE</b> in the box.
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder='Type "DELETE" to confirm'
              style={{
                width: 260,
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,120,120,0.35)",
                background: "rgba(0,0,0,0.25)",
                color: "white",
                outline: "none",
              }}
              disabled={delBusy}
            />

            <button
              onClick={handleDeleteAccount}
              disabled={delBusy}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                fontWeight: 900,
                cursor: delBusy ? "not-allowed" : "pointer",
                opacity: delBusy ? 0.7 : 1,
                border: "1px solid rgba(255,120,120,0.45)",
                background: "rgba(255,120,120,0.18)",
                color: "white",
              }}
            >
              {delBusy ? "Deleting..." : "Delete account"}
            </button>
          </div>

          {delErr ? (
            <div style={{ marginTop: 10, fontWeight: 800, color: "rgba(255,160,160,1)" }}>
              {delErr}
            </div>
          ) : null}
        </div>
      </section>
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
