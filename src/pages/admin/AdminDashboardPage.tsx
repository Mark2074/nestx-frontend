import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DisabledBadge, featureFlag, panel } from "./adminUi";
import { api } from "../../api/nestxApi";
import { adminGetBlockedUsers, adminGetGrowthSummary } from "../../api/nestxApi";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ ...panel, padding: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 950 }}>{value}</div>
    </div>
  );
}

function DisabledBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ ...panel, padding: 14, opacity: 0.55, filter: "grayscale(0.4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ fontWeight: 950 }}>{title}</div>
        <DisabledBadge />
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const economyEnabled = featureFlag("ECONOMY");

  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  const [growth, setGrowth] = useState<any>(null);
  const [growthLoading, setGrowthLoading] = useState(false);

  const [blocked, setBlocked] = useState<any[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);

  const [metrics, setMetrics] = useState<null | {
    vipUsersActive: number;
    tokensTotalBalance: number;
    tokensRedeemable: number;
    vipRevenueTokensCurrentMonth: number;
    advRevenueTokensCurrentMonth: number;
    showcaseRevenueTokensCurrentMonth: number;
    totalRevenueTokensCurrentMonth: number;
  }>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  useEffect(() => {
    if (!economyEnabled) return;

    let alive = true;
    (async () => {
      try {
        setMetricsLoading(true);
        const res = await api.adminDashboardMetrics();
        if (!alive) return;

        const m = (res as any)?.data ?? res ?? null;

        setMetrics(
          m
            ? {
                vipUsersActive: Number(m.vipUsersActive ?? 0),
                tokensTotalBalance: Number(m.tokensTotalBalance ?? 0),
                tokensRedeemable: Number(m.tokensRedeemable ?? 0),
                vipRevenueTokensCurrentMonth: Number(m.vipRevenueTokensCurrentMonth ?? 0),
                advRevenueTokensCurrentMonth: Number(m.advRevenueTokensCurrentMonth ?? 0),
                showcaseRevenueTokensCurrentMonth: Number(m.showcaseRevenueTokensCurrentMonth ?? 0),
                totalRevenueTokensCurrentMonth: Number(m.totalRevenueTokensCurrentMonth ?? 0),
              }
            : null
        );
      } catch {
        if (!alive) return;
        setMetrics(null);
      } finally {
        if (!alive) return;
        setMetricsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [economyEnabled]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setPendingLoading(true);
        const res = await api.adminGetPending({ category: "all", sort: "priority", limit: 200 });
        if (!alive) return;
        setPendingItems(res?.items || []);
      } catch {
        if (!alive) return;
        setPendingItems([]);
      } finally {
        if (!alive) return;
        setPendingLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setGrowthLoading(true);
        const res = await adminGetGrowthSummary();
        if (!alive) return;
        setGrowth(res);
      } catch {
        if (!alive) return;
        setGrowth(null);
      } finally {
        if (!alive) return;
        setGrowthLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setBlockedLoading(true);
        const res = await adminGetBlockedUsers();
        if (!alive) return;
        setBlocked(res?.users || []);
      } catch {
        if (!alive) return;
        setBlocked([]);
      } finally {
        if (!alive) return;
        setBlockedLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const pendingCounts = useMemo(() => {
    const verification = pendingItems.filter((x) => String(x?.type || "").startsWith("verification_")).length;
    const reports = pendingItems.filter((x) => String(x?.type || "").startsWith("report_")).length;
    const refunds = pendingItems.filter((x) => {
      const t = String(x?.type || "");
      return t === "economy_refund_request" || t === "economy_refund";
    }).length;
    return { verification, reports, refunds };
  }, [pendingItems]);

  const overview = useMemo(() => {
    const totalUsers = growth?.users?.total ?? null;
    const newUsers7d = growth?.users?.new7d ?? null;
    const creatorsTotal = growth?.creators?.total ?? null;
    const vipUsers = null; // non abbiamo endpoint ora

    const bannedTotal = blocked.filter((u) => !!u?.isBanned).length;
    const suspendedTotal = blocked.filter((u) => !!u?.isSuspended).length;
    const blockedTotal = bannedTotal + suspendedTotal;

    return {
      totalUsers,
      newUsers7d,
      vipUsers,
      creatorsTotal,
      blockedTotal,
      bannedTotal,
      suspendedTotal,
    };
  }, [growth, blocked]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 950 }}>Dashboard</div>
        <div style={{ marginTop: 6, opacity: 0.85 }}>
          Admin home. Structure is final; content is mock and will be replaced section by section.
        </div>
      </div>

      {/* Overview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 12 }}>
        <StatCard label="Total users" value={growthLoading ? "…" : (overview.totalUsers == null ? "—" : String(overview.totalUsers))} />
        <StatCard label="New users (7d)" value={growthLoading ? "…" : (overview.newUsers7d == null ? "—" : String(overview.newUsers7d))} />
        <StatCard label="Creators" value={growthLoading ? "…" : (overview.creatorsTotal == null ? "—" : String(overview.creatorsTotal))} />
        <StatCard label="VIP active users" value={economyEnabled ? (metricsLoading ? "…" : String(metrics?.vipUsersActive ?? 0)) : "—"} />

        <StatCard label="Blocked (total)" value={blockedLoading ? "…" : String(overview.blockedTotal)} />
        <StatCard label="Banned" value={blockedLoading ? "…" : String(overview.bannedTotal)} />
        <StatCard label="Suspended" value={blockedLoading ? "…" : String(overview.suspendedTotal)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 12 }}>
        {economyEnabled ? (
          <>
            <StatCard
              label="Total tokens (balance)"
              value={metricsLoading ? "…" : String(metrics?.tokensTotalBalance ?? 0)}
            />
            <StatCard
              label="Redeemable tokens"
              value={metricsLoading ? "…" : String(metrics?.tokensRedeemable ?? 0)}
            />
            <StatCard
              label="VIP revenue (month)"
              value={metricsLoading ? "…" : String(metrics?.vipRevenueTokensCurrentMonth ?? 0)}
            />
            <StatCard
              label="ADV revenue (month)"
              value={metricsLoading ? "…" : String(metrics?.advRevenueTokensCurrentMonth ?? 0)}
            />
            <StatCard
              label="Showcase revenue (month)"
              value={metricsLoading ? "…" : String(metrics?.showcaseRevenueTokensCurrentMonth ?? 0)}
            />
            <StatCard
              label="Total platform revenue (month)"
              value={metricsLoading ? "…" : String(metrics?.totalRevenueTokensCurrentMonth ?? 0)}
            />
          </>
        ) : (
          <>
            <DisabledBlock title="Token metrics">
              Total tokens in platform • NestX tokens • Redeemable tokens
            </DisabledBlock>
            <DisabledBlock title="Economy (Phase 1A)">
              Economy is disabled. Cards are visible but inactive.
            </DisabledBlock>
            <DisabledBlock title="Creator / Payout (Phase 1A)">
              Creator approval, ticketed events, refunds, ADV/showcase economy.
            </DisabledBlock>
          </>
        )}
      </div>

      {/* Pending preview */}
      <div style={{ ...panel, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ fontWeight: 950 }}>Pending (preview)</div>
          <a href="/admin/pending" style={{ color: "white", textDecoration: "underline", fontWeight: 900, opacity: 0.9 }}>
            Open queue
          </a>
        </div>

        <div style={{ marginTop: 10, opacity: 0.85 }}>
          Primary queue preview (mock). Under construction.
        </div>

                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { label: "Verification approvals", tab: "Verification", value: pendingCounts.verification },
            { label: "Reports to review", tab: "Reports", value: pendingCounts.reports },
            { label: "Refund requests", tab: "Economy", value: pendingCounts.refunds },
          ].map((x) => (
            <div
              key={x.label}
              onClick={() => navigate(`/admin/pending?tab=${encodeURIComponent(x.tab)}`)}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.03)",
                cursor: "pointer",
              }}
              title={`Open Pending → ${x.tab}`}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ fontWeight: 900 }}>{x.label}</div>
                <div style={{ fontWeight: 950, opacity: 0.9 }}>
                  {pendingLoading ? "…" : String(x.value)}
                </div>
              </div>
              <div style={{ marginTop: 4, fontSize: 12, opacity: 0.8 }}>Pending items</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
