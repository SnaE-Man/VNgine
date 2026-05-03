import type { ChoiceCondition, VNgineGame, VNgineProject, VNNode, ValidationIssue } from "./types";

const numericOps = new Set(["gt", "gte", "lt", "lte"]);

export function collectResourceRefs(nodes: VNNode[]): string[] {
  const refs = new Set<string>();
  for (const node of nodes) {
    if (node.titleScreen?.image?.path) refs.add(node.titleScreen.image.path);
    for (const phrase of node.phrases) {
      if (phrase.image?.path) refs.add(phrase.image.path);
    }
  }
  return [...refs].sort();
}

export function findMissingResources(nodes: VNNode[], availablePaths: string[]): string[] {
  const available = new Set(availablePaths.map(normalizePath));
  return collectResourceRefs(nodes).filter((path) => !available.has(normalizePath(path)));
}

export function validateProject(project: VNgineProject | VNgineGame, availableResourcePaths?: string[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const titleNodes = project.nodes.filter((node) => node.kind === "title");
  const storyNodes = project.nodes.filter((node) => node.kind === "story");
  const nodeIds = new Set(project.nodes.map((node) => node.id));
  const storyNodeIds = new Set(storyNodes.map((node) => node.id));

  if (titleNodes.length !== 1) {
    issues.push({ severity: "error", message: "Project must contain exactly one title node." });
  }

  const titleNode = project.nodes.find((node) => node.id === project.titleNodeId);
  if (!titleNode || titleNode.kind !== "title") {
    issues.push({ severity: "error", message: "titleNodeId must point to the title node.", path: "titleNodeId" });
  }

  for (const node of titleNodes) {
    if (node.phrases.length > 0) {
      issues.push({ severity: "error", message: `Title node "${node.title}" cannot contain story phrases.`, path: node.id });
    }
  }

  if (project.startNodeId && !storyNodeIds.has(project.startNodeId)) {
    issues.push({ severity: "error", message: "startNodeId must point to a story node.", path: "startNodeId" });
  }

  for (const node of project.nodes) {
    if (node.kind === "story" && node.phrases.length === 0) {
      issues.push({ severity: "warning", message: `Story node "${node.title}" has no phrases.`, path: node.id });
    }
    node.phrases.forEach((phrase, phraseIndex) => {
      if (phrase.choices.length > 0 && phraseIndex !== node.phrases.length - 1) {
        issues.push({ severity: "warning", message: `Node "${node.title}" has choices before the final phrase.`, path: phrase.id });
      }
      for (const effect of phrase.effects) {
        if (!effect.key.trim()) {
          issues.push({ severity: "error", message: "Effects require a non-empty key.", path: effect.id });
        }
        if (effect.operation === "increment" && typeof effect.value !== "number") {
          issues.push({ severity: "error", message: `Increment effect "${effect.key}" requires a numeric value.`, path: effect.id });
        }
      }
      for (const choice of phrase.choices) {
        if (choice.targetNodeId && !nodeIds.has(choice.targetNodeId)) {
          issues.push({ severity: "error", message: `Choice "${choice.text || choice.id}" targets a missing node.`, path: choice.id });
        }
        for (const condition of choice.conditions) {
          validateCondition(condition, issues);
        }
      }
    });
  }

  if (availableResourcePaths) {
    for (const missing of findMissingResources(project.nodes, availableResourcePaths)) {
      issues.push({ severity: "warning", message: `Missing resource: ${missing}`, path: missing });
    }
  }

  return issues;
}

function validateCondition(condition: ChoiceCondition, issues: ValidationIssue[]) {
  if (!condition.key.trim()) {
    issues.push({ severity: "error", message: "Choice conditions require a non-empty key.", path: condition.id });
  }
  if (numericOps.has(condition.operator) && typeof condition.value !== "number") {
    issues.push({ severity: "error", message: `Condition "${condition.key}" requires a numeric value.`, path: condition.id });
  }
}

function normalizePath(path: string) {
  return path.replaceAll("\\", "/");
}
