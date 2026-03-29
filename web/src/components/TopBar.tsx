import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface TopBarProps {
  collectionName: string;
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onCreateAlbum: () => void;
  allSelected: boolean;
}

export function TopBar({ collectionName, selectedCount, totalCount, onSelectAll, onDeselectAll, onCreateAlbum, allSelected }: TopBarProps) {
  return (
    <div className="flex h-16 items-center justify-between border-b border-border bg-card px-8">
      <div className="flex items-center gap-4">
        <span className="text-lg font-bold text-foreground">DrivePick</span>
        <span className="text-muted-foreground">/</span>
        <span className="text-muted-foreground">{collectionName}</span>
      </div>
      <div className="flex items-center gap-4">
        <Badge variant="secondary" className="bg-primary/10 text-primary">
          {selectedCount} of {totalCount} selected
        </Badge>
        <Button variant="outline" size="sm" onClick={allSelected ? onDeselectAll : onSelectAll}>
          {allSelected ? "Deselect All" : "Select All"}
        </Button>
        <Button size="sm" onClick={onCreateAlbum} disabled={selectedCount === 0}>
          Create Album
        </Button>
      </div>
    </div>
  );
}
