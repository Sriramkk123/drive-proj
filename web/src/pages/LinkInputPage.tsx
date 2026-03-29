import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStatus, redirectToLogin } from "../api/auth";
import { useCreateCollection } from "../api/collections";

export function LinkInputPage() {
  const [link, setLink] = useState("");
  const navigate = useNavigate();
  const { data: auth } = useAuthStatus();
  const createCollection = useCreateCollection();

  const handleLoad = () => {
    if (!auth?.authenticated) {
      redirectToLogin();
      return;
    }
    createCollection.mutate(link, {
      onSuccess: (data) => { navigate(`/collections/${data.id}`); },
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex w-[480px] flex-col items-center gap-6 rounded-2xl bg-card p-10 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">DrivePick</h1>
        <p className="text-center text-sm text-muted-foreground">
          Curate your photos from Google Drive
        </p>
        <div className="flex w-full gap-3">
          <Input
            placeholder="Paste a Google Drive folder link..."
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLoad()}
            className="flex-1"
          />
          <Button onClick={handleLoad} disabled={!link.trim() || createCollection.isPending}>
            {createCollection.isPending ? "Loading..." : "Load"}
          </Button>
        </div>
        {createCollection.isError && (
          <p className="text-sm text-red-400">{createCollection.error.message}</p>
        )}
      </div>
    </div>
  );
}
