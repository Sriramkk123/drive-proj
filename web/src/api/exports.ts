import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "./client";

interface ExportRequest {
  collectionId: string;
  name: string;
  mediaIds: string[];
}

interface ExportResponse {
  id: string;
  name: string;
  link: string;
  sourceType: "drive" | "photos";
  itemCount: number;
}

export function useCreateExport() {
  return useMutation({
    mutationFn: ({ collectionId, name, mediaIds }: ExportRequest) =>
      apiFetch<ExportResponse>(`/v1/collections/${collectionId}/exports`, {
        method: "POST",
        body: JSON.stringify({ name, mediaIds }),
      }),
  });
}

export type { ExportResponse };
