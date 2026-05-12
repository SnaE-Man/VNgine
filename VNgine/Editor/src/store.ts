import { create } from "zustand";
import {
  createId,
  createNewProject,
  exportGameZip,
  exportProjectZip,
  insertPhraseNear,
  moveItemByDirection,
  parseImportedPhrases,
  projectToGame,
  reorderItemsByIds,
  sampleProject,
  serializeJson,
  splitNodeAtPhrase,
  validateProject,
  type Choice,
  type ChoiceCondition,
  type PersistentEffect,
  type Phrase,
  type ResourceFile,
  type VNgineProject,
  type VNNode,
  type ValidationIssue
} from "@vngine/shared";

type EditorStore = {
  project: VNgineProject;
  resources: ResourceFile[];
  resourceFilter: string;
  resourceSize: number;
  selectedResourcePath: string | null;
  issues: ValidationIssue[];
  importOpen: boolean;
  missingOpen: boolean;
  setProject: (project: VNgineProject, resources?: ResourceFile[]) => void;
  setTitle: (title: string) => void;
  selectNode: (nodeId: string) => void;
  selectPhrase: (phraseId: string | null) => void;
  addNode: () => void;
  updateNodeTitle: (nodeId: string, title: string) => void;
  moveNode: (nodeId: string, direction: "up" | "down") => void;
  reorderNodes: (orderedNodeIds: string[]) => void;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  autoOrganize: () => void;
  updateTitleScreen: (patch: Partial<NonNullable<VNNode["titleScreen"]>>) => void;
  addPhrase: () => void;
  insertPhrase: (phraseId: string | null, position: "above" | "below") => void;
  movePhrase: (phraseId: string, direction: "up" | "down") => void;
  reorderPhrases: (nodeId: string, orderedPhraseIds: string[]) => void;
  splitNode: (phraseId: string) => void;
  updatePhrase: (phraseId: string, patch: Partial<Phrase>) => void;
  deletePhrase: (phraseId: string) => void;
  addEffect: (phraseId: string) => void;
  updateEffect: (phraseId: string, effectId: string, patch: Partial<PersistentEffect>) => void;
  deleteEffect: (phraseId: string, effectId: string) => void;
  addChoice: (phraseId: string) => void;
  updateChoice: (phraseId: string, choiceId: string, patch: Partial<Choice>) => void;
  deleteChoice: (phraseId: string, choiceId: string) => void;
  addCondition: (phraseId: string, choiceId: string) => void;
  updateCondition: (phraseId: string, choiceId: string, conditionId: string, patch: Partial<ChoiceCondition>) => void;
  deleteCondition: (phraseId: string, choiceId: string, conditionId: string) => void;
  appendImportedText: (text: string) => void;
  setResources: (resources: ResourceFile[]) => void;
  setResourceFilter: (filter: string) => void;
  setResourceSize: (size: number) => void;
  setSelectedResourcePath: (path: string | null) => void;
  applySelectedResource: () => void;
  validate: () => ValidationIssue[];
  exportLeanProject: () => void;
  exportFullProject: () => Promise<void>;
  exportLeanGame: () => void;
  exportFullGame: () => Promise<void>;
  playFromSelectedNode: () => void;
  setImportOpen: (open: boolean) => void;
  setMissingOpen: (open: boolean) => void;
  loadSample: () => void;
};

const draftKey = "vngine.editor.draft";
const initialProject = loadDraft() ?? createNewProject();

export const useEditorStore = create<EditorStore>((set, get) => ({
  project: initialProject,
  resources: [],
  resourceFilter: "",
  resourceSize: 96,
  selectedResourcePath: null,
  issues: validateProject(initialProject),
  importOpen: false,
  missingOpen: false,
  setProject: (project, resources = []) => setAndPersist(set, { project, resources, issues: validateProject(project, resources.map((r) => r.path)) }),
  setTitle: (title) => mutateProject(set, get, (project) => {
    project.title = title;
    const titleNode = project.nodes.find((node) => node.id === project.titleNodeId);
    if (titleNode?.titleScreen) titleNode.titleScreen.displayTitle = title;
  }),
  selectNode: (nodeId) => mutateProject(set, get, (project) => {
    project.editor.selectedNodeId = nodeId;
    project.editor.selectedPhraseId = null;
  }),
  selectPhrase: (phraseId) => mutateProject(set, get, (project) => {
    project.editor.selectedPhraseId = phraseId;
  }),
  addNode: () => mutateProject(set, get, (project) => {
    const storyCount = project.nodes.filter((node) => node.kind === "story").length + 1;
    const node: VNNode = {
      id: createId("node"),
      kind: "story",
      title: `Node ${storyCount}`,
      position: { x: 280 + storyCount * 80, y: 160 + storyCount * 40 },
      phrases: []
    };
    project.nodes.push(node);
    project.startNodeId ??= node.id;
    project.editor.selectedNodeId = node.id;
  }),
  updateNodeTitle: (nodeId, title) => mutateProject(set, get, (project) => {
    const node = project.nodes.find((candidate) => candidate.id === nodeId);
    if (node && node.kind === "story") node.title = title;
  }),
  moveNode: (nodeId, direction) => mutateProject(set, get, (project) => {
    const titleNode = project.nodes.find((node) => node.kind === "title");
    const storyNodes = project.nodes.filter((node) => node.kind === "story");
    project.nodes = [titleNode, ...moveItemByDirection(storyNodes, nodeId, direction)].filter((node): node is VNNode => Boolean(node));
  }),
  reorderNodes: (orderedNodeIds) => mutateProject(set, get, (project) => {
    const titleNode = project.nodes.find((node) => node.kind === "title");
    const storyNodes = project.nodes.filter((node) => node.kind === "story");
    project.nodes = [titleNode, ...reorderItemsByIds(storyNodes, orderedNodeIds)].filter((node): node is VNNode => Boolean(node));
  }),
  updateNodePosition: (nodeId, position) => mutateProject(set, get, (project) => {
    const node = project.nodes.find((candidate) => candidate.id === nodeId);
    if (node) node.position = position;
  }),
  autoOrganize: () => mutateProject(set, get, (project) => {
    project.nodes.forEach((node, index) => {
      node.position = { x: (index % 4) * 300, y: Math.floor(index / 4) * 210 };
    });
  }),
  updateTitleScreen: (patch) => mutateProject(set, get, (project) => {
    const node = project.nodes.find((candidate) => candidate.id === project.titleNodeId);
    if (node) node.titleScreen = { displayTitle: project.title, ...node.titleScreen, ...patch };
  }),
  addPhrase: () => mutateProject(set, get, (project) => {
    const node = selectedNode(project);
    if (!node || node.kind !== "story") return;
    const phrase = blankPhrase();
    node.phrases.push(phrase);
    project.editor.selectedPhraseId = phrase.id;
  }),
  insertPhrase: (phraseId, position) => mutateProject(set, get, (project) => {
    const node = selectedNode(project);
    if (!node || node.kind !== "story") return;
    const phrase = blankPhrase();
    node.phrases = insertPhraseNear(node.phrases, phraseId, position, phrase);
    project.editor.selectedPhraseId = phrase.id;
  }),
  movePhrase: (phraseId, direction) => mutateProject(set, get, (project) => {
    for (const node of project.nodes) {
      if (node.kind === "story" && node.phrases.some((phrase) => phrase.id === phraseId)) {
        node.phrases = moveItemByDirection(node.phrases, phraseId, direction);
        project.editor.selectedPhraseId = phraseId;
        break;
      }
    }
  }),
  reorderPhrases: (nodeId, orderedPhraseIds) => mutateProject(set, get, (project) => {
    const node = project.nodes.find((candidate) => candidate.id === nodeId);
    if (node?.kind === "story") node.phrases = reorderItemsByIds(node.phrases, orderedPhraseIds);
  }),
  splitNode: (phraseId) => mutateProject(set, get, (project) => {
    const nodeIndex = project.nodes.findIndex((node) => node.kind === "story" && node.phrases.some((phrase) => phrase.id === phraseId));
    const node = project.nodes[nodeIndex];
    if (!node) return;
    const result = splitNodeAtPhrase(node, phraseId, createId("node"), createId("choice"));
    if (!result) return;
    project.nodes.splice(nodeIndex, 1, result.original, result.created);
    project.editor.selectedNodeId = result.created.id;
    project.editor.selectedPhraseId = phraseId;
  }),
  updatePhrase: (phraseId, patch) => mutateSelectedPhrase(set, get, phraseId, (phrase) => Object.assign(phrase, patch)),
  deletePhrase: (phraseId) => mutateProject(set, get, (project) => {
    for (const node of project.nodes) node.phrases = node.phrases.filter((phrase) => phrase.id !== phraseId);
    if (project.editor.selectedPhraseId === phraseId) project.editor.selectedPhraseId = null;
  }),
  addEffect: (phraseId) => mutateSelectedPhrase(set, get, phraseId, (phrase) => {
    phrase.effects.push({ id: createId("effect"), key: "flag", operation: "set", value: "true" });
  }),
  updateEffect: (phraseId, effectId, patch) => mutateSelectedPhrase(set, get, phraseId, (phrase) => {
    const effect = phrase.effects.find((candidate) => candidate.id === effectId);
    if (effect) Object.assign(effect, patch);
  }),
  deleteEffect: (phraseId, effectId) => mutateSelectedPhrase(set, get, phraseId, (phrase) => {
    phrase.effects = phrase.effects.filter((effect) => effect.id !== effectId);
  }),
  addChoice: (phraseId) => mutateSelectedPhrase(set, get, phraseId, (phrase) => {
    phrase.choices.push({ id: createId("choice"), text: "Choice", targetNodeId: null, conditions: [] });
  }),
  updateChoice: (phraseId, choiceId, patch) => mutateSelectedPhrase(set, get, phraseId, (phrase) => {
    const choice = phrase.choices.find((candidate) => candidate.id === choiceId);
    if (choice) Object.assign(choice, patch);
  }),
  deleteChoice: (phraseId, choiceId) => mutateSelectedPhrase(set, get, phraseId, (phrase) => {
    phrase.choices = phrase.choices.filter((choice) => choice.id !== choiceId);
  }),
  addCondition: (phraseId, choiceId) => mutateSelectedPhrase(set, get, phraseId, (phrase) => {
    const choice = phrase.choices.find((candidate) => candidate.id === choiceId);
    choice?.conditions.push({ id: createId("condition"), key: "flag", operator: "exists" });
  }),
  updateCondition: (phraseId, choiceId, conditionId, patch) => mutateSelectedPhrase(set, get, phraseId, (phrase) => {
    const condition = phrase.choices.find((choice) => choice.id === choiceId)?.conditions.find((candidate) => candidate.id === conditionId);
    if (condition) Object.assign(condition, patch);
  }),
  deleteCondition: (phraseId, choiceId, conditionId) => mutateSelectedPhrase(set, get, phraseId, (phrase) => {
    const choice = phrase.choices.find((candidate) => candidate.id === choiceId);
    if (choice) choice.conditions = choice.conditions.filter((condition) => condition.id !== conditionId);
  }),
  appendImportedText: (text) => mutateProject(set, get, (project) => {
    const node = selectedNode(project);
    if (!node || node.kind !== "story") return;
    node.phrases.push(...parseImportedPhrases(text, createId));
    project.editor.selectedPhraseId = node.phrases.at(-1)?.id ?? null;
  }),
  setResources: (resources) => {
    const project = { ...get().project, resources: resources.map(({ path, name, type, size }) => ({ path, name, type, size })) };
    setAndPersist(set, { project, resources, issues: validateProject(project, resources.map((resource) => resource.path)), missingOpen: true });
  },
  setResourceFilter: (resourceFilter) => set({ resourceFilter }),
  setResourceSize: (resourceSize) => set({ resourceSize }),
  setSelectedResourcePath: (selectedResourcePath) => set({ selectedResourcePath }),
  applySelectedResource: () => mutateProject(set, get, (project) => {
    const path = get().selectedResourcePath;
    if (!path) return;
    const node = selectedNode(project);
    const phrase = selectedPhrase(project);
    if (phrase) phrase.image = { path };
    else if (node?.kind === "title") node.titleScreen = { displayTitle: project.title, ...node.titleScreen, image: { path } };
  }),
  validate: () => {
    const issues = validateProject(get().project, get().resources.map((resource) => resource.path));
    set({ issues, missingOpen: issues.some((issue) => issue.message.startsWith("Missing resource")) });
    return issues;
  },
  exportLeanProject: () => download(serializeJson(get().project), `${safeName(get().project.title)}.vngproj`),
  exportFullProject: async () => download(await exportProjectZip(get().project, get().resources), `${safeName(get().project.title)}.vngproj.zip`),
  exportLeanGame: () => download(serializeJson(projectToGame(get().project)), `${safeName(get().project.title)}.vngame`),
  exportFullGame: async () => download(await exportGameZip(projectToGame(get().project), get().resources), `${safeName(get().project.title)}.vngame.zip`),
  playFromSelectedNode: () => {
    const { project, resources } = get();
    const selected = selectedNode(project);
    if (!selected || selected.kind !== "story") return;
    const game = { ...projectToGame(project), startNodeId: selected.id };
    const payload = {
      type: "vngine.preview",
      game,
      resources: resources.map(({ path, name, type, size, file }) => ({ path, name, type, size, file }))
    };
    const previewUrl = resolveEnginePreviewUrl();
    const preview = window.open(previewUrl, "vngine-preview");
    if (!preview) return;
    const send = () => preview.postMessage(payload, new URL(previewUrl).origin);
    setTimeout(send, 250);
    setTimeout(send, 750);
    setTimeout(send, 1500);
  },
  setImportOpen: (importOpen) => set({ importOpen }),
  setMissingOpen: (missingOpen) => set({ missingOpen }),
  loadSample: () => setAndPersist(set, { project: sampleProject, issues: validateProject(sampleProject), resources: [] })
}));

function selectedNode(project: VNgineProject) {
  return project.nodes.find((node) => node.id === project.editor.selectedNodeId);
}

function selectedPhrase(project: VNgineProject) {
  return project.nodes.flatMap((node) => node.phrases).find((phrase) => phrase.id === project.editor.selectedPhraseId);
}

function blankPhrase(): Phrase {
  return { id: createId("phrase"), speaker: "Narrator", text: "", effects: [], choices: [] };
}

function mutateSelectedPhrase(set: (state: Partial<EditorStore>) => void, get: () => EditorStore, phraseId: string, mutator: (phrase: Phrase) => void) {
  mutateProject(set, get, (project) => {
    const phrase = project.nodes.flatMap((node) => node.phrases).find((candidate) => candidate.id === phraseId);
    if (phrase) mutator(phrase);
  });
}

function mutateProject(set: (state: Partial<EditorStore>) => void, get: () => EditorStore, mutator: (project: VNgineProject) => void) {
  const project = structuredClone(get().project);
  mutator(project);
  setAndPersist(set, { project, issues: validateProject(project, get().resources.map((resource) => resource.path)) });
}

function setAndPersist(set: (state: Partial<EditorStore>) => void, state: Partial<EditorStore>) {
  if (state.project) localStorage.setItem(draftKey, JSON.stringify(state.project));
  set(state);
}

function loadDraft(): VNgineProject | null {
  try {
    const raw = localStorage.getItem(draftKey);
    return raw ? (JSON.parse(raw) as VNgineProject) : null;
  } catch {
    return null;
  }
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function safeName(name: string) {
  return name.trim().replace(/[^a-z0-9_-]+/gi, "_") || "vngine";
}

function resolveEnginePreviewUrl(): string {
  const { origin, hostname, port, pathname } = window.location;
  if ((hostname === "127.0.0.1" || hostname === "localhost") && port === "5173") {
    return "http://127.0.0.1:5174/?preview=1";
  }
  if (pathname.includes("/editor/")) {
    return new URL("../engine/?preview=1", window.location.href).toString();
  }
  return `${origin}/engine/?preview=1`;
}
