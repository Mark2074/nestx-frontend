import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, mapApiErrorMessage, getApiRetryAfterMs, formatRetryAfterLabel } from "../api/nestxApi";

type ConvItem = {
  conversationKey: string;
  lastMessage: {
    id: string;
    senderId: string;
    recipientId: string;
    text: string;
    createdAt: string;
    readAt?: string | null;
  };
};

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

type PeerInfo = {
  id: string;
  displayName?: string;
  username?: string;
};

export default function ChatPage() {
  const nav = useNavigate();
  const q = useQuery();

  const [meId, setMeId] = useState<string>("");
  const [isVip, setIsVip] = useState<boolean>(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [convs, setConvs] = useState<ConvItem[]>([]);
  const [selectedPeerId, setSelectedPeerId] = useState<string>("");

  const [messages, setMessages] = useState<any[]>([]);
  const [peerMap, setPeerMap] = useState<Record<string, PeerInfo>>({});
  const [threadErr, setThreadErr] = useState("");
  const [text, setText] = useState("");
  const [dmRetryUntil, setDmRetryUntil] = useState<number | null>(null);
  const [threadErrUntil, setThreadErrUntil] = useState<number | null>(null);
  const [activeThreadLastMessageId, setActiveThreadLastMessageId] = useState<string>("");

  const listRef = useRef<HTMLDivElement | null>(null);
  const loadThreadSeqRef = useRef(0);
  const selectedPeerRef = useRef("");
  const loadingPeerIdsRef = useRef<Set<string>>(new Set());
  const shouldAutoScrollRef = useRef(true);
  const forceScrollOnNextMessagesRef = useRef(false);

  const cardStyle: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 16,
    padding: 14,
    background: "rgba(255,255,255,0.03)",
  };

  const pillStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.9,
  };

  const btnStyle: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    fontWeight: 900,
    cursor: "pointer",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.10)",
    color: "white",
  };

  function scrollToBottom() {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  function forceScrollToBottomAfterRender() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    });
  }

  function isNearBottom() {
    const el = listRef.current;
    if (!el) return true;

    const threshold = 80; // px tolleranza
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }

  function showThreadError(message: string, ms = 5000) {
    setThreadErr(message);
    setThreadErrUntil(Date.now() + ms);
  }

  function clearThreadErrorIfExpired() {
    if (!threadErrUntil) return;
    if (Date.now() >= threadErrUntil) {
      setThreadErr("");
      setThreadErrUntil(null);
    }
  }

  function getPeerIdFromConv(c: ConvItem, myId: string) {
    const lm = c.lastMessage;
    return String(lm.senderId) === String(myId) ? String(lm.recipientId) : String(lm.senderId);
  }

  function getConversationLastMessageId(c: ConvItem) {
    return String(c?.lastMessage?.id || "");
  }

  async function loadConversations() {
    setErr("");
    try {
      const res: any = await api.listConversations();
      const data = Array.isArray(res) ? res : (res?.data || []);

      setConvs(data);

      if (meId) {
        await ensureConversationPeersLoaded(data as ConvItem[], meId);
      }

      return data as ConvItem[];
    } catch (e: any) {
      setErr(e?.message || "Failed to load conversations");
      setConvs([]);
      return [];
    }
  }

  async function loadThread(
    peerId: string,
    scrollMode: "force" | "smart" = "smart"
  ) {
    if (!peerId) return;

    const requestSeq = ++loadThreadSeqRef.current;
    clearThreadErrorIfExpired();

    try {
      await ensurePeerLoaded(peerId);

      const res: any = await api.getConversation(peerId);
      const data = Array.isArray(res) ? res : (res?.data || []);

      if (
        requestSeq !== loadThreadSeqRef.current ||
        String(selectedPeerRef.current || "") !== String(peerId)
      ) {
        return;
      }

      // mostra subito i messaggi, senza aspettare i fetch profilo
      setMessages(data);

      const lastMsg = Array.isArray(data) && data.length ? data[data.length - 1] : null;
      setActiveThreadLastMessageId(String(lastMsg?._id || lastMsg?.id || ""));

      if (scrollMode === "force") {
        forceScrollToBottomAfterRender();
      } else if (shouldAutoScrollRef.current) {
        setTimeout(scrollToBottom, 0);
      }

      // carica i peer mancanti in background, senza bloccare il render
      const senderIds = data
        .map((m: any) => String(m.senderId || ""))
        .filter((uid: string) => !!uid && uid !== meId && !peerMap[uid]);

      const missingPeerIds: string[] = [...new Set<string>(senderIds)];

      for (const uid of missingPeerIds) {
        void ensurePeerLoaded(uid);
      }
    } catch (e: any) {
      if (
        requestSeq !== loadThreadSeqRef.current ||
        String(selectedPeerRef.current || "") !== String(peerId)
      ) {
        return;
      }

      showThreadError(e?.message || "Failed to load messages");
      setMessages([]);
    }
  }

  async function refreshThreadIfChanged(activePeerId: string, convList?: ConvItem[]) {
    if (!activePeerId || !meId) return;

    const list = Array.isArray(convList) ? convList : await loadConversations();
    const activeConv = list.find((c) => String(getPeerIdFromConv(c, meId)) === String(activePeerId));

    if (!activeConv) {
      // se la conversazione non esiste più, pulizia minima
      setMessages([]);
      setActiveThreadLastMessageId("");
      return;
    }

    const latestConvMsgId = getConversationLastMessageId(activeConv);

    if (!latestConvMsgId) return;

    // ricarica thread solo se è cambiato l'ultimo messaggio
    if (String(latestConvMsgId) !== String(activeThreadLastMessageId || "")) {
      await loadThread(activePeerId, "smart");
    }
  }

  async function ensurePeerLoaded(userId: string) {
    if (!userId) return;
    if (peerMap[userId]) return;
    if (loadingPeerIdsRef.current.has(userId)) return;

    loadingPeerIdsRef.current.add(userId);

    try {
      const res: any = await api.publicProfile(userId);
      const p = res?.profile ?? res?.data ?? res;

      setPeerMap((prev) => {
        if (prev[userId]) return prev;
        return {
          ...prev,
          [userId]: {
            id: userId,
            displayName: p?.displayName,
            username: p?.username,
          },
        };
      });
    } catch {
      setPeerMap((prev) => {
        if (prev[userId]) return prev;
        return {
          ...prev,
          [userId]: { id: userId },
        };
      });
    } finally {
      loadingPeerIdsRef.current.delete(userId);
    }
  }

  async function ensureConversationPeersLoaded(list: ConvItem[], myId: string) {
    if (!myId || !Array.isArray(list) || !list.length) return;

    const peerIds = list
      .map((c) => getPeerIdFromConv(c, myId))
      .filter(Boolean);

    for (const pid of peerIds) {
      await ensurePeerLoaded(String(pid));
    }
  }

  // init
  useEffect(() => {
    (async () => {
      setBusy(true);
      try {
        const raw: any = await api.meProfile();
        const profile = raw?.profile ?? raw;
        const loadedMeId = String(profile?._id || profile?.id || "");
        setMeId(loadedMeId);
        setIsVip(profile?.isVip === true);

        const convList = await loadConversations();
        if (loadedMeId) {
          await ensureConversationPeersLoaded(convList, loadedMeId);
        }

        const qp = String(q.get("user") || "").trim();
        if (qp) {
          await ensurePeerLoaded(qp);
          selectedPeerRef.current = String(qp);
          setSelectedPeerId(qp);
          return;
        }

        // default select first conv
        // (dopo meId)
        // non seleziono qui: ci pensa effect sotto quando meId disponibile
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // auto select first conversation when meId + convs ready
  useEffect(() => {
    if (!meId) return;
    if (selectedPeerId) return;
    if (!convs.length) return;

    const firstPeer = getPeerIdFromConv(convs[0], meId);
    if (firstPeer) {
      setSelectedPeerId(firstPeer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId, convs]);

  // polling (semplice)
  useEffect(() => {
    const t = setInterval(async () => {
      const convList = await loadConversations();
      const qp = String(q.get("user") || "").trim();
      const active = qp || selectedPeerId;

      if (active) {
        await refreshThreadIfChanged(active, convList);
      }
    }, 4000);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeerId, meId, activeThreadLastMessageId]);

  useEffect(() => {
    if (!threadErrUntil) return;

    const left = threadErrUntil - Date.now();
    if (left <= 0) {
      setThreadErr("");
      setThreadErrUntil(null);
      return;
    }

    const t = setTimeout(() => {
      setThreadErr("");
      setThreadErrUntil(null);
    }, left);

    return () => clearTimeout(t);
  }, [threadErrUntil]);

  useEffect(() => {
    selectedPeerRef.current = String(selectedPeerId || "");
  }, [selectedPeerId]);

  async function handleSelectPeer(peerId: string) {
    if (!peerId) return;

    selectedPeerRef.current = String(peerId);
    setSelectedPeerId(peerId);

    // pulisce query ?user=
    nav("/app/chat", { replace: true });

    await ensurePeerLoaded(peerId);
  }

  useEffect(() => {
    if (!selectedPeerId) return;

    selectedPeerRef.current = String(selectedPeerId);
    setMessages([]);
    setActiveThreadLastMessageId("");
    shouldAutoScrollRef.current = true;
    void loadThread(selectedPeerId, "force");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeerId]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const onScroll = () => {
      shouldAutoScrollRef.current = isNearBottom();
    };

    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!forceScrollOnNextMessagesRef.current) return;
    if (!selectedPeerId) return;

    forceScrollOnNextMessagesRef.current = false;
    forceScrollToBottomAfterRender();
  }, [messages, selectedPeerId]);

  async function handleSend() {
    if (dmRetryUntil && Date.now() < dmRetryUntil) return;

    const t = String(text || "").trim();
    if (!t) return;
    if (!selectedPeerId) return;

    setText("");
    try {
      await api.sendMessage(selectedPeerId, { text: t });
      shouldAutoScrollRef.current = true;
      forceScrollOnNextMessagesRef.current = true;
      await loadThread(selectedPeerId, "force");
      await loadConversations();
    } catch (e: any) {
      const retryAfterMs = getApiRetryAfterMs(e);
      if (retryAfterMs) {
        setDmRetryUntil(Date.now() + retryAfterMs);
      }

      showThreadError(
        mapApiErrorMessage(e, "Send failed") +
          formatRetryAfterLabel(retryAfterMs),
        5000
      );

      setText(t);
    }
  }

  const convRows = useMemo(() => {
    if (!meId) return [];
    return convs
      .map((c) => {
        const peerId = getPeerIdFromConv(c, meId);
        const lm = c.lastMessage;
        const direction = String(lm.senderId) === String(meId) ? "out" : "in";
        return {
          peerId,
          lastText: String(lm.text || ""),
          createdAt: lm.createdAt,
          direction,
          raw: c,
        };
      })
      .filter((x) => !!x.peerId);
  }, [convs, meId]);

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Chat</h1>
        <button onClick={() => void loadConversations()} style={btnStyle} disabled={busy}>
          Refresh
        </button>
      </div>

      {err ? <div style={{ marginTop: 10, color: "salmon", fontWeight: 900 }}>{err}</div> : null}

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "340px 1fr", gap: 14 }}>
        {/* LEFT: conversations */}
        <div style={cardStyle}>
          <div style={{ fontWeight: 900, marginBottom: 10, opacity: 0.95 }}>Conversations</div>

          {convRows.length === 0 ? (
            <div style={{ opacity: 0.8 }}>No conversations yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {convRows.map((c) => {
                const active = String(c.peerId) === String(selectedPeerId);
                return (
                  <button
                    key={c.raw.conversationKey}
                    type="button"
                    onClick={() => void handleSelectPeer(c.peerId)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: 12,
                      borderRadius: 14,
                      cursor: "pointer",
                      border: active ? "1px solid rgba(120,255,200,0.45)" : "1px solid rgba(255,255,255,0.12)",
                      background: active ? "rgba(120,255,200,0.08)" : "rgba(255,255,255,0.03)",
                      color: "white",
                    }}
                    title="Open conversation"
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <div style={{ fontWeight: 900, opacity: 0.95 }}>
                        {peerMap[c.peerId]?.displayName ||
                        peerMap[c.peerId]?.username ||
                        String(c.peerId).slice(-6)}
                      </div>
                      <span style={{ ...pillStyle, fontSize: 11, opacity: 0.75 }}>
                        {c.direction === "in" ? "IN" : "OUT"}
                      </span>
                    </div>

                    <div style={{ marginTop: 6, opacity: 0.9, fontSize: 13, lineHeight: 1.25 }}>
                      {c.lastText.length > 80 ? c.lastText.slice(0, 80) + "…" : c.lastText}
                    </div>

                    <div style={{ marginTop: 6, opacity: 0.6, fontSize: 12 }}>
                      {c.createdAt ? new Date(c.createdAt).toLocaleString() : ""}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: thread */}
        <div style={cardStyle}>
          {!selectedPeerId ? (
            <div style={{ opacity: 0.8 }}>Select a conversation.</div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div style={{ fontWeight: 900 }}>
                  Thread ·{" "}
                  <span style={{ opacity: 0.85 }}>
                    {peerMap[selectedPeerId]?.displayName ||
                    peerMap[selectedPeerId]?.username ||
                    String(selectedPeerId).slice(-6)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => nav(`/app/profile/${selectedPeerId}`)}
                  style={{ ...btnStyle, background: "transparent" }}
                >
                  Open profile
                </button>
              </div>

              {threadErr ? <div style={{ marginTop: 10, color: "salmon", fontWeight: 900 }}>{threadErr}</div> : null}

              <div
                ref={listRef}
                style={{
                  marginTop: 12,
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 14,
                  background: "rgba(0,0,0,0.20)",
                  padding: 12,
                  minHeight: 360,
                  maxHeight: 520,
                  overflow: "auto",
                }}
              >
                {messages.length === 0 ? (
                  <div style={{ opacity: 0.75 }}>No messages yet.</div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {messages.map((m: any) => {
                      const isMeMsg = String(m.senderId) === String(meId);
                      const whoId = String(m.senderId || "");
                      return (
                        <div
                          key={String(m._id || Math.random())}
                          style={{
                            display: "grid",
                            gap: 4,
                            justifyItems: isMeMsg ? "end" : "start",
                          }}
                        >
                          <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                            <button
                              type="button"
                              onClick={() => nav(`/app/profile/${whoId}`)}
                              style={{
                                background: "transparent",
                                border: "none",
                                padding: 0,
                                color: isMeMsg ? "#22c55e" : "#3b82f6",
                                fontWeight: 900,
                                cursor: "pointer",
                                textDecoration: "underline",
                                textUnderlineOffset: 3,
                                opacity: 0.95,
                              }}
                              title="Open profile"
                            >
                              {isMeMsg
                                ? "You"
                                : peerMap[whoId]?.displayName ||
                                  peerMap[whoId]?.username ||
                                  String(whoId).slice(-6)}
                            </button>

                            <span style={{ opacity: 0.6, fontSize: 12 }}>
                              {m.createdAt ? new Date(m.createdAt).toLocaleTimeString() : ""}
                            </span>
                          </div>

                          <div
                            style={{
                              maxWidth: 560,
                              padding: "10px 12px",
                              borderRadius: 12,
                              border: "1px solid rgba(255,255,255,0.12)",
                              background: isMeMsg ? "rgba(34,197,94,0.10)" : "rgba(255,255,255,0.05)",
                              whiteSpace: "pre-wrap",
                              lineHeight: 1.35,
                            }}
                          >
                            {String(m.text || "")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                <textarea
                  value={text}
                  onChange={(e) => setText(String(e.target.value || "").slice(0, 400))}
                  placeholder="Write a message..."
                  disabled={!!(dmRetryUntil && Date.now() < dmRetryUntil)}
                  rows={2}
                  style={{
                    flex: "1 1 auto",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(255,255,255,0.05)",
                    color: "white",
                    outline: "none",
                    resize: "none",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!dmRetryUntil || Date.now() >= dmRetryUntil) {
                        void handleSend();
                      }
                    }
                  }}
                />
                <button
                  onClick={() => void handleSend()}
                  disabled={!!(dmRetryUntil && Date.now() < dmRetryUntil)}
                  style={{
                    ...btnStyle,
                    opacity: text.trim() && !(dmRetryUntil && Date.now() < dmRetryUntil) ? 0.95 : 0.55,
                    cursor: text.trim() && !(dmRetryUntil && Date.now() < dmRetryUntil) ? "pointer" : "not-allowed",
                  }}
                >
                  Send
                </button>
              </div>
              <div style={{ marginTop: 8, opacity: 0.72, fontSize: 12, lineHeight: 1.35 }}>
                {isVip
                  ? "VIP messages limit: up to 100 messages per day."
                  : "Base messages limit: up to 10 messages per day. Upgrade to VIP for up to 100 messages per day."}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}