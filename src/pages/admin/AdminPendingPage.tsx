import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DisabledBadge, featureFlag, panel } from "./adminUi";
import { api } from "../../api/nestxApi";

type PendingPriority = "P0" | "P1" | "P2" | "P3" | "P4";
type PendingStatus = "pending" | "flagged" | "hidden" | "approved" | "rejected" | "resolved";

type PendingType =
  | "verification_pending"
  | "verification_resubmission"
  | "report_post"
  | "report_profile"
  | "report_media"
  | "report_comment"
  | "report_live_message"
  | "report_event"
  | "report_live"
  | "economy_refund"
  | "economy_refund_request"
  | "economy_creator_approval";

type PendingCategory = "Critical" | "Verification" | "Reports" | "Economy" | "Ops";

type PendingItem = {
  id: string;
  type: PendingType;
  priority: PendingPriority;
  subject: string; // username / postId / mediaId
  createdAt: string; // ISO
  status: PendingStatus;
  links?: {
    open?: string;
    user?: string; // optional: navigate to user detail/list
    target?: string; // optional: navigate to post/media/event/etc.
  };
  actions?: {
    approve?: { method: string; path: string; body?: any };
    reject?: { method: string; path: string; body?: any };
    resolve?: { method: string; path: string; body?: any };
    hide?: { method: string; path: string; body?: any };
    actioned?: { method: string; path: string; body?: any }; // ✅ NEW
  };
};

function linkStyle(): React.CSSProperties {
  return {
    color: "rgba(255,255,255,0.92)",
    textDecoration: "underline",
    textDecorationColor: "rgba(255,255,255,0.35)",
    cursor: "pointer",
  };
}

function extractFirstUserHandle(subject: string): string | null {
  const m = subject.match(/@([a-zA-Z0-9_\.]+)/);
  if (!m) return null;
  return "@" + m[1];
}

function extractMongoId(input: string): string | null {
  const m = input.match(/[a-fA-F0-9]{24}/);
  return m ? m[0] : null;
}

function appProfileUrl(userId: string) {
  return `/app/profile/${userId}`;
}

function adminEventUrl(eventId: string) {
  return `/admin/events/${eventId}`;
}

const PRIORITY_ORDER: Record<PendingPriority, number> = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };

function categoryOf(item: PendingItem): PendingCategory {
  // category MUST be derived from type (source of truth)
  if (item.type.startsWith("report_")) return "Reports";
  if (item.type.startsWith("verification_")) return "Verification";
  if (item.type.startsWith("economy_")) return "Economy";
  if (item.type.startsWith("critical_")) return "Critical";
  if (item.type.startsWith("ops_")) return "Ops";

  // fallback: keep old logic
  if (item.priority === "P0") return "Critical";
  if (item.priority === "P1") return "Verification";
  if (item.priority === "P2") return "Reports";
  if (item.priority === "P3") return "Economy";
  return "Ops";
}

function typeLabel(t: PendingType) {
  switch (t) {
    case "verification_pending":
      return "Verification";
    case "verification_resubmission":
      return "Verification · Re-submit";
    case "report_post":
      return "Report · Post";
    case "report_profile":
      return "Report · Profile";
    case "report_media":
      return "Report · Media";
    case "report_comment":
      return "Report · Comment";
    case "report_live_message":
      return "Report · Live message";
    case "report_event":
      return "Report · Event";
    case "report_live":
      return "Report · Live";
    case "economy_refund":
      return "Economy · Refund";
    case "economy_refund_request":
      return "Economy · Refund";
    case "economy_creator_approval":
      return "Economy · Creator Approval";
    default:
      return t;
  }
}

function badgeStyle(kind: "type" | "priority" | "status") {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 950,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.90)",
    whiteSpace: "nowrap",
  };
  if (kind === "priority") return { ...base, background: "rgba(255,255,255,0.10)" };
  if (kind === "status") return { ...base, background: "rgba(255,255,255,0.06)", opacity: 0.92 };
  return base;
}

function pillBtn(active: boolean): React.CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.14)",
    background: active ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.92)",
    borderRadius: 999,
    padding: "7px 10px",
    fontWeight: 950,
    cursor: "pointer",
    fontSize: 12,
    opacity: active ? 1 : 0.9,
  };
}

function smallBtn(disabled?: boolean, tone: "neutral" | "approve" | "reject" = "neutral"): React.CSSProperties {
  const base: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 12,
    padding: "7px 10px",
    fontWeight: 950,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 12,
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.92)",
    opacity: disabled ? 0.45 : 0.95,
  };
  if (tone === "approve") return { ...base, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.35)" };
  if (tone === "reject") return { ...base, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)" };
  return base;
}

function formatTs(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
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
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
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
              title="Open image"
            >
              <img
                src={url}
                alt={`post-media-${idx}`}
                style={{
                  display: "block",
                  width: "100%",
                  height: 140,
                  objectFit: "cover",
                  background: "rgba(255,255,255,0.03)",
                }}
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
                title="Open video"
                style={{
                  position: "relative",
                  width: "100%",
                  height: 140,
                  cursor: "pointer",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                {thumbUrl ? (
                  <img
                    src={thumbUrl}
                    alt={`post-video-thumb-${idx}`}
                    style={{
                      display: "block",
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 900,
                      opacity: 0.85,
                    }}
                  >
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
                    background: "rgba(0,0,0,0.20)",
                    fontSize: 26,
                    fontWeight: 900,
                  }}
                >
                  ▶
                </div>
              </div>
            </div>
          );
        }

        return (
          <div
            key={idx}
            style={{
              padding: 10,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <span style={{ opacity: 0.9 }}>Unsupported media</span>
          </div>
        );
      })}
    </div>
  );
}

function Drawer({
  item,
  onClose,
  onApprove,
  onReject,
  onHide,
  onResolve,
  economyEnabled,
  navigateTo,
}: {
  item: PendingItem;
  onClose: () => void;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
  onHide: () => Promise<void>;
  onResolve: () => Promise<void>;
  economyEnabled: boolean;
  navigateTo: (to: string) => void;
}) {
  const isVerification = item.type === "verification_pending" || item.type === "verification_resubmission";
  const isEconomy = item.type.startsWith("economy_");
  const isReport = item.type.startsWith("report_");
  const disableEconomy = isEconomy && !economyEnabled;

  const userIdFromMeta = (item as any)?.meta?.userId ? String((item as any).meta.userId) : null;
  const userIdFromLink = item.links?.user ? extractMongoId(item.links.user) : null;
  const userId = userIdFromMeta || userIdFromLink;

  const [verificationDetail, setVerificationDetail] = useState<any | null>(null);
  const [verificationLoading, setVerificationLoading] = useState(false);

  const [reportDetail, setReportDetail] = useState<any | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportErr, setReportErr] = useState<string | null>(null);

  const [previewData, setPreviewData] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewErr, setPreviewErr] = useState<string | null>(null);

  const [adminNote, setAdminNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [modNote, setModNote] = useState("");

  async function runAction(kind: "approve" | "reject" | "hide" | "reviewed" | "actioned", body?: any) {
    const a = (item.actions as any)?.[kind];
    if (!a?.path) {
      setActionErr(`Missing action: ${kind}`);
      return;
    }
    try {
      setActionLoading(true);
      setActionErr(null);
      const method = (a.method || "POST") as any;
      const mergedBody =
        (body || a.body)
          ? { ...(a.body || {}), ...(body || {}) }
          : undefined;

      await api.adminAction(a.path, method, mergedBody);
      // dopo success: refresh + close gestiti dal parent (onApprove/onReject/...)
      if (kind === "approve") await onApprove();
      else if (kind === "reject") await onReject();
      else if (kind === "hide") await onHide();
      else await onResolve();
    } catch (e: any) {
      console.error("runAction error:", e);
      setActionErr(e?.message || "Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function loadVerificationDetail() {
    if (!isVerification) return;
    if (!userId) {
      setVerificationDetail(null);
      return;
    }
    try {
      setVerificationLoading(true);
      const res = await api.adminAction(`/verification/admin/${userId}`, "GET");
      setVerificationDetail(res?.data || res);
    } catch (e: any) {
      console.error("loadVerificationDetail error:", e);
      setVerificationDetail(null);
    } finally {
      setVerificationLoading(false);
    }
  }

  async function loadReportDetail() {
    if (!isReport) return;
    const reportId = item.id;
    if (!reportId) return;
    try {
      setReportLoading(true);
      setReportErr(null);
      const res = await api.adminAction(`/admin/reports/${reportId}/detail`, "GET");
      setReportDetail(res?.data || res);
    } catch (e: any) {
      console.error("loadReportDetail error:", e);
      setReportDetail(null);
      setReportErr(e?.message || "Failed to load report detail");
    } finally {
      setReportLoading(false);
    }
  }

  async function loadAdminPreview() {
    if (!isReport) return;

    const targetType = String(reportDetail?.targetType || (item as any)?.meta?.targetType || "").trim();
    const targetId = String(reportDetail?.targetId || (item as any)?.meta?.targetId || "").trim();

    if (!targetType || !targetId) {
      setPreviewData(null);
      return;
    }

    // preview dedicata solo per contenuti che possono essere invisibili lato app
    if (!["post", "comment", "live_message"].includes(targetType)) {
      setPreviewData(null);
      return;
    }

    try {
      setPreviewLoading(true);
      setPreviewErr(null);

      const res = await api.adminAction(
        `/admin/preview?type=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`,
        "GET"
      );

      setPreviewData(res?.data || res);
    } catch (e: any) {
      console.error("loadAdminPreview error:", e);
      setPreviewData(null);
      setPreviewErr(e?.message || "Failed to load admin preview");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function runModeration(action: "suspend_7d" | "unsuspend" | "ban" | "unban", adminNote: string) {
    if (!isReport) return;

    const ownerId =
      reportDetail?.targetOwnerId ||
      reportDetail?.data?.targetOwnerId ||
      null;

    if (!ownerId) {
      setReportErr("Missing targetOwnerId (cannot moderate)");
      return;
    }

    const note = (adminNote || "").trim();

    if ((action === "suspend_7d" || action === "ban") && note.length < 3) {
      setReportErr("Admin note is required.");
      return;
    }

    try {
      setReportLoading(true);
      setReportErr(null);

      await api.adminAction(`/admin/users/${ownerId}/moderation`, "PATCH", {
        action,
        adminNote: note,
      });

      // refresh detail (updates ownerModeration + history)
      await loadReportDetail();
    } catch (e: any) {
      console.error("runModeration error:", e);
      setReportErr(e?.message || "Moderation failed");
    } finally {
      setReportLoading(false);
    }
  }

  useEffect(() => {
    loadVerificationDetail();
    loadReportDetail();
    setPreviewData(null);
    setPreviewErr(null);
    setModNote("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, item?.type]);

  useEffect(() => {
    if (!isReport) return;
    loadAdminPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportDetail?.targetType, reportDetail?.targetId, item?.id]);

  function go(to?: string) {
    if (!to) return;
    navigateTo(to);
  }

  const detailTitle = isVerification ? "Verification" : isReport ? "Report" : isEconomy ? "Economy" : "Ops";

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 50,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100vh",
          width: "min(520px, 92vw)",
          zIndex: 60,
          padding: 16,
          boxSizing: "border-box",
          background: "rgba(16,16,18,0.98)",
          borderLeft: "1px solid rgba(255,255,255,0.10)",
          overflow: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 950 }}>{detailTitle} detail</div>
          <button onClick={onClose} style={smallBtn(false, "neutral")}>
            Close
          </button>
        </div>

        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
          <span style={badgeStyle("type")}>{typeLabel(item.type)}</span>
          <span style={badgeStyle("priority")}>{item.priority}</span>
          <span style={badgeStyle("status")}>{item.status}</span>
          {disableEconomy ? <DisabledBadge /> : null}
        </div>

        <div style={{ marginTop: 14, opacity: 0.88, fontSize: 13, lineHeight: 1.55 }}>
          <div>
            <b>ID:</b> <span style={{ opacity: 0.95 }}>{item.id}</span>
          </div>
          <div style={{ marginTop: 6 }}>
            <b>Subject:</b>{" "}
            {isVerification ? (
              userId ? (
                <span style={linkStyle()} onClick={() => go(appProfileUrl(userId))} title="Open profile">
                  {item.subject.replace(/^user:\s*/i, "").trim()}
                </span>
              ) : (
                <span>{item.subject}</span>
              )
            ) : isReport ? (
              (() => {
                // Prefer reportDetail if loaded; fallback to parsing subject.
                const tType =
                  (reportDetail?.targetType as string | undefined) ||
                  (item as any)?.targetType ||
                  null;

                const tId =
                  (reportDetail?.targetId as string | undefined) ||
                  (item as any)?.targetId ||
                  null;

                // If backend doesn't provide targetType/targetId, try parse from subject like: "post: <id>"
                const subj = String(item.subject || "");
                const m = subj.match(/^(post|user|profile|event)\s*:\s*([a-f0-9]{24})/i);
                const pType = m?.[1]?.toLowerCase() || null;
                const pId = m?.[2] || null;

                const finalType = (tType || pType) as string | null;
                const finalId = (tId || pId) as string | null;

                // Decide destination route (Phase 1B)
                const getUrl = () => {
                  if (!finalType || !finalId) return null;
                  if (finalType === "post") return `/app/post/${finalId}`;
                  if (finalType === "user" || finalType === "profile") return `/app/profile/${finalId}`;
                  if (finalType === "event") return `/app/event/${finalId}`; // only if exists
                  return null;
                };

                const url = getUrl();

                // If we can't safely build a URL, show plain text (no dead click)
                if (!url) return <span>{subj}</span>;

                // Render "type: id" clickable, not the entire subject string (no ambiguity)
                return (
                  <span style={linkStyle()} onClick={() => go(url)} title="Open target">
                    {finalType}: {finalId}
                  </span>
                );
              })()
            ) : (
              <span>{item.subject}</span>
            )}
          </div>

          <div style={{ marginTop: 8 }}>
            <b>Created:</b> {formatTs(item.createdAt)}
          </div>
          <div style={{ marginTop: 6 }}>
            <b>Category:</b> {categoryOf(item)}
          </div>
        </div>

        {/* Detail payload (mock) */}
        <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontWeight: 950, opacity: 0.92, marginBottom: 8 }}>Context</div>
          {isVerification ? (
            <div style={{ opacity: 0.86, fontSize: 13, lineHeight: 1.55 }}>
              <div>
                <b>Verification type:</b>{" "}
                {verificationLoading ? "loading…" : verificationDetail?.verificationType || (item.type === "verification_resubmission" ? "profile (re-submit)" : "profile")}
              </div>
              <div style={{ marginTop: 6 }}>
                <b>Verification video:</b>{" "}
                {verificationLoading ? (
                  <span style={{ opacity: 0.75 }}>loading…</span>
                ) : verificationDetail?.verificationVideoUrl ? (
                  <span
                    style={linkStyle()}
                    onClick={() => window.open(verificationDetail.verificationVideoUrl, "_blank", "noopener,noreferrer")}
                  >
                    Open
                  </span>
                ) : (
                  <span style={{ opacity: 0.75 }}>N/A</span>
                )}
              </div>
              <div style={{ marginTop: 6 }}>
                <b>Notes:</b> {verificationDetail?.notes || ""}
              </div>
            </div>
          ) : isReport ? (
            <div style={{ opacity: 0.86, fontSize: 13, lineHeight: 1.55 }}>
              <div><b>Report kind:</b> {typeLabel(item.type)}</div>
              <div style={{ marginTop: 6 }}>
                <b>Reporter:</b>{" "}
                {reportLoading ? (
                  <span style={{ opacity: 0.75 }}>loading…</span>
                ) : reportDetail?.reporter?.userId ? (
                  <span style={linkStyle()} onClick={() => go(appProfileUrl(String(reportDetail.reporter.userId)))}>
                    {reportDetail.reporter.username || reportDetail.reporter.displayName || "Open"}
                  </span>
                ) : (
                  <span style={{ opacity: 0.75 }}>{(item as any)?.meta?.reporterUsername || "N/A"}</span>
                )}
              </div>
              <div style={{ marginTop: 6 }}>
                <b>Target:</b>{" "}
                {(() => {
                  const tType = String(reportDetail?.targetType || (item as any)?.meta?.targetType || "").trim();
                  const tId = String(reportDetail?.targetId || (item as any)?.meta?.targetId || "").trim();

                  if (!tType || !tId) return <span style={{ opacity: 0.75 }}>N/A</span>;

                  const parentPostId =
                    previewData?.post?._id
                      ? String(previewData.post._id)
                      : null;

                  const open = () => {
                    if (tType === "post") return go(`/app/post/${String(tId)}`);
                    if (tType === "comment" && parentPostId) return go(`/app/post/${parentPostId}`);
                    if (tType === "event") return go(adminEventUrl(String(tId)));
                    if (tType === "user" || tType === "profile") return go(appProfileUrl(String(tId)));
                  };

                  const isClickable =
                    tType === "post" ||
                    (tType === "comment" && !!parentPostId) ||
                    tType === "event" ||
                    tType === "user" ||
                    tType === "profile";

                  if (isClickable) {
                    return (
                      <span style={linkStyle()} onClick={open}>
                        {tType === "comment" && parentPostId
                          ? `post: ${parentPostId}`
                          : `${tType}: ${tId}`}
                      </span>
                    );
                  }

                  return <span style={{ opacity: 0.95 }}>{tType}: {tId}</span>;
                })()}
              </div>
              <div style={{ marginTop: 6 }}>
                <b>Context:</b>{" "}
                <span style={{ opacity: 0.95 }}>
                  {(reportDetail as any)?.contextType || (item as any)?.meta?.contextType || "—"}
                  {((reportDetail as any)?.contextId || (item as any)?.meta?.contextId)
                    ? `: ${String((reportDetail as any)?.contextId || (item as any)?.meta?.contextId)}`
                    : ""}
                </span>
              </div>
              <div style={{ marginTop: 6 }}>
                <b>Reason:</b>{" "}
                <span style={{ opacity: 0.95 }}>
                  {reportDetail?.reason || (item as any)?.meta?.reason || "—"}
                </span>
              </div>
              <div style={{ marginTop: 6 }}>
                <b>User message:</b>{" "}
                {reportLoading ? (
                  <span style={{ opacity: 0.75 }}>loading…</span>
                ) : reportErr ? (
                  <span style={{ opacity: 0.75 }}>{reportErr}</span>
                ) : (
                  <span style={{ opacity: 0.95 }}>
                    {reportDetail?.userMessage ||
                      reportDetail?.note ||
                      reportDetail?.details ||
                      reportDetail?.additionalDetails ||
                      reportDetail?.message ||
                      (item as any)?.meta?.reasonText ||
                      (item as any)?.meta?.note ||
                      (item as any)?.meta?.userMessage ||
                      (item as any)?.meta?.details ||
                      (item as any)?.meta?.additionalDetails ||
                      (item as any)?.meta?.message ||
                      (item as any)?.meta?.reason ||
                      ""}
                  </span>
                )}
              </div>
              {["post", "comment", "live_message"].includes(
                String(reportDetail?.targetType || (item as any)?.meta?.targetType || "").trim()
              ) ? (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.035)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Admin preview</div>

                  {previewLoading ? (
                    <div style={{ opacity: 0.75 }}>loading…</div>
                  ) : previewErr ? (
                    <div style={{ opacity: 0.75 }}>{previewErr}</div>
                  ) : !previewData ? (
                    <div style={{ opacity: 0.75 }}>N/A</div>
                  ) : (
                    <>
                      {previewData?.post ? (
                        <div style={{ fontSize: 13, lineHeight: 1.55, opacity: 0.92 }}>
                          <div>
                            <b>Author:</b>{" "}
                            {previewData.postAuthor?.userId ? (
                              <span
                                style={linkStyle()}
                                onClick={() => go(appProfileUrl(String(previewData.postAuthor.userId)))}
                              >
                                {previewData.postAuthor.displayName ||
                                  previewData.postAuthor.username ||
                                  String(previewData.postAuthor.userId)}
                              </span>
                            ) : (
                              <span style={{ opacity: 0.95 }}>—</span>
                            )}
                          </div>

                          <div style={{ marginTop: 6 }}>
                            <b>Text:</b>{" "}
                            <span style={{ opacity: 0.95 }}>
                              {previewData.post?.text || "—"}
                            </span>
                          </div>

                          <div style={{ marginTop: 6 }}>
                            <b>Moderation:</b>{" "}
                            <span style={{ opacity: 0.95 }}>
                              {previewData.post?.moderation?.status ||
                                (previewData.post?.isHidden ? "hidden" : "visible")}
                            </span>
                          </div>

                          <div style={{ marginTop: 8 }}>
                            <b>Media:</b>
                            {renderAdminPostMedia(previewData.post?.media)}
                          </div>
                        </div>
                      ) : null}

                      {previewData?.comment ? (
                        <div style={{ fontSize: 13, lineHeight: 1.55, opacity: 0.92 }}>
                          <div>
                            <b>Comment author:</b>{" "}
                            {previewData.commentAuthor?.userId ? (
                              <span
                                style={linkStyle()}
                                onClick={() => go(appProfileUrl(String(previewData.commentAuthor.userId)))}
                              >
                                {previewData.commentAuthor.displayName ||
                                  previewData.commentAuthor.username ||
                                  String(previewData.commentAuthor.userId)}
                              </span>
                            ) : (
                              <span style={{ opacity: 0.95 }}>—</span>
                            )}
                          </div>

                          <div style={{ marginTop: 6 }}>
                            <b>Comment text:</b>{" "}
                            <span style={{ opacity: 0.95 }}>
                              {previewData.comment?.text ||
                                previewData.comment?.body ||
                                previewData.comment?.message ||
                                "—"}
                            </span>
                          </div>

                          <div
                            style={{
                              marginTop: 10,
                              paddingTop: 10,
                              borderTop: "1px solid rgba(255,255,255,0.08)",
                            }}
                          >
                            <div>
                              <b>Post author:</b>{" "}
                              {previewData.postAuthor?.userId ? (
                                <span
                                  style={linkStyle()}
                                  onClick={() => go(appProfileUrl(String(previewData.postAuthor.userId)))}
                                >
                                  {previewData.postAuthor.displayName ||
                                    previewData.postAuthor.username ||
                                    String(previewData.postAuthor.userId)}
                                </span>
                              ) : (
                                <span style={{ opacity: 0.95 }}>—</span>
                              )}
                            </div>

                            <div style={{ marginTop: 8 }}>
                              <b>Parent post:</b>
                              <div style={{ marginTop: 6, opacity: 0.95 }}>
                                {previewData.post?.text || "—"}
                              </div>
                            </div>

                            <div style={{ marginTop: 6 }}>
                              <b>Post moderation:</b>{" "}
                              <span style={{ opacity: 0.95 }}>
                                {previewData.post?.moderation?.status ||
                                  (previewData.post?.isHidden ? "hidden" : "visible")}
                              </span>
                            </div>

                            <div style={{ marginTop: 8 }}>
                              <b>Post media:</b>
                              {renderAdminPostMedia(previewData.post?.media)}
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {previewData?.message ? (
                        <div style={{ fontSize: 13, lineHeight: 1.55, opacity: 0.92 }}>
                          <div>
                            <b>Author:</b>{" "}
                            {previewData.messageAuthor?.userId ? (
                              <span
                                style={linkStyle()}
                                onClick={() => go(appProfileUrl(String(previewData.messageAuthor.userId)))}
                              >
                                {previewData.messageAuthor.displayName ||
                                  previewData.messageAuthor.username ||
                                  String(previewData.messageAuthor.userId)}
                              </span>
                            ) : (
                              <span style={{ opacity: 0.95 }}>—</span>
                            )}
                          </div>

                          <div style={{ marginTop: 6 }}>
                            <b>Message:</b>{" "}
                            <span style={{ opacity: 0.95 }}>
                              {previewData.message?.text ||
                                previewData.message?.message ||
                                previewData.message?.body ||
                                "—"}
                            </span>
                          </div>

                          <div style={{ marginTop: 6 }}>
                            <b>Event:</b>{" "}
                            <span style={{ opacity: 0.95 }}>
                              {previewData.event?.title ||
                                previewData.event?._id ||
                                "—"}
                            </span>
                          </div>

                          <div style={{ marginTop: 6 }}>
                            <b>Timestamp:</b>{" "}
                            <span style={{ opacity: 0.95 }}>
                              {previewData.message?.createdAt
                                ? formatTs(previewData.message.createdAt)
                                : "—"}
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}
              {isReport && reportDetail ? (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>Account actions</div>

                  <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>
                    Target owner: {reportDetail?.targetOwnerId || reportDetail?.data?.targetOwnerId || "—"}
                  </div>

                  {/* Admin note (moderation) */}
                    <textarea
                      value={modNote}
                      onChange={(e) => setModNote(e.target.value)}
                      placeholder="Admin note (required for Suspend/Ban)"
                      style={{
                        width: "100%",
                        minHeight: 70,
                        resize: "vertical",
                        padding: 10,
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "rgba(255,255,255,0.04)",
                        color: "inherit",
                        marginBottom: 10,
                      }}
                    />

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        disabled={reportLoading}
                        onClick={() => runModeration("suspend_7d", modNote)}
                      >
                        Suspend 7 days
                      </button>

                      <button
                        disabled={reportLoading}
                        onClick={() => runModeration("ban", modNote)}
                      >
                        Ban
                      </button>

                      {reportDetail?.ownerModeration?.isSuspended ? (
                        <button
                          disabled={reportLoading}
                          onClick={() => runModeration("unsuspend", "")}
                        >
                          Unsuspend
                        </button>
                      ) : null}

                      {reportDetail?.ownerModeration?.isBanned ? (
                        <button
                          disabled={reportLoading}
                          onClick={() => runModeration("unban", "")}
                        >
                          Unban
                        </button>
                      ) : null}
                    </div>
                </div>
              ) : null}              
            </div>
          ) : isEconomy ? (
            (item.type === "economy_refund_request" || item.type === "economy_refund") ? (
              <div style={{ opacity: 0.86, fontSize: 13, lineHeight: 1.55 }}>
                {(() => {
                  const m = (item as any)?.meta || {};

                  const requesterLabel =
                    m?.requesterDisplayName ||
                    m?.requesterUsername ||
                    m?.requester?.displayName ||
                    m?.requester?.username ||
                    item.subject;

                  const amountTokens = m?.amountTokens ?? m?.amount ?? null;
                  const reasonText = m?.reasonText || m?.reason || "";
                  const referenceType = m?.referenceType || "";
                  const referenceId = m?.referenceId || "";
                  const attachments = Array.isArray(m?.attachments) ? m.attachments : [];

                  const openAttachment = (a: any) => {
                    const url = typeof a === "string" ? a : a?.url;
                    if (!url) return;
                    window.open(url, "_blank", "noopener,noreferrer");
                  };

                  return (
                    <>
                      <div>
                        <b>Requester:</b>{" "}
                        {userId ? (
                          <span style={linkStyle()} onClick={() => go(appProfileUrl(userId))} title="Open profile">
                            {String(requesterLabel)}
                          </span>
                        ) : (
                          <span style={{ opacity: 0.95 }}>{String(requesterLabel)}</span>
                        )}
                      </div>

                      <div style={{ marginTop: 6 }}>
                        <b>Amount (tokens):</b> <span style={{ opacity: 0.95 }}>{amountTokens ?? "—"}</span>
                      </div>

                      <div style={{ marginTop: 6 }}>
                        <b>Reason:</b> <span style={{ opacity: 0.95 }}>{reasonText || "—"}</span>
                      </div>

                      <div style={{ marginTop: 6 }}>
                        <b>Reference:</b>{" "}
                        <span style={{ opacity: 0.95 }}>
                          {referenceType && referenceId ? `${referenceType}: ${referenceId}` : "—"}
                        </span>
                      </div>

                      <div style={{ marginTop: 6 }}>
                        <b>Attachments:</b>{" "}
                        {attachments.length ? (
                          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
                            {attachments.map((a: any, idx: number) => {
                              const label =
                                typeof a === "string"
                                  ? `Attachment ${idx + 1}`
                                  : a?.name || a?.filename || `Attachment ${idx + 1}`;
                              const url = typeof a === "string" ? a : a?.url;
                              if (!url) return null;

                              return (
                                <span key={idx} style={linkStyle()} onClick={() => openAttachment(a)} title="Open attachment">
                                  {label}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span style={{ opacity: 0.75 }}>—</span>
                        )}
                      </div>

                      <div style={{ marginTop: 10, opacity: 0.8, fontSize: 12 }}>
                        Phase: {disableEconomy ? "Disabled in Phase 1A" : "Enabled"}
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div style={{ opacity: 0.86, fontSize: 13, lineHeight: 1.55 }}>
                <div>
                  <b>Economy item:</b> {typeLabel(item.type)}
                </div>
                <div style={{ marginTop: 6 }}>
                  <b>Phase:</b> {disableEconomy ? "Disabled in Phase 1A" : "Enabled"}
                </div>
              </div>
            )
          ) : (
            <div style={{ opacity: 0.86, fontSize: 13, lineHeight: 1.55 }}>
              <div>
                <b>Ops:</b> low priority operational item (mock)
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.10)" }}>
          <div style={{ fontWeight: 950, opacity: 0.9, marginBottom: 10 }}>Actions</div>

                    {/* Admin note (required for refund approve/reject) */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.9, marginBottom: 6 }}>Admin note</div>
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Write the reason / note…"
              rows={3}
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

          {actionErr ? <div style={{ marginBottom: 10, color: "rgba(239,68,68,0.95)", fontSize: 12 }}>{actionErr}</div> : null}

          {isVerification ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => runAction("approve")}
                style={smallBtn(actionLoading, "approve")}
                disabled={actionLoading}
              >
                Approve
              </button>
              <button
                onClick={() =>
                  runAction("reject", {
                    reason: adminNote.trim(),
                    adminNote: adminNote.trim(),
                  })
                }
                style={smallBtn(actionLoading, "reject")}
                disabled={actionLoading}
                title="Reject requires a note"
              >
                Reject
              </button>
            </div>
          ) : isReport ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => runAction("hide", { adminNote: adminNote.trim() })}
                style={smallBtn(actionLoading, "reject")}
                disabled={actionLoading}
              >
                Hide
              </button>

              <button
                onClick={() => runAction("reviewed", { adminNote: adminNote.trim() })}
                style={smallBtn(actionLoading, "neutral")}
                disabled={actionLoading}
              >
                Resolve
              </button>

              {/* ✅ NUOVO: ACTIONED (grave/gravissimo) */}
              <button
                onClick={() =>
                  runAction("actioned", {
                    adminNote: adminNote.trim(),
                    severity: "grave",
                  })
                }
                style={smallBtn(actionLoading, "reject")}
                disabled={actionLoading}
              >
                Action (grave)
              </button>

              <button
                onClick={() =>
                  runAction("actioned", {
                    adminNote: adminNote.trim(),
                    severity: "gravissimo",
                  })
                }
                style={smallBtn(actionLoading, "reject")}
                disabled={actionLoading}
              >
                Action (gravissimo)
              </button>
            </div>
          ) : isEconomy ? (
            // REFUND: solo SI/NO, entrambi con motivazione obbligatoria
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => {
                  const note = adminNote.trim();
                  if (!note) return setActionErr("Admin note is required");
                  if (disableEconomy) return;
                  runAction("approve", { adminNote: note });
                }}
                style={smallBtn(disableEconomy || actionLoading, "approve")}
                disabled={disableEconomy || actionLoading}
                title={disableEconomy ? "Disabled in Phase 1A" : "Refund full (requested amount)"}
              >
                Refund (full)
              </button>

              <button
                onClick={() => {
                  const note = adminNote.trim();
                  if (!note) return setActionErr("Admin note is required");
                  if (disableEconomy) return;
                  runAction("reject", { adminNote: note });
                }}
                style={smallBtn(disableEconomy || actionLoading, "reject")}
                disabled={disableEconomy || actionLoading}
                title={disableEconomy ? "Disabled in Phase 1A" : "Reject request"}
              >
                Reject
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => runAction("reviewed", { adminNote: adminNote.trim() })}
                style={smallBtn(actionLoading, "neutral")}
                disabled={actionLoading}
              >
                Resolve
              </button>
            </div>
          )}

          {disableEconomy ? (
            <div style={{ marginTop: 10, opacity: 0.75, fontSize: 12 }}>Economy actions are disabled in Phase 1A.</div>
          ) : null}
        </div>
      </div>
    </>
  );
}

type Tab = "All" | PendingCategory;

export default function AdminPendingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const economyEnabled = featureFlag("ECONOMY");

  function navigateTo(to: string) {
    if (!to) return;
    if (to.startsWith("/")) {
      navigate(to);
      return;
    }
    window.open(to, "_blank", "noopener,noreferrer");
  }

  const [items, setItems] = useState<PendingItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"priority" | "newest">("priority");

  const [activeTab, setActiveTab] = useState<Tab>("All");

  const [openSections, setOpenSections] = useState<Record<PendingCategory, boolean>>({
    Critical: true,
    Verification: true,
    Reports: true,
    Economy: false,
    Ops: false,
  });

  const [drawerItemId, setDrawerItemId] = useState<string | null>(null); // legacy, da rimuovere dopo migrazione completa
  async function loadPending() {
    try {
      setIsLoading(true);
      setLoadErr(null);

      // qui carichiamo tutto e poi filtri/sort restano UI (per ora)
      const res = await api.adminGetPending({ category: "all", sort: "priority", limit: 200 });
      setItems(res.items || []);
    } catch (e: any) {
      console.error("loadPending error:", e);
      setLoadErr(e?.message || "Failed to load pending");
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

    useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const tab = sp.get("tab");

    if (!tab) return;

    const allowed = ["All", "Critical", "Verification", "Reports", "Economy", "Ops"] as const;
    const found = allowed.find((x) => x.toLowerCase() === String(tab).toLowerCase());

    if (!found) return;

    setActiveTab(found);

    // auto-open the corresponding section when landing
    if (found !== "All") {
      setOpenSections((prev) => ({ ...prev, [found]: true }));
    }
  }, [location.search]);

  const drawerItem = useMemo(() => items.find((x) => x.id === drawerItemId) || null, [drawerItemId, items]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    let out = items.filter((it) => {
      if (activeTab !== "All" && categoryOf(it) !== activeTab) return false;

      if (!needle) return true;
      return (
        it.id.toLowerCase().includes(needle) ||
        it.subject.toLowerCase().includes(needle) ||
        it.type.toLowerCase().includes(needle) ||
        it.status.toLowerCase().includes(needle)
      );
    });

    out = out.sort((a, b) => {
      if (sort === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      const pa = PRIORITY_ORDER[a.priority];
      const pb = PRIORITY_ORDER[b.priority];
      if (pa !== pb) return pa - pb;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return out;
  }, [items, q, sort, activeTab]);

  const counters = useMemo(() => {
    const byCat: Record<PendingCategory, number> = {
      Critical: 0,
      Verification: 0,
      Reports: 0,
      Economy: 0,
      Ops: 0,
    };
    for (const it of items) byCat[categoryOf(it)] += 1;
    return { total: items.length, byCat };
  }, [items]);

  function toggleSection(c: PendingCategory) {
    setOpenSections((prev) => ({ ...prev, [c]: !prev[c] }));
  }

  const groupsAll: PendingCategory[] = ["Critical", "Verification", "Reports", "Economy", "Ops"];
  const groups: PendingCategory[] = activeTab === "All" ? groupsAll : [activeTab];

  return (
    <div style={{ ...panel, padding: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 950 }}>Pending</div>
          <div style={{ marginTop: 6, opacity: 0.85 }}>Primary admin queue. Items require action.</div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ ...badgeStyle("priority"), padding: "5px 12px" }}>Total: {counters.total}</span>
          <span style={{ ...badgeStyle("priority"), padding: "5px 12px" }}>Critical: {counters.byCat.Critical}</span>
          <span style={{ ...badgeStyle("priority"), padding: "5px 12px" }}>Verification: {counters.byCat.Verification}</span>
          <span style={{ ...badgeStyle("priority"), padding: "5px 12px" }}>Reports: {counters.byCat.Reports}</span>
          <span style={{ ...badgeStyle("priority"), padding: "5px 12px", opacity: economyEnabled ? 1 : 0.8 }}>
            Economy: {counters.byCat.Economy} {economyEnabled ? null : <span style={{ marginLeft: 6 }}>(disabled)</span>}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search (id / username / type)…"
          style={{
            flex: "1 1 260px",
            maxWidth: 520,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
            outline: "none",
            fontWeight: 800,
          }}
        />

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["All", "Critical", "Verification", "Reports", "Economy", "Ops"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setActiveTab(t)} style={pillBtn(activeTab === t)}>
              {t}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ opacity: 0.8, fontSize: 12, fontWeight: 950 }}>Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            style={{
              padding: "9px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.06)",
              color: "white",
              fontWeight: 900,
              outline: "none",
            }}
          >
            <option value="priority">Priority</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: 12, opacity: 0.8, fontWeight: 900 }}>Loading pending…</div>
      ) : null}

      {loadErr ? (
        <div style={{ padding: 12, color: "#ff6b6b", fontWeight: 900 }}>{loadErr}</div>
      ) : null}

      {/* List */}
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        {groups.map((cat) => {
          const catItems = filtered.filter((it) => categoryOf(it) === cat);

          const forceShow = cat === "Critical";
          const visible = forceShow || catItems.length > 0;
          if (!visible) return null;

          const open = openSections[cat];

          return (
            <div key={cat} style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.10)", overflow: "hidden" }}>
              <button
                onClick={() => toggleSection(cat)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  background: "rgba(255,255,255,0.06)",
                  border: "none",
                  color: "rgba(255,255,255,0.92)",
                  cursor: "pointer",
                  fontWeight: 950,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <span>
                  {cat} <span style={{ opacity: 0.75, fontWeight: 900 }}>({catItems.length})</span>
                  {cat === "Economy" && !economyEnabled ? (
                    <span style={{ marginLeft: 10 }}>
                      <DisabledBadge />
                    </span>
                  ) : null}
                </span>
                <span style={{ opacity: 0.75 }}>{open ? "Hide" : "Show"}</span>
              </button>

              {!open ? null : (
                <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                  {catItems.length === 0 ? (
                    <div style={{ padding: 10, opacity: 0.75, fontWeight: 900, fontSize: 13 }}>
                      No items right now. (P0 placeholders will appear here when AI flags / user reports are enabled.)
                    </div>
                  ) : (
                    catItems.map((it) => {
                      const isVerification = it.type === "verification_pending" || it.type === "verification_resubmission";
                      const isEconomy = it.type.startsWith("economy_");
                      const disableEconomy = isEconomy && !economyEnabled;

                      const metaAny: any = it as any;
                      const rowUserIdFromMeta = metaAny?.meta?.userId ? String(metaAny.meta.userId) : null;
                      const rowUserIdFromLink = it.links?.user ? extractMongoId(it.links.user) : null;
                      const rowUserId = rowUserIdFromMeta || rowUserIdFromLink;

                      return (
                        <div
                          key={it.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(180px, 260px) minmax(180px, 1fr) 140px 120px",
                            gap: 10,
                            alignItems: "center",
                            padding: 10,
                            borderRadius: 12,
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          {/* Badges */}
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                            <span style={badgeStyle("type")}>{typeLabel(it.type)}</span>
                            <span style={badgeStyle("priority")}>{it.priority}</span>
                          </div>

                          {/* Subject */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <div style={{ fontWeight: 950, opacity: 0.95, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {it.subject}
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", opacity: 0.8, fontSize: 12 }}>
                              {/* Minimal list: username NOT clickable */}
                              {(() => {
                                const u = metaAny?.meta?.reporterUsername || extractFirstUserHandle(it.subject);
                                if (!u) return null;

                                return rowUserId ? (
                                  <span style={linkStyle()} onClick={() => navigateTo(appProfileUrl(rowUserId))} title="Open profile">
                                    {u}
                                  </span>
                                ) : (
                                  <span style={{ opacity: 0.95 }}>{u}</span>
                                );
                              })()}
                              <span>{formatTs(it.createdAt)}</span>
                              <span style={badgeStyle("status")}>{it.status}</span>
                            </div>
                          </div>

                          {/* Quick actions */}
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                            {isVerification ? (
                              <>
                                <button
                                  onClick={async () => {
                                    const a = (it as any)?.actions?.approve;
                                    if (!a?.path) return;
                                    await api.adminAction(a.path, a.method || "PATCH", a.body);
                                    await loadPending();
                                  }}
                                  style={smallBtn(false, "approve")}
                                  title="Approve verification"
                                >
                                  Approve
                                </button>

                                <button
                                  onClick={async () => {
                                    const a = (it as any)?.actions?.reject;
                                    if (!a?.path) return;

                                    const reason = window.prompt("Reject reason:");
                                    if (reason === null) return;

                                    const note = reason.trim();
                                    if (!note) {
                                      alert("Reason is required.");
                                      return;
                                    }

                                    await api.adminAction(a.path, a.method || "PATCH", {
                                      ...(a.body || {}),
                                      reason: note,
                                      adminNote: note,
                                    });

                                    await loadPending();
                                  }}
                                  style={smallBtn(false, "reject")}
                                  title="Reject verification"
                                >
                                  Reject
                                </button>
                              </>
                            ) : null}
                          </div>

                          {/* Open */}
                          <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <button
                              onClick={() => {
                                if (isVerification) {
                                  setDrawerItemId(it.id);
                                  return;
                                }

                                if (String(it.type || "").startsWith("report_")) {
                                  navigate(`/admin/reports/${encodeURIComponent(it.id)}`);
                                  return;
                                }

                                if (disableEconomy) return;
                                setDrawerItemId(it.id);
                              }}
                              style={smallBtn(disableEconomy && !isVerification ? true : false, "neutral")}
                              title={
                                String(it.type || "").startsWith("report_")
                                  ? "Open full report page"
                                  : disableEconomy && !isVerification
                                  ? "Disabled in Phase 1A"
                                  : "Open detail"
                              }
                            >
                              Open
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {drawerItem ? (
        <Drawer
          item={drawerItem}
          onClose={() => setDrawerItemId(null)}
          economyEnabled={economyEnabled}
          onApprove={async () => {
            await loadPending();
            setDrawerItemId(null);
          }}
          onReject={async () => {
            await loadPending();
            setDrawerItemId(null);
          }}
          onHide={async () => {
            await loadPending();
            setDrawerItemId(null);
          }}
          onResolve={async () => {
            await loadPending();
            setDrawerItemId(null);
          }}
          navigateTo={navigateTo}
        />
      ) : null}
    </div>
  );
}
