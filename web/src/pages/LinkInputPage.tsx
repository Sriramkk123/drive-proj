import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStatus, useLogout, redirectToLogin } from "../api/auth";
import { useCreateCollection } from "../api/collections";
import {
  useCreatePickerSession,
  usePickerSessionStatus,
  useFinalizePickerSession,
} from "../api/photos-picker";
import { LogOut } from "lucide-react";

const PENDING_LINK_KEY = "drivepick_pending_link";
const PENDING_PHOTOS_KEY = "drivepick_pending_photos";

export function LinkInputPage() {
  const [link, setLink] = useState("");
  const navigate = useNavigate();
  const { data: auth, isLoading: authLoading } = useAuthStatus();
  const createCollection = useCreateCollection();
  const logout = useLogout();

  // Photos Picker state
  const [pickerSessionId, setPickerSessionId] = useState<string>();
  const [pickerCollectionId, setPickerCollectionId] = useState<string>();
  const [polling, setPolling] = useState(false);

  const createPickerSession = useCreatePickerSession();
  const { data: pickerStatus } = usePickerSessionStatus(pickerSessionId, polling);
  const finalizeSession = useFinalizePickerSession();

  // Restore pending actions after OAuth redirect
  useEffect(() => {
    if (authLoading) return;

    const pendingLink = sessionStorage.getItem(PENDING_LINK_KEY);
    const pendingPhotos = sessionStorage.getItem(PENDING_PHOTOS_KEY);

    if (auth?.authenticated) {
      if (pendingLink) {
        sessionStorage.removeItem(PENDING_LINK_KEY);
        setLink(pendingLink);
        createCollection.mutate(pendingLink, {
          onSuccess: (data) => {
            navigate(`/collections/${data.id}`);
          },
        });
      } else if (pendingPhotos) {
        sessionStorage.removeItem(PENDING_PHOTOS_KEY);
        // Auto-trigger the Photos picker
        createPickerSession.mutate(undefined, {
          onSuccess: (data) => {
            setPickerSessionId(data.sessionId);
            setPickerCollectionId(data.collectionId);
            setPolling(true);
            window.open(data.pickerUri, "_blank");
          },
        });
      }
    } else {
      // Auth failed, restore link if any
      if (pendingLink) {
        setLink(pendingLink);
        sessionStorage.removeItem(PENDING_LINK_KEY);
      }
      if (pendingPhotos) {
        sessionStorage.removeItem(PENDING_PHOTOS_KEY);
      }
    }
  }, [auth, authLoading]);

  // When user finishes picking photos in Google's UI
  useEffect(() => {
    if (pickerStatus?.mediaItemsSet && pickerSessionId && pickerCollectionId) {
      setPolling(false);
      finalizeSession.mutate(
        { sessionId: pickerSessionId, collectionId: pickerCollectionId },
        {
          onSuccess: () => {
            navigate(`/collections/${pickerCollectionId}`);
          },
        },
      );
    }
  }, [pickerStatus?.mediaItemsSet]);

  const handleLoad = () => {
    if (!auth?.authenticated) {
      sessionStorage.setItem(PENDING_LINK_KEY, link);
      redirectToLogin();
      return;
    }
    createCollection.mutate(link, {
      onSuccess: (data) => {
        navigate(`/collections/${data.id}`);
      },
    });
  };

  const handlePhotos = () => {
    if (!auth?.authenticated) {
      sessionStorage.setItem(PENDING_PHOTOS_KEY, "true");
      redirectToLogin();
      return;
    }
    createPickerSession.mutate(undefined, {
      onSuccess: (data) => {
        setPickerSessionId(data.sessionId);
        setPickerCollectionId(data.collectionId);
        setPolling(true);
        window.open(data.pickerUri, "_blank");
      },
    });
  };

  const handleLogout = () => {
    logout.mutate();
  };

  const isPhotosLoading =
    createPickerSession.isPending || polling || finalizeSession.isPending;

  return (
    <div className="relative flex min-h-screen items-center justify-center">
      {auth?.authenticated && (
        <div className="absolute right-6 top-6 flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{auth.email}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            disabled={logout.isPending}
          >
            <LogOut className="mr-1.5 h-4 w-4" />
            Logout
          </Button>
        </div>
      )}

      <div className="flex w-[480px] flex-col items-center gap-6 rounded-2xl bg-card p-10 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">DrivePick</h1>
        <p className="text-center text-sm text-muted-foreground">
          Curate your photos from Google Drive or Google Photos
        </p>

        {/* Drive link input */}
        <div className="flex w-full gap-3">
          <Input
            placeholder="Paste a Google Drive folder link..."
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLoad()}
            className="flex-1"
          />
          <Button
            onClick={handleLoad}
            disabled={!link.trim() || createCollection.isPending}
          >
            {createCollection.isPending ? "Loading..." : "Load"}
          </Button>
        </div>

        <div className="flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Google Photos picker button */}
        <Button
          variant="outline"
          className="w-full"
          onClick={handlePhotos}
          disabled={isPhotosLoading}
        >
          {isPhotosLoading
            ? polling
              ? "Waiting for selection..."
              : "Opening Google Photos..."
            : "Pick from Google Photos"}
        </Button>

        {polling && (
          <p className="text-center text-xs text-muted-foreground">
            Select photos in the Google Photos tab, then come back here.
          </p>
        )}

        {createCollection.isError && (
          <p className="text-sm text-red-400">
            {createCollection.error.message}
          </p>
        )}
        {createPickerSession.isError && (
          <p className="text-sm text-red-400">
            {createPickerSession.error.message}
          </p>
        )}
      </div>
    </div>
  );
}
