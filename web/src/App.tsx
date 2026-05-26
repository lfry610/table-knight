import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { OAuthCallbackPage } from "@/pages/auth/OAuthCallbackPage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { CollectionPage } from "@/pages/collection/CollectionPage";
import { GroupsPage, GroupDetailPage } from "@/pages/groups/GroupsPage";
import { SessionsPage, LogSessionPage } from "@/pages/sessions/SessionsPage";
import { FeedPage } from "@/pages/feed/FeedPage";
import { ListsPage, ListDetailPage } from "@/pages/lists/ListsPage";
import { ProfilePage } from "@/pages/profile/ProfilePage";
import { GameDetailPage } from "@/pages/games/GameDetailPage";
import { ReviewsPage } from "@/pages/reviews/ReviewsPage";
import { OnboardingPage } from "@/pages/onboarding/OnboardingPage";
import { ProtectedRoute } from "@/components/layout/AppLayout";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/auth/callback" element={<OAuthCallbackPage />} />

        {/* Protected */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/collection" element={<ProtectedRoute><CollectionPage /></ProtectedRoute>} />
        <Route path="/groups" element={<ProtectedRoute><GroupsPage /></ProtectedRoute>} />
        <Route path="/groups/:id" element={<ProtectedRoute><GroupDetailPage /></ProtectedRoute>} />
        <Route path="/feed" element={<ProtectedRoute><FeedPage /></ProtectedRoute>} />
        <Route path="/lists" element={<ProtectedRoute><ListsPage /></ProtectedRoute>} />
        <Route path="/lists/:id" element={<ProtectedRoute><ListDetailPage /></ProtectedRoute>} />
        <Route path="/sessions" element={<ProtectedRoute><SessionsPage /></ProtectedRoute>} />
        <Route path="/sessions/log" element={<ProtectedRoute><LogSessionPage /></ProtectedRoute>} />
        <Route path="/users/:id" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/games/:bggId" element={<ProtectedRoute><GameDetailPage /></ProtectedRoute>} />
        <Route path="/reviews" element={<ProtectedRoute><ReviewsPage /></ProtectedRoute>} />
        <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
