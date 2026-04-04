import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App";
import "./index.css";
import ProfileCenterPage from "./pages/ProfileCenterPage";
import LoginTestPage from "./pages/LoginTestPage";
import AuthPage from "./pages/AuthPage.tsx";
import DiscoverPage from "./pages/DiscoverPage.tsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.tsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.tsx";
import VerifyEmailPage from "./pages/VerifyEmailPage.tsx";
import ProfileLayoutPage from "./pages/ProfileLayoutPage";
import SearchPage from "./pages/SearchPage";
import NotificationsPage from "./pages/NotificationsPage";
import ChatPage from "./pages/ChatPage";
import LiveDetailPage from "./pages/LiveDetailPage";
import LiveRoomPage from "./pages/LiveRoomPage";
import LiveDiscoverPage from "./pages/LiveDiscoverPage";
import TokensPage from "./pages/TokensPage";
import RulesPage from "./pages/RulesPage";
import PromotedPage from "./pages/PromotedPage";
import ShowcasePage from "./pages/ShowcasePage";
import UpdatesPage from "./pages/UpdatesPage";
import ProfileManagePage from "./pages/ProfileManagePage";
import ProfilePrivacySecurityPage from "./pages/ProfilePrivacySecurityPage";
import ProfileVerificationPage from "./pages/ProfileVerificationPage";
import ProfileConnectionsPage from "./pages/ProfileConnectionsPage";
import PostDetailPage from "./pages/PostDetailPage";
import BecomeCreatorPage from "./pages/rules/BecomeCreatorPage";
import AdminLayoutPage from "./pages/admin/AdminLayoutPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminPendingPage from "./pages/admin/AdminPendingPage";
import AdminNewGrowthPage from "./pages/admin/AdminNewGrowthPage";
import AdminWatchlistPage from "./pages/admin/AdminWatchlistPage";
import AdminCreatorApprovalPage from "./pages/admin/AdminCreatorApprovalPage.tsx";
import AdminShowcaseApprovalPage from "./pages/admin/AdminShowcaseApprovalPage.tsx";
import AdminUpdatesPage from "./pages/admin/AdminUpdatesPage";
import BlockedPage from "./pages/BlockedPage";
import AdminBlockedUsersPage from "./pages/admin/AdminBlockedUsersPage.tsx";
import LiveCreatePage from "./pages/LiveCreatePage.tsx";
import ProfileVipPage from "./pages/ProfileVipPage";
import ProfileVipToolsPage from "./pages/ProfileVipToolsPage.tsx";
import BugReportPage from "./pages/BugReportPage.tsx";
import AdminBugReportsPage from "./pages/admin/AdminBugReportsPage.tsx";
import AdminSecurityLogPage from "./pages/admin/AdminSecurityLogPage.tsx";
import AdminReportDetailPage from "./pages/admin/AdminReportDetailPage";
import AdminDeletedAccountsPage from "./pages/admin/AdminDeletedAccountsPage.tsx";
import FedPage from "./pages/FedPage";

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
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />

        <Route path="/blocked" element={<BlockedPage />} />

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
          {/* Room */}
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
    </BrowserRouter>
  </React.StrictMode>
);
