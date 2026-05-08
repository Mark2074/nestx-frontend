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

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function ProfilePrivacySecurityPage() {
  const nav = useNavigate();

  const [blocked, setBlocked] = useState<UserItem[]>([]);
  const [muted, setMuted] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const loc = useLocation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState("");
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

  function validatePasswordForm() {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return "All fields are required.";
    }

    if (newPassword.length < 8) {
      return "New password must be at least 8 characters.";
    }

    if (confirmNewPassword !== newPassword) {
      return "New passwords do not match.";
    }

    return "";
  }

  function clearLocalAuthSession() {
    try {
      [
        "token",
        "accountType",
        "username",
        "userId",
        "displayName",
        "avatar",
        "coverImage",
        "isVip",
        "isCreator",
        "isVerified",
        "isPrivate",
        "profileType",
        "language",
        "area",
        "auth_block",
        "auth_block_until",
        "auth_block_reason",
      ].forEach((key) => localStorage.removeItem(key));

      window.dispatchEvent(new CustomEvent("nx:identity-updated"));
    } catch {
      /* localStorage may be unavailable. */
    }
  }

  async function handleChangePassword() {
    const validationMessage = validatePasswordForm();
    if (validationMessage) {
      setPasswordMsg(validationMessage);
      return;
    }

    setPasswordBusy(true);
    setPasswordMsg("");

    try {
      await api.changePassword({ currentPassword, newPassword });
      clearLocalAuthSession();
      nav("/auth?mode=login&passwordChanged=1", { replace: true });
    } catch (e: unknown) {
      setPasswordMsg(getErrorMessage(e, "Could not change password."));
    } finally {
      setPasswordBusy(false);
    }
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
      } catch {
        /* localStorage may be unavailable. */
      }

      nav("/auth?mode=login&deleted=1", { replace: true });
    } catch (e: unknown) {
      setDelErr(getErrorMessage(e, "Delete account failed"));
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

      {/* SECURITY */}
      <section style={{ marginTop: 30 }}>
        <h2>Security</h2>

        <div
          style={{
            marginTop: 10,
            padding: 14,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
          }}
        >
          <div style={{ fontWeight: 900 }}>Change Password</div>
          <div style={{ fontSize: 13, opacity: 0.78, marginTop: 6 }}>
            Update your account password
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            <PasswordField
              label="Current Password"
              value={currentPassword}
              onChange={setCurrentPassword}
              disabled={passwordBusy}
              visible={showPasswords}
              autoComplete="current-password"
            />

            <PasswordField
              label="New Password"
              value={newPassword}
              onChange={setNewPassword}
              disabled={passwordBusy}
              visible={showPasswords}
              autoComplete="new-password"
            />

            <PasswordField
              label="Confirm New Password"
              value={confirmNewPassword}
              onChange={setConfirmNewPassword}
              disabled={passwordBusy}
              visible={showPasswords}
              autoComplete="new-password"
            />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setShowPasswords((value) => !value)}
              disabled={passwordBusy}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                fontWeight: 900,
                background: "transparent",
              }}
            >
              {showPasswords ? "Hide passwords" : "Show passwords"}
            </button>

            <button
              type="button"
              onClick={handleChangePassword}
              disabled={passwordBusy}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                fontWeight: 900,
                cursor: passwordBusy ? "not-allowed" : "pointer",
                opacity: passwordBusy ? 0.7 : 1,
              }}
            >
              {passwordBusy ? "Saving..." : "Change Password"}
            </button>
          </div>

          {passwordMsg ? (
            <div style={{ marginTop: 10, fontWeight: 800, color: "rgba(255,205,150,1)" }}>
              {passwordMsg}
            </div>
          ) : null}
        </div>
      </section>

      {/* BLOCKED */}
      <section style={{ marginTop: 40 }}>
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

function PasswordField({
  label,
  value,
  onChange,
  disabled,
  visible,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  visible: boolean;
  autoComplete: string;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 900, opacity: 0.82 }}>
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        disabled={disabled}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(0,0,0,0.25)",
          color: "white",
          outline: "none",
        }}
      />
    </label>
  );
}
