import { CheckCircle, Circle, Play } from "lucide-react";

interface MediaCardProps {
  id: string;
  thumbnailUrl: string;
  name: string;
  mimeType: string;
  isSelected: boolean;
  onToggle: (id: string) => void;
}

export function MediaCard({ id, thumbnailUrl, name, mimeType, isSelected, onToggle }: MediaCardProps) {
  const isVideo = mimeType.startsWith("video/");
  return (
    <button
      onClick={() => onToggle(id)}
      className={`group relative aspect-square overflow-hidden rounded-xl transition-all ${
        isSelected ? "ring-3 ring-primary" : "opacity-50 hover:opacity-75"
      }`}
    >
      <img src={thumbnailUrl} alt={name} className="h-full w-full object-cover" loading="lazy" />
      <div className="absolute left-3 top-3">
        {isSelected ? (
          <CheckCircle className="h-6 w-6 fill-primary text-white" />
        ) : (
          <Circle className="h-6 w-6 text-white/70" />
        )}
      </div>
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40">
            <Play className="h-6 w-6 fill-white text-white" />
          </div>
        </div>
      )}
    </button>
  );
}
