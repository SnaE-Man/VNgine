export type ResourceRef = {
  path: string;
};

export type ResourceAsset = {
  path: string;
  name: string;
  type: string;
  size?: number;
};

export type EditorStateSnapshot = {
  selectedNodeId: string | null;
  selectedPhraseId: string | null;
  map: {
    zoom: number;
    pan: { x: number; y: number };
  };
};

export type BlackboardValue = string | number;
export type Blackboard = Record<string, BlackboardValue>;

export type PersistentEffect = {
  id: string;
  key: string;
  operation: "set" | "increment" | "append";
  value: BlackboardValue;
};

export type ChoiceCondition = {
  id: string;
  key: string;
  operator: "exists" | "notExists" | "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
  value?: BlackboardValue;
};

export type Choice = {
  id: string;
  text: string;
  targetNodeId: string | null;
  conditions: ChoiceCondition[];
};

export type Phrase = {
  id: string;
  speaker: string;
  text: string;
  image?: ResourceRef;
  effects: PersistentEffect[];
  choices: Choice[];
};

export type VNNode = {
  id: string;
  kind: "title" | "story";
  title: string;
  position: { x: number; y: number };
  titleScreen?: {
    displayTitle: string;
    subtitle?: string;
    image?: ResourceRef;
  };
  phrases: Phrase[];
};

export type RuntimeNode = VNNode;

export type VNgineProject = {
  format: "vngine.project";
  version: 1;
  title: string;
  titleNodeId: string;
  startNodeId: string | null;
  nodes: VNNode[];
  resources: ResourceAsset[];
  editor: EditorStateSnapshot;
};

export type VNgineGame = {
  format: "vngine.game";
  version: 1;
  title: string;
  titleNodeId: string;
  startNodeId: string | null;
  nodes: RuntimeNode[];
  resources: ResourceAsset[];
};

export type RuntimeSnapshot = {
  nodeId: string | null;
  phraseIndex: number;
  imagePath: string | null;
  blackboard: Blackboard;
  mode: "title" | "story" | "ending";
};

export type RuntimeState = RuntimeSnapshot & {
  history: RuntimeSnapshot[];
};

export type VNgineSave = {
  format: "vngine.save";
  version: 1;
  gameTitle: string;
  savedAt: string;
  state: RuntimeState;
};

export type ValidationIssue = {
  severity: "error" | "warning";
  message: string;
  path?: string;
};
