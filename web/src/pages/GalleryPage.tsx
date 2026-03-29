import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCollection, useCollectionMedia } from "../api/collections";
import { useCreateExport } from "../api/exports";
import { useSelectionStore } from "../stores/selection";
import { TopBar } from "../components/TopBar";
import { MediaGrid } from "../components/MediaGrid";
import { NameAlbumModal } from "../components/NameAlbumModal";

export function GalleryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const { data: collection } = useCollection(id);
  const { data: mediaResponse } = useCollectionMedia(id, collection?.status);
  const createExport = useCreateExport();
  const { selected, toggle, selectAll, deselectAll, isSelected } = useSelectionStore();
  const items = mediaResponse?.items ?? [];
  const allIds = items.map((i) => i.id);

  const handleCreateAlbum = (name: string) => {
    if (!id) return;
    createExport.mutate(
      { collectionId: id, name, mediaIds: Array.from(selected) },
      {
        onSuccess: (data) => {
          navigate(`/collections/${id}/result`, {
            state: { name: data.name, link: data.link, sourceType: data.sourceType, itemCount: data.itemCount },
          });
        },
      },
    );
  };

  if (!collection) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  }
  if (collection.status === "fetching") {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Fetching photos from Google...</div>;
  }
  if (collection.status === "failed") {
    return <div className="flex min-h-screen items-center justify-center text-red-400">Failed to load media. Please try again.</div>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar
        collectionName={collection.name}
        selectedCount={selected.size}
        totalCount={items.length}
        onSelectAll={() => selectAll(allIds)}
        onDeselectAll={deselectAll}
        onCreateAlbum={() => setModalOpen(true)}
        allSelected={selected.size === items.length && items.length > 0}
      />
      <MediaGrid items={items} isSelected={isSelected} onToggle={toggle} />
      <NameAlbumModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleCreateAlbum}
        selectedCount={selected.size}
        defaultName={`${collection.name} - Best Picks`}
        isPending={createExport.isPending}
        sourceType={collection.sourceType}
      />
    </div>
  );
}
