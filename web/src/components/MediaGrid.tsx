import { MediaCard } from "./MediaCard";
import type { MediaItem } from "../api/collections";

interface MediaGridProps {
  items: MediaItem[];
  isSelected: (id: string) => boolean;
  onToggle: (id: string) => void;
}

export function MediaGrid({ items, isSelected, onToggle }: MediaGridProps) {
  return (
    <div className="grid grid-cols-4 gap-4 p-8">
      {items.map((item) => (
        <MediaCard
          key={item.id}
          id={item.id}
          thumbnailUrl={item.thumbnailUrl}
          name={item.name}
          mimeType={item.mimeType}
          isSelected={isSelected(item.id)}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}
