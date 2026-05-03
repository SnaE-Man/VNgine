import { z } from "zod";

const resourceRefSchema = z.object({ path: z.string().min(1) });
const resourceAssetSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  size: z.number().optional()
});

const effectSchema = z.object({
  id: z.string().min(1),
  key: z.string(),
  operation: z.enum(["set", "increment", "append"]),
  value: z.union([z.string(), z.number()])
});

const conditionSchema = z.object({
  id: z.string().min(1),
  key: z.string(),
  operator: z.enum(["exists", "notExists", "eq", "neq", "gt", "gte", "lt", "lte"]),
  value: z.union([z.string(), z.number()]).optional()
});

const choiceSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  targetNodeId: z.string().nullable(),
  conditions: z.array(conditionSchema)
});

const phraseSchema = z.object({
  id: z.string().min(1),
  speaker: z.string(),
  text: z.string(),
  image: resourceRefSchema.optional(),
  effects: z.array(effectSchema),
  choices: z.array(choiceSchema)
});

const nodeSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["title", "story"]),
  title: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  titleScreen: z
    .object({
      displayTitle: z.string(),
      subtitle: z.string().optional(),
      image: resourceRefSchema.optional()
    })
    .optional(),
  phrases: z.array(phraseSchema)
});

export const projectSchema = z.object({
  format: z.literal("vngine.project"),
  version: z.literal(1),
  title: z.string(),
  titleNodeId: z.string(),
  startNodeId: z.string().nullable(),
  nodes: z.array(nodeSchema),
  resources: z.array(resourceAssetSchema),
  editor: z.object({
    selectedNodeId: z.string().nullable(),
    selectedPhraseId: z.string().nullable(),
    map: z.object({
      zoom: z.number(),
      pan: z.object({ x: z.number(), y: z.number() })
    })
  })
});

export const gameSchema = z.object({
  format: z.literal("vngine.game"),
  version: z.literal(1),
  title: z.string(),
  titleNodeId: z.string(),
  startNodeId: z.string().nullable(),
  nodes: z.array(nodeSchema),
  resources: z.array(resourceAssetSchema)
});

export const saveSchema = z.object({
  format: z.literal("vngine.save"),
  version: z.literal(1),
  gameTitle: z.string(),
  savedAt: z.string(),
  state: z.object({
    nodeId: z.string().nullable(),
    phraseIndex: z.number(),
    imagePath: z.string().nullable(),
    blackboard: z.record(z.string(), z.union([z.string(), z.number()])),
    mode: z.enum(["title", "story", "ending"]),
    history: z.array(
      z.object({
        nodeId: z.string().nullable(),
        phraseIndex: z.number(),
        imagePath: z.string().nullable(),
        blackboard: z.record(z.string(), z.union([z.string(), z.number()])),
        mode: z.enum(["title", "story", "ending"])
      })
    )
  })
});
