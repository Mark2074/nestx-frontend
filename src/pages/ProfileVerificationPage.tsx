import { useEffect, useMemo, useState } from "react";

type VerificationStatus = "none" | "pending" | "approved" | "rejected";

function authHeaders() {
  const token = localStorage.getItem("token") || "";
  const h: Record<string, string> = {};
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export default function ProfileVerificationPage() {
  const [status, setStatus] = useState<VerificationStatus>("none");
  const [publicVideoUrl, setPublicVideoUrl] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [openPreview, setOpenPreview] = useState(false);

  const canResubmit = status === "none" || status === "rejected";
  const isPending = status === "pending";
  const isApproved = status === "approved";
  const [isVerifiedUser, setIsVerifiedUser] = useState(false);

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
      const r = await fetch("/api/verification/profile/status", {
        method: "GET",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
      });

      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.message || "Failed to load verification status");

      const d = j?.data || {};
      const s = String(d?.verificationStatus || "none").toLowerCase();

      const normalized: VerificationStatus =
        s === "pending" || s === "approved" || s === "rejected" ? (s as VerificationStatus) : "none";

      setStatus(normalized);
      setIsVerifiedUser(!!d?.verifiedUser || !!d?.isVerified);

      const vu = String(d?.verificationPublicVideoUrl || "").trim();
      // sanity: accept only URLs that look like video files (basic)
      const looksLikeVideo =
        /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(vu) || vu.includes("/uploads/") || vu.includes("/media/");
      setPublicVideoUrl(looksLikeVideo ? vu : "");
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
    if (!canResubmit) return;
    if (busy) return;
    if (!file) return alert("Select a video file.");

    setBusy(true);
    setErr("");
    setOkMsg("");

    try {
      // 1) upload to backend local storage
      const fd = new FormData();
      fd.append("file", file);

      const up = await fetch("/api/media/upload", {
        method: "POST",
        headers: authHeaders(), // NO Content-Type for multipart
        body: fd,
      });

      const upJson = await up.json().catch(() => null);
      if (!up.ok) throw new Error(upJson?.message || "Upload failed");

      const uploadedUrl = String(upJson?.data?.url || "").trim();
      if (!uploadedUrl) throw new Error("Upload returned empty url");

      // 2) submit verification with publicVideoUrl
      const vr = await fetch("/api/verification/profile", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ publicVideoUrl: uploadedUrl }),
      });

      const vrJson = await vr.json().catch(() => null);
      if (!vr.ok) throw new Error(vrJson?.message || "Verification submit failed");

      setFile(null);
      setOkMsg("Submitted. Your verification is now pending review.");
      await loadStatus();
    } catch (e: any) {
      setErr(String(e?.message || "Submit failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 820, margin: "0 auto" }}>
      <h1>Profile verification</h1>

      <div style={{ marginTop: 10, opacity: 0.9, lineHeight: 1.4 }}>
        Before uploading, read the verification rules to know exactly what to record.
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <a
          href="/rules/en/verification.html"
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 12px",
            borderRadius: 12,
            fontWeight: 900,
            textDecoration: "none",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.92)",
          }}
        >
          Read verification rules
        </a>
      </div>

      <div style={{ marginTop: 10, opacity: 0.85 }}>
        {loading ? "Loading..." : err ? err : statusLabel}
      </div>

      {okMsg ? (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(0,255,0,0.06)" }}>
          {okMsg}
        </div>
      ) : null}

      {err ? (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(255,0,0,0.06)" }}>
          {err}
        </div>
      ) : null}

      <div style={{ marginTop: 14, opacity: 0.85, lineHeight: 1.4 }}>
        {isApproved ? (
          <div>Approved. Your verification video is public.</div>
        ) : isPending ? (
          <div>Review in progress. Resubmission is disabled while pending.</div>
        ) : (
          <div>You can submit (or resubmit) your verification video.</div>
        )}
      </div>

      {/* Approved: show public video (only if URL provided by API) */}
      {isApproved && isVerifiedUser && publicVideoUrl ? (
        <div
          style={{
            marginTop: 16,
            display: "flex",
            justifyContent: "center",
          }}
        >
          {publicVideoUrl ? (
            <div
              onClick={() => setOpenPreview(true)}
              style={{
                width: 220,
                aspectRatio: "9 / 16",
                borderRadius: 16,
                overflow: "hidden",
                cursor: "pointer",
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <video
                src={publicVideoUrl}
                muted
                playsInline
                preload="metadata"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </div>
          ) : (
            <div style={{ opacity: 0.75 }}>
              Video approved but no public video URL.
            </div>
          )}
        </div>
      ) : null}

      {/* Submit */}
      <div style={{ marginTop: 16, padding: 12, borderRadius: 16, border: "1px solid rgba(255,255,255,0.12)" }}>
        <div style={{ fontWeight: 900 }}>Submit verification</div>

        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          <div style={{ position: "relative", zIndex: 5 }}>
            <input
              type="file"
              accept="video/*"
              disabled={!canResubmit || busy}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={{
                width: "100%",
                cursor: !canResubmit || busy ? "not-allowed" : "pointer",
                pointerEvents: !canResubmit || busy ? "none" : "auto",
              }}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!canResubmit || busy || !file}
            title={
              isPending
                ? "You cannot resubmit while pending."
                : canResubmit
                ? "Submit verification"
                : "Already approved"
            }
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              fontWeight: 900,
              cursor: !canResubmit || busy ? "not-allowed" : "pointer",
              border: "1px solid rgba(255,255,255,0.12)",
              background: !canResubmit || busy ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.92)",
              opacity: !canResubmit || busy ? 0.6 : 1,
            }}
          >
            {busy ? "Submitting..." : status === "rejected" ? "Resubmit" : "Submit"}
          </button>

          {!canResubmit ? (
            <div style={{ opacity: 0.7, fontSize: 13 }}>
              Submission is disabled while pending or after approval.
            </div>
          ) : null}
        </div>
      </div>
      {openPreview ? (
        <div
          onClick={() => setOpenPreview(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(480px, calc(100vw - 32px))",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.14)",
              overflow: "hidden",
            }}
          >
            <video
              src={publicVideoUrl}
              controls
              autoPlay
              style={{
                width: "100%",
                display: "block",
              }}
            />
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 14, opacity: 0.7, fontSize: 13 }}>
        Note: the verification video becomes public only after approval.
      </div>
    </div>
    
  );
}
