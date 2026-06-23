import React from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../../api/nestxApi";

const MENTION_RE = /(^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]{3,30})(?![a-zA-Z0-9_])/g;

type MentionPart =
  | { type: "text"; value: string }
  | { type: "mention"; value: string; username: string };

type MentionTextProps = {
  text: string;
};

function splitMentionText(text: string): MentionPart[] {
  const value = String(text || "");
  const parts: MentionPart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  MENTION_RE.lastIndex = 0;

  while ((match = MENTION_RE.exec(value))) {
    const prefix = match[1] || "";
    const mentionStart = match.index + prefix.length;

    if (mentionStart > lastIndex) {
      parts.push({ type: "text", value: value.slice(lastIndex, mentionStart) });
    }

    parts.push({
      type: "mention",
      value: value.slice(mentionStart, MENTION_RE.lastIndex),
      username: String(match[2] || "").toLowerCase(),
    });
    lastIndex = MENTION_RE.lastIndex;
  }

  if (lastIndex < value.length) {
    parts.push({ type: "text", value: value.slice(lastIndex) });
  }

  return parts;
}

export default function MentionText({ text }: MentionTextProps) {
  const navigate = useNavigate();
  const pendingUsernames = React.useRef(new Set<string>());
  const parts = React.useMemo(() => splitMentionText(text), [text]);

  const openMention = async (
    event: React.MouseEvent<HTMLButtonElement>,
    username: string,
  ) => {
    event.stopPropagation();
    if (!username || pendingUsernames.current.has(username)) return;

    pendingUsernames.current.add(username);

    try {
      const profile = await api.publicProfileByUsername(username);
      const userId = String(profile?._id || profile?.id || profile?.userId || "");

      if (!userId) {
        alert("Profile not available");
        return;
      }

      navigate(`/app/profile/${userId}`);
    } catch {
      alert("Profile not available");
    } finally {
      pendingUsernames.current.delete(username);
    }
  };

  return (
    <>
      {parts.map((part, index) =>
        part.type === "mention" ? (
          <button
            key={`${part.username}-${index}`}
            type="button"
            onClick={(event) => openMention(event, part.username)}
            style={{
              display: "inline",
              margin: 0,
              padding: 0,
              border: 0,
              background: "transparent",
              color: "#60a5fa",
              font: "inherit",
              fontWeight: 800,
              cursor: "pointer",
            }}
            title={`View @${part.username}`}
          >
            {part.value}
          </button>
        ) : (
          <React.Fragment key={`text-${index}`}>{part.value}</React.Fragment>
        ),
      )}
    </>
  );
}
