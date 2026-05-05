import { create } from "zustand";
import {
  choose,
  createInitialRuntimeState,
  getCurrentPhrase,
  getVisibleChoices,
  goBack,
  goForward,
  normalizeLoadedResourcePath,
  openGameFile,
  saveSchema,
  validateProject,
  type Choice,
  type ResourceFile,
  type RuntimeState,
  type VNgineGame,
  type VNgineSave,
  type ValidationIssue
} from "@vngine/shared";

type SaveSlot = VNgineSave & { id: string };
type StoredSaveSlot = SaveSlot & { game: VNgineGame };

type EngineStore = {
  game: VNgineGame | null;
  resources: ResourceFile[];
  state: RuntimeState | null;
  issues: ValidationIssue[];
  saveSlots: StoredSaveSlot[];
  loadGameFile: (file: File) => Promise<void>;
  loadResourceFiles: (files: FileList | File[]) => void;
  start: () => void;
  forward: () => void;
  back: () => void;
  chooseChoice: (choice: Choice) => void;
  save: () => void;
  loadSave: (slot: StoredSaveSlot) => void;
  deleteSave: (slotId: string) => void;
};

const saveKey = "vngine.engine.saves";

export const useEngineStore = create<EngineStore>((set, get) => ({
  game: null,
  resources: [],
  state: null,
  issues: [],
  saveSlots: loadSaveSlots(),
  loadGameFile: async (file) => {
    const { game, resources } = await openGameFile(file);
    const issues = validateProject(game, resources.map((resource) => resource.path));
    set({ game, resources, state: createInitialRuntimeState(game), issues });
  },
  loadResourceFiles: (files) => {
    const game = get().game;
    if (!game) return;
    const images = [...files].filter((file) => file.type.startsWith("image/"));
    const resources: ResourceFile[] = images.map((file) => {
      const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      const path = normalizeLoadedResourcePath(relativePath);
      return { path, name: file.name, type: file.type, size: file.size, file, url: URL.createObjectURL(file) };
    });
    set({ resources, issues: validateProject(game, resources.map((resource) => resource.path)) });
  },
  start: () => {
    const { game, state } = get();
    if (game && state) set({ state: goForward(game, state) });
  },
  forward: () => {
    const { game, state } = get();
    if (game && state) set({ state: goForward(game, state) });
  },
  back: () => {
    const { state } = get();
    if (state) set({ state: goBack(state) });
  },
  chooseChoice: (choice) => {
    const { game, state } = get();
    if (game && state) set({ state: choose(game, state, choice) });
  },
  save: () => {
    const { game, state, saveSlots } = get();
    if (!game || !state) return;
    const slot: StoredSaveSlot = {
      id: crypto.randomUUID(),
      format: "vngine.save",
      version: 1,
      gameTitle: game.title,
      savedAt: new Date().toISOString(),
      state,
      game
    };
    const next = [slot, ...saveSlots].slice(0, 12);
    localStorage.setItem(saveKey, JSON.stringify(next));
    set({ saveSlots: next });
  },
  loadSave: (slot) => set({ game: slot.game, state: slot.state, resources: [], issues: validateProject(slot.game) }),
  deleteSave: (slotId) => {
    const next = get().saveSlots.filter((slot) => slot.id !== slotId);
    localStorage.setItem(saveKey, JSON.stringify(next));
    set({ saveSlots: next });
  }
}));

export function currentViewModel(game: VNgineGame | null, state: RuntimeState | null) {
  if (!game || !state) return { phrase: null, choices: [] };
  const phrase = getCurrentPhrase(game, state);
  return { phrase, choices: getVisibleChoices(phrase, state.blackboard) };
}

function loadSaveSlots(): StoredSaveSlot[] {
  try {
    const raw = localStorage.getItem(saveKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((slot) => slot.game).map((slot) => ({ ...saveSchema.parse(slot), id: slot.id ?? crypto.randomUUID(), game: slot.game }))
      : [];
  } catch {
    return [];
  }
}
