import { useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";

interface CollectionResponse {
  id: string;
  sourceType: "drive" | "photos";
  name: string;
  status: "fetching" | "ready" | "failed";
  mediaCount?: number;
  createdAt?: string;
  expiresAt?: string;
}

interface MediaItem {
  id: string;
  name: string;
  mimeType: string;
  thumbnailUrl: string;
  width: number;
  height: number;
}

interface MediaResponse {
  items: MediaItem[];
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
}

export function useCreateCollection() {
  return useMutation({
    mutationFn: (link: string) =>
      apiFetch<CollectionResponse>("/v1/collections", {
        method: "POST",
        body: JSON.stringify({ link }),
      }),
  });
}

export function useCollection(id: string | undefined) {
  return useQuery<CollectionResponse>({
    queryKey: ["collections", id],
    queryFn: () => apiFetch<CollectionResponse>(`/v1/collections/${id}`),
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === "fetching") return 1000;
      return false;
    },
  });
}

async function fetchAllMedia(id: string): Promise<MediaResponse> {
  const all: MediaItem[] = [];
  let page = 1;
  let hasNext = true;
  let total = 0;

  while (hasNext) {
    const res = await apiFetch<MediaResponse>(
      `/v1/collections/${id}/media?page=${page}&limit=100`,
    );
    all.push(...res.items);
    total = res.total;
    hasNext = res.hasNext;
    page++;
  }

  return { items: all, page: 1, limit: total, total, hasNext: false };
}

export function useCollectionMedia(id: string | undefined, status: string | undefined) {
  return useQuery<MediaResponse>({
    queryKey: ["collections", id, "media"],
    queryFn: () => fetchAllMedia(id!),
    enabled: !!id && status === "ready",
  });
}

export type { CollectionResponse, MediaItem, MediaResponse };
