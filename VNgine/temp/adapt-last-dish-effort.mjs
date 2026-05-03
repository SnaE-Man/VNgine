import fs from "node:fs/promises";
import path from "node:path";

const tempDir = new URL(".", import.meta.url);
const twinePath = new URL("Last Dish Effort- open with twine.html", tempDir);
const roughPath = new URL("path_1_rough_2026_04_30.txt", tempDir);
const outPath = new URL("Last Dish Effort - adapted.vngproj", tempDir);
const notesPath = new URL("Last Dish Effort - adaptation notes.md", tempDir);

const twineHtml = await fs.readFile(twinePath, "utf8");
const roughLines = (await fs.readFile(roughPath, "utf8")).split(/\r?\n/);

const passages = parseTwine(twineHtml);
const idByName = new Map(passages.map((passage) => [passage.name, toNodeId(passage.name)]));
const titleNodeId = "node_title";

const contentRanges = new Map([
  ["1A. WOMAN AT RESTAURANT", [2, 76]],
  ["1B. LEAVE RESTAURANT; WALK INTO RAIN", [81, 109]],
  ["1C. GO BACK TO RESTAURANT", [114, 153]],
  ["1D. WARM UP IN KITCHEN; WET KISS IN KITCHEN", [154, 169]],
  ["1E. LEAN INTO WET KITCHEN KISS", [174, 183]],
  ["1F. KITCHEN SEX SCENE", [187, 228]],
  ["1G. GIVEN A RIDE", [234, 267]],
  ["1H. DRIVEN TO HER APARTMENT", [269, 287]],
  ["1I. INVITE UP; APARTMENT SEX SCENE", [291, 313]]
]);

const choiceTextOverrides = new Map([
  ["1A. WOMAN AT RESTAURANT", ["Leave before dessert", "Stay and flirt"]],
  ["1B. LEAVE RESTAURANT; WALK INTO RAIN", ["Keep walking", "Call Uber / go back for purse"]],
  ["2B. STAY AT RESTAURANT; FLIRT", ["Eat dessert and wait", "Go to the kitchen"]],
  ["1C. GO BACK TO RESTAURANT", ["Get purse and call Uber", "Warm up in the kitchen"]],
  ["1D. WARM UP IN KITCHEN; WET KISS IN KITCHEN", ["Lean into it", "Restraint"]],
  ["1G. GIVEN A RIDE", ["Let him drive you home", "Go to his apartment"]],
  ["1H. DRIVEN TO HER APARTMENT", ["Say goodnight", "Invite him up"]],
  ["1A. WAKE UP WITH WAITER AT HER APARTMENT", ["Let Michael leave before answering", "Let Michael stay while Todd knocks"]],
  ["1C. ANSWER DOOR; SEE EX", ["Invite Todd in", "Talk to Todd through the door"]],
  ["5D. WAITER LEAVES", ["Talk to Todd through the door", "Invite Todd in"]],
  ["1D. INVITE EX IN (EX DOESN'T KNOW ABOUT WAITER)", ["Give in to Todd", "Stay angry with Todd"]],
  ["5E. INVITE EX IN (EX KNOWS ABOUT WAITER)", ["Sympathetic conversation", "Angry conversation"]]
]);

const effectByNode = new Map([
  ["1B. LEAVE RESTAURANT; WALK INTO RAIN", { key: "restaurant_choice", value: "left" }],
  ["2B. STAY AT RESTAURANT; FLIRT", { key: "restaurant_choice", value: "stayed" }],
  ["3C. CONTINUE WALKING", { key: "rain_choice", value: "kept_walking" }],
  ["1C. GO BACK TO RESTAURANT", { key: "rain_choice", value: "returned_for_purse" }],
  ["4D. GET PURSE AND CALL UBER", { key: "chapter1_outcome", value: "happy_alone" }],
  ["3J. END ALONE AT APARTMENT; SAD", { key: "chapter1_outcome", value: "sad_alone" }],
  ["1F. KITCHEN SEX SCENE", { key: "waiter_intimacy", value: "kitchen" }],
  ["5D. RESTRAINT IN KITCHEN", { key: "waiter_intimacy", value: "restrained" }],
  ["7E. WET RESTRAINT IN KITCHEN", { key: "waiter_intimacy", value: "wet_restrained" }],
  ["1J. END AT HER APARTMENT WITH WAITER", { key: "chapter1_outcome", value: "waiter_her_apartment" }],
  ["8J. END AT HIS APARTMENT WITH WAITER", { key: "chapter1_outcome", value: "waiter_his_apartment" }]
]);

const titleNode = {
  id: titleNodeId,
  kind: "title",
  title: "Title Screen",
  position: { x: 0, y: 0 },
  titleScreen: {
    displayTitle: "Last Dish Effort",
    subtitle: "Adapted from Twine branch map and path_1 rough script"
  },
  phrases: []
};

const nodes = [
  titleNode,
  ...passages.map((passage) => makeNode(passage))
];

const project = {
  format: "vngine.project",
  version: 1,
  title: "Last Dish Effort",
  titleNodeId,
  startNodeId: idByName.get("1A. WOMAN AT RESTAURANT"),
  nodes,
  resources: [],
  editor: {
    selectedNodeId: idByName.get("1A. WOMAN AT RESTAURANT"),
    selectedPhraseId: null,
    map: { zoom: 0.6, pan: { x: 0, y: 0 } }
  }
};

const issues = validateProject(project);
const errors = issues.filter((issue) => issue.severity === "error");
if (errors.length > 0) {
  throw new Error(errors.map((issue) => issue.message).join("\n"));
}

await fs.writeFile(outPath, `${JSON.stringify(project, null, 2)}\n`, "utf8");
await fs.writeFile(notesPath, makeNotes(project, issues), "utf8");

console.log(`Wrote ${path.basename(outPath.pathname)} with ${nodes.length} nodes.`);
console.log(`Validation: ${issues.length} issue(s), ${errors.length} error(s).`);

function parseTwine(html) {
  const passages = [];
  const regex = /<tw-passagedata\b([^>]*)>([\s\S]*?)<\/tw-passagedata>/g;
  let match;
  while ((match = regex.exec(html))) {
    const attrs = Object.fromEntries([...match[1].matchAll(/(\w+)="([^"]*)"/g)].map((attr) => [attr[1], decode(attr[2])]));
    const text = decode(match[2]).trim();
    const links = [...text.matchAll(/\[\[([^\]]+)]]/g)].map((link) => link[1].trim());
    const [x, y] = (attrs.position || "0,0").split(",").map(Number);
    passages.push({
      pid: attrs.pid,
      name: attrs.name,
      tags: attrs.tags,
      position: { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 },
      body: text,
      links
    });
  }
  return passages;
}

function makeNode(passage) {
  const phrases = contentRanges.has(passage.name)
    ? parsePhrases(linesForRange(contentRanges.get(passage.name)))
    : [placeholderPhrase(passage)];

  const effect = effectByNode.get(passage.name);
  if (effect && phrases[0]) {
    phrases[0].effects.push({
      id: `effect_${toSlug(passage.name)}`,
      key: effect.key,
      operation: "set",
      value: effect.value
    });
  }

  if (passage.links.length > 0) {
    phrases[phrases.length - 1].choices = passage.links.map((link, index) => ({
      id: `choice_${toSlug(passage.name)}_${index + 1}`,
      text: choiceText(passage.name, link, index, passage.links.length),
      targetNodeId: idByName.get(link) ?? null,
      conditions: []
    }));
  }

  return {
    id: toNodeId(passage.name),
    kind: "story",
    title: passage.name,
    position: passage.position,
    phrases
  };
}

function parsePhrases(lines) {
  const phrases = [];
  let speaker = "Narrator";
  let buffer = [];
  const knownSpeakers = new Set(["DIANA", "MICHAEL", "TODD", "SAMMY"]);
  const selectedOptions = new Set(["LEAVE", "CALL UBER", "LEAN INTO IT", "INVITE HIM UP"]);

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, "  ");
    const trimmed = line.trim();
    if (!trimmed || isMarker(trimmed) || selectedOptions.has(trimmed)) {
      flush();
      continue;
    }
    if (knownSpeakers.has(trimmed)) {
      flush();
      speaker = titleCase(trimmed);
      continue;
    }
    buffer.push(trimmed);
  }
  flush();
  return phrases;

  function flush() {
    const text = buffer.join("\n").trim();
    if (text) {
      phrases.push({
        id: `phrase_${String(phrases.length + 1).padStart(3, "0")}_${toSlug(text).slice(0, 18)}`,
        speaker,
        text,
        effects: [],
        choices: []
      });
    }
    buffer = [];
    speaker = "Narrator";
  }
}

function placeholderPhrase(passage) {
  const bodyWithoutLinks = passage.body.replace(/\[\[[^\]]+]]/g, "").trim();
  const text = bodyWithoutLinks && bodyWithoutLinks !== "Double-click this passage to edit it."
    ? `Outline note: ${bodyWithoutLinks}`
    : `TODO: Draft scene content for "${passage.name}".`;
  return {
    id: `phrase_placeholder_${toSlug(passage.name)}`,
    speaker: "Narrator",
    text,
    effects: [],
    choices: []
  };
}

function choiceText(sourceName, targetName, index, total) {
  const overrides = choiceTextOverrides.get(sourceName);
  if (overrides?.[index]) return overrides[index];
  if (total === 1) return "Continue";
  return stripPrefix(targetName);
}

function linesForRange([start, end]) {
  return roughLines.slice(start - 1, end);
}

function isMarker(text) {
  return /^-+>/.test(text) || /^-+\[/.test(text);
}

function stripPrefix(name) {
  return name.replace(/^\d+[A-Z]\.\s*/, "").replace(/\s+/g, " ").trim();
}

function toNodeId(name) {
  return `node_${toSlug(name)}`;
}

function toSlug(value) {
  return value
    .toLowerCase()
    .replace(/&[^;]+;/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

function titleCase(value) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function decode(value) {
  return value
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function makeNotes(project, issues) {
  const authoredNodes = [...contentRanges.keys()];
  const placeholderCount = project.nodes.filter((node) => node.kind === "story" && node.phrases.some((phrase) => phrase.id.startsWith("phrase_placeholder"))).length;
  return `# Last Dish Effort Adaptation Notes

Generated from:

- Last Dish Effort- open with twine.html
- path_1_rough_2026_04_30.txt

## Adaptation choices

- Preserved the Twine passage graph as VNgine story nodes, including original node titles and map positions.
- Filled the written route from the rough script into the matching Twine nodes.
- Left unwritten branches as TODO placeholder phrases so the graph remains playable and editable.
- Added simple route-tracking effects on major branch/result nodes.
- Did not invent missing branch prose or images.

## Rough script mapped into nodes

${authoredNodes.map((name) => `- ${name}`).join("\n")}

## Remaining authoring work

- ${placeholderCount} story nodes still contain placeholder prose.
- Images are not assigned yet; load a resource folder in the editor and apply images phrase by phrase.
- Choice conditions were not inferred from the Twine file; the current graph uses direct branches.

## Validation

${issues.length === 0 ? "- No validation issues." : issues.map((issue) => `- ${issue.severity.toUpperCase()}: ${issue.message}`).join("\n")}
`;
}

function validateProject(project) {
  const issues = [];
  const titleNodes = project.nodes.filter((node) => node.kind === "title");
  const nodeIds = new Set(project.nodes.map((node) => node.id));
  const storyNodeIds = new Set(project.nodes.filter((node) => node.kind === "story").map((node) => node.id));
  if (titleNodes.length !== 1) issues.push({ severity: "error", message: "Project must contain exactly one title node." });
  if (!storyNodeIds.has(project.startNodeId)) issues.push({ severity: "error", message: "startNodeId must point to a story node." });
  for (const node of project.nodes) {
    if (node.kind === "title" && node.phrases.length > 0) {
      issues.push({ severity: "error", message: `Title node "${node.title}" cannot contain story phrases.` });
    }
    for (const phrase of node.phrases) {
      for (const choice of phrase.choices) {
        if (choice.targetNodeId && !nodeIds.has(choice.targetNodeId)) {
          issues.push({ severity: "error", message: `Choice "${choice.text}" targets a missing node.` });
        }
      }
    }
  }
  return issues;
}
