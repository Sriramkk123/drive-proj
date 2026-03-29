import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean }>("/v1/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.setQueryData(["auth", "status"], null);
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}

export function redirectToLogin() {
  window.location.href = "/v1/auth/google";
}
