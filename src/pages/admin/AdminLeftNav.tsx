import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { adminDeletedUsersList, adminGetCreatorPending, adminGetShowcasePending, api } from "../../api/nestxApi";

const LOGO_SRC = "/legal/nestx-horizontal-dark.png";

type NavKey = "creator" | "showcase" | "bugreports" | "deleted" | null;
type NavItem = { label: string; path: string; key?: NavKey };

const items: NavItem[] = [
  { label: "Dashboard", path: "/admin/dashboard" },
  { label: "Pending", path: "/admin/pending" },

  { label: "Creator approval", path: "/admin/creator-approval", key: "creator" },
  { label: "Showcase approval", path: "/admin/showcase-approval", key: "showcase" },
  { label: "Updates", path: "/admin/updates" },
  { label: "Bug reports", path: "/admin/bug-reports", key: "bugreports" },

  { label: "New / Growth", path: "/admin/new-growth" },
  { label: "Watchlist", path: "/admin/watchlist" },

  { label: "Blocked / Suspended", path: "/admin/blocked-users" },
  { label: "Deleted Accounts", path: "/admin/deleted-accounts", key: "deleted" },
  { label: "Security Log", path: "/admin/security-log" },
];

export default function AdminLeftNav({ onOpenDictionary }: { onOpenDictionary: () => void }) {
  const nav = useNavigate();
  const loc = useLocation();

  const [creatorPending, setCreatorPending] = useState<number | null>(null);
  const [showcasePending, setShowcasePending] = useState<number | null>(null);
  const [bugReportsPending, setBugReportsPending] = useState<number | null>(null);
  const [deletedReady, setDeletedReady] = useState<number | null>(null);

  const badge = useMemo(() => {
    return {
      creator: creatorPending,
      showcase: showcasePending,
      bugreports: bugReportsPending,
      deleted: deletedReady,
    } as Record<string, number | null>;
  }, [creatorPending, showcasePending, bugReportsPending, deletedReady]);

  useEffect(() => {
    let alive = true;

    async function loadCounts() {
      try {
        const [c, s, b, d] = await Promise.all([
          adminGetCreatorPending().catch(() => []),
          adminGetShowcasePending().catch(() => []),
          api.adminBugReportsList({ status: "open", sort: "new", limit: 1, skip: 0 }).catch(() => null),
          adminDeletedUsersList().catch(() => ({ status: "ok", users: [] })),
        ]);

        if (!alive) return;

        setCreatorPending(Array.isArray(c) ? c.length : 0);
        setShowcasePending(Array.isArray(s) ? s.length : 0);
        const total =
          typeof (b as any)?.total === "number"
            ? Number((b as any).total)
            : typeof (b as any)?.count === "number"
              ? Number((b as any).count)
              : Array.isArray((b as any)?.items)
                ? (b as any).items.length
                : Array.isArray(b)
                  ? (b as any).length
                  : 0;

        setBugReportsPending(total);

        const list = Array.isArray((d as any)?.users)
          ? (d as any).users
          : Array.isArray(d)
            ? d
            : [];

        setDeletedReady(list.length);
      } catch {
        if (!alive) return;
        setCreatorPending(null);
        setShowcasePending(null);
        setBugReportsPending(null);
        setDeletedReady(null);
      }
    }

    loadCounts();
    const t = window.setInterval(loadCounts, 30000);

    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  function isActive(path: string) {
    return loc.pathname === path || loc.pathname.startsWith(path + "/");
  }

  return (
    <div style={{ overflow: "visible" }}>
      <div style={{ padding: 14 }}>
        <img
          src={LOGO_SRC}
          alt="NestX"
          onClick={() => nav("/admin/dashboard")}
          onContextMenu={(e) => {
            e.preventDefault();
            onOpenDictionary();
          }}
          style={{
            height: 70,
            width: "auto",
            opacity: 0.95,
            cursor: "pointer",
            userSelect: "none",
          }}
          title="Go to Admin Dashboard • Right-click: AI Dictionary"
        />
      </div>

      <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((it) => {
          const active = isActive(it.path);
          return (
            <button
              key={it.label}
              onClick={() => nav(it.path)}
              style={{
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
              }}
            >
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span>{it.label}</span>

                {it.key && typeof badge[it.key] === "number" && badge[it.key]! > 0 ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 26,
                      height: 22,
                      padding: "0 8px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 900,
                      background: "rgba(255,255,255,0.14)",
                      color: "rgba(255,255,255,0.92)",
                    }}
                    title="Pending"
                  >
                    {badge[it.key]}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}