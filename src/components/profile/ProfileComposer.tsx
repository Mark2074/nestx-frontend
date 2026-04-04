export default function ProfileComposer({
  composerOpen,
  composerType,
  setComposerType,
  composerBusy,
  handleSubmitPost,
  resetComposer,
  setComposerOpen,
  isVip,
  postText,
  setPostText,
  selectedFiles,
  setSelectedFiles,
  pollQuestion,
  setPollQuestion,
  pollOptions,
  pollDays,
  setPollDays,
  addPollOption,
  removePollOption,
  updatePollOption,
  composerError,
  setComposerError,
}: {
  composerOpen: boolean;

  composerType: "text" | "poll";
  setComposerType: React.Dispatch<React.SetStateAction<"text" | "poll">>;

  composerBusy: boolean;
  handleSubmitPost: () => Promise<void>;

  resetComposer: () => void;
  setComposerOpen: React.Dispatch<React.SetStateAction<boolean>>;

  isVip: boolean;

  postText: string;
  setPostText: React.Dispatch<React.SetStateAction<string>>;

  selectedFiles: File[];
  setSelectedFiles: React.Dispatch<React.SetStateAction<File[]>>;

  pollQuestion: string;
  setPollQuestion: React.Dispatch<React.SetStateAction<string>>;

  pollOptions: string[];
  pollDays: number;
  setPollDays: React.Dispatch<React.SetStateAction<number>>;

  addPollOption: () => void;
  removePollOption: (idx: number) => void;
  updatePollOption: (idx: number, val: string) => void;

  composerError: string;
  setComposerError: React.Dispatch<React.SetStateAction<string>>;
}) {
  if (!composerOpen) return null;

  return (
    <div
      style={{
        marginTop: 14,
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 16,
        background: "rgba(255,255,255,0.03)",
        padding: 12,
      }}
    >
      {/* Type selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <button
          onClick={() => {
            setComposerError("");
            setComposerType("text");
          }}
          style={{
            padding: "8px 12px",
            borderRadius: 12,
            fontWeight: 900,
            cursor: "pointer",
            opacity: composerType === "text" ? 1 : 0.6,
          }}
        >
          Text
        </button>

        <button
          onClick={() => {
            if (!isVip) return;
            setSelectedFiles([]); // poll can't include media
            setComposerType("poll");
            setComposerError("");
          }}
          title={!isVip ? "VIP only" : "Create a poll"}
          style={{
            padding: "8px 12px",
            borderRadius: 12,
            fontWeight: 900,
            cursor: !isVip ? "not-allowed" : "pointer",
            opacity: composerType === "poll" ? 1 : 0.6,
          }}
        >
          Poll {!isVip ? "(VIP)" : ""}
        </button>
      </div>

      {/* Optional text (works for both) */}
      <div style={{ marginBottom: 10 }}>
        <textarea
          value={postText}
          onChange={(e) => setPostText(e.target.value)}
          placeholder={composerType === "poll" ? "Optional text…" : "Write something…"}
          style={{
            width: "100%",
            minHeight: 90,
            padding: 10,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(0,0,0,0.15)",
            color: "inherit",
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
      </div>
      {/* Media (optional, 1–3) */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>Media (optional, 1–3)</div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "8px 12px",
              borderRadius: 12,
              fontWeight: 900,
              cursor: composerType === "poll" ? "not-allowed" : "pointer",
              opacity: composerType === "poll" ? 0.45 : 1,
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(255,255,255,0.06)",
            }}
            title={composerType === "poll" ? "Poll posts can’t include media" : "Add file"}
          >
            Add file
            <input
              type="file"
              accept="image/*,video/*"
              style={{ display: "none" }}
              disabled={composerType === "poll"}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                setComposerError("");

                setSelectedFiles((prev: File[]) => {
                  const curr = Array.isArray(prev) ? prev : [];
                  if (curr.length >= 3) return curr;
                  return [...curr, file];
                });

                e.currentTarget.value = "";
              }}
            />
          </label>

          <div style={{ opacity: 0.85, fontSize: 13 }}>
            Selected: <b>{selectedFiles.length}</b> / 3
          </div>

          <div style={{ opacity: 0.75, fontSize: 12, marginTop: 2 }}>
            {isVip ? "Video up to 3 min" : "Video up to 1 min (VIP up to 3 min)"}
          </div>

          {selectedFiles.length > 0 ? (
            <button
              onClick={() => {
                setComposerError("");
                setSelectedFiles([]);
              }}
              type="button"
              style={{
                marginLeft: "auto",
                padding: "8px 12px",
                borderRadius: 12,
                fontWeight: 900,
                cursor: "pointer",
                border: "1px solid rgba(255,255,255,0.16)",
                background: "rgba(255,255,255,0.04)",
                color: "white",
              }}
            >
              Clear
            </button>
          ) : null}
        </div>

        {composerType === "poll" ? (
          <div style={{ marginTop: 6, opacity: 0.7, fontSize: 13 }}>
            Note: Poll posts can’t include media.
          </div>
        ) : null}

        {composerError ? (
          <div
            style={{
              marginTop: 10,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,0,0,0.35)",
              background: "rgba(255,0,0,0.08)",
              color: "rgba(255,255,255,0.92)",
              fontWeight: 800,
              fontSize: 13,
              lineHeight: 1.35,
            }}
          >
            {composerError}
          </div>
        ) : null}

        {selectedFiles.length > 0 ? (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {selectedFiles.map((f: File, idx: number) => (
              <div
                key={`${f.name}_${f.size}_${idx}`}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f.name}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setComposerError("");
                    setSelectedFiles((prev: File[]) => prev.filter((_, i) => i !== idx));
                  }}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 10,
                    fontWeight: 900,
                    cursor: "pointer",
                    opacity: 0.9,
                  }}
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Poll fields */}
      {composerType === "poll" ? (
        <div style={{ marginTop: 10 }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Question</div>
            <input
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              placeholder="Ask a question…"
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.15)",
                color: "inherit",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Options</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pollOptions.map((opt, idx) => (
                <div key={idx} style={{ display: "flex", gap: 8 }}>
                  <input
                    value={opt}
                    onChange={(e) => updatePollOption(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                    style={{
                      flex: 1,
                      padding: 10,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(0,0,0,0.15)",
                      color: "inherit",
                    }}
                  />

                  <button
                    onClick={() => removePollOption(idx)}
                    disabled={pollOptions.length <= 2}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      fontWeight: 900,
                      cursor: pollOptions.length <= 2 ? "not-allowed" : "pointer",
                      opacity: pollOptions.length <= 2 ? 0.5 : 1,
                    }}
                    title={pollOptions.length <= 2 ? "Minimum 2 options" : "Remove option"}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
              <button
                onClick={addPollOption}
                disabled={pollOptions.length >= 6}
                style={{
                  padding: "8px 12px",
                  borderRadius: 12,
                  fontWeight: 900,
                  cursor: pollOptions.length >= 6 ? "not-allowed" : "pointer",
                  opacity: pollOptions.length >= 6 ? 0.5 : 1,
                }}
              >
                Add option
              </button>

              <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ fontWeight: 900 }}>Duration</div>
                <select
                  value={pollDays}
                  onChange={(e) => setPollDays(Number(e.target.value))}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(0,0,0,0.15)",
                    color: "inherit",
                    cursor: "pointer",
                  }}
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <option key={d} value={d}>
                      {d} day{d > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Submit */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
          marginTop: 14, // 👈 spazio tra media e bottoni
        }}
      >
        <button
          onClick={() => {
            resetComposer();
            setComposerOpen(false);
          }}
          disabled={composerBusy}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            fontWeight: 900,
            cursor: composerBusy ? "not-allowed" : "pointer",
            opacity: composerBusy ? 0.6 : 1,
          }}
        >
          Cancel
        </button>

        <button
          onClick={handleSubmitPost}
          disabled={composerBusy}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            fontWeight: 900,
            cursor: composerBusy ? "not-allowed" : "pointer",
            opacity: composerBusy ? 0.6 : 1,
          }}
        >
          {composerBusy ? "Publishing…" : "Publish"}
        </button>
      </div>
    </div>
  );
}
