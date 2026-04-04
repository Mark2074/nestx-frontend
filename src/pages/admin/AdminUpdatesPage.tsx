import { useEffect, useMemo, useState } from "react";
import {
  adminCreateUpdate,
  adminDeleteUpdate,
  adminListUpdates,
  adminPatchUpdate,
  type AdminPlatformUpdate,
} from "../../api/nestxApi";

function fmt(dt?: string) {
  if (!dt) return "—";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function AdminUpdatesPage() {
  const [items, setItems] = useState<AdminPlatformUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [createText, setCreateText] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const count = useMemo(() => items.length, [items]);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const data = await adminListUpdates();
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErr(String(e?.message || "Load failed"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    const text = createText.trim();
    if (!text) return;
    if (text.length > 220) return;

    setBusyId("__create__");
    setErr(null);
    try {
      await adminCreateUpdate(text);
      setCreateText("");
      await load();
    } catch (e: any) {
      setErr(String(e?.message || "Create failed"));
    } finally {
      setBusyId(null);
    }
  }

  async function toggle(id: string, next: boolean) {
    setBusyId(id);
    setErr(null);
    try {
      await adminPatchUpdate(id, { isActive: next });
      await load();
    } catch (e: any) {
      setErr(String(e?.message || "Toggle failed"));
    } finally {
      setBusyId(null);
    }
  }

  async function saveEdit(id: string) {
    const text = editText.trim();
    if (!text) return;
    if (text.length > 220) return;

    setBusyId(id);
    setErr(null);
    try {
      await adminPatchUpdate(id, { text });
      setEditId(null);
      setEditText("");
      await load();
    } catch (e: any) {
      setErr(String(e?.message || "Edit failed"));
    } finally {
      setBusyId(null);
    }
  }

  async function del(id: string) {
    setBusyId(id);
    setErr(null);
    try {
      await adminDeleteUpdate(id);
      await load();
    } catch (e: any) {
      setErr(String(e?.message || "Delete failed"));
    } finally {
      setBusyId(null);
    }
  }

  const cardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.08)",
  };

  const btn: React.CSSProperties = {
    border: "none",
    borderRadius: 10,
    padding: "8px 10px",
    fontWeight: 900,
    cursor: "pointer",
    background: "rgba(255,255,255,0.10)",
    color: "rgba(255,255,255,0.92)",
  };

  const btnDanger: React.CSSProperties = {
    ...btn,
    background: "rgba(255,70,70,0.18)",
  };

  return (
    <div style={{ padding: 18, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Updates</h1>
          <div style={{ marginTop: 6, opacity: 0.75 }}>Total: {count}</div>
        </div>

        <button onClick={load} style={btn} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {err ? (
        <div style={{ marginTop: 12, ...cardStyle, borderColor: "rgba(255,80,80,0.25)" }}>
          <div style={{ fontWeight: 900 }}>Error</div>
          <div style={{ marginTop: 6, opacity: 0.9 }}>{err}</div>
        </div>
      ) : null}

      {/* Create */}
      <div style={{ marginTop: 14, ...cardStyle }}>
        <div style={{ fontWeight: 900 }}>Create update</div>
        <div style={{ marginTop: 10 }}>
          <textarea
            value={createText}
            onChange={(e) => setCreateText(e.target.value)}
            rows={3}
            placeholder="Write platform update (max 220 chars)..."
            style={{
              width: "100%",
              resize: "vertical",
              borderRadius: 12,
              padding: 10,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(0,0,0,0.25)",
              color: "rgba(255,255,255,0.90)",
              outline: "none",
            }}
          />
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ opacity: 0.7, fontSize: 12 }}>
              {createText.trim().length}/220
            </div>
            <button
              style={btn}
              disabled={busyId === "__create__" || !createText.trim() || createText.trim().length > 220}
              onClick={create}
            >
              {busyId === "__create__" ? "..." : "Create"}
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((it) => {
          const id = String(it._id);
          const disabled = busyId === id;

          const isEditing = editId === id;

          return (
            <div key={id} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900, opacity: it.isActive ? 1 : 0.75 }}>
                      {it.isActive ? "ACTIVE" : "INACTIVE"}
                    </div>
                    <div style={{ opacity: 0.7, fontSize: 12 }}>
                      created: {fmt(it.createdAt)}
                    </div>
                  </div>

                  {!isEditing ? (
                    <div style={{ marginTop: 10, lineHeight: 1.35, opacity: 0.92 }}>
                      {it.text}
                    </div>
                  ) : (
                    <div style={{ marginTop: 10 }}>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={3}
                        style={{
                          width: "100%",
                          resize: "vertical",
                          borderRadius: 12,
                          padding: 10,
                          border: "1px solid rgba(255,255,255,0.10)",
                          background: "rgba(0,0,0,0.25)",
                          color: "rgba(255,255,255,0.90)",
                          outline: "none",
                        }}
                      />
                      <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ opacity: 0.7, fontSize: 12 }}>{editText.trim().length}/220</div>
                        <div style={{ display: "flex", gap: 10 }}>
                          <button
                            style={btn}
                            onClick={() => {
                              setEditId(null);
                              setEditText("");
                            }}
                            disabled={disabled}
                          >
                            Cancel
                          </button>
                          <button
                            style={btn}
                            onClick={() => saveEdit(id)}
                            disabled={disabled || !editText.trim() || editText.trim().length > 220}
                          >
                            {disabled ? "..." : "Save"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button
                    style={btn}
                    disabled={disabled}
                    onClick={() => toggle(id, !it.isActive)}
                    title="Toggle isActive"
                  >
                    {disabled ? "..." : it.isActive ? "Disable" : "Enable"}
                  </button>

                  {!isEditing ? (
                    <button
                      style={btn}
                      disabled={disabled}
                      onClick={() => {
                        setEditId(id);
                        setEditText(it.text || "");
                      }}
                    >
                      Edit
                    </button>
                  ) : null}

                  <button style={btnDanger} disabled={disabled} onClick={() => del(id)}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {!loading && items.length === 0 ? (
          <div style={{ ...cardStyle, opacity: 0.85 }}>
            No updates yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}