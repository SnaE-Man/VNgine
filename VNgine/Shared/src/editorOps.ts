import type { Choice, Phrase, VNNode } from "./types";

export type Direction = "up" | "down";
export type InsertPosition = "above" | "below";

export function insertPhraseNear(phrases: Phrase[], anchorPhraseId: string | null, position: InsertPosition, phrase: Phrase): Phrase[] {
  if (!anchorPhraseId) return [...phrases, phrase];
  const index = phrases.findIndex((candidate) => candidate.id === anchorPhraseId);
  if (index === -1) return [...phrases, phrase];
  const insertIndex = position === "above" ? index : index + 1;
  return [...phrases.slice(0, insertIndex), phrase, ...phrases.slice(insertIndex)];
}

export function moveItemByDirection<T extends { id: string }>(items: T[], itemId: string, direction: Direction): T[] {
  const index = items.findIndex((item) => item.id === itemId);
  if (index === -1) return items;
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= items.length) return items;
  const next = [...items];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}

export function reorderItemsByIds<T extends { id: string }>(items: T[], orderedIds: string[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered = orderedIds.map((id) => byId.get(id)).filter((item): item is T => Boolean(item));
  const orderedSet = new Set(ordered.map((item) => item.id));
  return [...ordered, ...items.filter((item) => !orderedSet.has(item.id))];
}

export function splitNodeAtPhrase(node: VNNode, phraseId: string, newNodeId: string, continueChoiceId: string): { original: VNNode; created: VNNode } | null {
  if (node.kind !== "story") return null;
  const index = node.phrases.findIndex((phrase) => phrase.id === phraseId);
  if (index <= 0) return null;

  const originalPhrases = node.phrases.slice(0, index);
  const createdPhrases = node.phrases.slice(index);
  const createdNode: VNNode = {
    id: newNodeId,
    kind: "story",
    title: `${node.title} - continued`,
    position: { x: node.position.x + 260, y: node.position.y + 140 },
    phrases: createdPhrases
  };

  const lastOriginalPhrase = originalPhrases[originalPhrases.length - 1];
  const continueChoice: Choice = {
    id: continueChoiceId,
    text: "Continue",
    targetNodeId: newNodeId,
    conditions: []
  };
  lastOriginalPhrase.choices = [...lastOriginalPhrase.choices, continueChoice];

  return {
    original: { ...node, phrases: originalPhrases },
    created: createdNode
  };
}
