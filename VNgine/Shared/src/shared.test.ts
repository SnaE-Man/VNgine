import { describe, expect, it } from "vitest";
import { applyEffects, createInitialRuntimeState, evaluateCondition, goBack, goForward, parseImportedPhrases, projectSchema, projectToGame, sampleProject, validateProject } from "./index";

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
