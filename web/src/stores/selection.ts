import { create } from "zustand";

interface SelectionState {
  selected: Set<string>;
  toggle: (id: string) => void;
  selectAll: (ids: string[]) => void;
  deselectAll: () => void;
  isSelected: (id: string) => boolean;
  reset: () => void;
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  selected: new Set<string>(),
  toggle: (id) =>
    set((state) => {
      const next = new Set(state.selected);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return { selected: next };
    }),
  selectAll: (ids) => set(() => ({ selected: new Set(ids) })),
  deselectAll: () => set(() => ({ selected: new Set<string>() })),
  isSelected: (id) => get().selected.has(id),
  reset: () => set(() => ({ selected: new Set<string>() })),
}));
