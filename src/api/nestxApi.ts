export type ApiWrapped<T> = { status: "success" | "error"; data?: T; message?: string };

type LiveScope = "public" | "private";

type HostRealtimeState = "idle" | "setup" | "joined" | "broadcasting" | "ended";

export type LiveTokenResponse = {
  eventId: string;
  requestedScope?: LiveScope;
  authorizedScope: LiveScope;
  scope: LiveScope;
  roomId?: string | null;
  provider: "cloudflare" | string;
  meetingId: string;
  authToken: string;
  participantId?: string;
  participantPreset?: string;
  role: "host" | "viewer";
  isHost?: boolean;
  isAdmin?: boolean;
  viewerCountMode?: string;
};

export type LiveMediaStatusResponse = {
  eventId: string;
  scope: LiveScope;
  hostMediaStatus: "idle" | "live";
  playbackUrl?: string | null;
  streamKey?: string | null;
};

export type LiveMessageItem = {
  _id: string;
  eventId?: string;
  scope: "public" | "private";
  userId: string;
  displayName?: string;
  username?: string;
  text: string;
  createdAt: string;
};

export type LiveMessagesResponse = {
  items?: LiveMessageItem[];
  data?: LiveMessageItem[];
};

type TicketGetResponse = {
  hasTicket: boolean;
  scope?: "public" | "private";
  ticket?: any;
};

type PrivateSchedulePayload = {
  seats: number;
  ticketPriceTokens: number;
  description?: string;
};

type PrivateBuyResponse = {
  roomId?: string;
  expiresAt?: string;     // alias BE
  waitSeconds?: number;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

function getToken(): string | null {
  return localStorage.getItem("token"); // IMPORTANT: useremo questa chiave
}

export function persistLocalIdentity(raw: any) {
  const u = raw || {};

  try {
    const username = String(u?.username || "").trim();
    const displayName = String(u?.displayName || u?.username || "Me").trim();
    const avatar = String(u?.avatar || "").trim();
    const coverImage = String(u?.coverImage || "").trim();

    localStorage.setItem("username", username);
    localStorage.setItem("userId", String(u?._id || u?.id || ""));
    localStorage.setItem("displayName", displayName);
    localStorage.setItem("avatar", avatar);
    localStorage.setItem("coverImage", coverImage);

    localStorage.setItem("isVip", u?.isVip ? "1" : "0");
    localStorage.setItem("isCreator", u?.isCreator ? "1" : "0");
    localStorage.setItem("isVerified", (u?.isVerified || u?.verifiedUser) ? "1" : "0");
    localStorage.setItem("isPrivate", u?.isPrivate ? "1" : "0");

    localStorage.setItem("profileType", String(u?.profileType || ""));
    localStorage.setItem("language", String(u?.language || ""));
    localStorage.setItem("area", String(u?.area || ""));

    if (u?.accountType) {
      localStorage.setItem("accountType", String(u.accountType));
    }
  } catch {}

  try {
    window.dispatchEvent(new CustomEvent("nx:identity-updated", { detail: { user: u } }));
  } catch {}
}

type ApiErrorCode =
  | "LINK_NOT_ALLOWED"
  | "FUNNEL_NOT_ALLOWED"
  | "CONTACT_NOT_ALLOWED"
  | "POST_RATE_LIMIT"
  | "COMMENT_RATE_LIMIT"
  | "DM_RATE_LIMIT"
  | string;

export type ApiClientError = Error & {
  status?: number;
  data?: any;
  code?: ApiErrorCode;
  retryAfterMs?: number | null;
};

function extractRetryAfterMs(payload: any, res?: Response): number | null {
  const fromBody =
    Number(payload?.retryAfterMs ?? payload?.data?.retryAfterMs ?? payload?.details?.retryAfterMs);

  if (Number.isFinite(fromBody) && fromBody > 0) {
    return Math.floor(fromBody);
  }

  const rawHeader = res?.headers?.get("Retry-After");
  if (!rawHeader) return null;

  const sec = Number(rawHeader);
  if (Number.isFinite(sec) && sec > 0) {
    return Math.floor(sec * 1000);
  }

  return null;
}

export function getApiErrorCode(err: any): string {
  return String(
    err?.code ||
      err?.data?.code ||
      err?.response?.data?.code ||
      ""
  ).trim();
}

export function getApiRetryAfterMs(err: any): number | null {
  const n = Number(
    err?.retryAfterMs ??
      err?.data?.retryAfterMs ??
      err?.response?.data?.retryAfterMs
  );
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export function mapApiErrorMessage(err: any, fallback = "Something went wrong."): string {
  const code = getApiErrorCode(err);

  switch (code) {
    case "LINK_NOT_ALLOWED":
      return "Links are not allowed.";
    case "FUNNEL_NOT_ALLOWED":
      return "Promotional or funnel-style messages are not allowed.";
    case "CONTACT_NOT_ALLOWED":
      return "Contact details are not allowed.";
    case "POST_RATE_LIMIT":
      return "You are posting too fast.";
    case "COMMENT_RATE_LIMIT":
      return "You are commenting too fast.";
    case "DM_RATE_LIMIT":
      return "You are sending messages too fast.";
    case "INSUFFICIENT_TOKENS":
      return "Not enough tokens.";
    case "INVALID_TOKEN_CONTEXT":
      return "Invalid token action.";
    case "TIP_DAILY_CAP":
      return "Daily tip limit reached.";
    case "TIP_MONTHLY_CAP":
      return "Monthly tip limit reached.";
    case "DONATION_DAILY_CAP":
      return "Daily donation limit reached.";
    case "DONATION_MONTHLY_CAP":
      return "Monthly donation limit reached.";
    default:
      return String(err?.message || fallback);
  }
}

export function formatRetryAfterLabel(retryAfterMs: number | null | undefined): string {
  const ms = Number(retryAfterMs);
  if (!Number.isFinite(ms) || ms <= 0) return "";

  const totalSec = Math.ceil(ms / 1000);
  if (totalSec < 60) return ` Try again in ${totalSec}s.`;

  const min = Math.ceil(totalSec / 60);
  return ` Try again in ${min}m.`;
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();

  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });

  let payload: any = null;
  try {
    payload = await res.json();
  } catch {
    try {
      payload = await res.text();
    } catch {
      payload = null;
    }
  }

  if (!res.ok) {
    try {
      const code =
        payload && typeof payload === "object" ? String(payload.code || "") : "";

      if (res.status === 403 && (code === "ACCOUNT_BANNED" || code === "ACCOUNT_SUSPENDED")) {
        localStorage.setItem("auth_block", code);

        if (code === "ACCOUNT_SUSPENDED") {
          if (payload.suspendedUntil) localStorage.setItem("auth_block_until", String(payload.suspendedUntil));
          if (payload.suspendReason) localStorage.setItem("auth_block_reason", String(payload.suspendReason));
        } else {
          localStorage.removeItem("auth_block_until");
          localStorage.removeItem("auth_block_reason");
        }
      }
    } catch {}

    const serverMsg =
      (payload && typeof payload === "object"
        ? payload.message || payload.error || payload.statusMessage
        : null) || null;

    const err: ApiClientError = new Error(serverMsg || `HTTP_${res.status}`);
    err.status = res.status;
    err.data = payload;
    err.code = String(payload?.code || "");
    err.retryAfterMs = extractRetryAfterMs(payload, res);

    try {
      const code = payload?.code ? String(payload.code) : "";
      const isHardBlocked =
        res.status === 403 &&
        (code === "ACCOUNT_SUSPENDED" ||
          code === "ACCOUNT_BANNED" ||
          code === "ACCOUNT_DELETED");

      if (isHardBlocked) {
        localStorage.removeItem("token");

        const qs = new URLSearchParams();
        if (code === "ACCOUNT_SUSPENDED") {
          qs.set("mode", "suspended");
          if (payload?.suspendedUntil) qs.set("until", String(payload.suspendedUntil));
          if (payload?.suspendReason) qs.set("reason", String(payload.suspendReason));
        } else if (code === "ACCOUNT_BANNED") {
          qs.set("mode", "banned");
        } else if (code === "ACCOUNT_DELETED") {
          qs.set("mode", "deleted");
        } else {
          qs.set("mode", "blocked");
          qs.set("code", code);
        }

        const p = window.location.pathname || "";
        if (!p.startsWith("/auth")) {
          window.location.href = `/blocked?${qs.toString()}`;
        }
      }
    } catch {}

    throw err;
  }

  const json = payload;

  try {
    if (path.startsWith("/auth/me") || path.startsWith("/profile/me")) {
      localStorage.removeItem("auth_block");
      localStorage.removeItem("auth_block_until");
      localStorage.removeItem("auth_block_reason");
    }
  } catch {}

  if (json && typeof json === "object" && "status" in json) {
    const st = String(json.status);

    if (st === "error") {
      throw new Error(json.message || "API_ERROR");
    }

    if ("data" in json) return json.data as T;
    if ("profile" in json) return json.profile as T;
    if ("token" in json) return json as T;

    return json as T;
  }

  return json as T;
}

async function requestForm<T>(path: string, form: FormData, opts: RequestInit = {}): Promise<T> {
  const token = getToken();

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    ...opts,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
      // IMPORTANT: niente Content-Type manuale per FormData
    },
    body: form,
  });

  let payload: any = null;
  try {
    payload = await res.json();
  } catch {
    try {
      payload = await res.text();
    } catch {
      payload = null;
    }
  }

  if (!res.ok) {
    const serverMsg =
      (payload && typeof payload === "object" ? (payload.message || payload.error || payload.statusMessage) : null) ||
      null;

    const err: ApiClientError = new Error(serverMsg || `HTTP_${res.status}`);
    err.status = res.status;
    err.data = payload;
    err.code = String(payload?.code || "");
    err.retryAfterMs = extractRetryAfterMs(payload, res);
    throw err;
  }

  const json = payload;

  if (json && typeof json === "object" && "status" in json) {
    const st = String(json.status);
    if (st === "error") throw new Error(json.message || "API_ERROR");
    if ("data" in json) return json.data as T;
    return json as T;
  }

  return json as T;
}

export type AdvItem = {
  _id: string;
  creatorId: string;
  title: string;
  text?: string;
  mediaUrl?: string;
  targetUrl: string;
  placement: "feed" | "pre_event" | "profile";
  billingType?: "free" | "paid";
  paidTokens?: number;
  impressions?: number;
  clicks?: number;
  targetType?: "event" | "liveRoom" | "url";
  targetId?: string | null;
};

// ---- tipi minimi ----
export type MeProfile = {
  _id: string;

  displayName?: string;
  username?: string;

  emailVerifiedAt?: string | null;

  avatar?: string;
  coverImage?: string;

  bio?: string;
  area?: string;
  language?: string;

  profileType?: string;

  isVip?: boolean;
  isVerified?: boolean;
  verifiedUser?: boolean;
  verificationStatus?: string;
  verificationPublicVideoUrl?: string;
  isCreator?: boolean;
  isCreatorMonetizable?: boolean;
  isPrivate?: boolean;
  accountType?: "base" | "creator" | "admin" | string;

  creatorVerificationStatus?: "pending" | "approved" | "rejected" | string;
  creatorEnabled?: boolean;

  payoutEnabled?: boolean;
  payoutStatus?: "unverified" | "pending" | "verified" | string;

  interestsVip?: string[];

  interests?: string[];
  languages?: string[];
  profileVerificationStatus?: string; // opzionale se il backend lo espone in /profile/me

  followerCount?: number;
  followingCount?: number;

  hasSeenTokenInfo?: boolean;

  tokenInfoAcceptedAt?: string | null;
  tokenInfoAcceptedVersion?: number | null;

    // --- moderation (admin) ---
  isSuspended?: boolean;
  suspendedUntil?: string | null;
  suspendReason?: string | null;
}

// Profilo pubblico (profilo altrui)
export type PublicProfile = {
  _id: string;

  displayName?: string;
  username?: string;

  avatar?: string;
  avatarUrl?: string;
  coverImage?: string;

  bio?: string;
  area?: string;
  language?: string;

  profileType?: string;

  isVip?: boolean;
  isVerified?: boolean;
  isCreator?: boolean;
  isCreatorMonetizable?: boolean;
  isPrivate: boolean;

  verificationStatus?: string;
  verificationPublicVideoUrl?: string;

  followerCount?: number;
  followingCount?: number;
};

export type RecentReportLiveItem = {
  eventId: string;
  title?: string;
  startAt?: string | null;
  endAt?: string | null;
  type?: "public" | "private" | string;
};

export type FollowRelationship =
  | "self"
  | "none"
  | "pending"
  | "accepted"
  | "blocked_by_me"
  | "blocked_me";

function unwrapList(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.items)) return res.items;
  if (res && Array.isArray(res.posts)) return res.posts;
  if (res && Array.isArray(res.feed)) return res.feed;
  if (res && Array.isArray(res.oldLive)) return res.oldLive;

  if (res && res.data) {
    if (Array.isArray(res.data.items)) return res.data.items;
    if (Array.isArray(res.data.posts)) return res.data.posts;
    if (Array.isArray(res.data.feed)) return res.data.feed;
    if (Array.isArray(res.data.oldLive)) return res.data.oldLive;
  }

  return [];
}

export type SearchType = "posts" | "users" | "events";

export type SocialSearchResponse = {
  page: number;
  limit: number;
  type: SearchType;
  users: any[];
  posts: any[];
  events: any[];
};

export type LiveSearchResponse = {
  page: number;
  limit: number;
  total: number;
  items: any[];
};

// --- NOTIFICATIONS ---
export type NotificationTargetType = "user" | "post" | "event" | "ticket" | "token_tx" | "adv" | "showcase" | "report" | "system";

export type NotificationActor = {
  _id: string;
  username?: string;
  displayName?: string;
  avatar?: string;
};

export type NotificationType =
  | "SOCIAL_FOLLOW_REQUEST"
  | "SOCIAL_FOLLOW_ACCEPTED"
  | "SOCIAL_FOLLOW_REJECTED"
  | "SOCIAL_NEW_FOLLOWER"
  | "SOCIAL_POST_LIKED"
  | "SOCIAL_POST_COMMENTED"
  | "EVENT_WENT_LIVE"
  | "EVENT_CANCELLED"
  | "EVENT_FINISHED"
  | "EVENT_PRIVATE_STARTED"
  | "TOKEN_RECEIVED"
  | "TICKET_PURCHASED"
  | "TICKET_REFUNDED"
  | "SYSTEM_PROFILE_VERIFICATION_APPROVED"
  | "SYSTEM_PROFILE_VERIFICATION_REJECTED"
  | "SYSTEM_TOTEM_VERIFICATION_APPROVED"
  | "SYSTEM_TOTEM_VERIFICATION_REJECTED"
  | "SYSTEM_VIP_CHANGED"
  | "ADV_APPROVED"
  | "ADV_REJECTED"
  | "VETRINA_APPROVED"
  | "VETRINA_REJECTED"
  | "ADMIN_ADV_PENDING"
  | "ADMIN_VETRINA_PENDING"
  | "ADMIN_REPORT_PENDING"
  | "ADMIN_PROFILE_VERIFICATION_PENDING"
  | "ADMIN_TOTEM_VERIFICATION_PENDING"
  | string;


export type NotificationItem = {
  _id: string;
  userId: string;
  actorId?: string | NotificationActor | null;
  type: NotificationType;
  targetType: NotificationTargetType;
  targetId?: string | null;
  message: string;
  data?: any;
  isRead: boolean;
  readAt?: string | null;
  isPersistent?: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type ShowcaseItem = {
  _id: string;

  creatorId: string;
  creatorDisplayName?: string;
  creatorUsername?: string;
  creatorAvatarUrl?: string;

  title: string;
  text?: string;

  mediaUrl: string;

  status?: "pending" | "approved" | "rejected" | string;
  adminNote?: string | null;

  billingType?: "free" | "paid";
  paidTokens?: number;
  durationDays?: number;

  clicks?: number;
  impressions?: number;

  createdAt?: string;
  updatedAt?: string;
};

export type ShowcaseAllResponse = {
  items: ShowcaseItem[];
  page?: number;
  pages?: number;
  total?: number;
};

export const api = {
  login: (email: string, password: string) =>
  request<{
    token: string;
    user: {
      id: string;
      email: string;
      displayName?: string;
      profileType?: string;
      accountType?: string;
      isVip?: boolean;
      isCreator?: boolean;
    };
  }>(`/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  }),

  serverTime: () =>
    request<{ serverNow: string }>(`/time`, {
      method: "GET",
    }),

  logoutAll: () =>
  request<any>(`/auth/logout-all`, {
    method: "POST",
  }),

  deleteAccount: () =>
    request<any>(`/auth/account`, {
      method: "DELETE",
    }),

  getPostComments: (postId: string, page = 1, limit = 20) =>
    request<any>(`/posts/${postId}/comments?page=${page}&limit=${limit}`, {
      method: "GET",
    }),

  addPostComment: (postId: string, payload: { text: string; parentCommentId?: string | null }) =>
    request<any>(`/posts/${postId}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
    
  tokenDonate: (toUserId: string, amountTokens: number) =>
    request<any>(`/tokens/transfer`, {
      method: "POST",
      body: JSON.stringify({ toUserId, amountTokens, context: "donation" }),
    }),

  setHasSeenTokenInfo: () =>
    request<any>(`/profile/update`, {
      method: "PUT",
      body: JSON.stringify({ hasSeenTokenInfo: true }),
    }),

  deletePost: (postId: string) =>
    request<any>(`/posts/${postId}`, { method: "DELETE" }),

  getPostById: (postId: string) =>
    request<any>(`/posts/${postId}`, { method: "GET" }),

  deletePostComment: (postId: string, commentId: string) =>
    request<any>(`/posts/${postId}/comments/${commentId}`, {
      method: "DELETE",
    }),

  register: (payload: {
    email: string;
    password: string;
    displayName: string;
    dateOfBirth: string;
    adultConsent: boolean;
    termsAccepted: boolean;
    receiveEmailUpdates?: boolean;
    profileType: string;
    area: string;
    bio?: string;
    language?: string;
  }) =>
    request<{
      message?: string;
      user: {
        id: string;
        email: string;
        displayName: string;
        accountType: string;
        emailVerifiedAt: null;
      };
    }>(`/auth/register`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

    forgotPassword: (email: string) =>
    request<any>(`/auth/forgot-password`, {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  vipStatus: () =>
    request<{
      isVipActive: boolean;
      vipExpiresAt: string | null;
      vipAutoRenew: boolean;
      priceTokens: number;
      days: number;
    }>(`/vip/status`, { method: "GET" }),

  vipBuy: () =>
    request<any>(`/vip/buy`, { method: "POST" }),

  vipCancel: () =>
    request<any>(`/vip/cancel`, { method: "POST" }),
    
  verificationProfileStatus: () =>
    request<any>(`/verification/profile/status`),

  // se già esiste lato backend (dalle tue rotte sì)
  verificationTotemStatus: () =>
    request<any>(`/verification/totem/status`),

  verificationProfileSubmit: (publicVideoUrl: string) =>
    request<any>(`/verification/profile`, {
      method: "POST",
      body: JSON.stringify({ publicVideoUrl }),
    }),

  uploadVerificationVideo: async (file: File): Promise<string> => {
    if (!file) throw new Error("Missing file");

    const form = new FormData();
    form.append("file", file);
    form.append("scope", "verification");

    const res: any = await requestForm(`/media/upload`, form);

    const url = String(
      res?.data?.url ||
      res?.url ||
      res?.data?.data?.url ||
      ""
    ).trim();

    if (!url) throw new Error("Upload failed: missing url");
    return url;
  },

  payoutEligibility: () =>
    request<any>(`/payout/me/eligibility`),

  // -------------------------
  // CREATOR (Stripe-first)
  // -------------------------
  creatorRequest: (payload: { over18: boolean; acceptTerms: boolean; note?: string | null }) =>
    request<any>(`/verification/creator/request`, {
      method: "POST",
      body: JSON.stringify({
        over18: Boolean(payload?.over18),
        acceptTerms: Boolean(payload?.acceptTerms),
        note: payload?.note ? String(payload.note).trim() : null,
      }),
    }),

  stripeCreateAccountLink: () =>
    request<{ url: string }>(`/stripe/connect/create-account-link`, {
      method: "POST",
    }),

  resetPassword: (token: string, newPassword: string) =>
    request<any>(`/auth/reset-password`, {
      method: "POST",
      body: JSON.stringify({ token, newPassword }),
    }),

  createEvent: (payload: any) =>
    request<any>(`/events`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // --- ADV ---
  advServe: async (opts?: { placement?: "feed" | "pre_event" | "profile"; limit?: number }) => {
    const placement = opts?.placement || "feed";
    const limit = Math.max(1, Math.min(20, Number(opts?.limit || 10)));
    const res = await request<any>(`/adv/serve?placement=${placement}&limit=${limit}`, { method: "GET" });
    const data = res?.data ?? res;
    return Array.isArray(data) ? data : [];
  },

  advServeFour: async (opts?: { placement?: "feed" | "pre_event" | "profile"; limit?: number }) => {
    const placement = opts?.placement || "feed";
    const limit = Math.max(1, Math.min(4, Number(opts?.limit || 4))); // DX: max 4
    const res = await request<any>(`/adv/serve-four?placement=${placement}&limit=${limit}`, { method: "GET" });
    const data = res?.data ?? res;
    return Array.isArray(data) ? data : [];
  },

  advClick: (advId: string) =>
    request<any>(`/adv/${advId}/click`, {
      method: "POST",
    }),

  advCreateCampaign: (payload: any) => {
    return request<any>(`/adv/campaign`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

    // --- SHOWCASE (Vetrina) ---
  showcaseServe: async () => {
    // returns 1 item (FAIR) or null
    const res = await request<any>(`/showcase/serve`, { method: "GET" });
    const data = res?.data ?? res;
    return data || null;
  },

  showcaseAll: async (page = 1, limit = 20) => {
    const p = Math.max(1, Number(page || 1));
    const l = Math.max(1, Math.min(50, Number(limit || 20)));
    const res = await request<any>(`/showcase/all?page=${p}&limit=${l}`, { method: "GET" });
    const data = res?.data ?? res;

    // normalize {items,page,pages,total} or array
    if (Array.isArray(data)) {
      return { items: data, page: p, pages: 1, total: data.length } as ShowcaseAllResponse;
    }
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      page: Number(data?.page ?? p),
      pages: Number(data?.pages ?? 1),
      total: Number(data?.total ?? (Array.isArray(data?.items) ? data.items.length : 0)),
    } as ShowcaseAllResponse;
  },

  showcaseRequest: async (payload: {
    title: string;
    text?: string;
    mediaUrl: string;
    confirmPaid?: boolean;
  }) => {
    // 409 VETRINA_PAYMENT_REQUIRED handled in UI (we just throw err with status/data)
    const body = {
      title: String(payload?.title || "").trim(),
      text: String(payload?.text || "").trim(),
      mediaUrl: String(payload?.mediaUrl || "").trim(),
      confirmPaid: Boolean(payload?.confirmPaid),
    };

    return request<any>(`/showcase/item`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  showcaseClick: async (id: string) => {
    const sid = String(id || "").trim();
    if (!sid) throw new Error("Missing showcase id");

    // BE: +clicks, returns creatorId (or {creatorId})
    const res = await request<any>(`/showcase/${sid}/click`, { method: "POST" });
    const data = res?.data ?? res;
    const creatorId = String(data?.creatorId ?? data?.data?.creatorId ?? data ?? "").trim();
    return creatorId;
  },

  // minimal upload helper (no existing UI to reuse)
  uploadShowcaseImage: async (file: File): Promise<string> => {
    if (!file) throw new Error("Missing file");

    const form = new FormData();
    form.append("file", file);

    // ✅ keep a known-working scope (you already used "post" successfully)
    form.append("scope", "showcase");

    const res: any = await requestForm(`/media/upload`, form);

    const url =
      String(
        res?.data?.url ||
          res?.url ||
          res?.data?.data?.url ||
          res?.data?.data?.data?.url ||
          ""
      ).trim();

    if (!url) throw new Error("Upload failed: missing url");
    return url;
  },
  
  // -------------------------
  // LIVE / EVENTS (Blocco 3 split)
  // -------------------------

  eventGet: (eventId: string) =>
    request<any>(`/events/${eventId}`, { method: "GET" }),

  eventAccess: (eventId: string, scope: "public" | "private" = "public") =>
    request<any>(
      `/events/${eventId}/access?scope=${encodeURIComponent(scope)}`,
      { method: "GET" }
    ),

  eventJoin: (eventId: string, scope: LiveScope = "public") =>
    request<any>(`/events/${eventId}/join?scope=${scope}`, { method: "POST" }),

  eventBuyTicket: (eventId: string, scope: "public" | "private" = "public") => {
    const idem = `ticket_${eventId}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    return request<any>(`/events/${eventId}/ticket`, {
      method: "POST",
      headers: {
        "Idempotency-Key": idem,
        "x-idempotency-key": idem,
      },
      body: JSON.stringify({ scope }),
    });
  },

  liveGetToken: (eventId: string, scope: LiveScope = "public") =>
    request<LiveTokenResponse>(`/live/token`, {
      method: "POST",
      body: JSON.stringify({ eventId, scope }),
    }),

  liveStartBroadcast: (eventId: string, scope: LiveScope = "public") =>
    request<any>(`/live/${eventId}/start-broadcast`, {
      method: "POST",
      body: JSON.stringify({ scope }),
    }),

  liveHostRealtimeState: (
    eventId: string,
    payload: { scope: LiveScope; state: HostRealtimeState }
  ) =>
    request<any>(`/live/${eventId}/host-realtime-state`, {
      method: "POST",
      body: JSON.stringify({
        scope: payload.scope,
        state: payload.state,
      }),
    }),

  eventGetTicket: (eventId: string) =>
    request<TicketGetResponse>(`/events/${eventId}/ticket`, { method: "GET" }),

  // -------------------------
  // PRIVATE (Strategy 3)
  // -------------------------
  eventPrivateSchedule: (eventId: string, payload: PrivateSchedulePayload) =>
    request<any>(`/events/${eventId}/private/schedule`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  eventPrivateBuy: (eventId: string) => {
    const idem = `privbuy_${eventId}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    return request<PrivateBuyResponse>(`/events/${eventId}/private/buy`, {
      method: "POST",
      headers: {
        "Idempotency-Key": idem,
        "x-idempotency-key": idem,
      },
    });
  },

  eventPrivateAccept: (eventId: string) =>
    request<any>(`/events/${eventId}/private/accept`, { method: "POST" }),

  eventPrivateFinish: (eventId: string) =>
    request<any>(`/events/${eventId}/private/finish`, { method: "POST" }),

  livePing: (eventId: string, scope: LiveScope = "public") =>
    request<any>(`/live/${eventId}/ping?scope=${scope}`, { method: "POST" }),

  liveHostPing: (eventId: string, scope: LiveScope = "public") =>
    request<any>(`/live/${eventId}/host-ping`, {
      method: "POST",
      body: JSON.stringify({ scope }),
    }),

  liveStatus: (eventId: string, scope: LiveScope = "public") =>
    request<any>(`/live/${eventId}/status?scope=${scope}`, { method: "GET" }),

  liveStartMedia: (
    eventId: string,
    payload?: {
      scope?: LiveScope;
      playbackUrl?: string | null;
      streamKey?: string | null;
    }
  ) =>
    request<LiveMediaStatusResponse>(`/live/${eventId}/start-media`, {
      method: "POST",
      body: JSON.stringify({
        scope: payload?.scope === "private" ? "private" : "public",
        playbackUrl: payload?.playbackUrl || null,
        streamKey: payload?.streamKey || null,
      }),
    }),

  liveStopMedia: (eventId: string, scope: LiveScope = "public") =>
    request<LiveMediaStatusResponse>(`/live/${eventId}/stop-media`, {
      method: "POST",
      body: JSON.stringify({ scope }),
    }),

  eventGoLive: (eventId: string) =>
    request<any>(`/events/${eventId}/go-live`, { method: "POST" }),

  eventFinish: (eventId: string) =>
    request<any>(`/events/${eventId}/finish`, { method: "POST" }),

  eventCancel: (eventId: string) =>
    request<any>(`/events/${eventId}/cancel`, { method: "POST" }),

  liveJoinRoom: (eventId: string, scope: LiveScope = "public") =>
    request<any>(`/live/${eventId}/join-room?scope=${scope}`, { method: "POST" }),

  liveLeaveRoom: (eventId: string, scope: LiveScope = "public") =>
    request<any>(`/live/${eventId}/leave-room?scope=${scope}`, { method: "POST" }),

  liveGetMessages: (eventId: string, scope: LiveScope = "public", limit = 80) => {
    const lim = Math.max(1, Math.min(200, Number(limit || 80)));
    return request<any>(`/live/${eventId}/messages?scope=${scope}&limit=${lim}`, { method: "GET" });
  },

  livePostMessage: (eventId: string, payload: { scope: LiveScope; text: string }) => {
    const scope = payload?.scope === "private" ? "private" : "public";
    const text = String(payload?.text || "").trim();

    if (!text) throw new Error("Empty message");
    if (text.length > 400) throw new Error("Message too long");

    return request<{ item: LiveMessageItem }>(`/live/${eventId}/messages`, {
      method: "POST",
      body: JSON.stringify({ scope, text }),
    });
  },
  
  tipSend: (payload: { toUserId: string; amountTokens: number; eventId?: string }) => {
    
    const toUserId = String(payload?.toUserId || "").trim();
    const amt = Number(payload?.amountTokens);

    if (!toUserId) throw new Error("Missing toUserId");
    if (!Number.isFinite(amt) || !Number.isInteger(amt) || amt <= 0) throw new Error("Invalid tip amount");

    const idem = `tip_${payload?.eventId || "na"}_${toUserId}_${amt}_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    return request<any>(`/tokens/transfer`, {
      method: "POST",
      headers: {
        "Idempotency-Key": idem,
        "x-idempotency-key": idem,
      },
      body: JSON.stringify({ toUserId, amountTokens: amt, context: "tip", eventId: payload?.eventId }),
    });
  },

  submitReport: (payload: {
    targetType: "user" | "post" | "event" | "comment" | "live_message";
    targetId: string;
    reasonCode: string;
    note?: string | null;
    contextType?: "live" | null;
    contextId?: string | null;
  }) =>
    request<{ status: "ok" | "error"; message?: string }>(`/report`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  goalCreate: (eventId: string, payload: { title: string; description?: string; targetTokens: number }) => {
    const id = String(eventId || "").trim();
    if (!id) throw new Error("Missing eventId");

    const title = String(payload?.title || "").trim();
    const description = String(payload?.description || "").trim();
    const targetTokens = Math.max(0, Math.floor(Number(payload?.targetTokens ?? 0)));

    if (!title) throw new Error("Missing goal title");
    if (!Number.isFinite(targetTokens) || targetTokens <= 0) throw new Error("Invalid targetTokens");

    const idem = `goal_create_${id}_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    return request<any>(`/events/${id}/goal/create`, {
      method: "POST",
      headers: {
        "Idempotency-Key": idem,
        "x-idempotency-key": idem,
      },
      body: JSON.stringify({ title, description, targetTokens }),
    });
  },

  goalStop: (eventId: string) => {
    const id = String(eventId || "").trim();
    if (!id) throw new Error("Missing eventId");

    const idem = `goal_stop_${id}_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    return request<any>(`/events/${id}/goal/stop`, {
      method: "POST",
      headers: {
        "Idempotency-Key": idem,
        "x-idempotency-key": idem,
      },
    });
  },

  goalReset: (eventId: string) => {
    const id = String(eventId || "").trim();
    if (!id) throw new Error("Missing eventId");

    const idem = `goal_reset_${id}_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    return request<any>(`/events/${id}/goal/reset`, {
      method: "POST",
      headers: {
        "Idempotency-Key": idem,
        "x-idempotency-key": idem,
      },
    });
  },

  // --- DX FED (Suggested posts) ---
  fed: async () => {
    const res = await request<any>(`/posts/feed/fed`, { method: "GET" });
    return unwrapList(res);
  },

  verifyEmailConfirm: (token: string) =>
    request<any>(`/auth/verify-email/confirm`, {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  verifyEmailRequest: () =>
    request<any>(`/auth/verify-email/request`, {
      method: "POST",
    }),

  verifyEmailResend: (email: string) =>
    request<any>(`/auth/verify-email/resend`, {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  profileUpdate: (payload: any) =>
  request<any>(`/profile/update`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }),

  meProfile: async () => {
    const res = await request<any>(`/profile/me`);
    const me = res?.profile || res?.data?.profile || res?.data || res;

    const out: MeProfile = {
      _id: me?._id,

      displayName: me?.displayName,
      username: me?.username,

      emailVerifiedAt: me?.emailVerifiedAt,

      avatar: me?.avatar,
      coverImage: me?.coverImage,

      bio: me?.bio,
      area: me?.area,
      language: me?.language,
      profileType: me?.profileType,

      isVip: Boolean(me?.isVip),
      isVerified: Boolean(me?.isVerified || me?.verifiedUser),
      verifiedUser: Boolean(me?.verifiedUser),
      verificationStatus: me?.verificationStatus ?? null,
      verificationPublicVideoUrl: me?.verificationPublicVideoUrl ?? "",
      isCreator: Boolean(me?.isCreator),
      isCreatorMonetizable: Boolean(me?.isCreatorMonetizable),
      isPrivate: Boolean(me?.isPrivate),
      accountType: me?.accountType ?? "base",

      interestsVip: me?.interestsVip ?? [],
      interests: me?.interests ?? [],
      languages: me?.languages ?? [],
      hasSeenTokenInfo: Boolean(me?.hasSeenTokenInfo),

      followerCount:
        me?.followerCount ??
        me?.followersCount ??
        me?.followers ??
        me?.countFollowers ??
        0,

      followingCount:
        me?.followingCount ??
        me?.followingsCount ??
        me?.following ??
        me?.countFollowing ??
        0,

      isSuspended: Boolean(me?.isSuspended),
      suspendedUntil: me?.suspendedUntil ?? null,
      suspendReason: me?.suspendReason ?? null,

      creatorVerificationStatus:
        me?.creatorVerification?.status ??
        me?.creatorVerificationStatus ??
        null,

      creatorEnabled: Boolean(me?.creatorEnabled),

      payoutEnabled: Boolean(me?.payoutEnabled),
      payoutStatus: me?.payoutStatus ?? null,

      tokenInfoAcceptedAt: me?.tokenInfoAcceptedAt ?? null,
      tokenInfoAcceptedVersion: me?.tokenInfoAcceptedVersion ?? null,
    };

    return out;
  },

    // --- TOKEN INFO FLAG (for UI) ---
  meStatus: async (): Promise<{ hasSeenTokenInfo: boolean }> => {
    const res = await request<any>(`/profile/status/me`);
    const v = !!(res?.data?.hasSeenTokenInfo ?? res?.hasSeenTokenInfo);
    return { hasSeenTokenInfo: v };
  },

  markTokenInfoSeen: async (): Promise<any> => {
    return request<any>(`/profile/update`, {
      method: "PUT",
      body: JSON.stringify({ hasSeenTokenInfo: true }),
    });
  },

  tokenInfoAccept: async (): Promise<{ tokenInfoAcceptedAt: string | null; tokenInfoAcceptedVersion: number | null }> => {
    const res = await request<any>(`/profile/token-info-accept`, {
      method: "POST",
    });

    const data = res?.data ?? res;

    return {
      tokenInfoAcceptedAt: data?.tokenInfoAcceptedAt ?? null,
      tokenInfoAcceptedVersion: data?.tokenInfoAcceptedVersion ?? null,
    };
  },

  socialSearch: (params: {
    q: string;
    type: SearchType;
    page?: number;
    limit?: number;
    profileType?: string | null;
    country?: string | null;
    language?: string | null;
  }) => {
    const q = String(params?.q || "").trim();
    const type = params?.type || "posts";
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 10;

    const sp = new URLSearchParams();
    sp.set("q", q);
    sp.set("type", type);
    sp.set("page", String(page));
    sp.set("limit", String(limit));

    if (params?.profileType) sp.set("profileType", String(params.profileType));
    if (params?.country) sp.set("country", String(params.country));
    if (params?.language) sp.set("language", String(params.language));

    return request<SocialSearchResponse>(`/search?${sp.toString()}`, { method: "GET" });
  },

  liveSearch: (params: {
    q: string;
    status?: "live" | "scheduled" | "all";
    page?: number;
    limit?: number;
    profileType?: string | null;
    country?: string | null;
    language?: string | null;
    contentScope?: "HOT" | "NO_HOT" | null;
  }) => {
    const q = String(params?.q || "").trim();
    const status = params?.status ?? "all";
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;

    const sp = new URLSearchParams();
    sp.set("q", q);
    sp.set("status", status);
    sp.set("page", String(page));
    sp.set("limit", String(limit));

    if (params?.profileType) sp.set("profileType", String(params.profileType));
    if (params?.country) sp.set("country", String(params.country));
    if (params?.language) sp.set("language", String(params.language));
    if (params?.contentScope) sp.set("contentScope", String(params.contentScope));

    return request<LiveSearchResponse>(`/live-search/search?${sp.toString()}`, { method: "GET" });
  },

  // --- DONATE (token transfer with donation context) ---
  donateTokens: async (toUserId: string, amountTokens: number): Promise<any> => {
    const amt = Number(amountTokens);
    if (!Number.isFinite(amt) || !Number.isInteger(amt) || amt <= 0) {
      throw new Error("Invalid amountTokens");
    }

    const idempotencyKey = `don_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    return request<any>(`/tokens/transfer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({ toUserId, amountTokens: amt, context: "donation" }),
    });
  },

  // --- BLOCK ---
  blockedList: () =>
    request<any>(`/block/me`, { method: "GET" }).then((res: any) => {
      // backend tipico: {status, data:[...]}
      const arr = res?.data ?? res;
      return Array.isArray(arr) ? arr : [];
    }),

  unblockUser: (userId: string) =>
    request<any>(`/block/${userId}`, {
      method: "DELETE",
    }),

    // --- MUTE ---
  muteUser: (userId: string) =>
    request<any>(`/mute/${userId}`, {
      method: "POST",
    }),

  unmuteUser: (userId: string) =>
    request<any>(`/mute/${userId}`, {
      method: "DELETE",
    }),

  mutedList: () => request<string[]>(`/mute`),

  // --- PROFILO ALTRUI ---
  publicProfile: async (userId: string) => {
    const res = await request<any>(`/profile/public/${userId}`);

    // request() già tenta json.profile/json.data, qui normalizziamo eventuali chiavi "profile"
    const prof = res?.profile || res?.data?.profile || res?.data || res;

    // Normalizzazione minima: alcuni backend usano avatarUrl al posto di avatar
    const out: PublicProfile = {
      _id: prof?._id || userId,
      displayName: prof?.displayName,
      username: prof?.username,
      avatar: prof?.avatar,
      avatarUrl: prof?.avatarUrl,
      coverImage: prof?.coverImage,
      bio: prof?.bio,
      area: prof?.area,
      language: prof?.language,
      profileType: prof?.profileType,
      isVip: prof?.isVip,
      isVerified: Boolean(prof?.verifiedUser || prof?.isVerified),
      verificationStatus: prof?.verificationStatus,
      verificationPublicVideoUrl: prof?.verificationPublicVideoUrl,
      isCreator: prof?.isCreator,
      isPrivate: Boolean(prof?.isPrivate),
      followerCount: prof?.followerCount,
      followingCount: prof?.followingCount,
    };

    return out;
  },

  followRelationship: async (userId: string) => {
    const res = await request<any>(`/follow/relationship/${userId}`);

    // casi possibili:
    // 2) res.data.followStatus = "accepted" (il tuo caso reale)
    const raw =
      typeof res === "string"
        ? res
        : res?.data?.followStatus ||
          res?.followStatus ||
          res?.status ||
          res?.relationship ||
          res?.data?.status ||
          res?.data?.relationship ||
          "none";

    const s = String(raw);

    // mapping canonico
    const mapped: FollowRelationship =
      s === "self" ? "self" :
      s === "accepted" ? "accepted" :
      s === "pending" ? "pending" :
      s === "none" ? "none" :
      s === "blocked_by_me" || s === "blockedByMe" ? "blocked_by_me" :
      s === "blocked_me" || s === "blockedMe" ? "blocked_me" :
      "none";

    return { status: mapped };
      },

  followUser: (userId: string) =>
    request<any>(`/follow/${userId}`, {
      method: "POST",
    }),

  unfollowUser: (userId: string) =>
    request<any>(`/follow/${userId}`, {
      method: "DELETE",
    }),

  cancelFollowRequest: (userId: string) =>
    request<any>(`/follow/request/${userId}/cancel`, {
      method: "DELETE",
    }),

  blockUser: (userId: string) =>
    request<any>(`/block/${userId}`, {
      method: "POST",
    }),

  uploadPostMedia: async (files: File[]): Promise<Array<{ type: "image" | "video"; url: string }>> => {
    const arr = Array.isArray(files) ? files.slice(0, 3) : [];
    if (!arr.length) return [];

    const out: Array<{ type: "image" | "video"; url: string }> = [];

    for (const f of arr) {
      const form = new FormData();
      form.append("file", f);
      // official media upload for post files
      form.append("scope", "post");

      const res: any = await requestForm(`/media/upload`, form);
      const url =
        String(
          res?.data?.url ||          // backend shape: { status, data:{url} }
          res?.url ||                // eventuale shape alternativa
          res?.data?.data?.url ||    // se requestForm wrappa ancora
          res?.data?.data?.data?.url // ultimo fallback
        ).trim();

      if (!url) throw new Error("Upload failed: missing url");

      const mime = String((f as any)?.type || "").toLowerCase();
      const isVideo = mime.startsWith("video/");
      out.push({ type: isVideo ? "video" : "image", url });
    }

    return out;
  },

  reportRecentLives: async (userId: string, limit = 5) => {
    const uid = String(userId || "").trim();
    const lim = Math.max(1, Math.min(10, Number(limit || 5)));

    const res = await request<any>(
      `/report/recent-lives/${encodeURIComponent(uid)}?limit=${lim}`,
      { method: "GET" }
    );

    return Array.isArray(res?.items) ? res.items : [];
  },

  reportPost: (payload: { targetPostId: string; reasonCode: string; note?: string }) => {
    const targetPostId = String(payload?.targetPostId || "").trim();
    const reasonCode = String(payload?.reasonCode || "").trim();
    const note = String(payload?.note || "").trim();

    const body = {
      targetId: targetPostId,
      targetType: "post",
      reasonCode,
      note: note || "",
    };

    return request<any>(`/report`, { method: "POST", body: JSON.stringify(body) });
  },

  reportComment: (payload: { targetCommentId: string; reasonCode: string; note?: string }) => {
    const targetCommentId = String(payload?.targetCommentId || "").trim();
    const reasonCode = String(payload?.reasonCode || "").trim();
    const note = String(payload?.note || "").trim();

    const body = {
      targetId: targetCommentId,
      targetType: "comment",
      reasonCode,
      note: note || "",
    };

    return request<any>(`/report`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  reportUser: (payload: {
    targetUserId: string;
    reasonCode: string;
    note?: string;
    contextType?: "live" | null;
    contextId?: string | null;
  }) => {
    const targetUserId = String(payload?.targetUserId || "").trim();
    const reasonCode = String(payload?.reasonCode || "").trim();
    const note = String(payload?.note || "").trim();
    const contextType = payload?.contextType === "live" ? "live" : null;
    const contextId = String(payload?.contextId || "").trim();

    const body: any = {
      targetId: targetUserId,
      targetType: "user",
      reasonCode,
      note: note || "",
    };

    if (contextType && contextId) {
      body.contextType = contextType;
      body.contextId = contextId;
    }

    return request<any>(`/report`, { method: "POST", body: JSON.stringify(body) });
  },

  sendMessage: (recipientId: string, payload: { text: string }) =>
    request<any>(`/messages/${recipientId}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // --- Social Chat ---
  listConversations: () =>
    request<any>(`/messages/conversations`, {
      method: "GET",
    }),

  getConversation: (otherUserId: string) =>
    request<any>(`/messages/conversation/${otherUserId}`, {
      method: "GET",
    }),

  // compat: createPost("text") oppure createPost({ text, poll, media, ... })
  createPost: (payloadOrText: any) => {
    const body =
      typeof payloadOrText === "string"
        ? { text: payloadOrText }
        : (payloadOrText && typeof payloadOrText === "object")
          ? payloadOrText
          : {};

    return request<any>(`/posts`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  myPosts: async () => {
    const res = await request<any>(`/posts/me`);
    return unwrapList(res);
  },

  togglePostLike: (postId: string) =>
    request<any>(`/posts/${postId}/likes`, {
      method: "POST",
  }),

  votePoll: (postId: string, optionIndex: number) =>
  request(`/posts/${postId}/poll/vote`, {
    method: "POST",
    body: JSON.stringify({ optionIndex }),
  }),

  // post di un altro utente (profilo altrui)
  userPosts: async (userId: string) => {
    // tentiamo la rotta più probabile; se nel backend la rotta è diversa, la correggiamo in 2 minuti
    const res = await request<any>(`/posts/user/${userId}`);
    return unwrapList(res);
  },

  // --- OLD LIVE ---
  oldLive: async (userId: string) => {
    const res = await request<any>(`/profile/old-live/${userId}`);
    return unwrapList(res);
  },

  // --- FEED FOLLOWING (My profile) ---
  followingMixed: async () => {
    const res = await request<any>(`/posts/feed/following-mixed`);
    return unwrapList(res);
  },

  // --- EVENT BANNER ---
  profileEventBanner: async (userId: string) => {
    const res = await request<any>(`/profile/event-banner/${userId}`);

    if (!res) return null;
    if (res && res.event) return res.event;
    if (res && res.banner) return res.banner;
    if (res && res.data) return res.data;

    return res;
  },

  // --- NOTIFICATIONS ---
  getNotifications: async (opts?: { limit?: number; cursor?: string; unreadOnly?: boolean }) => {
    const limit = Math.max(1, Math.min(50, Number(opts?.limit || 20)));
    const cursor = opts?.cursor ? `&cursor=${encodeURIComponent(opts.cursor)}` : "";
    const unreadOnly = opts?.unreadOnly ? "&unreadOnly=1" : "";
    const res = await request<any>(`/notifications?limit=${limit}${cursor}${unreadOnly}`);
    return {
      count: Number(res?.count || 0),
      nextCursor: (res?.nextCursor as string | null) ?? null,
      items: Array.isArray(res?.items) ? (res.items as NotificationItem[]) : ([] as NotificationItem[]),
    };
  },

  getUnreadNotificationsCount: async () => {
    const res = await request<any>(`/notifications/unread-count`);
    return Number(res?.count || 0);
  },

  readNotification: (notificationId: string) =>
    request<any>(`/notifications/${notificationId}/read`, {
      method: "PATCH",
    }),

  readAllNotifications: () =>
    request<any>(`/notifications/read-all`, {
      method: "PATCH",
    }),

  deleteNotification: (notificationId: string) =>
    request<any>(`/notifications/${notificationId}`, {
      method: "DELETE",
    }),


  // -------- TOKENS (Phase 1A/1B) --------
  getTokensMe: async () => {
    const res = await request<any>(`/tokens/me`);
    return {
      economyEnabled: Boolean(res?.economyEnabled),
      balance: Number(res?.balance || 0),
      purchased: Number(res?.purchased || 0),
      earnings: Number(res?.earnings || 0),
      redeemable: Number(res?.redeemable || 0),
      held: Number(res?.held || 0),
    };
  },

  getTokenTransactions: async (limit = 50) => {
    const res = await request<any>(`/tokens/transactions`);
    const items = Array.isArray(res?.items) ? res.items : [];
    return {
      count: Number(res?.count || items.length || 0),
      items: items.slice(0, Math.max(1, Math.min(200, Number(limit) || 50))),
    };
  },

  getPayoutPolicy: async () => {
    return request<any>(`/payout/policy`);
  },

  getPayoutEligibility: async () => {
    return request<any>(`/payout/me/eligibility`);
  },

  getPayoutAvailable: async () => {
    return request<any>(`/payout/me/available`);
  },

  requestPayout: async (amountTokens: number) => {
    return request<any>(`/payout/request`, {
      method: "POST",
      body: JSON.stringify({ amountTokens }),
    });
  },
  acceptFollowRequest: (followerId: string) =>
    request<any>(`/follow/request/${followerId}/accept`, {
      method: "POST",
    }),

  adminSecurityLogList: (params?: { limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.limit != null) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";

    return request<{
      status: "success" | "error";
      data?: any[];
      message?: string;
    }>(`/admin/security-log${suffix}`, { method: "GET" });
  },

  adminDeletedUsersList: () =>
  request<{ status: "ok"; users: any[] }>(`/admin/deleted-users`, { method: "GET" }),
  
  // -------------------------
  // ADMIN — Pending Queue
  // -------------------------
  adminGetPending: (params?: { q?: string; category?: string; sort?: "priority" | "newest"; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.category) qs.set("category", params.category);
    if (params?.sort) qs.set("sort", params.sort);
    if (params?.limit) qs.set("limit", String(params.limit));

    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<any>(`/admin/pending${suffix}`, { method: "GET" });
  },

  adminAction: (path: string, method: string, body?: any) =>
    request<any>(path, {
      method,
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),

  // -------------------------
  // ADMIN — Dashboard metrics
  // -------------------------
  adminDashboardMetrics: () =>
    request<{
      vipUsersActive: number;
      tokensTotalBalance: number;
      tokensRedeemable: number;
      vipRevenueTokensCurrentMonth: number;
    }>(`/admin/dashboard/metrics`, { method: "GET" }),

  // -------------------------
  // BUG REPORTS (MVP)
  // -------------------------
  bugReportCreate: (payload: {
    category: "social" | "live" | "chat" | "tokens" | "search" | "adv" | "showcase";
    text: string;
    steps?: string;
    screenshotUrl?: string;
    route?: string;
    userAgent?: string;
  }) =>
    request<any>(`/bugreports`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  adminBugReportsList: (params?: {
    status?: "open" | "closed" | "all";
    limit?: number;
    skip?: number;
    sort?: "new" | "old";
  }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.limit != null) qs.set("limit", String(params.limit));
    if (params?.skip != null) qs.set("skip", String(params.skip));
    if (params?.sort) qs.set("sort", params.sort);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<any>(`/admin/bugreports${suffix}`, { method: "GET" });
  },

  adminBugReportPatch: (id: string, patch: { status: "open" | "closed" }) =>
    request<any>(`/admin/bugreports/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

};

// --------------------------------------------------
// ADMIN — Blocked / Suspended users
// --------------------------------------------------

export type AdminBlockedUser = {
  _id: string;
  displayName: string;
  avatar?: string | null;

  accountType?: "base" | "creator" | "admin";
  isVip?: boolean;
  isCreator?: boolean;
  isPrivate?: boolean;

  isBanned?: boolean;
  bannedAt?: string | null;
  banReason?: string | null;

  isSuspended?: boolean;
  suspendedUntil?: string | null;
  suspendReason?: string | null;

  createdAt?: string | null;
};

export const adminGetBlockedUsers = () =>
  request<{ status: "ok"; users: AdminBlockedUser[] }>(
    `/admin/users/blocked`,
    { method: "GET" }
  );

export const adminUnbanUser = (userId: string) =>
  request<{ status: "ok"; user: any }>(
    `/admin/users/${userId}/unban`,
    { method: "PATCH" }
  );

export const adminUnsuspendUser = (userId: string) =>
  request<{ status: "ok"; user: any }>(
    `/admin/users/${userId}/unsuspend`,
    { method: "PATCH" }
  );

// --------------------------------------------------
// ADMIN — New / Growth
// --------------------------------------------------

export type AdminGrowthLatestUser = {
  _id: string;
  displayName: string;
  createdAt: string;
  accountType: "base" | "creator" | "admin";
};

export type AdminGrowthSummary = {
  status: "ok";
  users: {
    total: number;
    new7d: number;
    latest: AdminGrowthLatestUser[];
  };
  activation: {
    emailVerified7d: number;
    adultConsent7d: number;
  };
  creators: {
    total: number;
    requestedPendingApproval: number;
    eligible: number;
  };
  meta: {
    since7d: string;
    now: string;
  };
};

export const adminGetGrowthSummary = () =>
  request<AdminGrowthSummary>(`/admin/growth/summary`, { method: "GET" });

// --------------------------------------------------
// ADMIN — Age-gate logs (aggregated by email)
// --------------------------------------------------

export type AdminAgeGateLog = {
  _id: string;
  email: string;

  failedUnderageAttempts: number;
  lastUnderageAttemptAt?: string | null;

  firstDobString?: string | null;
  successDobString?: string | null;

  userId?:
    | string
    | {
        _id: string;
        displayName?: string | null;
        username?: string | null;
      }
    | null;
};

export type AdminAgeGateLogsResponse = {
  logs: AdminAgeGateLog[];
  total: number;
};

export const adminGetAgeGateLogs = (params?: {
  q?: string;
  minAttempts?: number;
  sort?: "newest" | "oldest" | "mostAttempts";
  limit?: number;
}) => {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  qs.set("minAttempts", String(params?.minAttempts ?? 1));
  if (params?.sort) qs.set("sort", params.sort);
  if (params?.limit) qs.set("limit", String(params.limit));

  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request<{ logs: AdminAgeGateLog[]; total: number }>(`/admin/age-gate-logs${suffix}`, {
    method: "GET",
  });
};

// --------------------------------------------------
// ADMIN — Watchlist (Accounts + Age-gate attempts)
// --------------------------------------------------

export type AdminAgeGateAttempt = {
  _id: string;
  createdAt: string;

  userId?: string | null;
  userDisplayName?: string | null;

  ip?: string | null;
  userAgent?: string | null;

  result: "pass" | "fail" | "blocked";
  reason?: string | null;
};

export type AdminAgeGateAttemptsResponse = {
  status: "ok";
  attempts: AdminAgeGateAttempt[];
  total: number;
};

export const adminGetAgeGateAttempts = (params?: {
  q?: string;              // search on displayName / userId / ip
  result?: "pass" | "fail" | "blocked";
  sort?: "newest" | "oldest";
  limit?: number;
}) => {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.result) qs.set("result", params.result);
  if (params?.sort) qs.set("sort", params.sort);
  if (params?.limit) qs.set("limit", String(params.limit));

  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request<AdminAgeGateAttemptsResponse>(`/admin/age-gate/attempts${suffix}`, { method: "GET" });
};

// --------------------------------------------------
// ADMIN — Creator approval (Stripe-first)
// --------------------------------------------------

export type AdminCreatorPendingItem = {
  _id: string;
  email?: string;
  displayName?: string;
  creatorVerification?: {
    status?: string;
    submittedAt?: string;
    note?: string | null;
  };
};

export const adminGetCreatorPending = () =>
  request<AdminCreatorPendingItem[]>(`/admin/creator/pending`, { method: "GET" });

export const adminApproveCreator = (userId: string, adminNote?: string | null) =>
  request<any>(`/admin/creator/${userId}/approve`, {
    method: "PATCH",
    body: JSON.stringify({ ...(adminNote ? { adminNote } : {}) }),
  });

export const adminRejectCreator = (userId: string, adminNote?: string | null) =>
  request<any>(`/admin/creator/${userId}/reject`, {
    method: "PATCH",
    body: JSON.stringify({ ...(adminNote ? { adminNote } : {}) }),
  });

export type AdminCreatorActiveItem = {
  _id: string;
  email?: string;
  displayName?: string;
  isCreator?: boolean;
  accountType?: string;
  creatorEnabled?: boolean;
  creatorEligible?: boolean;
  creatorDisabledReason?: string | null;
  creatorDisabledAt?: string | null;
  payoutEnabled?: boolean;
  payoutStatus?: string | null;
  creatorVerification?: {
    status?: string;
    submittedAt?: string;
    verifiedAt?: string;
    note?: string | null;
  };
};

export const adminGetCreatorActive = (params?: { disabled?: boolean }) => {
  const qs = new URLSearchParams();
  if (params?.disabled) qs.set("disabled", "true");
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request<AdminCreatorActiveItem[]>(`/admin/creator/active${suffix}`, { method: "GET" });
};

export const adminDisableCreator = (userId: string, adminNote?: string | null) =>
  request<any>(`/admin/creator/${userId}/disable`, {
    method: "PATCH",
    body: JSON.stringify({ ...(adminNote ? { adminNote } : {}) }),
  });

export const adminReenableCreator = (userId: string, adminNote?: string | null) =>
  request<any>(`/admin/creator/${userId}/reenable`, {
    method: "PATCH",
    body: JSON.stringify({ ...(adminNote ? { adminNote } : {}) }),
  });

export const adminGetTrustUser = (userId: string) =>
  request<any>(`/admin/trust/user/${userId}`, { method: "GET" });

export const adminGetTrustQueue = (params?: {
  tier?: "OK" | "ATTENZIONE" | "CRITICO" | "BLOCCO" | "ALL" | "DEFAULT";
  q?: string;
  limit?: number;
}) => {
  const qs = new URLSearchParams();
  if (params?.tier) qs.set("tier", params.tier);
  if (params?.q) qs.set("q", params.q);
  if (params?.limit) qs.set("limit", String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request<any>(`/admin/trust/queue${suffix}`, { method: "GET" });
};

export const adminGetNativePrivateReview = (params?: {
  status?: "held" | "frozen";
  limit?: number;
}) => {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.limit) qs.set("limit", String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request<any>(`/admin/economy/native-private-review${suffix}`, { method: "GET" });
};

export const adminFreezeNativePrivate = (eventId: string, reason?: string | null) =>
  request<any>(`/admin/economy/native-private/${eventId}/freeze`, {
    method: "POST",
    body: JSON.stringify({ ...(reason ? { reason } : {}) }),
  });

export const adminRefundNativePrivate = (eventId: string, reason?: string | null) =>
  request<any>(`/admin/economy/native-private/${eventId}/refund`, {
    method: "POST",
    body: JSON.stringify({ ...(reason ? { reason } : {}) }),
  });

// --------------------------------------------------
// ADMIN — Showcase approval
// --------------------------------------------------

export type AdminShowcasePendingItem = {
  _id: string;
  title?: string;
  text?: string;
  mediaUrl?: string | null;

  billingType?: "free" | "paid" | string;
  paidTokens?: number;

  creatorId?: any; // populated user (displayName/_id/...)
  createdAt?: string;
};

export const adminGetShowcasePending = () =>
  request<AdminShowcasePendingItem[]>(`/admin/showcase/pending`, { method: "GET" });

export const adminApproveShowcase = (id: string) =>
  request<any>(`/admin/showcase/${id}/approve`, { method: "PATCH" });

export const adminRejectShowcase = (id: string, adminNote: string) =>
  request<any>(`/admin/showcase/${id}/reject`, {
    method: "PATCH",
    body: JSON.stringify({ adminNote }),
  });

// --------------------------------------------------
// ADMIN — Updates (Platform News)
// --------------------------------------------------

export type AdminPlatformUpdate = {
  _id: string;
  text: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export const adminCreateUpdate = (text: string) =>
  request<AdminPlatformUpdate>(`/admin/updates`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });

export const adminListUpdates = () =>
  request<AdminPlatformUpdate[]>(`/admin/updates`, { method: "GET" });

export const adminPatchUpdate = (id: string, patch: { text?: string; isActive?: boolean }) =>
  request<AdminPlatformUpdate>(`/admin/updates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });

export const adminDeleteUpdate = (id: string) =>
  request<any>(`/admin/updates/${id}`, { method: "DELETE" });

// --------------------------------------------------
// ADMIN — Deleted Accounts
// --------------------------------------------------

export type AdminDeletedUserItem = {
  _id: string;
  displayName?: string | null;
  email?: string | null;

  deletedAt?: string | null;

  // BE may provide it
  readyToPurge?: boolean;

  // optional fields if present
  deletionStatus?: string | null;
};

export const adminDeletedUsersList = () =>
  request<any>(`/admin/deleted-users`, { method: "GET" });