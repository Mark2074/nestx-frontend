import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/nestxApi";

const CATEGORIES = ["social", "live", "chat", "tokens", "search", "adv", "showcase"] as const;
type Category = (typeof CATEGORIES)[number];

export default function BugReportPage() {
  const nav = useNavigate();

  const [category, setCategory] = useState<Category>("social");
  const [text, setText] = useState("");
  const [steps, setSteps] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");

  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return String(category).trim().length > 0 && text.trim().length > 0 && text.trim().length <= 1000;
  }, [category, text]);

  async function onSubmit() {
    if (!canSubmit || loading) return;

    setLoading(true);
    setError(null);

    try {
      await api.bugReportCreate({
        category,
        text: text.trim(),
        steps: steps.trim() ? steps.trim() : undefined,
        screenshotUrl: screenshotUrl.trim() ? screenshotUrl.trim() : undefined,
        route: `${window.location.pathname}${window.location.search || ""}`,
        userAgent: navigator.userAgent,
      });

      setSent(true);
    } catch (e: any) {
      setError(e?.message || "Failed to send bug report");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 950 }}>Bug report</div>
        <div style={{ marginTop: 10, opacity: 0.9 }}>Bug report sent.</div>

        <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
          <button
            onClick={() => nav(-1)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "none",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Go back
          </button>
          <button
            onClick={() => {
              setSent(false);
              setText("");
              setSteps("");
              setScreenshotUrl("");
              setError(null);
            }}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "none",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Send another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 760 }}>
      <div style={{ fontSize: 22, fontWeight: 950 }}>Bug report</div>
      <div style={{ marginTop: 6, opacity: 0.85 }}>Minimal report form (no uploads).</div>

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>Category</div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            style={{ marginTop: 6, padding: "10px 12px", borderRadius: 12, width: "100%" }}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>Description (required)</div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            maxLength={1000}
            style={{ marginTop: 6, padding: "10px 12px", borderRadius: 12, width: "100%", resize: "vertical" }}
            placeholder="What happened?"
          />
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>{text.length}/1000</div>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>Steps to reproduce (optional)</div>
          <textarea
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            rows={5}
            maxLength={2000}
            style={{ marginTop: 6, padding: "10px 12px", borderRadius: 12, width: "100%", resize: "vertical" }}
            placeholder="1) ... 2) ... 3) ..."
          />
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>Screenshot URL (optional)</div>
          <input
            value={screenshotUrl}
            onChange={(e) => setScreenshotUrl(e.target.value)}
            maxLength={500}
            style={{ marginTop: 6, padding: "10px 12px", borderRadius: 12, width: "100%" }}
            placeholder="https://..."
          />
        </div>

        {error ? (
          <div style={{ padding: 10, borderRadius: 12, background: "rgba(255,0,0,0.12)" }}>{error}</div>
        ) : null}

        <button
          disabled={!canSubmit || loading}
          onClick={onSubmit}
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "none",
            fontWeight: 950,
            cursor: !canSubmit || loading ? "not-allowed" : "pointer",
            opacity: !canSubmit || loading ? 0.6 : 1,
          }}
        >
          {loading ? "Sending…" : "Submit"}
        </button>
      </div>
    </div>
  );
}