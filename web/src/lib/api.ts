import axios from "axios";
import { useAuthStore } from "@/store/auth";

export const api = axios.create({
  baseURL: "/api",
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
};

export const gamesApi = {
  search: (q: string) =>
    api.get<BGGSearchHit[]>("/games/search", { params: { q } }),
  getMyCollection: () =>
    api.get<CollectionGame[]>("/me/collection"),
  addToCollection: (data: { bgg_id: number; status: GameStatus }) =>
    api.post<UserGame>("/me/collection", data),
  updateCollectionEntry: (gameId: string, data: { status?: GameStatus; user_rating?: number }) =>
    api.patch<UserGame>(`/me/collection/${gameId}`, data),
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

export const sessionsApi = {
  create: (data: CreateSessionData) =>
    api.post<Session>("/sessions", data),
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
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

export type GameStatus = "owned" | "want_to_play" | "for_trade" | "wishlist";

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
