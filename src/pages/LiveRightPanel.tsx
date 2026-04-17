import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, mapApiErrorMessage, getApiRetryAfterMs, formatRetryAfterLabel } from "../api/nestxApi";

type LiveScope = "public" | "private";

type PrivateSessionDTO = {
  isEnabled?: boolean;
  status?: string;
  seats?: number;
  countdownSeconds?: number;
  roomId?: string | null;
  ticketPriceTokens?: number;
  description?: string;
  reservedByUserId?: string | null;
  reservedExpiresAt?: string | null;
};

type EventDetail = {
  id?: string;
  _id?: string;
  status?: string;
  accessScope?: LiveScope;
  contentScope?: "HOT" | "NO_HOT";
  ticketPriceTokens?: number;
  tipTotalTokens?: number;
  privateTotalTokens?: number;
  privateGrossTokens?: number;
  privateRefundTokens?: number;
  creator?: { id?: string; _id?: string; displayName?: string };
  creatorId?: string;
  privateSession?: PrivateSessionDTO | null;
  goal?: any;
  live?: any;
};

type ChatState = {
  entered: boolean;
  joinedPresence: boolean;
  authorizedScope: LiveScope | null;
  authorizedRoomId: string;
  shouldPausePublic: boolean;
  canWriteChat: boolean;
  roomBlockCode?: "" | "ROOM_FULL";
};

type Msg = {
  _id: string;
  scope: LiveScope;
  userId: string;
  displayName?: string;
  username?: string;
  text: string;
  createdAt: string;
  __optimistic?: boolean;
  __failed?: boolean;
};

function normalizeEventDetail(input: any): EventDetail {
  const privateSession = input?.privateSession ?? input?.live?.privateSession ?? null;

  const tipTotalTokens =
    input?.tipTotalTokens ??
    input?.ownerTotals?.tipTotalTokens ??
    input?.live?.tipTotalTokens ??
    input?.live?.totalTipsTokens ??
    0;

  const privateTotalTokens =
    input?.privateTotalTokens ??
    input?.ownerTotals?.privateTotalTokens ??
    input?.live?.privateTotalTokens ??
    input?.live?.totalPrivateTokens ??
    input?.live?.privateTokensTotal ??
    input?.live?.privateTotal ??
    0;

  return {
    ...input,
    privateSession,
    tipTotalTokens,
    privateTotalTokens,
  };
}

function normalizeMessage(item: any): Msg | null {
  const userId = String(item?.userId || item?.user?._id || item?.user?.id || "").trim();
  const text = String(item?.text || "").trim();
  if (!userId || !text) return null;

  return {
    _id: String(item?._id || item?.id || `srv_${Math.random().toString(16).slice(2)}`),
    scope: String(item?.scope || "public").toLowerCase() === "private" ? "private" : "public",
    userId,
    displayName: item?.displayName || item?.userDisplayName || item?.user?.displayName,
    username: item?.username || item?.user?.username,
    text,
    createdAt: String(item?.createdAt || new Date().toISOString()),
  };
}

export default function LiveRightPanel() {
  const nav = useNavigate();
  const { id } = useParams();
  const eventId = String(id || "").trim();

  const [meId, setMeId] = useState("");
  const [ev, setEv] = useState<EventDetail | null>(null);

  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [waitLeft, setWaitLeft] = useState<number | null>(null);

  const [open, setOpen] = useState(false);
  const [seats, setSeats] = useState(1);
  const [priceTokens, setPriceTokens] = useState(20);
  const [description, setDescription] = useState("");

  const [expiredLock, setExpiredLock] = useState(false);

  const [tab, setTab] = useState<"private" | "goal">("private");

  const [chatState, setChatState] = useState<ChatState>({
    entered: false,
    joinedPresence: false,
    authorizedScope: null,
    authorizedRoomId: "",
    shouldPausePublic: false,
    canWriteChat: false,
    roomBlockCode: "",
  });

  const [messages, setMessages] = useState<Msg[]>([]);
  const [chatText, setChatText] = useState("");
  const [sending, setSending] = useState(false);
  const [chatErr, setChatErr] = useState("");
  const [chatRetryUntil, setChatRetryUntil] = useState<number | null>(null);
  const [chatBlockedUntil, setChatBlockedUntil] = useState<number | null>(null);

  const [goalTitleDraft, setGoalTitleDraft] = useState("");
  const [goalTargetDraft, setGoalTargetDraft] = useState<number>(200);

  const listRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const ps = ev?.privateSession || null;
  const psStatus = String(ps?.status || "idle").toLowerCase();

  const accessScope = String(ev?.accessScope || "").trim().toLowerCase();
  const isNativePrivateEvent = accessScope === "private";

  const contentScope = String(ev?.contentScope || "").toUpperCase();
  const isHotEvent = contentScope === "HOT";
  const isTicketedEvent = Number(ev?.ticketPriceTokens ?? 0) > 0;

  const supportsInternalPrivate = isHotEvent && !isNativePrivateEvent;
  const supportsGoal = isHotEvent && !isNativePrivateEvent;

  const runtimeScope = chatState.authorizedScope;

  const isFreeze =
    psStatus === "running" &&
    chatState.shouldPausePublic === true &&
    !isNativePrivateEvent;

  const uiScope: LiveScope =
    isNativePrivateEvent
      ? "private"
      : psStatus === "running" && runtimeScope === "private"
      ? "private"
      : "public";

  const goal = ev?.goal || ev?.live?.goal || null;
  const goalIsActive = !!goal?.isActive;

  const goalTarget = Math.max(0, Number(goal?.targetTokens ?? 0));
  const goalProgressRaw = Math.max(0, Number(goal?.progressTokens ?? 0));
  const goalProgress = goalTarget > 0 ? Math.min(goalProgressRaw, goalTarget) : goalProgressRaw;

  const goalTitle = String(goal?.title || "Goal").trim();
  const goalDescription = String(goal?.description || "").trim();
  const goalReachedAt = goal?.reachedAt ? String(goal.reachedAt) : null;

  const goalPct =
    goalIsActive && goalTarget > 0 ? Math.max(0, Math.min(100, (goalProgress / goalTarget) * 100)) : 0;

  const goalIsReached =
    !!goalReachedAt || (goalIsActive && goalTarget > 0 && goalProgress >= goalTarget);

  const isLive = String(ev?.status || "").toLowerCase() === "live";
  const canShow = isLive;

  const hostUserId = useMemo(() => {
    return String(
      ev?.creator?._id ??
        ev?.creator?.id ??
        ev?.creatorId ??
        ""
    ).trim();
  }, [ev]);

  const isHost = useMemo(() => {
    return !!meId && !!hostUserId && meId === hostUserId;
  }, [hostUserId, meId]);

  const hideToolsPanel = !isHost || isNativePrivateEvent;

  const reservedBy = String(ps?.reservedByUserId || "").trim();
  const isReservedUser = !!meId && !!reservedBy && meId === reservedBy;
  const isRunningLockedOut =
    canShow && psStatus === "running" && !isHost && !isReservedUser;

  const viewerPrivateVisible =
    supportsInternalPrivate &&
    canShow &&
    (psStatus === "scheduled" || psStatus === "reserved" || psStatus === "running");

  const privateActive =
    supportsInternalPrivate &&
    canShow &&
    (psStatus === "scheduled" || psStatus === "reserved" || psStatus === "running");

  const goalActive = canShow && goalIsActive;

  const canAccessChat =
    canShow &&
    !isFreeze &&
    !!runtimeScope &&
    (isHost || chatState.entered || chatState.joinedPresence);

  const isRoomFullBlocked = chatState.roomBlockCode === "ROOM_FULL";
  const isChatTemporarilyBlocked =
    !!chatBlockedUntil && Date.now() < chatBlockedUntil;

  const canWriteChat = isHost || chatState.canWriteChat === true;

  console.log("LIVE_CHAT_DEBUG", {
    isHost,
    canShow,
    canAccessChat,
    runtimeScope,
    canWriteChat,
    chatState,
    isRoomFullBlocked,
    isChatTemporarilyBlocked,
  });

  const canUseChatComposer =
    canShow &&
    canAccessChat &&
    !!runtimeScope &&
    canWriteChat &&
    !isRoomFullBlocked &&
    !isChatTemporarilyBlocked;

  const hasPrivate =
    !!psStatus &&
    psStatus !== "idle" &&
    psStatus !== "completed" &&
    psStatus !== "expired" &&
    psStatus !== "cancelled";

  const goalLockedByPrivate =
    !supportsGoal ||
    privateActive ||
    runtimeScope === "private";

  const privateLockedByGoal =
    !supportsInternalPrivate ||
    goalActive;

  const viewerCanBuy = !isHost && canShow && supportsInternalPrivate && psStatus === "scheduled";
  const showExpiredUi = isHost && canShow && expiredLock;

  const hostCanSchedule =
    isHost &&
    canShow &&
    supportsInternalPrivate &&
    !isTicketedEvent &&
    !hasPrivate &&
    !expiredLock;

  const hostCanAccept =
    isHost &&
    canShow &&
    supportsInternalPrivate &&
    psStatus === "reserved" &&
    !showExpiredUi;

  const hostCanFinish =
    isHost &&
    canShow &&
    supportsInternalPrivate &&
    psStatus === "running";

  const canOpenPrivateTab = supportsInternalPrivate && !isTicketedEvent;
  const canOpenGoalTab = supportsGoal;

  const tipTotalTokensRaw = Number(
    ev?.tipTotalTokens ??
      ev?.live?.tipTotalTokens ??
      ev?.live?.totalTipsTokens ??
      0
  );
  const tipTotalTokens = Number.isFinite(tipTotalTokensRaw) ? Math.max(0, Math.floor(tipTotalTokensRaw)) : 0;

  const privateTotalTokensDirect = Number(
    ev?.privateTotalTokens ??
      ev?.live?.privateTotalTokens ??
      ev?.live?.totalPrivateTokens ??
      ev?.live?.privateTokensTotal ??
      ev?.live?.privateTotal ??
      0
  );

  const privateGross = Number(ev?.privateGrossTokens ?? ev?.live?.privateGrossTokens ?? 0);
  const privateRefund = Number(ev?.privateRefundTokens ?? ev?.live?.privateRefundTokens ?? 0);

  let privateTotalTokens = 0;
  if (Number.isFinite(privateTotalTokensDirect) && privateTotalTokensDirect > 0) {
    privateTotalTokens = Math.max(0, Math.floor(privateTotalTokensDirect));
  } else if (Number.isFinite(privateGross) && Number.isFinite(privateRefund) && privateGross > 0) {
    privateTotalTokens = Math.max(0, Math.floor(privateGross - privateRefund));
  } else if (Number.isFinite(privateTotalTokensDirect)) {
    privateTotalTokens = Math.max(0, Math.floor(privateTotalTokensDirect));
  }

  const isMsgHost = useCallback(
    (uid: any) => String(uid || "").trim() === String(hostUserId || "").trim(),
    [hostUserId]
  );

  const isMsgMe = useCallback(
    (uid: any) => String(uid || "").trim() === String(meId || "").trim(),
    [meId]
  );

  function scrollToBottom() {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  function onScrollList() {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 24;
    stickToBottomRef.current = nearBottom;
  }

  const loadMe = useCallback(async () => {
    try {
      const me = await api.meProfile();
      setMeId(String((me as any)?._id || (me as any)?.id || "").trim());
    } catch {
      // keep previous
    }
  }, []);

  const loadEvent = useCallback(async () => {
    if (!eventId) return null;

    try {
      const raw = await api.eventGet(eventId);
      const data = normalizeEventDetail(raw);
      setEv(data);

      const status = String(data?.privateSession?.status || "idle").toLowerCase();
      const exp = data?.privateSession?.reservedExpiresAt;

      if (expiredLock) return data;

      if (exp && status === "reserved") {
        const end = new Date(String(exp)).getTime();
        const sec = Math.max(0, Math.ceil((end - Date.now()) / 1000));
        setWaitLeft(sec);
      } else {
        setWaitLeft(null);
      }

      return data;
    } catch {
      return null;
    }
  }, [eventId, expiredLock]);

  const loadMessages = useCallback(
    async (scopeToLoad: LiveScope) => {
      if (!eventId) return;

      try {
        const res = await api.liveGetMessages(eventId, scopeToLoad, 80);
        const items = Array.isArray((res as any)?.items)
          ? (res as any).items
          : Array.isArray(res)
          ? res
          : [];

        const normalized = items
          .map(normalizeMessage)
          .filter(Boolean) as Msg[];

        setChatErr("");

        setMessages((prev) => {
          const now = Date.now();

          const optimisticRecent = prev.filter((m) => {
            if (!m.__optimistic) return false;
            const t = Date.parse(m.createdAt);
            return Number.isFinite(t) && now - t <= 20000;
          });

          const serverSig = new Set(
            normalized.map((m) => `${m.scope}|${m.userId}|${m.text}`)
          );

          const keep = optimisticRecent.filter(
            (m) => !serverSig.has(`${m.scope}|${m.userId}|${m.text}`)
          );

          return [...normalized, ...keep];
        });

        if (stickToBottomRef.current) {
          setTimeout(scrollToBottom, 0);
        }
      } catch (e: any) {
        const httpStatus = Number(e?.status || e?.response?.status || 0);

        if (httpStatus === 403) {
          setChatErr("");
          if (scopeToLoad === "private") {
            setMessages([]);
          }
          return;
        }

        setChatErr(String(e?.message || "Failed to load messages"));
      }
    },
    [eventId]
  );

  const sendMessage = useCallback(async () => {
    if (!eventId || !runtimeScope) return;
    if (!canWriteChat) return;
    if (chatRetryUntil && Date.now() < chatRetryUntil) return;

    const txt = chatText.trim();
    if (!txt) return;

    setSending(true);
    setChatErr("");

    const tempId = `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const optimistic: Msg = {
      _id: tempId,
      scope: runtimeScope,
      userId: meId || "me",
      displayName: "You",
      text: txt,
      createdAt: new Date().toISOString(),
      __optimistic: true,
    };

    setMessages((prev) => [...prev, optimistic]);
    setChatText("");

    if (stickToBottomRef.current) {
      setTimeout(scrollToBottom, 0);
    }

    try {
      const res: any = await api.livePostMessage(eventId, { scope: runtimeScope, text: txt });
      const item = res?.item || res;
      const serverMsg = normalizeMessage(item);

      if (serverMsg) {
        setMessages((prev) => prev.map((m) => (m._id === tempId ? serverMsg : m)));
      }

      setTimeout(() => {
        void loadMessages(runtimeScope);
      }, 400);
    } catch (e: any) {
      const httpStatus = Number(e?.status || e?.response?.status || 0);

      if (httpStatus === 403 && runtimeScope === "private") {
        setChatErr("");
        setMessages([]);
        nav(`/app/live/${eventId}/room?scope=public`, { replace: true });
        return;
      }

      const code = String(e?.data?.code || e?.code || "").trim();
      const retryAfterMs = getApiRetryAfterMs(e);

      if (code === "CHAT_NOT_ALLOWED") {
        setChatBlockedUntil(Date.now() + 5000);
        setChatErr("Chat available only for VIP or users with tokens");
        setMessages((prev) => prev.filter((m) => m._id !== tempId));
      } else {
        if (retryAfterMs) {
          setChatRetryUntil(Date.now() + retryAfterMs);
        }

        setChatErr(
          mapApiErrorMessage(e, "Send failed") +
            formatRetryAfterLabel(retryAfterMs)
        );
      }

      setMessages((prev) =>
        prev.map((m) => (m._id === tempId ? { ...m, __failed: true } : m))
      );
    } finally {
      setSending(false);
    }
  }, [chatRetryUntil, chatText, eventId, loadMessages, meId, nav, runtimeScope]);

  useEffect(() => {
    if (!eventId) return;
    void loadMe();
    void loadEvent();
  }, [eventId, loadEvent, loadMe]);

  useEffect(() => {
    if (!eventId) return;
    if (expiredLock) return;

    const t = window.setInterval(() => {
      void loadEvent();
    }, 8000);

    return () => window.clearInterval(t);
  }, [eventId, expiredLock, loadEvent]);

  useEffect(() => {
    if (waitLeft == null) return;

    if (waitLeft === 0) {
      if (isHost) setExpiredLock(true);
      return;
    }

    if (waitLeft < 0) return;

    const t = window.setInterval(() => {
      setWaitLeft((p) => (p == null ? null : Math.max(0, p - 1)));
    }, 1000);

    return () => window.clearInterval(t);
  }, [isHost, waitLeft]);

  useEffect(() => {
    if (!isHost && expiredLock) {
      setExpiredLock(false);
    }

    if (isHost && psStatus !== "reserved" && expiredLock) {
      setExpiredLock(false);
    }
  }, [expiredLock, isHost, psStatus]);

  useEffect(() => {
    if (!canShow) return;

    if (privateActive) {
      if (tab !== "private") setTab("private");
      return;
    }

    if (goalActive) {
      if (tab !== "goal") setTab("goal");
    }
  }, [canShow, goalActive, privateActive, tab]);

  useEffect(() => {
    const handler = (e: any) => {
      const d = e?.detail || {};
      if (String(d?.eventId || "") !== eventId) return;

      const nextAuthorizedScope: LiveScope | null =
        d?.authorizedScope === "private"
          ? "private"
          : d?.authorizedScope === "public"
          ? "public"
          : null;

      setChatState({
        entered: Boolean(d?.entered),
        joinedPresence: Boolean(d?.joinedPresence),
        authorizedScope: nextAuthorizedScope,
        authorizedRoomId: typeof d?.authorizedRoomId === "string" ? d.authorizedRoomId : "",
        shouldPausePublic: Boolean(d?.shouldPausePublic),
        canWriteChat: Boolean(d?.canWriteChat),
        roomBlockCode: d?.roomBlockCode === "ROOM_FULL" ? "ROOM_FULL" : "",
      });
    };

    window.addEventListener("nx:livechat:state", handler as any);
    return () => window.removeEventListener("nx:livechat:state", handler as any);
  }, [eventId]);

  useEffect(() => {
    setMessages([]);
    setChatErr("");
    stickToBottomRef.current = true;
  }, [eventId, runtimeScope]);

  useEffect(() => {
    if (isFreeze || isRoomFullBlocked) {
      setMessages([]);
      setChatErr(isRoomFullBlocked ? "Room is full." : "");
    }
  }, [isFreeze, isRoomFullBlocked]);

  useEffect(() => {
    if (!canShow) return;
    if (!canAccessChat) return;
    if (!runtimeScope) return;

    let alive = true;

    const tick = async () => {
      if (!alive) return;
      await loadMessages(runtimeScope);
    };

    void tick();

    const t = window.setInterval(() => {
      void tick();
    }, 2000);

    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [canShow, canAccessChat, loadMessages, runtimeScope]);

  useEffect(() => {
    if (!canUseChatComposer) return;

    const t = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);

    return () => clearTimeout(t);
  }, [canUseChatComposer]);

  useEffect(() => {
    if (!chatBlockedUntil) return;

    const ms = chatBlockedUntil - Date.now();
    if (ms <= 0) {
      setChatBlockedUntil(null);
      return;
    }

    const t = window.setTimeout(() => {
      setChatBlockedUntil(null);
    }, ms);

    return () => window.clearTimeout(t);
  }, [chatBlockedUntil]);

  async function onSchedule() {
    if (!eventId) return;
    if (!supportsInternalPrivate) {
      setErr("Private session is not available for this live.");
      return;
    }
    if (isTicketedEvent) {
      setErr("Private session is not available inside an already ticketed event.");
      return;
    }

    setBusy(true);
    setErr("");

    try {
      await api.eventPrivateSchedule(eventId, {
        seats,
        ticketPriceTokens: priceTokens,
        description,
      });
      setOpen(false);
      await loadEvent();
    } catch (e: any) {
      setErr(String(e?.message || "Private schedule failed"));
    } finally {
      setBusy(false);
    }
  }

  async function onBuy() {
    if (!eventId) return;
    if (!supportsInternalPrivate) {
      setErr("Private session is not available for this live.");
      return;
    }

    setBusy(true);
    setErr("");

    try {
      const res = await api.eventPrivateBuy(eventId);
      const exp = (res as any)?.expiresAt;
      if (exp) {
        const end = new Date(String(exp)).getTime();
        setWaitLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
      }
      await loadEvent();
    } catch (e: any) {
      setErr(String(e?.message || "Private buy failed"));
    } finally {
      setBusy(false);
    }
  }

  async function onAccept() {
    if (!eventId) return;
    if (!supportsInternalPrivate) {
      setErr("Private session is not available for this live.");
      return;
    }

    setBusy(true);
    setErr("");

    try {
      await api.eventPrivateAccept(eventId);
      await loadEvent();
      nav(`/app/live/${eventId}/room?scope=private`, { replace: true });
    } catch (e: any) {
      setErr(String(e?.message || "Private accept failed"));
    } finally {
      setBusy(false);
    }
  }

  async function onFinish() {
    if (!eventId) return;
    if (!supportsInternalPrivate) {
      setErr("Private session is not available for this live.");
      return;
    }

    setBusy(true);
    setErr("");

    try {
      await api.eventPrivateFinish(eventId);
      setExpiredLock(false);
      setWaitLeft(null);
      await loadEvent();
      nav(`/app/live/${eventId}/room?scope=public`, { replace: true });
    } catch (e: any) {
      setErr(String(e?.message || "Private finish failed"));
    } finally {
      setBusy(false);
    }
  }

  async function onGoalCreate() {
    if (!eventId) return;
    if (!isHost) return;

    if (!supportsGoal) {
      setErr("Goal is not available for this live.");
      return;
    }

    if (privateActive || goalLockedByPrivate) {
      setErr("Goal is locked while a private session is active.");
      return;
    }

    setBusy(true);
    setErr("");

    try {
      const res: any = await api.goalCreate(eventId, {
        title: goalTitleDraft,
        targetTokens: goalTargetDraft,
      });

      setGoalTitleDraft("");
      setGoalTargetDraft(200);

      const createdGoal = res?.goal;
      const createdTipTotal = res?.tipTotalTokens;

      if (createdGoal) {
        setEv((prev: any) => ({
          ...(prev || {}),
          live: {
            ...((prev as any)?.live || {}),
            goal: createdGoal,
            ...(createdTipTotal != null ? { tipTotalTokens: createdTipTotal } : {}),
          },
        }));
      }

      await loadEvent();
      setTab("goal");
    } catch (e: any) {
      setErr(String(e?.message || "Goal publish failed"));
    } finally {
      setBusy(false);
    }
  }

  async function onGoalStop() {
    if (!eventId) return;
    if (!isHost) return;

    setBusy(true);
    setErr("");

    try {
      const res: any = await api.goalStop(eventId);
      const g = res?.goal;

      setEv((prev: any) => {
        const next: any = { ...(prev || {}) };
        next.live = { ...(next.live || {}) };

        if (g) {
          next.live.goal = g;
        } else {
          next.live.goal = { ...(next.live.goal || {}), isActive: false };
        }

        return next;
      });

      await loadEvent();
      setTab("goal");
    } catch (e: any) {
      setErr(String(e?.message || "Goal stop failed"));
    } finally {
      setBusy(false);
    }
  }

  if (!isHost) {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        {viewerPrivateVisible ? (
          <div style={cardStyle}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Private session</div>

            {!canShow ? (
              <div style={{ opacity: 0.8, fontWeight: 800 }}>
                Private session available when the event is LIVE.
              </div>
            ) : privateLockedByGoal ? (
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  fontWeight: 900,
                  lineHeight: 1.35,
                  opacity: 0.9,
                }}
              >
                Private session is locked while a goal is active.
              </div>
            ) : isRunningLockedOut ? (
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: "rgba(220,38,38,0.15)",
                  border: "1px solid rgba(220,38,38,0.35)",
                  fontWeight: 900,
                  lineHeight: 1.35,
                }}
              >
                Private session in progress.
                <div style={{ marginTop: 8, opacity: 0.9, fontWeight: 800 }}>
                  Public live is temporarily paused.
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={pillStyle}>Status: {String(psStatus).toUpperCase()}</span>
                  <span style={pillStyle}>Price: {Number(ps?.ticketPriceTokens ?? 0)} tokens</span>
                  <span style={pillStyle}>Seats: {Number(ps?.seats ?? 0)}</span>
                  <span style={pillStyle}>{runtimeScope ? runtimeScope.toUpperCase() : "…"}</span>
                </div>

                {ps?.description ? (
                  <div style={{ marginTop: 10, opacity: 0.9, lineHeight: 1.35 }}>
                    {String(ps.description)}
                  </div>
                ) : null}

                <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {viewerCanBuy ? (
                    <button
                      onClick={() => void onBuy()}
                      disabled={busy}
                      style={{
                        ...secondaryBtnStyle,
                        borderColor: "rgba(120,255,200,0.55)",
                        color: "rgba(120,255,200,0.95)",
                        opacity: busy ? 0.6 : 1,
                      }}
                    >
                      {busy ? "Buying..." : "Buy private"}
                    </button>
                  ) : null}
                </div>
              </>
            )}

            {err ? <div style={{ marginTop: 10, color: "salmon", fontWeight: 900 }}>{err}</div> : null}
          </div>
        ) : null}

        <div style={cardStyle}>
          <div
            style={{
              fontWeight: 900,
              marginBottom: 8,
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <span>Chat</span>
            <span style={{ ...pillStyle, fontSize: 11 }}>{uiScope.toUpperCase()}</span>
          </div>

          <div style={{ position: "relative" }}>
            <div
              ref={listRef}
              onScroll={onScrollList}
              style={{
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 14,
                background: "rgba(0,0,0,0.20)",
                padding: 12,
                minHeight: 240,
                maxHeight: 360,
                overflow: "auto",
              }}
            >
              {isFreeze ? null : messages.length === 0 ? (
                <div style={{ opacity: 0.75 }}>No messages yet.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {messages.map((m) => (
                    <div key={m._id} style={{ display: "grid", gap: 4 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => nav(`/app/profile/${m.userId}`)}
                          style={{
                            background: "transparent",
                            border: "none",
                            padding: 0,
                            color: isMsgHost(m.userId)
                              ? "#ef4444"
                              : isMsgMe(m.userId)
                              ? "#22c55e"
                              : "#3b82f6",
                            fontWeight: 900,
                            cursor: "pointer",
                            textDecoration: "underline",
                            textUnderlineOffset: 3,
                            opacity: 0.95,
                          }}
                          title="Open profile"
                        >
                          {String(m.displayName || m.username || m.userId)}
                        </button>
                        <span style={{ opacity: 0.6, fontSize: 12 }}>
                          {new Date(m.createdAt).toLocaleTimeString()}
                        </span>
                        {m.__failed ? (
                          <span style={{ color: "salmon", fontWeight: 900, fontSize: 12 }}>
                            Failed
                          </span>
                        ) : null}
                      </div>
                      <div
                        style={{
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.35,
                          opacity: m.__optimistic ? 0.85 : 1,
                        }}
                      >
                        {m.text}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isFreeze ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 80,
                  borderRadius: 14,
                  background: "rgba(0,0,0,0.92)",
                  display: "grid",
                  placeItems: "center",
                  padding: 14,
                  textAlign: "center",
                  pointerEvents: "all",
                }}
              >
                <div style={{ maxWidth: 320 }}>
                  <div style={{ fontWeight: 1000, fontSize: 14 }}>
                    Host is in a private session.
                  </div>
                  <div style={{ marginTop: 6, opacity: 0.9, fontWeight: 800, fontSize: 13 }}>
                    Public chat is temporarily paused.
                  </div>
                </div>
              </div>
            ) : null}

          {isRoomFullBlocked ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 90,
                borderRadius: 14,
                background: "rgba(0,0,0,0.92)",
                display: "grid",
                placeItems: "center",
                padding: 14,
                textAlign: "center",
                pointerEvents: "all",
              }}
            >
              <div style={{ maxWidth: 320 }}>
                <div style={{ fontWeight: 1000, fontSize: 14, color: "salmon" }}>
                  Room is full
                </div>
                <div style={{ marginTop: 6, opacity: 0.9, fontWeight: 800, fontSize: 13 }}>
                  Chat is unavailable because you are not inside the live room.
                </div>
              </div>
            </div>
          ) : null}
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
            <textarea
              ref={inputRef}
              value={chatText}
              onChange={(e) => setChatText(String(e.target.value || "").slice(0, 400))}
              placeholder={
                isRoomFullBlocked
                  ? "Room is full"
                  : !canShow
                  ? "Chat available when live starts"
                  : !canWriteChat
                  ? "Chat available only for VIP or users with tokens"
                  : isChatTemporarilyBlocked
                  ? "Chat available only for VIP or users with tokens"
                  : "Write a message..."
              }
              disabled={
                sending ||
                !canUseChatComposer ||
                isRoomFullBlocked ||
                !!(chatRetryUntil && Date.now() < chatRetryUntil)
              }
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
                opacity: sending || isFreeze ? 0.6 : 1,
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!sending && canUseChatComposer && (!chatRetryUntil || Date.now() >= chatRetryUntil)) {
                    void sendMessage();
                  }
                }
              }}
            />
            <button
              onClick={() => void sendMessage()}
              disabled={
                sending ||
                !canUseChatComposer ||
                isRoomFullBlocked ||
                !chatText.trim() ||
                !!(chatRetryUntil && Date.now() < chatRetryUntil)
              }
              style={{
                ...secondaryBtnStyle,
                opacity: sending || !canUseChatComposer ? 0.55 : 0.92,
                cursor: sending || !canUseChatComposer ? "not-allowed" : "pointer",
              }}
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </div>

          {chatErr ? (
            <div style={{ marginTop: 8, color: "salmon", fontWeight: 900 }}>{chatErr}</div>
          ) : null}

          {!chatErr && (!canWriteChat || isChatTemporarilyBlocked) ? (
            <div style={{ marginTop: 8, color: "salmon", fontWeight: 900 }}>
              Chat available only for VIP or users with tokens
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {canShow && isHost ? (
        <div style={{ ...cardStyle, padding: 10 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div
              style={{
                fontWeight: 900,
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <span>Total tips (live)</span>
              <span style={{ opacity: 0.95 }}>{tipTotalTokens} tokens</span>
            </div>

            <div
              style={{
                fontWeight: 900,
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                opacity: 0.92,
              }}
            >
              <span>Total private (live)</span>
              <span style={{ opacity: 0.95 }}>{privateTotalTokens} tokens</span>
            </div>
          </div>
        </div>
      ) : null}

      {!hideToolsPanel ? (
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 900 }}>Live tools</div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setTab("private")}
                disabled={!canOpenPrivateTab}
                style={{
                  ...tabBtnStyle,
                  ...(tab === "private" ? tabBtnActiveStyle : tabBtnIdleStyle),
                  cursor: canOpenPrivateTab ? "pointer" : "not-allowed",
                  opacity: canOpenPrivateTab ? 1 : 0.55,
                }}
              >
                Private
              </button>

              <button
                type="button"
                onClick={() => setTab("goal")}
                disabled={!canOpenGoalTab}
                style={{
                  ...tabBtnStyle,
                  ...(tab === "goal" ? tabBtnActiveStyle : tabBtnIdleStyle),
                }}
              >
                Goal
              </button>
            </div>
          </div>

          {canShow && goalActive ? (
            <div style={{ marginTop: 10, opacity: 0.85, fontSize: 13 }}>
              Private is locked while a goal is active.
            </div>
          ) : null}

          {canShow && privateActive ? (
            <div style={{ marginTop: 10, opacity: 0.85, fontSize: 13 }}>
              Goal creation is locked while a private session is active.
            </div>
          ) : null}

          <div style={{ marginTop: 12 }}>
            {tab === "private" ? (
              <>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Private session</div>

                {!canShow ? (
                  <div style={{ opacity: 0.8, fontWeight: 800 }}>
                    Private controls available when the event is LIVE.
                  </div>
                ) : privateLockedByGoal ? (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.14)",
                      fontWeight: 900,
                      lineHeight: 1.35,
                      opacity: 0.9,
                    }}
                  >
                    Private session is locked while a goal is active.
                  </div>
                ) : isRunningLockedOut ? (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      background: "rgba(220,38,38,0.15)",
                      border: "1px solid rgba(220,38,38,0.35)",
                      fontWeight: 900,
                      lineHeight: 1.35,
                    }}
                  >
                    Private session in progress.
                    <div style={{ marginTop: 8, opacity: 0.9, fontWeight: 800 }}>
                      Public live is temporarily paused.
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={pillStyle}>Status: {String(psStatus).toUpperCase()}</span>
                      <span style={pillStyle}>Price: {Number(ps?.ticketPriceTokens ?? 0)} tokens</span>
                      <span style={pillStyle}>Seats: {Number(ps?.seats ?? 0)}</span>
                      <span style={pillStyle}>{runtimeScope ? runtimeScope.toUpperCase() : "…"}</span>
                      {isHost && psStatus === "reserved" && waitLeft != null ? (
                        <span
                          style={{
                            ...pillStyle,
                            ...(waitLeft <= 60
                              ? {
                                  background: "rgba(220,38,38,0.20)",
                                  border: "1px solid rgba(220,38,38,0.55)",
                                }
                              : {}),
                          }}
                        >
                          ⏳ {waitLeft}s
                        </span>
                      ) : null}
                    </div>

                    {ps?.description ? (
                      <div style={{ marginTop: 10, opacity: 0.9, lineHeight: 1.35 }}>
                        {String(ps.description)}
                      </div>
                    ) : null}

                    <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {hostCanSchedule ? (
                        <button onClick={() => setOpen(true)} style={secondaryBtnStyle} disabled={busy}>
                          Schedule private
                        </button>
                      ) : null}

                      {showExpiredUi ? (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ color: "salmon", fontWeight: 900 }}>Reservation expired</div>

                          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <button
                              onClick={async () => {
                                try {
                                  setBusy(true);
                                  setExpiredLock(false);
                                  setWaitLeft(null);
                                  await loadEvent();
                                } finally {
                                  setBusy(false);
                                }
                              }}
                              disabled={busy}
                              style={secondaryBtnStyle}
                            >
                              Back
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {hostCanAccept ? (
                        <button
                          onClick={() => void onAccept()}
                          disabled={busy}
                          style={{
                            ...secondaryBtnStyle,
                            borderColor: "rgba(120,255,200,0.65)",
                            color: "rgba(120,255,200,0.95)",
                            opacity: busy ? 0.6 : 1,
                          }}
                        >
                          {busy ? "Accepting..." : "Accept"}
                        </button>
                      ) : null}

                      {hostCanFinish ? (
                        <button onClick={() => void onFinish()} style={secondaryBtnStyle} disabled={busy}>
                          {busy ? "Finishing..." : "Finish"}
                        </button>
                      ) : null}
                    </div>
                  </>
                )}

                {err ? <div style={{ marginTop: 10, color: "salmon", fontWeight: 900 }}>{err}</div> : null}
              </>
            ) : (
              <>
                {!canShow ? (
                  <div style={{ opacity: 0.8, fontWeight: 800 }}>
                    Goal controls available when the event is LIVE.
                  </div>
                ) : goalIsActive ? (
                  <>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <div style={{ fontWeight: 900 }}>{goalTitle || "Goal"}</div>

                      {goalIsReached ? (
                        <span
                          style={{
                            ...pillStyle,
                            border: "1px solid rgba(34,197,94,0.55)",
                            background: "rgba(34,197,94,0.16)",
                          }}
                        >
                          Reached
                        </span>
                      ) : null}
                    </div>

                    {goalDescription ? (
                      <div style={{ marginTop: 8, opacity: 0.9, lineHeight: 1.35 }}>
                        {goalDescription}
                      </div>
                    ) : null}

                    <div style={{ marginTop: 10 }}>
                      <div
                        style={{
                          height: 8,
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
                              : `hsl(${Math.round(0 + goalPct * 1.2)}, 85%, 52%)`,
                            transition: "width 220ms ease, background 220ms ease",
                          }}
                        />
                      </div>

                      <div
                        style={{
                          marginTop: 8,
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <div style={{ fontWeight: 900, opacity: 0.95 }}>
                          {goalTarget > 0 ? `${goalProgress} / ${goalTarget} tokens` : `${goalProgress} tokens`}
                        </div>
                      </div>

                      {isHost ? (
                        <div
                          style={{
                            marginTop: 10,
                            display: "flex",
                            gap: 10,
                            justifyContent: "flex-end",
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            onClick={() => void onGoalStop()}
                            style={{
                              ...secondaryBtnStyle,
                              borderColor: "rgba(255,100,120,0.35)",
                              color: "salmon",
                            }}
                            disabled={busy}
                          >
                            {busy ? "Stopping..." : "Cancel / Stop"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <>
                    {goalLockedByPrivate ? (
                      <div
                        style={{
                          padding: 12,
                          borderRadius: 12,
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.14)",
                          fontWeight: 900,
                          lineHeight: 1.35,
                          opacity: 0.9,
                        }}
                      >
                        Goal creation is locked while a private session is active.
                      </div>
                    ) : (
                      <>
                        <div style={{ opacity: 0.85, fontSize: 13 }}>
                          Create a new goal for this live.
                        </div>

                        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                          <label style={labelStyle}>
                            Title
                            <input
                              value={goalTitleDraft}
                              onChange={(e) => setGoalTitleDraft(String(e.target.value || "").slice(0, 60))}
                              style={inputStyle}
                              placeholder="Goal title"
                            />
                          </label>

                          <label style={labelStyle}>
                            Target (tokens)
                            <input
                              type="number"
                              min={1}
                              value={goalTargetDraft}
                              onChange={(e) => setGoalTargetDraft(Math.max(1, Number(e.target.value || 1)))}
                              style={inputStyle}
                            />
                          </label>

                          <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <button onClick={() => void onGoalCreate()} style={primaryBtnStyle} disabled={busy}>
                              {busy ? "Publishing..." : "Publish"}
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    {err ? <div style={{ marginTop: 10, color: "salmon", fontWeight: 900 }}>{err}</div> : null}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      ) : null}

      <div style={cardStyle}>
        <div
          style={{
            fontWeight: 900,
            marginBottom: 8,
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <span>Chat</span>
          <span style={{ ...pillStyle, fontSize: 11 }}>{uiScope.toUpperCase()}</span>
        </div>

        <div style={{ position: "relative" }}>
          <div
            ref={listRef}
            onScroll={onScrollList}
            style={{
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 14,
              background: "rgba(0,0,0,0.20)",
              padding: 12,
              minHeight: 240,
              maxHeight: 360,
              overflow: "auto",
              opacity: isFreeze ? 0 : 1,
              pointerEvents: isFreeze ? "none" : "auto",
            }}
          >
            {isFreeze ? null : messages.length === 0 ? (
              <div style={{ opacity: 0.75 }}>No messages yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {messages.map((m) => (
                  <div key={m._id} style={{ display: "grid", gap: 4 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => nav(`/app/profile/${m.userId}`)}
                        style={{
                          background: "transparent",
                          border: "none",
                          padding: 0,
                          color: isMsgHost(m.userId) ? "#ef4444" : isMsgMe(m.userId) ? "#22c55e" : "#3b82f6",
                          fontWeight: 900,
                          cursor: "pointer",
                          textDecoration: "underline",
                          textUnderlineOffset: 3,
                          opacity: 0.95,
                        }}
                        title="Open profile"
                      >
                        {String(m.displayName || m.username || m.userId)}
                      </button>
                      <span style={{ opacity: 0.6, fontSize: 12 }}>
                        {new Date(m.createdAt).toLocaleTimeString()}
                      </span>
                      {m.__failed ? (
                        <span style={{ color: "salmon", fontWeight: 900, fontSize: 12 }}>
                          Failed
                        </span>
                      ) : null}
                    </div>
                    <div
                      style={{
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.35,
                        opacity: m.__optimistic ? 0.85 : 1,
                      }}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isFreeze ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 14,
                background: "rgba(0,0,0,0.55)",
                display: "grid",
                placeItems: "center",
                padding: 14,
                textAlign: "center",
              }}
            >
              <div style={{ maxWidth: 320 }}>
                <div style={{ fontWeight: 1000, fontSize: 14 }}>
                  Host is in a private session.
                </div>
                <div style={{ marginTop: 6, opacity: 0.9, fontWeight: 800, fontSize: 13 }}>
                  Public chat is temporarily paused.
                </div>
              </div>
            </div>
          ) : null}

          {isRoomFullBlocked ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 90,
                borderRadius: 14,
                background: "rgba(0,0,0,0.92)",
                display: "grid",
                placeItems: "center",
                padding: 14,
                textAlign: "center",
                pointerEvents: "all",
              }}
            >
              <div style={{ maxWidth: 320 }}>
                <div style={{ fontWeight: 1000, fontSize: 14, color: "salmon" }}>
                  Room is full
                </div>
                <div style={{ marginTop: 6, opacity: 0.9, fontWeight: 800, fontSize: 13 }}>
                  Chat is unavailable because you are not inside the live room.
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
          <textarea
            ref={inputRef}
            value={chatText}
            onChange={(e) => setChatText(String(e.target.value || "").slice(0, 400))}
            placeholder={
              isRoomFullBlocked
                ? "Room is full"
                : !canWriteChat
                ? "Chat available only for VIP or users with tokens"
                : isChatTemporarilyBlocked
                ? "Chat available only for VIP or users with tokens"
                : "Write a message..."
            }
            disabled={
              sending ||
              !canUseChatComposer ||
              isRoomFullBlocked ||
              !!(chatRetryUntil && Date.now() < chatRetryUntil)
            }
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
              opacity: sending || isFreeze ? 0.6 : 1,
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!sending && canUseChatComposer && (!chatRetryUntil || Date.now() >= chatRetryUntil)) {
                  void sendMessage();
                }
              }
            }}
          />
          <button
            onClick={() => void sendMessage()}
            disabled={
              sending ||
              !canUseChatComposer ||
              !chatText.trim() ||
              !!(chatRetryUntil && Date.now() < chatRetryUntil)
            }
            style={{
              ...secondaryBtnStyle,
              opacity: sending || isFreeze ? 0.55 : 0.92,
              cursor: sending || isFreeze ? "not-allowed" : "pointer",
            }}
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
        {chatErr ? (
          <div style={{ marginTop: 8, color: "salmon", fontWeight: 900 }}>{chatErr}</div>
        ) : null}

        {!chatErr && (!canWriteChat || isChatTemporarilyBlocked) ? (
          <div style={{ marginTop: 8, color: "salmon", fontWeight: 900 }}>
            Chat available only for VIP or users with tokens
          </div>
        ) : null}
      </div>

      {open ? (
        <div style={modalOverlayStyle}>
          <div style={modalCardStyle}>
            <div style={{ fontWeight: 900, fontSize: 14 }}>Schedule private</div>

            <div
              style={{
                marginTop: 10,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <label style={labelStyle}>
                Seats
                <input
                  value={seats}
                  onChange={(e) => setSeats(Math.max(1, Number(e.target.value || 1)))}
                  type="number"
                  min={1}
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                Price (tokens)
                <input
                  value={priceTokens}
                  onChange={(e) => setPriceTokens(Math.max(0, Number(e.target.value || 0)))}
                  type="number"
                  min={0}
                  style={inputStyle}
                />
              </label>

              <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
                Offer description
                <textarea
                  value={description}
                  onChange={(e) => setDescription(String(e.target.value || "").slice(0, 140))}
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical" as const }}
                  placeholder="Short offer description (max 140 chars)"
                />
              </label>
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setOpen(false)} style={secondaryBtnStyle}>
                Cancel
              </button>
              <button onClick={() => void onSchedule()} style={primaryBtnStyle} disabled={busy}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const cardStyle = {
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 16,
  background: "rgba(255,255,255,0.04)",
  padding: 12,
} as const;

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

const tabBtnStyle = {
  padding: "8px 12px",
  borderRadius: 999,
  fontWeight: 900,
  fontSize: 13,
  cursor: "pointer",
  background: "rgba(255,255,255,0.04)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.14)",
  transition: "all 160ms ease",
} as const;

const tabBtnActiveStyle = {
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.26)",
  opacity: 1,
} as const;

const tabBtnIdleStyle = {
  opacity: 0.8,
} as const;

const modalOverlayStyle = {
  position: "fixed" as const,
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 12,
  zIndex: 50,
};

const modalCardStyle = {
  width: "min(520px, 100%)",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(20,20,20,0.98)",
  padding: 12,
  boxShadow: "0 10px 40px rgba(0,0,0,0.45)",
};

const labelStyle = {
  display: "grid",
  gap: 6,
  fontWeight: 900,
  fontSize: 12,
  opacity: 0.9,
};

const inputStyle = {
  padding: "10px 10px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  outline: "none",
};