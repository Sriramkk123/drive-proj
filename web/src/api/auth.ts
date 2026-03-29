import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";

interface AuthStatus {
  authenticated: boolean;
  email: string;
}

export function useAuthStatus() {
  return useQuery<AuthStatus>({
    queryKey: ["auth", "status"],
    queryFn: () => apiFetch<AuthStatus>("/v1/auth/status"),
    retry: false,
  });
}

export function redirectToLogin() {
  window.location.href = "/v1/auth/google";
}
