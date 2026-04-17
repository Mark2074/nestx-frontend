import { useState } from "react";
import {
  api,
  mapApiErrorMessage,
  getApiRetryAfterMs,
  formatRetryAfterLabel,
} from "../../api/nestxApi";

type LiveScope = "public" | "private";

type EventDetailLike = {
  creator?: {
    id?: string;
    _id?: string;
  };
  goal?: any;
  live?: any;
};

type Props = {
  eventId: string;
  eventDetail: EventDetailLike | null;
  isHost: boolean;
  isLive: boolean;
  supportsGoal: boolean;
  shouldPausePublic: boolean;
  runtimeScope: LiveScope | null;
  eventBaseScope: LiveScope;
  viewersNow: number;
  onReloadEvent: () => Promise<any> | void;
  onRefreshStatus?: () => Promise<any> | void;
  onFinishHost?: () => Promise<any> | void;
  onCancelHost?: () => Promise<any> | void;
  chatScopeLabel?: string;
};

export default function LiveRightColumn({
  eventId,
  eventDetail,
  isHost,
  isLive,
  supportsGoal,
  shouldPausePublic,
  runtimeScope,
  eventBaseScope,
  viewersNow,
  onReloadEvent,
  onRefreshStatus,
  onFinishHost,
  onCancelHost,
  chatScopeLabel,
}: Props) {
  const [tipOpen, setTipOpen] = useState(false);
  const [tipAmount, setTipAmount] = useState<number>(10);
  const [loadingTip, setLoadingTip] = useState(false);
  const [tipOkMsg, setTipOkMsg] = useState("");
  const [tipErrMsg, setTipErrMsg] = useState("");

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string>("violent_or_gore_content");
  const [reportNote, setReportNote] = useState<string>("");
  const [reportSending, setReportSending] = useState(false);
  const [reportOkMsg, setReportOkMsg] = useState<string | null>(null);
  const [reportErrMsg, setReportErrMsg] = useState<string | null>(null);

  const REPORT_REASONS: { value: string; label: string }[] = [
    { value: "minor_involved", label: "Minor in stream" },
    { value: "impersonation_or_fake", label: "Pre-recorded video" },
    { value: "spam_or_scam", label: "External advertising" },
    { value: "violent_or_gore_content", label: "Inappropriate content" },
    { value: "illegal_content", label: "Illegal content" },
    { value: "harassment_or_threats", label: "Harassment or threats" },
    { value: "other", label: "Other" },
  ];

  const goal = eventDetail?.goal || eventDetail?.live?.goal || null;
  const goalIsActive = !!goal?.isActive;

  const goalTarget = Math.max(0, Number(goal?.targetTokens ?? 0));
  const goalProgressRaw = Math.max(0, Number(goal?.progressTokens ?? 0));
  const goalProgress = goalTarget > 0 ? Math.min(goalProgressRaw, goalTarget) : goalProgressRaw;

  const goalTitle = String(goal?.title || "Goal").trim();
  const goalDescription = String(goal?.description || "").trim();
  const goalReachedAt = goal?.reachedAt ? String(goal.reachedAt) : null;

  const goalPct =
    goalIsActive && goalTarget > 0
      ? Math.max(0, Math.min(100, (goalProgress / goalTarget) * 100))
      : 0;

  const goalIsReached =
    !!goalReachedAt || (goalIsActive && goalTarget > 0 && goalProgress >= goalTarget);

  async function handleTipSend() {
    if (!eventId) return;
    if (shouldPausePublic) return;

    const toUserId = String(eventDetail?.creator?.id || eventDetail?.creator?._id || "").trim();
    if (!toUserId) {
      setTipErrMsg("Missing creator id.");
      return;
    }

    const amount = Math.floor(Number(tipAmount));
    if (!Number.isFinite(amount) || amount <= 0) {
      setTipErrMsg("Invalid tip amount.");
      return;
    }

    setLoadingTip(true);
    setTipErrMsg("");
    setTipOkMsg("");

    try {
      await api.tipSend({ toUserId, amountTokens: amount, eventId });
      await onReloadEvent?.();

      try {
        window.dispatchEvent(
          new CustomEvent("nx:wallet:changed", {
            detail: { source: "tip", eventId },
          })
        );
      } catch {}

      setTipOkMsg(`Tip sent: ${amount} tokens`);
      setTipOpen(false);
      setTipAmount(10);
    } catch (e: any) {
      const retryAfterMs = getApiRetryAfterMs(e);
      setTipErrMsg(
        mapApiErrorMessage(e, "Tip failed.") + formatRetryAfterLabel(retryAfterMs)
      );
    } finally {
      setLoadingTip(false);
    }
  }

  async function handleReportSend() {
    try {
      if (!eventId) return;

      const creatorIdToReport = String(eventDetail?.creator?.id || eventDetail?.creator?._id || "").trim();
      if (!creatorIdToReport) {
        setReportErrMsg("Missing creator id");
        return;
      }

      setReportSending(true);
      setReportErrMsg(null);
      setReportOkMsg(null);

      await api.submitReport({
        targetType: "user",
        targetId: creatorIdToReport,
        contextType: "live",
        contextId: String(eventId),
        reasonCode: reportReason,
        note: reportNote?.trim() ? reportNote.trim().slice(0, 500) : null,
      });

      setReportOkMsg("Report submitted");
      setReportOpen(false);
      setReportNote("");
      setReportReason("violent_or_gore_content");
    } catch (e: any) {
      setReportErrMsg(e?.message || "Failed to submit report");
    } finally {
      setReportSending(false);
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        alignContent: "start",
      }}
    >
      <div
        style={{
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
          background: "rgba(255,255,255,0.04)",
          padding: 12,
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Live tools</div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <span style={pillStyle}>{(runtimeScope || eventBaseScope).toUpperCase()}</span>
          <span style={pillStyle}>👁 {viewersNow} watching</span>
          <span style={pillStyle}>{chatScopeLabel || (runtimeScope || eventBaseScope).toUpperCase()}</span>
        </div>

        {isHost ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => void onRefreshStatus?.()} style={secondaryBtnStyle}>
              Refresh status
            </button>
            <button onClick={() => void onFinishHost?.()} style={secondaryBtnStyle}>
              Finish
            </button>
            <button
              onClick={() => void onCancelHost?.()}
              style={{
                ...secondaryBtnStyle,
                borderColor: "rgba(255,100,120,0.35)",
                color: "salmon",
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                setTipErrMsg("");
                setTipOkMsg("");
                setTipOpen(true);
              }}
              disabled={shouldPausePublic}
              style={{
                ...secondaryBtnStyle,
                borderColor: "rgba(255,255,255,0.22)",
                background: "rgba(255,255,255,0.06)",
                opacity: shouldPausePublic ? 0.4 : 1,
                cursor: shouldPausePublic ? "not-allowed" : "pointer",
              }}
            >
              Tip
            </button>

            <button
              type="button"
              disabled={shouldPausePublic}
              onClick={() => setReportOpen(true)}
              style={{
                padding: "8px 12px",
                borderRadius: 12,
                fontWeight: 900,
                cursor: shouldPausePublic ? "not-allowed" : "pointer",
                background: "transparent",
                color: "salmon",
                border: "1px solid rgba(255,255,255,0.14)",
                opacity: shouldPausePublic ? 0.35 : 0.92,
                whiteSpace: "nowrap",
              }}
            >
              Report
            </button>
          </div>
        )}

        {tipErrMsg ? (
          <div style={{ marginTop: 10, color: "rgba(255,120,120,0.95)", fontWeight: 900 }}>
            {tipErrMsg}
          </div>
        ) : null}

        {tipOpen ? (
          <div
            style={{
              marginTop: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 16,
              background: "rgba(0,0,0,0.35)",
              padding: 12,
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontWeight: 900 }}>Send a tip</div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {[5, 10, 25, 50].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTipAmount(v)}
                  style={{
                    ...secondaryBtnStyle,
                    opacity: tipAmount === v ? 1 : 0.75,
                    borderColor:
                      tipAmount === v ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.14)",
                  }}
                >
                  {v}
                </button>
              ))}

              <input
                type="number"
                min={1}
                step={1}
                value={tipAmount}
                onChange={(e) => {
                  const raw = Number(e.target.value);
                  setTipAmount(Number.isFinite(raw) ? raw : 0);
                }}
                style={inputStyle}
              />

              <button
                type="button"
                onClick={() => void handleTipSend()}
                disabled={
                  loadingTip ||
                  shouldPausePublic ||
                  !Number.isFinite(Number(tipAmount)) ||
                  Math.floor(Number(tipAmount)) <= 0
                }
                style={{
                  ...primaryBtnStyle,
                  opacity:
                    loadingTip ||
                    shouldPausePublic ||
                    !Number.isFinite(Number(tipAmount)) ||
                    Math.floor(Number(tipAmount)) <= 0
                      ? 0.7
                      : 1,
                }}
              >
                {loadingTip ? "Sending..." : "Send"}
              </button>

              <button type="button" onClick={() => setTipOpen(false)} style={secondaryBtnStyle}>
                Cancel
              </button>
            </div>
            {tipOkMsg ? (
              <div style={{ marginTop: 10, color: "rgba(120,255,200,0.95)", fontWeight: 900 }}>
                {tipOkMsg}
              </div>
            ) : null}
          </div>
        ) : null}

        {reportOkMsg ? (
          <div style={{ marginTop: 10, color: "rgba(120,255,200,0.95)", fontWeight: 900 }}>
            {reportOkMsg}
          </div>
        ) : null}

        {reportErrMsg ? (
          <div style={{ marginTop: 10, color: "rgba(255,120,120,0.95)", fontWeight: 900 }}>
            {reportErrMsg}
          </div>
        ) : null}

        {reportOpen ? (
          <div
            style={{
              marginTop: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 16,
              background: "rgba(0,0,0,0.35)",
              padding: 12,
              display: "grid",
              gap: 10,
            }}
          >
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              style={inputStyle}
            >
              {REPORT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>

            <textarea
              value={reportNote}
              onChange={(e) => setReportNote(e.target.value)}
              placeholder="Comment (optional)"
              maxLength={500}
              rows={3}
              style={{
                ...inputStyle,
                resize: "vertical",
                minWidth: 0,
                width: "100%",
                maxWidth: "100%",
                boxSizing: "border-box",
              }}
            />

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button type="button" onClick={() => setReportOpen(false)} style={secondaryBtnStyle}>
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void handleReportSend()}
                disabled={reportSending}
                style={{ ...primaryBtnStyle, opacity: reportSending ? 0.7 : 1 }}
              >
                {reportSending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {isLive && supportsGoal && goalIsActive ? (
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 16,
            background: "rgba(255,255,255,0.04)",
            padding: 12,
            opacity: shouldPausePublic ? 0.85 : 1,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontWeight: 900,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {goalTitle || "Goal"}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 900, opacity: 0.95, whiteSpace: "nowrap" }}>
                {goalTarget > 0 ? `${goalProgress} / ${goalTarget} tokens` : `${goalProgress} tokens`}
              </div>

              {goalIsReached ? (
                <span
                  style={{
                    ...pillStyle,
                    border: "1px solid rgba(34,197,94,0.55)",
                    background: "rgba(34,197,94,0.16)",
                    whiteSpace: "nowrap",
                  }}
                >
                  Reached
                </span>
              ) : null}
            </div>
          </div>

          {goalDescription ? (
            <div style={{ marginTop: 6, opacity: 0.9, lineHeight: 1.35 }}>
              {goalDescription.length > 90 ? `${goalDescription.slice(0, 90)}…` : goalDescription}
            </div>
          ) : null}

          <div style={{ marginTop: 10 }}>
            <div
              style={{
                height: 10,
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${goalIsReached ? 100 : goalPct}%`,
                  background: goalIsReached
                    ? "rgba(34,197,94,0.70)"
                    : `linear-gradient(90deg,
                        rgba(220,38,38,0.85) 0%,
                        rgba(234,179,8,0.85) 50%,
                        rgba(34,197,94,0.85) 100%)`,
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div
        style={{
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
          background: "rgba(255,255,255,0.04)",
          padding: 12,
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Chat</div>
        <div style={{ ...pillStyle, marginBottom: 10, display: "inline-flex" }}>
          {chatScopeLabel || (runtimeScope || eventBaseScope).toUpperCase()}
        </div>

        <div
          style={{
            minHeight: 220,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(0,0,0,0.18)",
            display: "grid",
            placeItems: "center",
            opacity: 0.88,
            padding: 16,
            textAlign: "center",
          }}
        >
          Chat runtime stays shared. UI wiring can be reattached here without touching scope logic.
        </div>
      </div>
    </div>
  );
}

const pillStyle = {
  padding: "6px 10px",
  borderRadius: 999,
  fontWeight: 900,
  fontSize: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
} as const;

const primaryBtnStyle = {
  padding: "8px 12px",
  borderRadius: 12,
  fontWeight: 900,
  fontSize: 13,
  cursor: "pointer",
} as const;

const secondaryBtnStyle = {
  padding: "8px 12px",
  borderRadius: 12,
  fontWeight: 900,
  fontSize: 13,
  cursor: "pointer",
  opacity: 0.92,
  background: "transparent",
  color: "white",
  border: "1px solid rgba(255,255,255,0.14)",
} as const;

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.05)",
  color: "white",
  outline: "none",
} as const;