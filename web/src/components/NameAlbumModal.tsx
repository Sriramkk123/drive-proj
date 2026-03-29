import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface NameAlbumModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
  selectedCount: number;
  defaultName: string;
  isPending: boolean;
  sourceType: "drive" | "photos";
}

export function NameAlbumModal({ open, onClose, onConfirm, selectedCount, defaultName, isPending, sourceType }: NameAlbumModalProps) {
  const [name, setName] = useState(defaultName);
  const isPhotos = sourceType === "photos";
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card">
        <DialogHeader>
          <DialogTitle>Save to Google Drive</DialogTitle>
          <DialogDescription>
            {isPhotos
              ? `${selectedCount} selected items from Google Photos will be saved to a new Google Drive folder.`
              : `Create a new Google Drive folder with ${selectedCount} selected items.`}
          </DialogDescription>
        </DialogHeader>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Album name..." autoFocus />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={() => onConfirm(name)} disabled={!name.trim() || isPending}>
            {isPending ? "Creating..." : "Create Album"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
