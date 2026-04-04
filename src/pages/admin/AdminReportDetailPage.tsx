import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/nestxApi";
import { panel } from "./adminUi";

type ReportDetail = {
  _id?: string;
  reportId?: string;

  reportType?: string | null;

  targetType?: string | null;
  targetId?: string | null;

  contextType?: string | null;
  contextId?: string | null;

  reasonCode?: string | null;
  reason?: string | null;
  reasonLabel?: string | null;

  note?: string | null;
  userMessage?: string | null;

  status?: string | null;
  severity?: string | null;
  confirmedSeverity?: string | null;
  confirmedCategory?: string | null;
  adminNote?: string | null;

  createdAt?: string | null;
  updatedAt?: string | null;
  reviewedAt?: string | null;

  targetOwnerId?: string | null;

  owner?: {
    userId?: string;
    username?: string | null;
    displayName?: string | null;
    avatar?: string | null;
    accountType?: string | null;
    isCreator?: boolean;
    creatorEnabled?: boolean;
  } | null;

  creator?: {
    userId?: string;
    username?: string | null;
    displayName?: string | null;
    avatar?: string | null;
    accountType?: string | null;
    isCreator?: boolean;
    creatorEnabled?: boolean;
  } | null;

  ownerModeration?: {
    userId?: string;
    isBanned?: boolean;
    bannedAt?: string | null;
    banReason?: string | null;
    isSuspended?: boolean;
    suspendedUntil?: string | null;
    suspendReason?: string | null;
  } | null;

  reporter?: {
    userId?: string;
    username?: string | null;
    displayName?: string | null;
    avatar?: string | null;
  } | null;

  eventLinked?: {
    eventId?: string;
    title?: string | null;
    creatorId?: string | null;
    creator?: {
      userId?: string;
      username?: string | null;
      displayName?: string | null;
      avatar?: string | null;
      accountType?: string | null;
      isCreator?: boolean;
      creatorEnabled?: boolean;
    } | null;
    status?: string | null;
    startAt?: string | null;
    endAt?: string | null;
    accessScope?: string | null;
    ticketPriceTokens?: number | null;
    viewerCount?: number | null;
    roomId?: string | null;
    reporterWasPresent?: boolean | null;
    privateSession?: {
      isEnabled?: boolean;
      status?: string | null;
      seats?: number | null;
      ticketPriceTokens?: number | null;
      reservedByUserId?: string | null;
      reservedAt?: string | null;
      acceptedAt?: string | null;
      economicStatus?: string | null;
      economicHeldTokens?: number | null;
      economicHeldAt?: string | null;
      economicReleasedAt?: string | null;
      economicFrozenAt?: string | null;
      economicRefundedAt?: string | null;
      economicResolutionReason?: string | null;
    } | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    reporterHasPaidTicket?: boolean | null;
    reporterTicket?: {
      ticketId?: string | null;
      scope?: string | null;
      roomId?: string | null;
      priceTokens?: number | null;
      purchasedAt?: string | null;
      status?: string | null;
    } | null;
  } | null;
  creatorDecision?: {
    type?: "refund" | "revoke_creator" | "refund_revoke_creator" | null;
    note?: string | null;
    appliedAt?: string | null;
    appliedBy?: string | null;
  } | null;
};

type TrustEvent = {
  kind?: string | null;
  reportId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  severity?: string | null;
  category?: string | null;
  eventId?: string | null;
  note?: string | null;
  reasonCode?: string | null;
  at?: string | null;
};

type TrustUser = {
  _id?: string;
  displayName?: string;
  accountType?: string;
  isVip?: boolean;
  isCreator?: boolean;
  verifiedUser?: boolean;
  verificationStatus?: string | null;
  verificationTotemStatus?: string | null;
  createdAt?: string | null;
};

type TrustRecord = {
  userId?: string;
  tier?: "OK" | "ATTENZIONE" | "CRITICO" | "BLOCCO" | string;
  tierScore?: number;
  confirmedTotal?: number;
  confirmedGrave?: number;
  confirmedGravissimo?: number;
  creatorFreezeTotal?: number;
  creatorRefundTotal?: number;
  creatorDisableTotal?: number;
  creatorReenableTotal?: number;
  manualRefundApprovedTotal?: number;
  lastConfirmedAt?: string | null;
  lastConfirmedSeverity?: string | null;
  lastConfirmedCategory?: string | null;
  lastCreatorFreezeAt?: string | null;
  lastCreatorRefundAt?: string | null;
  lastCreatorDisableAt?: string | null;
  lastCreatorReenableAt?: string | null;
  creatorFlagged?: boolean;
  creatorReviewNote?: string | null;
  lastEvents?: TrustEvent[];
};

type ProhibitedSearchRow = {
  qHash?: string | null;
  qLen?: number | null;
  matchedPatternSnapshot?: string | null;
  createdAt?: string | null;
};

type TrustPayload = {
  user?: TrustUser | null;
  trust?: TrustRecord | null;
  prohibitedSearches?: ProhibitedSearchRow[];
};

type NativePrivateReviewItem = {
  eventId: string;
  title?: string;
  status?: string;
  creator?: {
    id?: string;
    displayName?: string;
    email?: string;
    accountType?: string | null;
    isCreator?: boolean;
    creatorEnabled?: boolean;
    payoutEnabled?: boolean;
    payoutStatus?: string | null;
  } | null;
  privateEconomic?: {
    status?: "held" | "frozen" | "refunded" | "released" | "none" | string;
    heldTokens?: number;
    heldAt?: string | null;
    releaseEligibleAt?: string | null;
    releasedAt?: string | null;
    frozenAt?: string | null;
    refundedAt?: string | null;
    resolutionReason?: string | null;
  } | null;
  roomId?: string | null;
  ticketPriceTokens?: number;
  maxSeats?: number;
  createdAt?: string;
  updatedAt?: string;
};

type PreviewPayload = any;

function fmt(dt?: string | null) {
  if (!dt) return "—";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function badge(tone: "neutral" | "warn" | "danger" | "ok") {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid rgba(255,255,255,0.12)",
    color: "rgba(255,255,255,0.92)",
    background: "rgba(255,255,255,0.08)",
  };

  if (tone === "ok") return { ...base, background: "rgba(34,197,94,0.14)", borderColor: "rgba(34,197,94,0.35)" };
  if (tone === "warn") return { ...base, background: "rgba(245,158,11,0.14)", borderColor: "rgba(245,158,11,0.35)" };
  if (tone === "danger") return { ...base, background: "rgba(239,68,68,0.14)", borderColor: "rgba(239,68,68,0.35)" };
  return base;
}

function btn(disabled = false, tone: "neutral" | "approve" | "reject" = "neutral"): React.CSSProperties {
  const base: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 12,
    padding: "9px 12px",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.92)",
    opacity: disabled ? 0.45 : 1,
  };
  if (tone === "approve") return { ...base, background: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.35)" };
  if (tone === "reject") return { ...base, background: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.35)" };
  return base;
}

function smallCardStyle(): React.CSSProperties {
  return {
    ...panel,
    padding: 14,
  };
}

function renderTrustKind(kind?: string | null) {
  switch (String(kind || "")) {
    case "report_actioned":
      return "Report actioned";
    case "post_hidden":
      return "Post hidden";
    case "private_funds_frozen":
      return "Private funds frozen";
    case "private_funds_refunded":
      return "Private funds refunded";
    case "creator_disabled":
      return "Creator disabled";
    case "creator_reenabled":
      return "Creator re-enabled";
    case "manual_refund_approved":
      return "Manual refund approved";
    default:
      return kind || "—";
  }
}

function renderTierTone(tier?: string | null): "neutral" | "warn" | "danger" | "ok" {
  if (tier === "BLOCCO" || tier === "CRITICO") return "danger";
  if (tier === "ATTENZIONE") return "warn";
  return "ok";
}

function renderAdminPostMedia(media: any[] | undefined | null) {
  if (!Array.isArray(media) || media.length === 0) {
    return <span style={{ opacity: 0.75 }}>—</span>;
  }

  return (
    <div
      style={{
        marginTop: 8,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: 10,
      }}
    >
      {media.map((m: any, idx: number) => {
        const type = String(m?.type || "").trim().toLowerCase();
        const url = String(m?.url || "").trim();
        const thumbUrl = String(m?.thumbUrl || "").trim();
        if (!url) return null;

        const open = () => window.open(url, "_blank", "noopener,noreferrer");

        if (type === "image") {
          return (
            <div
              key={idx}
              style={{
                borderRadius: 12,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.04)",
                cursor: "pointer",
              }}
              onClick={open}
            >
              <img
                src={url}
                alt={`media-${idx}`}
                style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }}
              />
            </div>
          );
        }

        if (type === "video") {
          return (
            <div
              key={idx}
              style={{
                borderRadius: 12,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.04)",
              }}
            >
              <div
                onClick={open}
                style={{
                  position: "relative",
                  width: "100%",
                  height: 160,
                  cursor: "pointer",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                {thumbUrl ? (
                  <img
                    src={thumbUrl}
                    alt={`video-thumb-${idx}`}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>
                    VIDEO
                  </div>
                )}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(0,0,0,0.18)",
                    fontSize: 28,
                    fontWeight: 900,
                  }}
                >
                  ▶
                </div>
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

export default function AdminReportDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState<string | null>(null);

  const [previewData, setPreviewData] = useState<PreviewPayload | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [trustData, setTrustData] = useState<TrustPayload | null>(null);
  const [trustLoading, setTrustLoading] = useState(false);

  const [nativePrivate, setNativePrivate] = useState<NativePrivateReviewItem | null>(null);
  const [nativeLoading, setNativeLoading] = useState(false);

  const [decision, setDecision] = useState<string>("no_action");
  const [decisionNote, setDecisionNote] = useState("");
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [decisionErr, setDecisionErr] = useState<string | null>(null);
  const [decisionOk, setDecisionOk] = useState<string | null>(null);

  const [modNote, setModNote] = useState("");
  const [modBusy, setModBusy] = useState(false);
  const [modErr, setModErr] = useState<string | null>(null);

  async function loadDetail() {
    if (!id) return;
    try {
      setDetailLoading(true);
      setDetailErr(null);
      const res = await api.adminAction(`/admin/reports/${id}/detail`, "GET");
      const data = res?.data || res;
      setDetail(data || null);
    } catch (e: any) {
      setDetail(null);
      setDetailErr(e?.message || "Failed to load report detail");
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadPreview(currentDetail: ReportDetail | null) {
    const targetType = String(currentDetail?.targetType || "").trim();
    const targetId = String(currentDetail?.targetId || "").trim();
    if (!targetType || !targetId) {
      setPreviewData(null);
      return;
    }
    if (!["post", "comment", "live_message"].includes(targetType)) {
      setPreviewData(null);
      return;
    }
    try {
      setPreviewLoading(true);
      const res = await api.adminAction(
        `/admin/preview?type=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`,
        "GET"
      );
      setPreviewData(res?.data || res || null);
    } catch {
      setPreviewData(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function loadTrust(currentDetail: ReportDetail | null) {
    const ownerId = String(currentDetail?.targetOwnerId || "").trim();
    if (!ownerId) {
      setTrustData(null);
      return;
    }
    try {
      setTrustLoading(true);
      const res = await api.adminAction(`/admin/trust/user/${ownerId}`, "GET");
      setTrustData({
        user: res?.user || null,
        trust: res?.trust || null,
        prohibitedSearches: Array.isArray(res?.prohibitedSearches) ? res.prohibitedSearches : [],
      });
    } catch {
      setTrustData(null);
    } finally {
      setTrustLoading(false);
    }
  }

  async function loadNativePrivate(currentDetail: ReportDetail | null) {
    const contextType = String(currentDetail?.contextType || "").trim();
    const contextId = String(currentDetail?.contextId || "").trim();
    const targetType = String(currentDetail?.targetType || "").trim();
    const targetId = String(currentDetail?.targetId || "").trim();

    let eventId = "";

    if (targetType === "event" && targetId) {
        eventId = targetId;
    } else if (contextType === "live" && contextId) {
        eventId = contextId;
    }

    if (!eventId) {
        setNativePrivate(null);
        return;
    }

    try {
      setNativeLoading(true);
      const res = await api.adminAction(`/admin/economy/native-private-review?limit=100`, "GET");
      const items = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      const found = items.find((x: any) => String(x?.eventId || "") === eventId) || null;
      setNativePrivate(found);
    } catch {
      setNativePrivate(null);
    } finally {
      setNativeLoading(false);
    }
  }

  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!detail) return;
    loadPreview(detail);
    loadTrust(detail);
    loadNativePrivate(detail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?._id, detail?.reportId, detail?.targetOwnerId, detail?.targetType, detail?.targetId, detail?.contextType, detail?.contextId]);

  const eventLinked = detail?.eventLinked ?? null;
  const hasPaidReporterTicket = !!(
    eventLinked?.reporterHasPaidTicket &&
    eventLinked?.reporterTicket?.ticketId &&
    Number(eventLinked?.reporterTicket?.priceTokens || 0) > 0
  );

  const availableDecisionOptions = useMemo(() => {
    const out = [
      { value: "no_action", label: "No action" },
      { value: "revoke_creator", label: "Revoke creator" },
    ];

    if (hasPaidReporterTicket) {
      out.push({ value: "refund", label: "Refund" });
      out.push({ value: "refund_revoke_creator", label: "Refund + Revoke creator" });
    }

    return out;
  }, [hasPaidReporterTicket]);

  useEffect(() => {
    const savedType = String(detail?.creatorDecision?.type || "").trim();
    const savedNote = String(detail?.creatorDecision?.note || "");

    if (savedType) {
      setDecision(savedType);
      setDecisionNote(savedNote);
      return;
    }

    if (!availableDecisionOptions.some((x) => x.value === decision)) {
      setDecision("no_action");
    }
  }, [detail?.creatorDecision?.type, detail?.creatorDecision?.note, availableDecisionOptions]);

  const outcomePreview = useMemo(() => {
    if (decision === "refund") {
      return {
        funds: "Refund to buyer",
        creator: "No creator restriction",
        economy: "Held/frozen private funds will be refunded",
      };
    }

    if (decision === "revoke_creator") {
      return {
        funds: "No refund",
        creator: "Creator revoked",
        economy: "No economy refund action",
      };
    }

    if (decision === "refund_revoke_creator") {
      return {
        funds: "Refund to buyer",
        creator: "Creator revoked",
        economy: "Refund applied and creator monetization revoked",
      };
    }

    return {
      funds: "No refund",
      creator: "No creator restriction",
      economy: "No economy action",
    };
  }, [decision]);

  async function refreshAll() {
    await loadDetail();
  }

  async function applyCreatorDecision() {
    if (!id) {
      setDecisionErr("Missing report id");
      return;
    }

    const note = decisionNote.trim();

    if (decision === "no_action") {
      setDecisionErr("Select a real creator decision.");
      return;
    }

    if (note.length < 3) {
      setDecisionErr("Admin note is required.");
      return;
    }

    try {
      setDecisionBusy(true);
      setDecisionErr(null);
      setDecisionOk(null);

      await api.adminAction(`/admin/reports/${id}/creator-decision`, "PATCH", {
        decision,
        note,
      });

      setDecisionOk("Decision applied.");
      await refreshAll();
      await loadTrust(detail);
      await loadNativePrivate(detail);
    } catch (e: any) {
      setDecisionErr(e?.message || "Failed to apply decision");
    } finally {
      setDecisionBusy(false);
    }
  }

  async function updateReportStatus(
    kind: "hidden" | "reviewed" | "actioned",
    actionSeverity?: "grave" | "gravissimo"
  ) {
    const note = decisionNote.trim();

    if (kind === "actioned" && note.length < 3) {
      setDecisionErr("Admin note is required.");
      return;
    }

    try {
      setDecisionBusy(true);
      setDecisionErr(null);
      setDecisionOk(null);

      const body: any = {
        status: kind,
        adminNote: note || null,
      };

      if (kind === "actioned") {
        body.severity = actionSeverity || "grave";
      }

      await api.adminAction(`/admin/reports/${id}`, "PATCH", body);
      setDecisionOk(`Report updated: ${kind}`);
      await refreshAll();
      await loadTrust(detail);
    } catch (e: any) {
      setDecisionErr(e?.message || "Failed to update report");
    } finally {
      setDecisionBusy(false);
    }
  }

  async function runModeration(action: "suspend_7d" | "unsuspend" | "ban" | "unban") {
    const ownerId = String(detail?.targetOwnerId || "").trim();
    if (!ownerId) {
      setModErr("Missing target owner");
      return;
    }

    const note = modNote.trim();

    if ((action === "suspend_7d" || action === "ban") && note.length < 3) {
      setModErr("Admin note is required.");
      return;
    }

    try {
      setModBusy(true);
      setModErr(null);
      await api.adminAction(`/admin/users/${ownerId}/moderation`, "PATCH", {
        action,
        adminNote: note,
      });
      await refreshAll();
    } catch (e: any) {
      setModErr(e?.message || "Moderation failed");
    } finally {
      setModBusy(false);
    }
  }

  const isLiveContext = detail?.contextType === "live";
  const isEventTarget = detail?.targetType === "event";
  const hasCreatorOwner = !!detail?.targetOwnerId;

  const canShowCreatorReview = isLiveContext || isEventTarget || hasCreatorOwner;
  const creatorDecisionLocked = !!detail?.creatorDecision?.type;
  const trust = trustData?.trust || null;
  const trustEvents = Array.isArray(trust?.lastEvents) ? [...trust.lastEvents].reverse() : [];
  const latestTrustEvent = trustEvents[0] || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 950 }}>Report detail</div>
          <div style={{ marginTop: 6, opacity: 0.82 }}>
            Full review page for live/event reports and creator/economy decisions.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={btn(false, "neutral")} onClick={() => navigate("/admin/pending?tab=Reports")}>
            Back to Pending
          </button>
          <button style={btn(detailLoading, "neutral")} onClick={refreshAll} disabled={detailLoading}>
            {detailLoading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {detailErr ? (
        <div style={{ ...smallCardStyle(), border: "1px solid rgba(239,68,68,0.35)" }}>
          <div style={{ fontWeight: 900 }}>Error</div>
          <div style={{ marginTop: 6, opacity: 0.9 }}>{detailErr}</div>
        </div>
      ) : null}

      {!detailLoading && !detail ? (
        <div style={smallCardStyle()}>Report not found.</div>
      ) : null}

      {detail ? (
        <>
          <div style={{ ...smallCardStyle(), display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 14 }}>
            <div>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Report context</div>
              <div><b>ID:</b> {detail.reportId || detail._id || "—"}</div>
              <div style={{ marginTop: 6 }}><b>Report type:</b> {detail.reportType || "—"}</div>
              <div style={{ marginTop: 6 }}><b>Status:</b> {detail.status || "—"}</div>
              <div style={{ marginTop: 6 }}><b>Target type:</b> {detail.targetType || "—"}</div>
              <div style={{ marginTop: 6 }}><b>Target ID:</b> {detail.targetId || "—"}</div>
              <div style={{ marginTop: 6 }}><b>Context type:</b> {detail.contextType || "—"}</div>
              <div style={{ marginTop: 6 }}><b>Context ID:</b> {detail.contextId || "—"}</div>
              <div style={{ marginTop: 6 }}><b>Created:</b> {fmt(detail.createdAt)}</div>
              <div style={{ marginTop: 6 }}><b>Reviewed:</b> {fmt(detail.reviewedAt)}</div>
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Reporter / reason</div>

              <div>
                <b>Reporter:</b>{" "}
                {detail.reporter?.userId ? (
                  <span
                    style={{ textDecoration: "underline", cursor: "pointer" }}
                    onClick={() => window.open(`/app/profile/${detail.reporter?.userId}`, "_blank")}
                  >
                    {detail.reporter?.username || detail.reporter?.displayName || detail.reporter?.userId}
                  </span>
                ) : "—"}
              </div>

              <div style={{ marginTop: 6 }}><b>Reason code:</b> {detail.reasonCode || "—"}</div>
              <div style={{ marginTop: 6 }}><b>Reason label:</b> {detail.reasonLabel || "—"}</div>
              <div style={{ marginTop: 6 }}><b>Reason text:</b> {detail.reason || "—"}</div>
              <div style={{ marginTop: 6 }}><b>User message:</b> {detail.userMessage || detail.note || "—"}</div>
              <div style={{ marginTop: 6 }}><b>Admin note:</b> {detail.adminNote || "—"}</div>

              <div style={{ marginTop: 6 }}>
                <b>Owner:</b>{" "}
                {detail.owner?.userId ? (
                  <span
                    style={{ textDecoration: "underline", cursor: "pointer" }}
                    onClick={() => window.open(`/app/profile/${detail.owner?.userId}`, "_blank")}
                  >
                    {detail.owner?.username || detail.owner?.displayName || detail.owner?.userId}
                  </span>
                ) : detail.targetOwnerId || "—"}
              </div>

              <div style={{ marginTop: 6 }}>
                <b>Creator:</b>{" "}
                {detail.creator?.userId ? (
                  <span
                    style={{ textDecoration: "underline", cursor: "pointer" }}
                    onClick={() => window.open(`/app/profile/${detail.creator?.userId}`, "_blank")}
                  >
                    {detail.creator?.username || detail.creator?.displayName || detail.creator?.userId}
                  </span>
                ) : "—"}
              </div>

              {eventLinked ? (
                <>
                  <div style={{ marginTop: 14, fontWeight: 900 }}>Event summary</div>
                  <div style={{ marginTop: 6 }}><b>Event ID:</b> {eventLinked.eventId || "—"}</div>
                  <div style={{ marginTop: 6 }}><b>Title:</b> {eventLinked.title || "—"}</div>
                  <div style={{ marginTop: 6 }}><b>Status:</b> {eventLinked.status || "—"}</div>
                  <div style={{ marginTop: 6 }}><b>Start:</b> {fmt(eventLinked.startAt)}</div>
                  <div style={{ marginTop: 6 }}><b>End:</b> {fmt(eventLinked.endAt)}</div>
                  <div style={{ marginTop: 6 }}>
                    <b>Event creator:</b>{" "}
                    {eventLinked.creator?.userId ? (
                      <span
                        style={{ textDecoration: "underline", cursor: "pointer" }}
                        onClick={() => window.open(`/app/profile/${eventLinked.creator?.userId}`, "_blank")}
                      >
                        {eventLinked.creator?.username || eventLinked.creator?.displayName || eventLinked.creator?.userId}
                      </span>
                    ) : eventLinked.creatorId || "—"}
                  </div>
                  <div style={{ marginTop: 6 }}><b>Access scope:</b> {eventLinked.accessScope || "—"}</div>
                  <div style={{ marginTop: 6 }}><b>Ticket price:</b> {Number(eventLinked.ticketPriceTokens || 0)}</div>
                  <div style={{ marginTop: 6 }}><b>Total viewers:</b> {Number(eventLinked.viewerCount || 0)}</div>
                  <div style={{ marginTop: 6 }}>
                    <b>Reporter has paid ticket:</b>{" "}
                    {eventLinked.reporterHasPaidTicket == null
                      ? "N/A"
                      : eventLinked.reporterHasPaidTicket
                      ? "Yes"
                      : "No"}
                  </div>

                  <div style={{ marginTop: 6 }}>
                    <b>Ticket ID:</b> {eventLinked.reporterTicket?.ticketId || "—"}
                  </div>
                </>
              ) : null}
            </div>
          </div>

          {previewLoading ? (
            <div style={smallCardStyle()}>Loading preview…</div>
          ) : previewData ? (
            <div style={smallCardStyle()}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Preview</div>

              {previewData?.post ? (
                <div style={{ lineHeight: 1.55 }}>
                  <div><b>Author:</b> {previewData.postAuthor?.displayName || previewData.postAuthor?.username || "—"}</div>
                  <div style={{ marginTop: 6 }}><b>Text:</b> {previewData.post?.text || "—"}</div>
                  <div style={{ marginTop: 6 }}><b>Moderation:</b> {previewData.post?.moderation?.status || (previewData.post?.isHidden ? "hidden" : "visible")}</div>
                  <div style={{ marginTop: 8 }}><b>Media:</b>{renderAdminPostMedia(previewData.post?.media)}</div>
                </div>
              ) : null}

              {previewData?.comment ? (
                <div style={{ lineHeight: 1.55 }}>
                  <div><b>Comment author:</b> {previewData.commentAuthor?.displayName || previewData.commentAuthor?.username || "—"}</div>
                  <div style={{ marginTop: 6 }}><b>Comment:</b> {previewData.comment?.text || previewData.comment?.body || "—"}</div>
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <div><b>Parent post:</b> {previewData.post?.text || "—"}</div>
                    <div style={{ marginTop: 8 }}><b>Post media:</b>{renderAdminPostMedia(previewData.post?.media)}</div>
                  </div>
                </div>
              ) : null}

              {previewData?.message ? (
                <div style={{ lineHeight: 1.55 }}>
                  <div><b>Author:</b> {previewData.messageAuthor?.displayName || previewData.messageAuthor?.username || "—"}</div>
                  <div style={{ marginTop: 6 }}><b>Message:</b> {previewData.message?.text || previewData.message?.message || "—"}</div>
                  <div style={{ marginTop: 6 }}><b>Event:</b> {previewData.event?.title || previewData.event?._id || "—"}</div>
                </div>
              ) : null}
            </div>
          ) : null}

          {canShowCreatorReview ? (
            <>
              <div style={{ ...smallCardStyle(), display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 14 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ fontWeight: 900 }}>Trust snapshot</div>
                    {trustLoading ? null : <span style={badge(renderTierTone(trust?.tier))}>{trust?.tier || "OK"}</span>}
                  </div>

                  {trustLoading ? (
                    <div style={{ opacity: 0.8 }}>Loading trust…</div>
                  ) : (
                    <>
                      <div><b>Creator:</b> {trustData?.user?.displayName || "—"}</div>
                      <div style={{ marginTop: 6 }}><b>Confirmed total:</b> {Number(trust?.confirmedTotal || 0)}</div>
                      <div style={{ marginTop: 6 }}><b>Grave:</b> {Number(trust?.confirmedGrave || 0)}</div>
                      <div style={{ marginTop: 6 }}><b>Gravissimo:</b> {Number(trust?.confirmedGravissimo || 0)}</div>
                      <div style={{ marginTop: 6 }}><b>Freeze total:</b> {Number(trust?.creatorFreezeTotal || 0)}</div>
                      <div style={{ marginTop: 6 }}><b>Refund total:</b> {Number(trust?.creatorRefundTotal || 0)}</div>
                      <div style={{ marginTop: 6 }}><b>Disable total:</b> {Number(trust?.creatorDisableTotal || 0)}</div>
                      <div style={{ marginTop: 6 }}><b>Re-enable total:</b> {Number(trust?.creatorReenableTotal || 0)}</div>
                      <div style={{ marginTop: 6 }}><b>Review note:</b> {trust?.creatorReviewNote || "—"}</div>
                    </>
                  )}
                </div>

                <div>
                  <div style={{ fontWeight: 900, marginBottom: 10 }}>Why flagged</div>
                  <div><b>Current cause:</b> {detail.reason || "—"}</div>
                  <div style={{ marginTop: 6 }}><b>Current message:</b> {detail.userMessage || detail.note || "—"}</div>
                  <div style={{ marginTop: 6 }}><b>Latest trust event:</b> {latestTrustEvent ? renderTrustKind(latestTrustEvent.kind) : "—"}</div>
                  <div style={{ marginTop: 6 }}><b>Reason code:</b> {latestTrustEvent?.reasonCode || "—"}</div>
                  <div style={{ marginTop: 6 }}><b>Latest note:</b> {latestTrustEvent?.note || "—"}</div>
                  <div style={{ marginTop: 6 }}><b>Latest event at:</b> {fmt(latestTrustEvent?.at)}</div>
                </div>
              </div>

              <div style={smallCardStyle()}>
                <div style={{ fontWeight: 900, marginBottom: 10 }}>Trust timeline</div>
                {!trustEvents.length ? (
                  <div style={{ opacity: 0.8 }}>No trust events.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {trustEvents.map((ev, idx) => (
                      <div
                        key={`${ev.kind || "ev"}_${idx}`}
                        style={{
                          padding: 10,
                          borderRadius: 12,
                          border: "1px solid rgba(255,255,255,0.08)",
                          background: "rgba(255,255,255,0.03)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                          <div style={{ fontWeight: 900 }}>{renderTrustKind(ev.kind)}</div>
                          <div style={{ opacity: 0.78, fontSize: 12 }}>{fmt(ev.at)}</div>
                        </div>
                        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.92 }}>
                          <div><b>Reason code:</b> {ev.reasonCode || "—"}</div>
                          <div style={{ marginTop: 4 }}><b>Severity:</b> {ev.severity || "—"}</div>
                          <div style={{ marginTop: 4 }}><b>Note:</b> {ev.note || "—"}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

                            <div style={smallCardStyle()}>
                <div style={{ fontWeight: 900, marginBottom: 10 }}>Creator decision</div>

                {creatorDecisionLocked ? (
                  <div
                    style={{
                      marginBottom: 12,
                      padding: 10,
                      borderRadius: 12,
                      border: "1px solid rgba(34,197,94,0.35)",
                      background: "rgba(34,197,94,0.10)",
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>Decision already applied</div>
                    <div style={{ marginTop: 6, opacity: 0.92 }}>
                      <b>Type:</b> {detail?.creatorDecision?.type || "—"}
                    </div>
                    <div style={{ marginTop: 4, opacity: 0.92 }}>
                      <b>Applied at:</b> {fmt(detail?.creatorDecision?.appliedAt)}
                    </div>
                  </div>
                ) : null}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <div style={{ fontWeight: 900, marginBottom: 6, fontSize: 13, opacity: 0.9 }}>Admin decision</div>
                    <select
                      value={decision}
                      onChange={(e) => setDecision(e.target.value)}
                      disabled={decisionBusy || creatorDecisionLocked}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.14)",
                        background: "rgba(255,255,255,0.06)",
                        color: "white",
                        fontWeight: 900,
                        outline: "none",
                      }}
                    >
                      {availableDecisionOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    <div style={{ fontWeight: 900, marginTop: 12, marginBottom: 6, fontSize: 13, opacity: 0.9 }}>Admin note</div>
                    <textarea
                      value={decisionNote}
                      onChange={(e) => setDecisionNote(e.target.value)}
                      disabled={decisionBusy || creatorDecisionLocked}
                      rows={4}
                      placeholder="Required for actions..."
                      style={{
                        width: "100%",
                        resize: "vertical",
                        borderRadius: 12,
                        padding: 10,
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "rgba(255,255,255,0.05)",
                        color: "rgba(255,255,255,0.92)",
                        outline: "none",
                      }}
                    />
                  </div>

                  <div>
                    <div style={{ fontWeight: 900, marginBottom: 8 }}>Outcome preview</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div
                        style={{
                          padding: 10,
                          borderRadius: 12,
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <b>Funds:</b> {outcomePreview.funds}
                      </div>

                      <div
                        style={{
                          padding: 10,
                          borderRadius: 12,
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <b>Creator:</b> {outcomePreview.creator}
                      </div>

                      <div
                        style={{
                          padding: 10,
                          borderRadius: 12,
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <b>Economy / Refund effect:</b> {outcomePreview.economy}
                      </div>

                      {nativeLoading ? (
                        <div style={{ opacity: 0.8 }}>Loading economy status…</div>
                      ) : nativePrivate?.privateEconomic ? (
                        <div
                          style={{
                            padding: 10,
                            borderRadius: 12,
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          <div><b>Current economic status:</b> {nativePrivate.privateEconomic.status || "—"}</div>
                          <div style={{ marginTop: 4 }}><b>Held tokens:</b> {Number(nativePrivate.privateEconomic.heldTokens || 0)}</div>
                          <div style={{ marginTop: 4 }}><b>Held at:</b> {fmt(nativePrivate.privateEconomic.heldAt)}</div>
                          <div style={{ marginTop: 4 }}><b>Frozen at:</b> {fmt(nativePrivate.privateEconomic.frozenAt)}</div>
                          <div style={{ marginTop: 4 }}><b>Refunded at:</b> {fmt(nativePrivate.privateEconomic.refundedAt)}</div>
                          <div style={{ marginTop: 4 }}><b>Release eligible:</b> {fmt(nativePrivate.privateEconomic.releaseEligibleAt)}</div>
                          <div style={{ marginTop: 4 }}><b>Resolution reason:</b> {nativePrivate.privateEconomic.resolutionReason || "—"}</div>
                        </div>
                      ) : hasPaidReporterTicket ? (
                        <div
                          style={{
                            padding: 10,
                            borderRadius: 12,
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          <div><b>Refund basis:</b> Paid reporter ticket found</div>
                          <div style={{ marginTop: 4 }}><b>Ticket ID:</b> {eventLinked?.reporterTicket?.ticketId || "—"}</div>
                          <div style={{ marginTop: 4 }}><b>Ticket price:</b> {Number(eventLinked?.reporterTicket?.priceTokens || 0)}</div>
                          <div style={{ marginTop: 4 }}><b>Purchased at:</b> {fmt(eventLinked?.reporterTicket?.purchasedAt)}</div>
                        </div>
                      ) : (
                        <div
                          style={{
                            padding: 10,
                            borderRadius: 12,
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          No refundable paid ticket linked.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {decisionErr ? <div style={{ marginTop: 12, color: "rgba(239,68,68,0.95)" }}>{decisionErr}</div> : null}
                {decisionOk ? <div style={{ marginTop: 12, color: "rgba(34,197,94,0.95)" }}>{decisionOk}</div> : null}

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                  <button
                    style={btn(decisionBusy || creatorDecisionLocked, "approve")}
                    disabled={decisionBusy || creatorDecisionLocked}
                    onClick={applyCreatorDecision}
                  >
                    {decisionBusy ? "Applying..." : "Confirm creator decision"}
                  </button>
                </div>
              </div>

              <div style={smallCardStyle()}>
                <div style={{ fontWeight: 900, marginBottom: 10 }}>Report actions</div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                    style={btn(decisionBusy, "reject")}
                    disabled={decisionBusy}
                    onClick={() => updateReportStatus("hidden")}
                    >
                    Hide target
                    </button>

                    <button
                    style={btn(decisionBusy, "neutral")}
                    disabled={decisionBusy}
                    onClick={() => updateReportStatus("reviewed")}
                    >
                    Resolve
                    </button>

                    <button
                    style={btn(decisionBusy, "reject")}
                    disabled={decisionBusy}
                    onClick={() => updateReportStatus("actioned", "grave")}
                    >
                    Action (grave)
                    </button>

                    <button
                    style={btn(decisionBusy, "reject")}
                    disabled={decisionBusy}
                    onClick={() => updateReportStatus("actioned", "gravissimo")}
                    >
                    Action (gravissimo)
                    </button>
                </div>
                </div>
            </>
          ) : null}

          <div style={smallCardStyle()}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Account moderation</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "start" }}>
              <div>
                <div><b>Banned:</b> {detail.ownerModeration?.isBanned ? "Yes" : "No"}</div>
                <div style={{ marginTop: 6 }}><b>Ban reason:</b> {detail.ownerModeration?.banReason || "—"}</div>
                <div style={{ marginTop: 6 }}><b>Suspended:</b> {detail.ownerModeration?.isSuspended ? "Yes" : "No"}</div>
                <div style={{ marginTop: 6 }}><b>Suspended until:</b> {fmt(detail.ownerModeration?.suspendedUntil)}</div>

                <div style={{ fontWeight: 900, marginTop: 12, marginBottom: 6, fontSize: 13, opacity: 0.9 }}>Admin note</div>
                <textarea
                  value={modNote}
                  onChange={(e) => setModNote(e.target.value)}
                  rows={3}
                  placeholder="Required for suspend / ban"
                  style={{
                    width: "100%",
                    resize: "vertical",
                    borderRadius: 12,
                    padding: 10,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.92)",
                    outline: "none",
                  }}
                />
                {modErr ? <div style={{ marginTop: 10, color: "rgba(239,68,68,0.95)" }}>{modErr}</div> : null}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button style={btn(modBusy, "reject")} disabled={modBusy} onClick={() => runModeration("suspend_7d")}>
                  Suspend 7 days
                </button>
                <button style={btn(modBusy, "reject")} disabled={modBusy} onClick={() => runModeration("ban")}>
                  Ban
                </button>
                {detail.ownerModeration?.isSuspended ? (
                  <button style={btn(modBusy, "neutral")} disabled={modBusy} onClick={() => runModeration("unsuspend")}>
                    Unsuspend
                  </button>
                ) : null}
                {detail.ownerModeration?.isBanned ? (
                  <button style={btn(modBusy, "neutral")} disabled={modBusy} onClick={() => runModeration("unban")}>
                    Unban
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {Array.isArray(trustData?.prohibitedSearches) && trustData!.prohibitedSearches!.length > 0 ? (
            <div style={smallCardStyle()}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Prohibited searches</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {trustData!.prohibitedSearches!.map((row, idx) => (
                  <div
                    key={`${row.qHash || "hash"}_${idx}`}
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    <div><b>Hash:</b> {row.qHash || "—"}</div>
                    <div style={{ marginTop: 4 }}><b>Length:</b> {row.qLen ?? "—"}</div>
                    <div style={{ marginTop: 4 }}><b>Pattern:</b> {row.matchedPatternSnapshot || "—"}</div>
                    <div style={{ marginTop: 4 }}><b>Created:</b> {fmt(row.createdAt)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}