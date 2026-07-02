import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App";
import "./index.css";
import { FeatureFlagsProvider } from "./config/FeatureFlagsProvider";

const ProfileCenterPage = React.lazy(() => import("./pages/ProfileCenterPage"));
const LoginTestPage = React.lazy(() => import("./pages/LoginTestPage"));
const AuthPage = React.lazy(() => import("./pages/AuthPage.tsx"));
const DiscoverPage = React.lazy(() => import("./pages/DiscoverPage.tsx"));
const ForgotPasswordPage = React.lazy(() => import("./pages/ForgotPasswordPage.tsx"));
const ResetPasswordPage = React.lazy(() => import("./pages/ResetPasswordPage.tsx"));
const VerifyEmailPage = React.lazy(() => import("./pages/VerifyEmailPage.tsx"));
const NestXAppsPage = React.lazy(() => import("./pages/NestXAppsPage.tsx"));
const ProfileLayoutPage = React.lazy(() => import("./pages/ProfileLayoutPage"));
const SearchPage = React.lazy(() => import("./pages/SearchPage"));
const NotificationsPage = React.lazy(() => import("./pages/NotificationsPage"));
const ChatPage = React.lazy(() => import("./pages/ChatPage"));
const LiveDetailPage = React.lazy(() => import("./pages/LiveDetailPage"));
const LiveRoomPage = React.lazy(() => import("./pages/LiveRoomPage"));
const LiveDiscoverPage = React.lazy(() => import("./pages/LiveDiscoverPage"));
const TokensPage = React.lazy(() => import("./pages/TokensPage"));
const RulesPage = React.lazy(() => import("./pages/RulesPage"));
const PromotedPage = React.lazy(() => import("./pages/PromotedPage"));
const ShowcasePage = React.lazy(() => import("./pages/ShowcasePage"));
const UpdatesPage = React.lazy(() => import("./pages/UpdatesPage"));
const ProfileManagePage = React.lazy(() => import("./pages/ProfileManagePage"));
const ProfilePrivacySecurityPage = React.lazy(() => import("./pages/ProfilePrivacySecurityPage"));
const ProfileVerificationPage = React.lazy(() => import("./pages/ProfileVerificationPage"));
const ProfileConnectionsPage = React.lazy(() => import("./pages/ProfileConnectionsPage"));
const PostDetailPage = React.lazy(() => import("./pages/PostDetailPage"));
const BecomeCreatorPage = React.lazy(() => import("./pages/rules/BecomeCreatorPage"));
const AdminLayoutPage = React.lazy(() => import("./pages/admin/AdminLayoutPage"));
const AdminDashboardPage = React.lazy(() => import("./pages/admin/AdminDashboardPage"));
const AdminPendingPage = React.lazy(() => import("./pages/admin/AdminPendingPage"));
const AdminNewGrowthPage = React.lazy(() => import("./pages/admin/AdminNewGrowthPage"));
const AdminWatchlistPage = React.lazy(() => import("./pages/admin/AdminWatchlistPage"));
const AdminCreatorApprovalPage = React.lazy(() => import("./pages/admin/AdminCreatorApprovalPage.tsx"));
const AdminShowcaseApprovalPage = React.lazy(() => import("./pages/admin/AdminShowcaseApprovalPage.tsx"));
const AdminUpdatesPage = React.lazy(() => import("./pages/admin/AdminUpdatesPage"));
const BlockedPage = React.lazy(() => import("./pages/BlockedPage"));
const AdminBlockedUsersPage = React.lazy(() => import("./pages/admin/AdminBlockedUsersPage.tsx"));
const LiveCreatePage = React.lazy(() => import("./pages/LiveCreatePage.tsx"));
const ProfileVipPage = React.lazy(() => import("./pages/ProfileVipPage"));
const ProfileVipToolsPage = React.lazy(() => import("./pages/ProfileVipToolsPage.tsx"));
const BugReportPage = React.lazy(() => import("./pages/BugReportPage.tsx"));
const AdminBugReportsPage = React.lazy(() => import("./pages/admin/AdminBugReportsPage.tsx"));
const AdminSecurityLogPage = React.lazy(() => import("./pages/admin/AdminSecurityLogPage.tsx"));
const AdminReportDetailPage = React.lazy(() => import("./pages/admin/AdminReportDetailPage"));
const AdminDeletedAccountsPage = React.lazy(() => import("./pages/admin/AdminDeletedAccountsPage.tsx"));
const AdminTestAccountsPage = React.lazy(() => import("./pages/admin/AdminTestAccountsPage.tsx"));
const FedPage = React.lazy(() => import("./pages/FedPage"));
const HostLiveConsolePage = React.lazy(() => import("./pages/HostLiveConsolePage"));
const HostPanelPage = React.lazy(() => import("./pages/HostPanelPage"));

function isAdminAccount() {
  return (localStorage.getItem("accountType") || "").toLowerCase() === "admin";
}

function RequireAuth({ children }: { children: React.ReactElement }) {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/auth?mode=login" replace />;
  return children;
}

function RequireAdmin({ children }: { children: React.ReactElement }) {
  if (!isAdminAccount()) return <Navigate to="/auth" replace />;
  return children;
}

function RequireNonAdmin({ children }: { children: React.ReactElement }) {
  // Phase 1B: admins must be able to open /app routes (profile/post) from the admin queue.
  // We keep the admin sidebar as the primary entry, but we must not hard-block /app/* for admins.
  return children;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FeatureFlagsProvider>
      <BrowserRouter>
        <React.Suspense fallback={<div style={{ padding: 20 }}>Loading...</div>}>
      <Routes>
        <Route path="/" element={<App />} />

        <Route path="/blocked" element={<BlockedPage />} />
        <Route path="/apps" element={<NestXAppsPage />} />

        {/* AUTH */}
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/verify-email" element={<VerifyEmailPage />} />

        {/* DISCOVER / SCOPRI DI PIÙ */}
        <Route path="/discover" element={<DiscoverPage />} />

{/* ADMIN */}
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayoutPage />
            </RequireAdmin>
          }
        >
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="pending" element={<AdminPendingPage />} />
          <Route path="reports/:id" element={<AdminReportDetailPage />} />

          <Route path="creator-approval" element={<AdminCreatorApprovalPage />} />
          <Route path="showcase-approval" element={<AdminShowcaseApprovalPage />} />
          <Route path="updates" element={<AdminUpdatesPage />} />
          <Route path="bug-reports" element={<AdminBugReportsPage />} />

          <Route path="new-growth" element={<AdminNewGrowthPage />} />
          <Route path="watchlist" element={<AdminWatchlistPage />} />
          <Route path="test-accounts" element={<AdminTestAccountsPage />} />
          <Route path="blocked-users" element={<AdminBlockedUsersPage />} />
          <Route path="deleted-accounts" element={<AdminDeletedAccountsPage />} />
          <Route path="security-log" element={<AdminSecurityLogPage />} />
        </Route>

        {/* APP (3 columns layout) */}
        <Route
          path="/app/profile"
          element={
            <RequireAuth>
              <RequireNonAdmin>
                <ProfileLayoutPage />
              </RequireNonAdmin>
            </RequireAuth>
          }
        >
          <Route index element={<ProfileCenterPage />} />
          <Route path=":id" element={<ProfileCenterPage />} />
          <Route path="vip" element={<ProfileVipPage />} />
          <Route path="vip-feed" element={<ProfileVipToolsPage />} />
          <Route path="manage" element={<ProfileManagePage />} />
          <Route path="privacy" element={<ProfilePrivacySecurityPage />} />
          <Route path="verification" element={<ProfileVerificationPage />} />
          <Route path="connections" element={<ProfileConnectionsPage />} />
        </Route>

        <Route
          path="/app/search"
          element={
            <RequireAuth>
              <RequireNonAdmin>
                <ProfileLayoutPage />
              </RequireNonAdmin>
            </RequireAuth>
          }
        >
          <Route index element={<SearchPage />} />
        </Route>

        <Route
          path="/app/notifications"
          element={
            <RequireAuth>
              <RequireNonAdmin>
                <ProfileLayoutPage />
              </RequireNonAdmin>
            </RequireAuth>
          }
        >
          <Route index element={<NotificationsPage />} />
        </Route>

        <Route
          path="/app/post/:id"
          element={
            <RequireAuth>
              <RequireNonAdmin>
                <ProfileLayoutPage />
              </RequireNonAdmin>
            </RequireAuth>
          }
        >
          <Route index element={<PostDetailPage />} />
        </Route>

        <Route
          path="/app/chat"
          element={
            <RequireAuth>
              <RequireNonAdmin>
                <ProfileLayoutPage />
              </RequireNonAdmin>
            </RequireAuth>
          }
        >
          <Route index element={<ChatPage />} />
        </Route>

        <Route
          path="/app/live/:id/host-panel"
          element={
            <RequireAuth>
              <RequireNonAdmin>
                <HostPanelPage />
              </RequireNonAdmin>
            </RequireAuth>
          }
        />

        <Route
          path="/app/live"
          element={
            <RequireAuth>
              <RequireNonAdmin>
                <ProfileLayoutPage />
              </RequireNonAdmin>
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="discover" replace />} />
          <Route path="discover" element={<LiveDiscoverPage />} />
          <Route path="create" element={<LiveCreatePage />} />
          {/* Placeholder detail (Blocco 2) */}
          {/* Detail */}
          <Route path=":id" element={<LiveDetailPage />} />
          <Route path=":id/host-console" element={<HostLiveConsolePage />} />
          <Route path=":id/room" element={<LiveRoomPage />} />
        </Route>

        <Route
          path="/app/tokens"
          element={
            <RequireAuth>
              <RequireNonAdmin>
                <ProfileLayoutPage />
              </RequireNonAdmin>
            </RequireAuth>
          }
        >
          <Route index element={<TokensPage />} />
        </Route>

        <Route
          path="/app/rules"
          element={
            <RequireAuth>
              <RequireNonAdmin>
                <ProfileLayoutPage />
              </RequireNonAdmin>
            </RequireAuth>
          }
        >
          <Route index element={<RulesPage />} />
        </Route>

        <Route
          path="/app/bug-report"
          element={
            <RequireAuth>
              <RequireNonAdmin>
                <ProfileLayoutPage />
              </RequireNonAdmin>
            </RequireAuth>
          }
        >
          <Route index element={<BugReportPage />} />
        </Route>

        <Route
          path="/app/fed"
          element={
            <RequireAuth>
              <RequireNonAdmin>
                <ProfileLayoutPage />
              </RequireNonAdmin>
            </RequireAuth>
          }
        >
          <Route index element={<FedPage />} />
        </Route>

        <Route
          path="/app/promoted"
          element={
            <RequireAuth>
              <RequireNonAdmin>
                <ProfileLayoutPage />
              </RequireNonAdmin>
            </RequireAuth>
          }
        >
          <Route index element={<PromotedPage />} />
        </Route>

        <Route
          path="/app/showcase"
          element={
            <RequireAuth>
              <RequireNonAdmin>
                <ProfileLayoutPage />
              </RequireNonAdmin>
            </RequireAuth>
          }
        >
          <Route index element={<ShowcasePage />} />
        </Route>

        <Route
          path="/app/updates"
          element={
            <RequireAuth>
              <RequireNonAdmin>
                <ProfileLayoutPage />
              </RequireNonAdmin>
            </RequireAuth>
          }
        >
          <Route index element={<UpdatesPage />} />
        </Route>

        {/* PROFILE */}
        <Route path="/profile" element={<ProfileCenterPage />} />
        <Route path="/profile/:id" element={<ProfileCenterPage />} />
        
        {/* DEV ONLY */}
        <Route path="/login-test" element={<LoginTestPage />} />

        <Route
          path="/app/rules/become-creator"
          element={
            <RequireAuth>
              <RequireNonAdmin>
                <ProfileLayoutPage />
              </RequireNonAdmin>
            </RequireAuth>
          }
        >
          <Route index element={<BecomeCreatorPage />} />
        </Route>
      </Routes>
        </React.Suspense>
      </BrowserRouter>
    </FeatureFlagsProvider>
  </React.StrictMode>
);
