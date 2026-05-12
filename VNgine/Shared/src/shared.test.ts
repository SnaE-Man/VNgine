import { describe, expect, it } from "vitest";
import { applyEffects, createInitialRuntimeState, evaluateCondition, goBack, goForward, insertPhraseNear, moveItemByDirection, normalizeLoadedResourcePath, parseImportedPhrases, projectSchema, projectToGame, reorderItemsByIds, sampleProject, splitNodeAtPhrase, validateProject, type Phrase, type VNNode } from "./index";

describe("schemas and validation", () => {
  it("accepts the sample project", () => {
    expect(projectSchema.parse(sampleProject).title).toBe("Sample Branch");
    expect(validateProject(sampleProject).filter((issue) => issue.severity === "error")).toHaveLength(0);
  });

  it("exports a lean runtime game", () => {
    const game = projectToGame(sampleProject);
    expect(game.format).toBe("vngine.game");
    expect("editor" in game).toBe(false);
  });
});

describe("import parser", () => {
  it("splits blank-line phrases and extracts speakers", () => {
    const phrases = parseImportedPhrases("[john] Hello\nthere.\n\nA narrator line.", (prefix) => `${prefix}_x`);
    expect(phrases).toHaveLength(2);
    expect(phrases[0].speaker).toBe("john");
    expect(phrases[0].text).toBe("Hello\nthere.");
    expect(phrases[1].speaker).toBe("Narrator");
  });
});

describe("resource paths", () => {
  it("normalizes resource folders from directory pickers and unzipped packages", () => {
    expect(normalizeLoadedResourcePath("Resource/Backgrounds/core_path_002.jpg")).toBe("Backgrounds/core_path_002.jpg");
    expect(normalizeLoadedResourcePath("resources/Backgrounds/core_path_002.jpg")).toBe("Backgrounds/core_path_002.jpg");
    expect(normalizeLoadedResourcePath("Last Dish/resources/Backgrounds/core_path_002.jpg")).toBe("Backgrounds/core_path_002.jpg");
    expect(normalizeLoadedResourcePath("Backgrounds\\core_path_002.jpg")).toBe("Backgrounds/core_path_002.jpg");
  });
});

describe("runtime helpers", () => {
  it("applies effects", () => {
    expect(applyEffects({}, [{ id: "e", key: "score", operation: "increment", value: 2 }]).score).toBe(2);
  });

  it("evaluates conditions", () => {
    expect(evaluateCondition({ id: "c", key: "score", operator: "gte", value: 2 }, { score: 3 })).toBe(true);
    expect(evaluateCondition({ id: "c", key: "route", operator: "eq", value: "A" }, { route: "B" })).toBe(false);
  });

  it("restores snapshots when going back", () => {
    const game = projectToGame(sampleProject);
    const started = goForward(game, createInitialRuntimeState(game));
    const restored = goBack(started);
    expect(restored.mode).toBe("title");
    expect(restored.blackboard).toEqual({});
  });
});

describe("editor operations", () => {
  const phrase = (id: string): Phrase => ({ id, speaker: "Narrator", text: id, effects: [], choices: [] });

  it("inserts and moves phrases without losing data", () => {
    const phrases = [phrase("a"), phrase("b")];
    const inserted = insertPhraseNear(phrases, "a", "below", phrase("x"));
    expect(inserted.map((item) => item.id)).toEqual(["a", "x", "b"]);
    expect(moveItemByDirection(inserted, "x", "down").map((item) => item.id)).toEqual(["a", "b", "x"]);
  });

  it("reorders nodes by ids while preserving unmentioned items", () => {
    const nodes = [{ id: "title" }, { id: "a" }, { id: "b" }, { id: "c" }];
    expect(reorderItemsByIds(nodes, ["b", "a"]).map((item) => item.id)).toEqual(["b", "a", "title", "c"]);
  });

  it("splits a node at a middle phrase and links the original to the created node", () => {
    const node: VNNode = {
      id: "node_a",
      kind: "story",
      title: "Scene",
      position: { x: 10, y: 20 },
      phrases: [phrase("p1"), phrase("p2"), phrase("p3")]
    };
    const result = splitNodeAtPhrase(node, "p2", "node_b", "choice_continue");
    expect(result?.original.phrases.map((item) => item.id)).toEqual(["p1"]);
    expect(result?.created.phrases.map((item) => item.id)).toEqual(["p2", "p3"]);
    expect(result?.original.phrases[0].choices[0]).toMatchObject({ text: "Continue", targetNodeId: "node_b" });
  });
});
