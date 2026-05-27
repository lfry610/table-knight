import axios from "axios";
import { useAuthStore } from "@/store/auth";

export const api = axios.create({
  // In dev, VITE_API_URL is unset → Vite proxies /api → localhost:8080
  // In prod, VITE_API_URL = https://api.yourdomain.com → direct requests
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  headers: { "Content-Type": "application/json" },
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// ── Typed API calls ───────────────────────────────────────────────────────────

export const authApi = {
  register: (data: { email: string; display_name: string; password: string }) =>
    api.post<AuthResponse>("/auth/register", data),
  login: (data: { email: string; password: string }) =>
    api.post<AuthResponse>("/auth/login", data),
  getMe: () =>
    api.get<User>("/me"),
  updateMe: (data: { display_name?: string; bio?: string; avatar_url?: string }) =>
    api.patch<User>("/me", data),
};

export const reviewsApi = {
  getMyReviews: () =>
    api.get<Review[]>("/me/reviews"),
  getReviewableGames: () =>
    api.get<ReviewableGame[]>("/me/reviewable-games"),
  upsert: (data: { game_id: string; rating: number; body?: string }) =>
    api.post<Review>("/reviews", data),
  delete: (gameId: string) =>
    api.delete(`/reviews/${gameId}`),
};

export const gamesApi = {
  search: (q: string) =>
    api.get<BGGSearchHit[]>("/games/search", { params: { q } }),
  getGameDetail: (bggId: number) =>
    api.get<GameDetail>(`/games/${bggId}`),
  getMyCollection: () =>
    api.get<CollectionGame[]>("/me/collection"),
  addToCollection: (data: { bgg_id: number; status: GameStatus }) =>
    api.post<UserGame>("/me/collection", data),
  updateCollectionEntry: (gameId: string, data: { status?: GameStatus; user_rating?: number }) =>
    api.patch<UserGame>(`/me/collection/${gameId}`, data),
  removeFromCollection: (gameId: string) =>
    api.delete(`/me/collection/${gameId}`),
};

export const groupsApi = {
  getMyGroups: () =>
    api.get<Group[]>("/me/groups"),
  createGroup: (data: { name: string }) =>
    api.post<Group>("/groups", data),
  joinGroup: (invite_code: string) =>
    api.post<Group>("/groups/join", { invite_code }),
  getGroup: (id: string) =>
    api.get<GroupDetail>(`/groups/${id}`),
  getGroupCollection: (id: string) =>
    api.get<CollectionGame[]>(`/groups/${id}/collection`),
  getGroupSessions: (id: string, params?: { limit?: number; offset?: number }) =>
    api.get<Session[]>(`/groups/${id}/sessions`, { params }),
};

export const listsApi = {
  getMyLists: () =>
    api.get<GameList[]>("/me/lists"),
  createList: (data: { title: string; description?: string }) =>
    api.post<GameList>("/lists", data),
  getList: (id: string) =>
    api.get<{ list: GameList; games: ListGame[] }>(`/lists/${id}`),
  updateList: (id: string, data: { title?: string; description?: string }) =>
    api.patch<GameList>(`/lists/${id}`, data),
  deleteList: (id: string) =>
    api.delete(`/lists/${id}`),
  addGame: (listId: string, bggId: number) =>
    api.post<ListGame[]>(`/lists/${listId}/games`, { bgg_id: bggId }),
  removeGame: (listId: string, gameId: string) =>
    api.delete<ListGame[]>(`/lists/${listId}/games/${gameId}`),
  reorderGames: (listId: string, gameIds: string[]) =>
    api.put<ListGame[]>(`/lists/${listId}/reorder`, { game_ids: gameIds }),
};

export interface UserProfile {
  user: User;
  round_table: RoundTableGame[];
  lists: GameList[];
  collection: CollectionGame[];
  recent_sessions: Session[];
  is_following: boolean;
  is_own_profile: boolean;
  follower_count: number;
  following_count: number;
  owned_count: number;
  played_count: number;
}

export const socialApi = {
  follow: (userId: string) =>
    api.post(`/users/${userId}/follow`),
  unfollow: (userId: string) =>
    api.delete(`/users/${userId}/follow`),
  getFeed: (params?: { limit?: number; offset?: number }) =>
    api.get<FeedItem[]>("/me/feed", { params }),
  getFollowing: () =>
    api.get<FollowingUser[]>("/me/following"),
  getFollowers: () =>
    api.get<FollowingUser[]>("/me/followers"),
  getGroupMates: () =>
    api.get<GroupMate[]>("/me/group-mates"),
  searchUsers: (q: string) =>
    api.get<UserSearchResult[]>("/users/search", { params: { q } }),
  getProfile: (userId: string) =>
    api.get<UserProfile>(`/users/${userId}`),
};

export const roundTableApi = {
  get: () =>
    api.get<RoundTableGame[]>("/me/round-table"),
  set: (bggIds: number[]) =>
    api.put<RoundTableGame[]>("/me/round-table", { bgg_ids: bggIds }),
};

export const sessionsApi = {
  create: (data: CreateSessionData) =>
    api.post<Session>("/sessions", data),
  getMyStats: () =>
    api.get<UserStats>("/me/stats"),
  getMySessions: (params?: { limit?: number; offset?: number }) =>
    api.get<Session[]>("/me/sessions", { params }),
  getPlayers: (sessionId: string) =>
    api.get<SessionPlayer[]>(`/sessions/${sessionId}/players`),
  updateSession: (sessionId: string, data: { played_at: string }) =>
    api.patch(`/sessions/${sessionId}`, data),
  deleteSession: (sessionId: string) =>
    api.delete(`/sessions/${sessionId}`),
  updatePlayers: (sessionId: string, players: { user_id: string; result: SessionResult; score?: number }[]) =>
    api.patch(`/sessions/${sessionId}/players`, players),
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface BGGSearchHit {
  bgg_id: number;
  title: string;
  year_published: number;
}

export type GameStatus = "owned" | "played" | "want_to_play" | "for_trade" | "wishlist";

export interface Game {
  id: string;
  bgg_id: number;
  title: string;
  min_players: number;
  max_players: number;
  playtime_mins: number | null;
  weight: number | null;
  image_url: string | null;
  categories: string[];
  bgg_rating: number | null;
  description: string | null;
}

export interface Review {
  id: string;
  user_id: string;
  game_id: string;
  rating: number;
  body: string | null;
  created_at: string;
  updated_at: string;
  game_title?: string;
  game_image?: string | null;
  game_bgg_id?: number;
}

export interface ReviewStat {
  rating: number;
  count: number;
}

export interface ReviewableGame {
  id: string;
  bgg_id: number;
  title: string;
  image_url: string | null;
}

export interface GameDetail {
  game: Game;
  sessions: Session[];
  review_stats: ReviewStat[];
  user_review: Review | null;
}

export interface UserGame {
  user_id: string;
  game_id: string;
  status: GameStatus;
  user_rating: number | null;
  added_at: string;
}

export interface CollectionGame extends Game {
  status: GameStatus;
  played: boolean;
  user_rating: number | null;
  added_at: string;
}

export interface Group {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
}

export interface GroupMember {
  id: string;
  display_name: string;
  avatar_url: string | null;
  role: "admin" | "member";
  joined_at: string;
}

export interface GroupDetail {
  group: Group;
  members: GroupMember[];
}

export type SessionResult = "win" | "loss" | "draw" | "dnf";

export interface SessionPlayer {
  id: string;
  display_name: string;
  avatar_url: string | null;
  result: SessionResult;
  score: number | null;
}

export interface Session {
  id: string;
  group_id: string | null;
  game_id: string;
  game_title: string;
  game_image: string | null;
  played_at: string;
  duration_mins: number | null;
  notes: string | null;
  logged_by: string;
}

export interface GameList {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  game_count: number;
}

export interface ListGame {
  id: string;
  bgg_id: number;
  title: string;
  image_url: string | null;
  bgg_rating: number | null;
  weight: number | null;
  min_players: number;
  max_players: number;
  playtime_mins: number | null;
  position: number;
}

export type ActivityType = "session_logged" | "game_added" | "game_for_trade" | "list_created" | "group_joined";

export interface FeedItem {
  activity_id: string;
  type: ActivityType;
  created_at: string;
  actor_id: string;
  display_name: string;
  avatar_url: string | null;
  game_id: string | null;
  game_title: string | null;
  game_image: string | null;
  session_id: string | null;
  session_notes: string | null;
  session_duration: number | null;
  list_id: string | null;
  list_title: string | null;
  group_id: string | null;
  group_name: string | null;
}

export interface FollowingUser {
  id: string;
  display_name: string;
  avatar_url: string | null;
  followed_at: string;
}

export interface GroupMate {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface UserSearchResult {
  id: string;
  display_name: string;
  avatar_url: string | null;
  is_following: boolean;
}

export interface RoundTableGame {
  position: number;
  id: string;
  bgg_id: number;
  title: string;
  min_players: number;
  max_players: number;
  playtime_mins: number | null;
  weight: number | null;
  image_url: string | null;
  categories: string[];
  bgg_rating: number | null;
  cached_at: string;
}

export interface UserStats {
  total_sessions: number;
  sessions_this_month: number;
  unique_games: number;
  total_playtime_mins: number;
  most_played_game: string;
  most_played_game_count: number;
  most_played_game_image: string | null;
  wins: number;
  total_results: number;
}

export interface CreateSessionData {
  bgg_id: number;
  group_id?: string;
  played_at?: string;
  duration_mins?: number;
  notes?: string;
  players: {
    user_id: string;
    result: SessionResult;
    score?: number;
  }[];
}
