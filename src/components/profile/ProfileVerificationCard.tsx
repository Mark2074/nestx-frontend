import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/nestxApi";

type VerificationStatus = "none" | "pending" | "approved" | "rejected";

export default function ProfileVerificationCard() {
  const [status, setStatus] = useState<VerificationStatus>("none");
  const [publicVideoUrl, setPublicVideoUrl] = useState<string>("");

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const canSubmit = status === "none" || status === "rejected";
  const isPending = status === "pending";
  const isApproved = status === "approved";

  const statusLabel = useMemo(() => {
    if (status === "none") return "Not verified";
    if (status === "pending") return "Pending review";
    if (status === "approved") return "Verified";
    if (status === "rejected") return "Rejected";
    return "Unknown";
  }, [status]);

  async function loadStatus() {
    setLoading(true);
    setErr("");
    setOkMsg("");

    try {
      const d = await api.verificationProfileStatus();

      const s = String(d?.verificationStatus || "none").toLowerCase();

      const normalized: VerificationStatus =
        s === "pending" || s === "approved" || s === "rejected"
          ? (s as VerificationStatus)
          : "none";

      setStatus(normalized);
      setPublicVideoUrl(String(d?.verificationPublicVideoUrl || "").trim());
    } catch (e: any) {
      setErr(String(e?.message || "Failed to load"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit() {
    if (!file) return alert("Select a video file.");
    if (!canSubmit) return;
    if (busy) return;

    setBusy(true);
    setErr("");
    setOkMsg("");

    try {
      const publicUrl = await api.uploadVerificationVideo(file);
      await api.verificationProfileSubmit(publicUrl);

      setOkMsg("Submitted. Your verification is now pending review.");
      setFile(null);
      await loadStatus();
    } catch (e: any) {
      setErr(String(e?.message || "Submit failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Verification</div>
        <div style={{ opacity: 0.8, fontWeight: 800 }}>{loading ? "Loading..." : statusLabel}</div>
      </div>

      {err ? (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(255,0,0,0.06)" }}>
          {err}
        </div>
      ) : null}

      {okMsg ? (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(0,255,0,0.06)" }}>
          {okMsg}
        </div>
      ) : null}

      <div style={{ marginTop: 10, opacity: 0.85, lineHeight: 1.4 }}>
        {isApproved ? (
          <div>Approved. Your verification video is public.</div>
        ) : isPending ? (
          <div>Review in progress. Resubmission is disabled while pending.</div>
        ) : (
          <div>Upload a short verification video.</div>
        )}
      </div>

      {isApproved && publicVideoUrl ? (
        <div style={{ marginTop: 12 }}>
          <video
            src={publicVideoUrl}
            controls
            style={{
              width: "100%",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.03)",
            }}
          />
        </div>
      ) : null}

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        <input
          type="file"
          accept="video/*"
          disabled={!canSubmit || busy}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || busy || !file}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            fontWeight: 900,
            cursor: !canSubmit || busy ? "not-allowed" : "pointer",
            border: "1px solid rgba(255,255,255,0.12)",
            background: !canSubmit || busy ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.92)",
            opacity: !canSubmit || busy ? 0.6 : 1,
          }}
        >
          {busy ? "Uploading..." : status === "rejected" ? "Resubmit" : "Submit"}
        </button>

        {!canSubmit ? (
          <div style={{ opacity: 0.7, fontSize: 13 }}>Submission is disabled while pending or after approval.</div>
        ) : null}
      </div>

      <div style={{ marginTop: 10, opacity: 0.65, fontSize: 12 }}>
        Note: the verification video becomes public only after approval.
      </div>
    </div>
  );
}
