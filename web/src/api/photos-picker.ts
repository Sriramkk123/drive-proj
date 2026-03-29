import { useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";

interface PickerSessionResponse {
  collectionId: string;
  sessionId: string;
  pickerUri: string;
}

interface PickerStatusResponse {
  sessionId: string;
  mediaItemsSet: boolean;
  expireTime: string;
}

interface FinalizeResponse {
  collectionId: string;
  mediaCount: number;
}

export function useCreatePickerSession() {
  return useMutation({
    mutationFn: () =>
      apiFetch<PickerSessionResponse>("/v1/photos/sessions", {
        method: "POST",
      }),
  });
}

export function usePickerSessionStatus(
  sessionId: string | undefined,
  enabled: boolean,
) {
  return useQuery<PickerStatusResponse>({
    queryKey: ["photos", "sessions", sessionId],
    queryFn: () =>
      apiFetch<PickerStatusResponse>(`/v1/photos/sessions/${sessionId}`),
    enabled: !!sessionId && enabled,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && !data.mediaItemsSet) return 2000;
      return false;
    },
  });
}

export function useFinalizePickerSession() {
  return useMutation({
    mutationFn: ({
      sessionId,
      collectionId,
    }: {
      sessionId: string;
      collectionId: string;
    }) =>
      apiFetch<FinalizeResponse>(
        `/v1/photos/sessions/${sessionId}/finalize`,
        {
          method: "POST",
          body: JSON.stringify({ collectionId }),
        },
      ),
  });
}
