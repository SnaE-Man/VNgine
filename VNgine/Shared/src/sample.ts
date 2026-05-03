import type { VNgineProject } from "./types";

export const sampleProject: VNgineProject = {
  format: "vngine.project",
  version: 1,
  title: "Sample Branch",
  titleNodeId: "node_title",
  startNodeId: "node_start",
  resources: [],
  editor: {
    selectedNodeId: "node_start",
    selectedPhraseId: "phrase_1",
    map: { zoom: 1, pan: { x: 0, y: 0 } }
  },
  nodes: [
    {
      id: "node_title",
      kind: "title",
      title: "Title Screen",
      position: { x: 0, y: 0 },
      titleScreen: { displayTitle: "Sample Branch", subtitle: "A tiny VNgine story" },
      phrases: []
    },
    {
      id: "node_start",
      kind: "story",
      title: "Crossroads",
      position: { x: 320, y: 120 },
      phrases: [
        {
          id: "phrase_1",
          speaker: "Narrator",
          text: "The path splits under a silver morning.",
          effects: [{ id: "effect_1", key: "courage", operation: "increment", value: 1 }],
          choices: [
            { id: "choice_left", text: "Take the forest road", targetNodeId: "node_forest", conditions: [] },
            { id: "choice_right", text: "Enter the old gate", targetNodeId: "node_gate", conditions: [{ id: "cond_1", key: "courage", operator: "gte", value: 1 }] }
          ]
        }
      ]
    },
    {
      id: "node_forest",
      kind: "story",
      title: "Forest Road",
      position: { x: 700, y: 20 },
      phrases: [{ id: "phrase_2", speaker: "Narrator", text: "Leaves close behind you. This ending is quiet.", effects: [], choices: [] }]
    },
    {
      id: "node_gate",
      kind: "story",
      title: "Old Gate",
      position: { x: 700, y: 220 },
      phrases: [{ id: "phrase_3", speaker: "Gatekeeper", text: "Brave enough. Come through.", effects: [], choices: [] }]
    }
  ]
};
