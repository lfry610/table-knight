import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export function OAuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const token = params.get("token");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    // Store token first so the getMe request carries it
    useAuthStore.setState({ token });

    const isNew = params.get("new") === "1";

    authApi.getMe()
      .then((res) => {
        login(token, res.data);
        navigate(isNew ? "/onboarding" : "/dashboard", { replace: true });
      })
      .catch(() => {
        useAuthStore.getState().logout();
        navigate("/login", { replace: true });
      });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground animate-pulse">Signing you in…</p>
    </div>
  );
}
