import type {
  Blackboard,
  Choice,
  ChoiceCondition,
  PersistentEffect,
  Phrase,
  RuntimeSnapshot,
  RuntimeState,
  VNgineGame
} from "./types";

export function createInitialRuntimeState(game: VNgineGame): RuntimeState {
  return {
    nodeId: game.titleNodeId,
    phraseIndex: 0,
    imagePath: null,
    blackboard: {},
    mode: "title",
    history: []
  };
}

export function startGame(game: VNgineGame, state: RuntimeState): RuntimeState {
  if (!game.startNodeId) return { ...pushHistory(state), nodeId: null, phraseIndex: 0, mode: "ending" };
  const next = { ...pushHistory(state), nodeId: game.startNodeId, phraseIndex: 0, mode: "story" as const };
  return enterPhrase(game, next);
}

export function goBack(state: RuntimeState): RuntimeState {
  const previous = state.history.at(-1);
  if (!previous) return state;
  return { ...previous, history: state.history.slice(0, -1) };
}

export function goForward(game: VNgineGame, state: RuntimeState): RuntimeState {
  if (state.mode === "title") return startGame(game, state);
  const phrase = getCurrentPhrase(game, state);
  if (!phrase) return state;
  if (phrase.choices.length > 0) return state;
  const node = game.nodes.find((candidate) => candidate.id === state.nodeId);
  if (!node || state.phraseIndex >= node.phrases.length - 1) {
    return { ...pushHistory(state), mode: "ending", nodeId: state.nodeId };
  }
  return enterPhrase(game, { ...pushHistory(state), phraseIndex: state.phraseIndex + 1 });
}

export function choose(game: VNgineGame, state: RuntimeState, choice: Choice): RuntimeState {
  if (!isChoiceAvailable(choice, state.blackboard)) return state;
  if (!choice.targetNodeId) return { ...pushHistory(state), mode: "ending" };
  return enterPhrase(game, { ...pushHistory(state), nodeId: choice.targetNodeId, phraseIndex: 0, mode: "story" });
}

export function enterPhrase(game: VNgineGame, state: RuntimeState): RuntimeState {
  const phrase = getCurrentPhrase(game, state);
  if (!phrase) return { ...state, mode: "ending" };
  return {
    ...state,
    imagePath: phrase.image?.path ?? state.imagePath,
    blackboard: applyEffects(state.blackboard, phrase.effects)
  };
}

export function getCurrentPhrase(game: VNgineGame, state: RuntimeState): Phrase | null {
  const node = game.nodes.find((candidate) => candidate.id === state.nodeId);
  if (!node || node.kind !== "story") return null;
  return node.phrases[state.phraseIndex] ?? null;
}

export function getVisibleChoices(phrase: Phrase | null, blackboard: Blackboard): Choice[] {
  return phrase ? phrase.choices.filter((choice) => isChoiceAvailable(choice, blackboard)) : [];
}

export function applyEffects(blackboard: Blackboard, effects: PersistentEffect[]): Blackboard {
  const next = { ...blackboard };
  for (const effect of effects) {
    if (effect.operation === "set") next[effect.key] = effect.value;
    if (effect.operation === "increment") next[effect.key] = Number(next[effect.key] ?? 0) + Number(effect.value);
    if (effect.operation === "append") next[effect.key] = `${next[effect.key] ?? ""}${effect.value}`;
  }
  return next;
}

export function isChoiceAvailable(choice: Choice, blackboard: Blackboard): boolean {
  return choice.conditions.every((condition) => evaluateCondition(condition, blackboard));
}

export function evaluateCondition(condition: ChoiceCondition, blackboard: Blackboard): boolean {
  const current = blackboard[condition.key];
  switch (condition.operator) {
    case "exists":
      return current !== undefined;
    case "notExists":
      return current === undefined;
    case "eq":
      return current === condition.value;
    case "neq":
      return current !== condition.value;
    case "gt":
      return Number(current) > Number(condition.value);
    case "gte":
      return Number(current) >= Number(condition.value);
    case "lt":
      return Number(current) < Number(condition.value);
    case "lte":
      return Number(current) <= Number(condition.value);
  }
}

function pushHistory(state: RuntimeState): RuntimeState {
  const snapshot: RuntimeSnapshot = {
    nodeId: state.nodeId,
    phraseIndex: state.phraseIndex,
    imagePath: state.imagePath,
    blackboard: { ...state.blackboard },
    mode: state.mode
  };
  return { ...state, history: [...state.history, snapshot] };
}
