import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  api,
  mapApiErrorMessage,
  getApiRetryAfterMs,
  formatRetryAfterLabel,
} from "../api/nestxApi";
import ViewerLiveStage from "../components/live/ViewerLiveStage";

type LiveScope = "public" | "private";
type UiMode =
  | "BOOT"
  | "ACCESS_DENIED"
  | "PRELIVE_HOST_WAITING"
  | "HOST_RECONNECTING"
  | "PUBLIC_ACTIVE"
  | "PRIVATE_RESERVED"
  | "PRIVATE_ACTIVE"
  | "RETURNING_PUBLIC"
  | "ENDED";

type AccessResponse = {
  canEnter: boolean;
  reason?: string;
  authorizedScope?: LiveScope;
  authorizedRoomId?: string | null;
};

type EventDetail = {
  id: string;
  _id?: string;
  title?: string;
  status?: string;
  ticketPriceTokens?: number;
  accessScope?: LiveScope;
  contentScope?: "HOT" | "NO_HOT";
  coverImage?: string | null;
  startTime?: string;
  creator?: {
    id?: string;
    _id?: string;
    displayName?: string;
    avatar?: string;
  };
  privateSession?: {
    isPrivateRunning?: boolean;
    status?: string;
    reservedByUserId?: string | null;
    reservedByDisplayName?: string | null;
    reservedByUsername?: string | null;
  } | null;
  goal?: any;
  live?: any;
};

type RuntimeStatePayload = {
  eventId: string;
  entered: boolean;
  joinedPresence: boolean;
  authorizedScope: LiveScope | null;
  authorizedRoomId: string;
  shouldPausePublic: boolean;
  canWriteChat: boolean;
  canWriteChatReason: string;
};

function normalizeEventDetail(input: any): EventDetail {
  return {
    ...input,
    privateSession: input?.privateSession ?? input?.live?.privateSession ?? null,
  };
}

function getCreatorId(ev: EventDetail | null): string {
  return String(ev?.creator?.id || ev?.creator?._id || "").trim();
}

function getEventStatus(ev: EventDetail | null): string {
  return String(ev?.status || "scheduled").trim().toLowerCase();
}

function getEventBaseScope(ev: EventDetail | null): LiveScope {
  return ev?.accessScope === "private" ? "private" : "public";
}

function getContentScope(ev: EventDetail | null): string {
  return String(ev?.contentScope || "").trim().toUpperCase();
}

function getPrivateStatus(ev: EventDetail | null): string {
  return String(ev?.privateSession?.status || "idle").trim().toLowerCase();
}

function getReservedUserId(ev: EventDetail | null): string {
  return String(ev?.privateSession?.reservedByUserId || "").trim();
}

function resolveUiMode(params: {
  event: EventDetail | null;
  meId: string;
  isHost: boolean;
  isAdmin: boolean;
  runtimeScope: LiveScope | null;
  access: AccessResponse | null;
  hostGraceActive: boolean;
  hostDisconnectState: string;
}): UiMode {
  const {
    event,
    isHost,
    isAdmin,
    runtimeScope,
    access,
    meId,
    hostGraceActive,
    hostDisconnectState,
  } = params;

  if (!event) return "BOOT";

  const status = getEventStatus(event);
  if (status === "finished" || status === "cancelled") return "ENDED";

  if (
    status === "live" &&
    (hostGraceActive || hostDisconnectState === "grace")
  ) {
    return "HOST_RECONNECTING";
  }

  const baseScope = getEventBaseScope(event);
  const contentScope = getContentScope(event);
  const supportsInternalPrivate = contentScope === "HOT" && baseScope === "public";

  const psStatus = getPrivateStatus(event);
  const reservedBy = getReservedUserId(event);
  const isReservedUser = !!meId && !!reservedBy && meId === reservedBy;
  const isPrivateRunning = psStatus === "running";

  if (!isHost && access && access.canEnter === false && access.reason !== "EVENT_NOT_LIVE") {
    return "ACCESS_DENIED";
  }

  if (status !== "live" && isHost) {
    return "PRELIVE_HOST_WAITING";
  }

  if (baseScope === "private") {
    if (runtimeScope === "private") return "PRIVATE_ACTIVE";
    return status === "live" ? "PRIVATE_ACTIVE" : "PRELIVE_HOST_WAITING";
  }

  if (supportsInternalPrivate) {
    if (isPrivateRunning) {
      if (isHost || isAdmin || isReservedUser) {
        return runtimeScope === "public" ? "RETURNING_PUBLIC" : "PRIVATE_ACTIVE";
      }
      return "PUBLIC_ACTIVE";
    }

    if (psStatus === "scheduled" || psStatus === "reserved") {
      return "PRIVATE_RESERVED";
    }
  }

  return "PUBLIC_ACTIVE";
}

function resolveTargetRuntimeScope(params: {
  event: EventDetail | null;
  meId: string;
  isHost: boolean;
  isAdmin: boolean;
  requestedScope: LiveScope;
  access: AccessResponse | null;
}): LiveScope | null {
  const { event, meId, isHost, isAdmin, requestedScope, access } = params;
  if (!event) return null;

  const status = getEventStatus(event);
  const baseScope = getEventBaseScope(event);
  const contentScope = getContentScope(event);
  const supportsInternalPrivate = contentScope === "HOT" && baseScope === "public";

  const psStatus = getPrivateStatus(event);
  const reservedBy = getReservedUserId(event);
  const isReservedUser = !!meId && !!reservedBy && meId === reservedBy;
  const isPrivateRunning = psStatus === "running";

  if (status === "finished" || status === "cancelled") return null;

  if (status !== "live") {
    return null;
  }

  if (!isHost && access && access.canEnter === false && access.reason !== "EVENT_NOT_LIVE") {
    return null;
  }

  if (baseScope === "private") {
    return "private";
  }

  if (supportsInternalPrivate && isPrivateRunning) {
    if (isHost || isAdmin || isReservedUser) return "private";
    return "public";
  }

  if (requestedScope === "private" && supportsInternalPrivate) {
    return "public";
  }

  return "public";
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(totalSec / 3600);
  const mm = Math.floor((totalSec % 3600) / 60);
  const ss = totalSec % 60;

  const p2 = (n: number) => String(n).padStart(2, "0");

  if (hh > 0) return `${p2(hh)}:${p2(mm)}:${p2(ss)}`;
  return `${p2(mm)}:${p2(ss)}`;
}

function formatCountdownTo(targetIso: string | null): string {
  if (!targetIso) return "00:00";

  const targetMs = new Date(targetIso).getTime();
  if (!Number.isFinite(targetMs)) return "00:00";

  const diff = Math.max(0, targetMs - Date.now());
  return formatDuration(diff);
}

export default function LiveRoomPage() {
  const nav = useNavigate();
  const { id } = useParams();
  const eventId = String(id || "").trim();

  const [sp] = useSearchParams();
  const requestedScope: LiveScope = sp.get("scope") === "private" ? "private" : "public";

  const [meId, setMeId] = useState("");
  const [meAccountType, setMeAccountType] = useState("");
  const [eventDetail, setEventDetail] = useState<EventDetail | null>(null);
  const [access, setAccess] = useState<AccessResponse | null>(null);

  const [runtimeScope, setRuntimeScope] = useState<LiveScope | null>(null);
  const [runtimeRoomId, setRuntimeRoomId] = useState("");
  const [entered, setEntered] = useState(false);
  const [roomReady, setRoomReady] = useState(false);
  const [canWriteChat, setCanWriteChat] = useState(false);
  const [canWriteChatReason, setCanWriteChatReason] = useState("");

  const [meta, setMeta] = useState<any>(null);
  const [viewersNow, setViewersNow] = useState(0);
  const [providerDurationMs] = useState(0);
  const [hostDisconnectState, setHostDisconnectState] = useState("offline");
  const [hostGraceActive, setHostGraceActive] = useState(false);
  const [hostGraceExpiresAt, setHostGraceExpiresAt] = useState<string | null>(null);

  const [loadingBootstrap, setLoadingBootstrap] = useState(false);
  const [loadingTransition, setLoadingTransition] = useState(false);
  const [loadingHostAction, setLoadingHostAction] = useState(false);

  const [err, setErr] = useState("");
  const [roomBlockCode, setRoomBlockCode] = useState<"" | "ROOM_FULL">("");

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
  const [, setGraceTick] = useState(0);
  const [isDocumentVisible, setIsDocumentVisible] = useState(() => {
    if (typeof document === "undefined") return true;
    return document.visibilityState === "visible";
  });
  const [viewerPlaybackUrl, setViewerPlaybackUrl] = useState<string | null>(null);
  const [hostMediaStatus, setHostMediaStatus] = useState<"idle" | "live">("idle");

  const REPORT_REASONS: { value: string; label: string }[] = [
    { value: "minor_involved", label: "Minor in stream" },
    { value: "impersonation_or_fake", label: "Pre-recorded video" },
    { value: "spam_or_scam", label: "External advertising" },
    { value: "violent_or_gore_content", label: "Inappropriate content" },
    { value: "illegal_content", label: "Illegal content" },
    { value: "harassment_or_threats", label: "Harassment or threats" },
    { value: "other", label: "Other" },
  ];

  const runtimeScopeRef = useRef<LiveScope | null>(null);
  const joinedPresenceRef = useRef(false);
  const transitionSeqRef = useRef(0);
  const transitionInFlightRef = useRef(false);
  const lastAppliedTargetScopeRef = useRef<LiveScope | null>(null);
  const viewerWasHiddenRef = useRef(false);

  const creatorId = useMemo(() => getCreatorId(eventDetail), [eventDetail]);
  const isHost = useMemo(() => !!meId && !!creatorId && meId === creatorId, [meId, creatorId]);
  const isAdmin = meAccountType === "admin";

  const eventStatus = getEventStatus(eventDetail);
  const isLive = eventStatus === "live";
  const isFinished = eventStatus === "finished";
  const isCancelled = eventStatus === "cancelled";

  const eventBaseScope = getEventBaseScope(eventDetail);
  const contentScope = getContentScope(eventDetail);
  const isNativePrivateEvent = eventBaseScope === "private";
  const isHotEvent = contentScope === "HOT";
  const supportsInternalPrivate = isHotEvent && !isNativePrivateEvent;
  const supportsGoal = isHotEvent && !isNativePrivateEvent;

  const psStatus = getPrivateStatus(eventDetail);
  const psReservedBy = getReservedUserId(eventDetail);
  const isPrivateRunning = psStatus === "running";

  const isReservedUser = !!meId && !!psReservedBy && psReservedBy === meId;

  const shouldPausePublic =
    supportsInternalPrivate &&
    runtimeScope === "public" &&
    isPrivateRunning &&
    !isHost &&
    !!psReservedBy &&
    psReservedBy !== meId;

  const uiMode = resolveUiMode({
    event: eventDetail,
    meId,
    isHost,
    isAdmin,
    runtimeScope,
    access,
    hostGraceActive,
    hostDisconnectState,
  });

  const targetRuntimeScope = resolveTargetRuntimeScope({
    event: eventDetail,
    meId,
    isHost,
    isAdmin,
    requestedScope,
    access,
  });

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

  const canStay = isHost || (access ? !!access.canEnter : true);
  const loading = loadingBootstrap || loadingTransition;

  const emitRuntimeState = useCallback(
    (payload?: Partial<RuntimeStatePayload> & { roomBlockCode?: "" | "ROOM_FULL" }) => {
      try {
        const detail = {
          eventId,
          entered: payload?.entered ?? entered,
          joinedPresence: payload?.joinedPresence ?? joinedPresenceRef.current,
          authorizedScope:
            payload?.authorizedScope !== undefined ? payload.authorizedScope : runtimeScopeRef.current,
          authorizedRoomId:
            payload?.authorizedRoomId !== undefined ? payload.authorizedRoomId : runtimeRoomId,
          shouldPausePublic:
            payload?.shouldPausePublic !== undefined ? payload.shouldPausePublic : shouldPausePublic,
          canWriteChat:
            payload?.canWriteChat !== undefined ? payload.canWriteChat : canWriteChat,
          canWriteChatReason:
            payload?.canWriteChatReason !== undefined ? payload.canWriteChatReason : canWriteChatReason,
          roomBlockCode:
            payload?.roomBlockCode !== undefined ? payload.roomBlockCode : roomBlockCode,
        };
        window.dispatchEvent(new CustomEvent("nx:livechat:state", { detail }));
      } catch {
        // ignore
      }
    },
    [entered, eventId, runtimeRoomId, shouldPausePublic, canWriteChat, canWriteChatReason, roomBlockCode]
  );

  const applyMetaFromEvent = useCallback((ev: EventDetail | null) => {
    if (!ev) return;

    setMeta((prev: any) => ({
      ...(prev || {}),
      title: ev.title ?? prev?.title,
      status: ev.status ?? prev?.status,
      price: ev.ticketPriceTokens ?? prev?.price,
      scope: ev.contentScope ?? prev?.scope,
      coverUrl: ev.coverImage ?? prev?.coverUrl,
      creatorName: ev.creator?.displayName ?? prev?.creatorName,
      avatarUrl: ev.creator?.avatar ?? prev?.avatarUrl,
      when: ev.startTime ?? prev?.when,
    }));
  }, []);

  const loadEvent = useCallback(async () => {
    if (!eventId) return null;
    try {
      const raw = await api.eventGet(eventId);
      const ev = normalizeEventDetail(raw);
      setEventDetail(ev);
      applyMetaFromEvent(ev);
      return ev;
    } catch {
      return null;
    }
  }, [applyMetaFromEvent, eventId]);

  const loadAccess = useCallback(
    async (scope: LiveScope) => {
      if (!eventId) return null;
      try {
        const res = await api.eventAccess(eventId, scope);
        setAccess(res as AccessResponse);
        setErr("");
        setRoomBlockCode("");
        return res as AccessResponse;
      } catch (e: any) {
        const code = String(e?.data?.code || e?.code || "").trim();
        const httpStatus = Number(e?.status || e?.response?.status || 0);

        if (code === "EVENT_NOT_LIVE" || httpStatus === 410) {
          const fallback = { canEnter: false, reason: "EVENT_NOT_LIVE" } as AccessResponse;
          setAccess(fallback);
          setErr("");
          return fallback;
        }

        setAccess(null);
        setErr(String(e?.message || "Failed to load access"));
        return null;
      }
    },
    [eventId]
  );

  const loadStatus = useCallback(
    async (scope: LiveScope) => {
      if (!eventId) return;
      try {
        const res: any = await api.liveStatus(eventId, scope);

        const viewers = Number(res?.viewersNow ?? 0);
        setViewersNow(Number.isFinite(viewers) ? viewers : 0);

        setHostDisconnectState(String(res?.hostDisconnectState || "offline").trim().toLowerCase());
        setHostGraceActive(Boolean(res?.hostGraceActive));
        setHostGraceExpiresAt(
          res?.hostGraceExpiresAt ? String(res.hostGraceExpiresAt) : null
        );
        try {
          const mediaRes: any = await api.liveMediaStatus(eventId, scope);
          setViewerPlaybackUrl(String(mediaRes?.playbackUrl || "").trim() || null);
          setHostMediaStatus(
            String(mediaRes?.hostMediaStatus || (mediaRes?.isLive ? "live" : "idle")) === "live"
              ? "live"
              : "idle"
          );
        } catch {
          setViewerPlaybackUrl(null);
          setHostMediaStatus("idle");
        }
      } catch {
        // ignore
      }
    },
    [eventId]
  );

  const applyPreLiveHostState = useCallback(
    (scope: LiveScope) => {
      runtimeScopeRef.current = null;
      joinedPresenceRef.current = false;

      setRuntimeScope(null);
      setRuntimeRoomId("");
      setEntered(false);
      setRoomReady(false);
      setViewerPlaybackUrl(null);
      setHostMediaStatus("idle");
      setCanWriteChat(true);
      setCanWriteChatReason("HOST");
      setRoomBlockCode("");

      emitRuntimeState({
        entered: false,
        joinedPresence: false,
        authorizedScope: scope,
        authorizedRoomId: "",
        shouldPausePublic: false,
        canWriteChat: true,
        canWriteChatReason: "HOST",
      });
    },
    [emitRuntimeState]
  );

  const clearRuntimeState = useCallback(
    (emitNull = true, nextRoomBlockCode: "" | "ROOM_FULL" = "") => {
      runtimeScopeRef.current = null;
      joinedPresenceRef.current = false;
      lastAppliedTargetScopeRef.current = null;
      viewerWasHiddenRef.current = false;

      setRuntimeScope(null);
      setRuntimeRoomId("");
      setEntered(false);
      setRoomReady(false);
      setViewerPlaybackUrl(null);
      setHostMediaStatus("idle");
      setCanWriteChat(false);
      setCanWriteChatReason("");
      setRoomBlockCode(nextRoomBlockCode);

      if (emitNull) {
        emitRuntimeState({
          entered: false,
          joinedPresence: false,
          authorizedScope: null,
          authorizedRoomId: "",
          shouldPausePublic: false,
          canWriteChat: false,
          canWriteChatReason: "",
          roomBlockCode: nextRoomBlockCode,
        });
      }
    },
    [emitRuntimeState]
  );

  const leaveRuntimeScope = useCallback(
    async (scope: LiveScope) => {
      if (!eventId) return;
      try {
        await api.liveLeaveRoom(eventId, scope);
      } catch {
        // best effort
      }
    },
    [eventId]
  );

  const transitionToRuntimeScope = useCallback(
    async (nextScope: LiveScope | null, eventSnapshot?: EventDetail | null) => {
      const effectiveEvent = eventSnapshot ?? eventDetail;
      if (!eventId || !effectiveEvent) return;
      if (transitionInFlightRef.current) return;

      const currentScope = runtimeScopeRef.current;
      const currentStatus = getEventStatus(effectiveEvent);

      if (
        currentScope === nextScope &&
        nextScope &&
        currentStatus === "live" &&
        joinedPresenceRef.current &&
        entered &&
        roomReady
      ) {
        return;
      }

      if (currentScope === nextScope) {
        if (nextScope && currentStatus === "live" && !joinedPresenceRef.current) {
          // continue
        } else if (!nextScope) {
          return;
        } else if (currentStatus !== "live") {
          return;
        }
      }

      const seq = ++transitionSeqRef.current;
      transitionInFlightRef.current = true;
      setLoadingTransition(true);
      setErr("");
      setRoomBlockCode("");

      const hadJoinedPresence = joinedPresenceRef.current;

      setEntered(false);
      setRoomReady(false);
      setCanWriteChat(false);
      setCanWriteChatReason("");

      emitRuntimeState({
        entered: false,
        joinedPresence: false,
        authorizedScope: currentScope,
        authorizedRoomId: runtimeRoomId,
        shouldPausePublic: false,
        canWriteChat: false,
        canWriteChatReason: "",
        roomBlockCode: "",
      });

      try {
        if (currentScope && currentScope !== nextScope && hadJoinedPresence) {
          await leaveRuntimeScope(currentScope);
          if (seq !== transitionSeqRef.current) return;
        }

        joinedPresenceRef.current = false;

        if (!nextScope) {
          clearRuntimeState(true);
          return;
        }

        if (currentStatus !== "live" && isHost) {
          applyPreLiveHostState(nextScope);
          return;
        }

        const joinAccess: any = await api.eventJoin(eventId, nextScope);
        if (seq !== transitionSeqRef.current) return;

        const accessObj = (joinAccess?.access || joinAccess) as any;
        const authorizedScope: LiveScope =
          accessObj?.authorizedScope === "private" ? "private" : "public";
        const authorizedRoomId = String(accessObj?.authorizedRoomId || "").trim();

        const joinRoomRes: any = await api.liveJoinRoom(eventId, authorizedScope);

        if (seq !== transitionSeqRef.current) return;

        const viewerSessionRes: any = await api.liveViewerSession(eventId, authorizedScope);

        if (seq !== transitionSeqRef.current) return;

        const viewers = Number(joinRoomRes?.currentViewersCount ?? 0);

        setHostDisconnectState(
          String(joinRoomRes?.hostDisconnectState || "offline").trim().toLowerCase()
        );
        setHostGraceActive(Boolean(joinRoomRes?.hostGraceActive));
        setHostGraceExpiresAt(
          joinRoomRes?.hostGraceExpiresAt ? String(joinRoomRes.hostGraceExpiresAt) : null
        );

        runtimeScopeRef.current = authorizedScope;
        joinedPresenceRef.current = true;
        lastAppliedTargetScopeRef.current = authorizedScope;

        setAccess((prev) => ({
          ...(prev || { canEnter: true }),
          canEnter: true,
          authorizedScope,
          authorizedRoomId,
        }));

        setRuntimeScope(authorizedScope);
        setRuntimeRoomId(authorizedRoomId);
        setEntered(true);
        setRoomReady(true);

        const joinCanWriteChat = Boolean(joinAccess?.permissions?.canChat);
        const joinCanWriteChatReason = String(joinAccess?.permissions?.canChatReason || "");

        setCanWriteChat(joinCanWriteChat);
        setCanWriteChatReason(joinCanWriteChatReason);

        if (Number.isFinite(viewers)) {
          setViewersNow(viewers);
        }

        setViewerPlaybackUrl(String(viewerSessionRes?.playbackUrl || "").trim() || null);
        setHostMediaStatus(
          String(
            viewerSessionRes?.hostMediaStatus ||
              (viewerSessionRes?.isLive ? "live" : "idle")
          ) === "live"
            ? "live"
            : "idle"
        );

        emitRuntimeState({
          entered: true,
          joinedPresence: true,
          authorizedScope,
          authorizedRoomId,
          canWriteChat: joinCanWriteChat,
          canWriteChatReason: joinCanWriteChatReason,
        });

        await loadStatus(authorizedScope);
      } catch (e: any) {
        if (seq !== transitionSeqRef.current) return;

        const code = String(e?.data?.code || e?.code || "").trim();

        if (
          nextScope === "private" &&
          supportsInternalPrivate &&
          ["PRIVATE_NOT_INVITED", "NO_TICKET_PRIVATE", "PRIVATE_NOT_AVAILABLE"].includes(code)
        ) {
          clearRuntimeState(true);
          nav(`/app/live/${eventId}/room?scope=public`, { replace: true });
          return;
        }

        if (code === "ROOM_FULL") {
          setErr("Room is full");
          clearRuntimeState(true, "ROOM_FULL");
          return;
        }

        setErr(String(e?.message || "Failed to enter room"));
        clearRuntimeState(true);
      } finally {
        if (seq === transitionSeqRef.current) {
          transitionInFlightRef.current = false;
          setLoadingTransition(false);
        }
      }
    },
    [
      applyPreLiveHostState,
      clearRuntimeState,
      emitRuntimeState,
      entered,
      eventDetail,
      eventId,
      isHost,
      leaveRuntimeScope,
      loadStatus,
      nav,
      roomReady,
      runtimeRoomId,
      supportsInternalPrivate,
    ]
  );

  async function hostAction(action: "go-live" | "finish" | "cancel") {
    if (!eventId) return;

    setLoadingHostAction(true);
    setErr("");

    try {
      if (action === "go-live") {
        await api.eventGoLive(eventId);
        const latest = await loadEvent();
        const nextScope = getEventBaseScope(latest);
        await loadAccess(nextScope);
        await transitionToRuntimeScope(nextScope, latest);
        nav(`/app/live/${eventId}/room?scope=${nextScope}`, { replace: true });
        return;
      }

      if (action === "finish") {
        await api.eventFinish(eventId);
        if (runtimeScopeRef.current && joinedPresenceRef.current) {
          await leaveRuntimeScope(runtimeScopeRef.current);
        }
        clearRuntimeState(true);
        nav("/app/live", { replace: true });
        return;
      }

      if (action === "cancel") {
        await api.eventCancel(eventId);
        if (runtimeScopeRef.current && joinedPresenceRef.current) {
          await leaveRuntimeScope(runtimeScopeRef.current);
        }
        clearRuntimeState(true);
        nav("/app/live", { replace: true });
      }
    } catch (e: any) {
      setErr(String(e?.message || `Failed: ${action}`));
    } finally {
      setLoadingHostAction(false);
    }
  }

  async function handleLeaveClick() {
    const current = runtimeScopeRef.current;
    if (current && joinedPresenceRef.current) {
      await leaveRuntimeScope(current);
    }
    clearRuntimeState(true);
    nav(`/app/live/${eventId}`);
  }

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
      await loadEvent();

      try {
        window.dispatchEvent(
          new CustomEvent("nx:wallet:changed", {
            detail: { source: "tip", eventId },
          })
        );
      } catch {
        // ignore
      }

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

  function goBackToDetail() {
    nav(`/app/live/${eventId}`);
  }

  useEffect(() => {
    const applyVisibility = () => {
      const visible =
        typeof document === "undefined" ? true : document.visibilityState === "visible";

      if (!visible) {
        viewerWasHiddenRef.current = true;
      }

      setIsDocumentVisible(visible);
    };

    document.addEventListener("visibilitychange", applyVisibility);
    window.addEventListener("pageshow", applyVisibility);

    applyVisibility();

    return () => {
      document.removeEventListener("visibilitychange", applyVisibility);
      window.removeEventListener("pageshow", applyVisibility);
    };
  }, []);

  useEffect(() => {
    if (!eventId) return;

    let alive = true;

    const run = async () => {
      setLoadingBootstrap(true);
      setErr("");
      setRoomBlockCode("");
      setTipOpen(false);
      setTipOkMsg("");
      setTipErrMsg("");
      setReportOpen(false);
      setReportOkMsg(null);
      setReportErrMsg(null);

      runtimeScopeRef.current = null;
      joinedPresenceRef.current = false;

      setRuntimeScope(null);
      setRuntimeRoomId("");
      setEntered(false);
      setRoomReady(false);

      try {
        const [me, rawEvent, accessRes] = await Promise.all([
          api.meProfile(),
          api.eventGet(eventId),
          api.eventAccess(eventId, requestedScope),
        ]);

        if (!alive) return;

        setMeId(String((me as any)?._id || (me as any)?.id || "").trim());
        setMeAccountType(String((me as any)?.accountType || "").trim().toLowerCase());

        const ev = normalizeEventDetail(rawEvent);
        setEventDetail(ev);
        applyMetaFromEvent(ev);

        setAccess(accessRes as AccessResponse);
        setErr("");
        setRoomBlockCode("");
      } catch (e: any) {
        if (!alive) return;
        setErr(String(e?.message || "Failed to load room"));
      } finally {
        if (alive) setLoadingBootstrap(false);
      }
    };

    void run();

    return () => {
      alive = false;
    };
  }, [applyMetaFromEvent, eventId, requestedScope]);

  useEffect(() => {
    if (!eventId || !eventDetail || !meId || !creatorId) return;

    const baseScope = getEventBaseScope(eventDetail);

    if (baseScope === "private" && requestedScope !== "private") {
      nav(`/app/live/${eventId}/room?scope=private`, { replace: true });
      return;
    }

    if (
      supportsInternalPrivate &&
      isPrivateRunning &&
      requestedScope !== "private" &&
      (isHost || isAdmin || isReservedUser)
    ) {
      nav(`/app/live/${eventId}/room?scope=private`, { replace: true });
      return;
    }

    if (
      supportsInternalPrivate &&
      !isPrivateRunning &&
      runtimeScope === "private" &&
      requestedScope !== "public"
    ) {
      nav(`/app/live/${eventId}/room?scope=public`, { replace: true });
    }
  }, [
    creatorId,
    eventDetail,
    eventId,
    isAdmin,
    isHost,
    isPrivateRunning,
    isReservedUser,
    meId,
    nav,
    requestedScope,
    runtimeScope,
    supportsInternalPrivate,
  ]);

  useEffect(() => {
    if (!eventId) return;
    if (!meId) return;
    if (!creatorId) return;
    if (!eventDetail) return;
    if (!isHost) return;

    const status = getEventStatus(eventDetail);
    if (status === "finished" || status === "cancelled") return;

    nav(`/app/live/${eventId}/host-console`, { replace: true });
  }, [
    creatorId,
    eventDetail,
    eventId,
    isHost,
    meId,
    nav,
  ]);

  useEffect(() => {
    if (!eventId) return;
    if (!meId) return;
    if (!creatorId) return;
    if (!eventDetail) return;
    if (transitionInFlightRef.current) return;
    if (roomBlockCode === "ROOM_FULL") return;
    if (!isHost && !isDocumentVisible) return;

    const alreadyStable =
      targetRuntimeScope !== null &&
      lastAppliedTargetScopeRef.current === targetRuntimeScope &&
      runtimeScopeRef.current === targetRuntimeScope &&
      joinedPresenceRef.current === true &&
      entered === true &&
      roomReady === true;

    if (alreadyStable) return;

    void transitionToRuntimeScope(targetRuntimeScope);
  }, [
    creatorId,
    entered,
    eventDetail,
    eventId,
    isDocumentVisible,
    isHost,
    meId,
    roomBlockCode,
    roomReady,
    targetRuntimeScope,
    transitionToRuntimeScope,
  ]);

  useEffect(() => {
    if (!eventId || !runtimeScope || !roomReady || !entered) return;
    if (transitionInFlightRef.current) return;

    if (
      supportsInternalPrivate &&
      targetRuntimeScope &&
      runtimeScope !== targetRuntimeScope
    ) {
      return;
    }

    const currentUrl = `${window.location.pathname}${window.location.search}`;
    const targetUrl = `/app/live/${eventId}/room?scope=${runtimeScope}`;

    if (requestedScope !== runtimeScope && currentUrl !== targetUrl) {
      nav(targetUrl, { replace: true });
    }
  }, [
    entered,
    eventId,
    nav,
    requestedScope,
    roomReady,
    runtimeScope,
    supportsInternalPrivate,
    targetRuntimeScope,
  ]);

  useEffect(() => {
    if (isHost) return;
    if (!isDocumentVisible) return;
    if (!viewerWasHiddenRef.current) return;

    viewerWasHiddenRef.current = false;

    if (!eventId) return;
    if (!meId) return;
    if (!creatorId) return;
    if (!eventDetail) return;
    if (transitionInFlightRef.current) return;
    if (roomBlockCode === "ROOM_FULL") return;

    void transitionToRuntimeScope(targetRuntimeScope);
  }, [
    creatorId,
    eventDetail,
    eventId,
    isDocumentVisible,
    isHost,
    meId,
    roomBlockCode,
    targetRuntimeScope,
    transitionToRuntimeScope,
  ]);

  useEffect(() => {
    if (!eventId) return;
    if (!isLive) return;

    const t = window.setInterval(async () => {
      if (!isHost && !isDocumentVisible) return;
      const latest = await loadEvent();
      if (!latest) return;

      const latestStatus = getEventStatus(latest);

      if (latestStatus === "finished" || latestStatus === "cancelled") {
        const current = runtimeScopeRef.current;
        if (current && joinedPresenceRef.current) {
          await leaveRuntimeScope(current);
        }
        clearRuntimeState(true);
        return;
      }

      const latestBaseScope = getEventBaseScope(latest);
      const latestPrivateStatus = getPrivateStatus(latest);
      const latestReservedBy = getReservedUserId(latest);
      const latestIsReservedUser = !!meId && !!latestReservedBy && latestReservedBy === meId;
      const latestSupportsInternalPrivate =
        getContentScope(latest) === "HOT" && latestBaseScope === "public";

      const desiredAccessScope: LiveScope =
        latestBaseScope === "private"
          ? "private"
          : latestSupportsInternalPrivate &&
            latestPrivateStatus === "running" &&
            (isHost || isAdmin || latestIsReservedUser)
          ? "private"
          : "public";

      await loadAccess(desiredAccessScope);
    }, 6000);

    return () => window.clearInterval(t);
  }, [
    clearRuntimeState,
    eventId,
    isAdmin,
    isDocumentVisible,
    isHost,
    leaveRuntimeScope,
    loadAccess,
    loadEvent,
    meId,
    isLive,
  ]);

  useEffect(() => {
    if (!eventId) return;
    if (!isHost) return;
    if (!isLive) return;

    const t = window.setInterval(async () => {
      try {
        const scope = runtimeScopeRef.current || "public";
        await api.liveHostPing(eventId, scope);
        await loadStatus(scope);
      } catch {
        // ignore
      }
    }, 5000);

    return () => window.clearInterval(t);
  }, [eventId, isHost, isLive, loadStatus]);

  useEffect(() => {
    if (!eventId) return;
    if (!isLive) return;
    if (!runtimeScope) return;
    if (!roomReady) return;

    const t = window.setInterval(async () => {
      if (!isHost && !isDocumentVisible) return;
      const currentScope = runtimeScopeRef.current;
      if (!currentScope) return;

      if (isHost) {
        await loadStatus(currentScope);
        return;
      }

      if (!joinedPresenceRef.current) return;

      try {
        await api.livePing(eventId, currentScope);
      } catch (e: any) {
        const httpStatus = Number(e?.status || e?.response?.status || 0);

        if (httpStatus === 403) {
          try {
            const joinAccess: any = await api.eventJoin(eventId, currentScope);
            const accessObj = (joinAccess?.access || joinAccess) as any;
            const authorizedScope: LiveScope =
              accessObj?.authorizedScope === "private" ? "private" : "public";

            await api.liveJoinRoom(eventId, authorizedScope);

            runtimeScopeRef.current = authorizedScope;
            joinedPresenceRef.current = true;
            lastAppliedTargetScopeRef.current = authorizedScope;

            setRuntimeScope(authorizedScope);
            setEntered(true);
            setRoomReady(true);
            setCanWriteChat(Boolean(joinAccess?.permissions?.canChat));
            setCanWriteChatReason(String(joinAccess?.permissions?.canChatReason || ""));

            emitRuntimeState({
              entered: true,
              joinedPresence: true,
              authorizedScope,
              authorizedRoomId: String(accessObj?.authorizedRoomId || ""),
              canWriteChat: Boolean(joinAccess?.permissions?.canChat),
              canWriteChatReason: String(joinAccess?.permissions?.canChatReason || ""),
            });
          } catch {
            clearRuntimeState(true);

            const latest = await loadEvent();
            const latestStatus = getEventStatus(latest);

            if (latestStatus === "finished" || latestStatus === "cancelled") {
              return;
            }

            if (currentScope === "private" && supportsInternalPrivate) {
              nav(`/app/live/${eventId}/room?scope=public`, { replace: true });
            }
          }
        }
        return;
      }

      await loadStatus(currentScope);
    }, 5000);

    return () => window.clearInterval(t);
  }, [
    clearRuntimeState,
    emitRuntimeState,
    eventId,
    isDocumentVisible,
    isHost,
    isLive,
    loadEvent,
    loadStatus,
    nav,
    roomReady,
    runtimeScope,
    supportsInternalPrivate,
  ]);

  useEffect(() => {
    emitRuntimeState();
  }, [
    emitRuntimeState,
    runtimeScope,
    runtimeRoomId,
    entered,
    roomReady,
    shouldPausePublic,
    canWriteChat,
    canWriteChatReason,
    roomBlockCode,
  ]);

  useEffect(() => {
    if (!eventId) return;

    return () => {
      const current = runtimeScopeRef.current;
      const isRealPageUnload =
        document.visibilityState === "hidden" ||
        !window.location.pathname.includes(`/app/live/${eventId}/room`);

      if (current && joinedPresenceRef.current && isRealPageUnload) {
        void api.liveLeaveRoom(eventId, current).catch(() => {});
      }

      if (isRealPageUnload) {
        runtimeScopeRef.current = null;
        joinedPresenceRef.current = false;

        try {
          window.dispatchEvent(
            new CustomEvent("nx:livechat:state", {
              detail: {
                eventId,
                entered: false,
                joinedPresence: false,
                authorizedScope: null,
                authorizedRoomId: "",
                shouldPausePublic: false,
                canWriteChat: false,
                canWriteChatReason: "",
                roomBlockCode: "",
              },
            })
          );
        } catch {
          // ignore
        }
      }
    };
  }, [eventId]);

  useEffect(() => {
    if (!hostGraceActive || !hostGraceExpiresAt) return;

    const t = window.setInterval(() => {
      setGraceTick((v) => v + 1);
    }, 1000);

    return () => window.clearInterval(t);
  }, [hostGraceActive, hostGraceExpiresAt]);

  useEffect(() => {
    if (!eventId) return;
    if (!isFinished && !isCancelled) return;

    if (isHost) {
      nav("/app/live", { replace: true });
    }
  }, [eventId, isCancelled, isFinished, isHost, nav]);

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>
            {meta?.title ? meta.title : "Live room"}
          </div>

          <div
            style={{
              opacity: 0.85,
              marginTop: 4,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span style={pillStyle}>{String(meta?.scope || eventDetail?.contentScope || "—")}</span>
            <span style={pillStyle}>
              {Number(meta?.price ?? eventDetail?.ticketPriceTokens ?? 0) === 0
                ? "FREE"
                : `${Number(meta?.price ?? eventDetail?.ticketPriceTokens ?? 0)} tokens`}
            </span>
            <span style={pillStyle}>👁 {viewersNow} watching</span>
            <span style={pillStyle}>⏱ {formatDuration(providerDurationMs)}</span>
            <span style={pillStyle}>
              {roomBlockCode === "ROOM_FULL"
                ? "BLOCKED"
                : (runtimeScope || eventBaseScope).toUpperCase()}
            </span>
            <span style={pillStyle}>{uiMode}</span>
            {hostGraceActive ? (
              <span style={pillStyle}>
                reconnect {formatCountdownTo(hostGraceExpiresAt)}
              </span>
            ) : null}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={goBackToDetail} style={secondaryBtnStyle}>
            Back
          </button>
          <button onClick={() => void loadAccess(requestedScope)} style={secondaryBtnStyle}>
            Refresh
          </button>
          {entered ? (
            <button onClick={() => void handleLeaveClick()} style={secondaryBtnStyle}>
              Leave
            </button>
          ) : null}
        </div>
      </div>

      {err && uiMode !== "ENDED" ? (
        <div style={{ marginTop: 10, color: "salmon", fontWeight: 900 }}>{err}</div>
      ) : null}

      {!isHost && !canStay && access && access.reason !== "EVENT_NOT_LIVE" ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 14,
            background: "rgba(255,255,255,0.04)",
          }}
        >
          <div style={{ fontWeight: 900, color: "salmon" }}>Access denied</div>
          <div style={{ opacity: 0.85, marginTop: 6 }}>
            {String(access.reason || "Not allowed")}
          </div>
          <div style={{ marginTop: 10 }}>
            <button onClick={goBackToDetail} style={secondaryBtnStyle}>
              Back to detail
            </button>
          </div>
        </div>
      ) : null}

      <div
        style={{
          marginTop: 14,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
          background: "rgba(255,255,255,0.04)",
          padding: 12,
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 6 }}>Live</div>

        {uiMode === "HOST_RECONNECTING" ? (
          <div
            style={{
              marginBottom: 12,
              padding: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 14,
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <div style={{ fontWeight: 900, color: "salmon" }}>
              Host disconnected — reconnecting
            </div>
            <div style={{ opacity: 0.88, marginTop: 6 }}>
              Waiting for host reconnection. Session will close automatically in{" "}
              <b>{formatCountdownTo(hostGraceExpiresAt)}</b>.
            </div>
          </div>
        ) : null}

        <ViewerLiveStage
          eventId={eventId}
          stageReady={roomReady && entered && !!runtimeScope}
          stageErr=""
          isHost={isHost}
          shouldPausePublic={shouldPausePublic}
          roomBlockCode={roomBlockCode}
          uiMode={uiMode}
          eventBaseScope={eventBaseScope}
          runtimeScope={runtimeScope}
          playbackUrl={viewerPlaybackUrl}
          hostMediaStatus={hostMediaStatus}
          onBack={goBackToDetail}
          hostGraceActive={hostGraceActive}
          hostGraceExpiresAt={hostGraceExpiresAt}
          hostGraceCountdownLabel={formatCountdownTo(hostGraceExpiresAt)}
          onRetry={() => {
            setRoomBlockCode("");
            setErr("");
            void loadAccess(requestedScope);
          }}
          navToLive={() => nav("/app/live")}
        />

        {isHost && isLive ? (
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => void hostAction("finish")}
              disabled={loadingHostAction}
              style={secondaryBtnStyle}
            >
              Finish
            </button>
          </div>
        ) : null}

        <div
          style={{
            marginTop: 12,
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          {entered && !isHost ? (
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
          ) : null}

          {entered && !isHost ? (
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
          ) : null}
        </div>

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
                style={{
                  width: 110,
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.05)",
                  color: "white",
                  outline: "none",
                }}
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

            {tipErrMsg ? (
              <div style={{ marginTop: 10, color: "rgba(255,120,120,0.95)", fontWeight: 900 }}>
                {tipErrMsg}
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
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.05)",
                color: "white",
                outline: "none",
                maxWidth: "100%",
                boxSizing: "border-box",
              }}
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
                width: "100%",
                maxWidth: "100%",
                boxSizing: "border-box",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.05)",
                color: "white",
                outline: "none",
                resize: "vertical",
                minWidth: 0,
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

      {isLive && supportsGoal && goalIsActive && !isHost ? (
        <div
          style={{
            marginTop: 12,
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

      {loading ? <div style={{ marginTop: 10, opacity: 0.8 }}>Loading…</div> : null}
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