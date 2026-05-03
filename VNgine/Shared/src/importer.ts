import type { Phrase } from "./types";

export function parseImportedPhrases(input: string, idFactory = defaultIdFactory): Phrase[] {
  return input
    .trim()
    .split(/\r?\n\s*\r?\n/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const match = chunk.match(/^\[([^\]]+)]\s*([\s\S]*)$/);
      return {
        id: idFactory("phrase"),
        speaker: match?.[1]?.trim() || "Narrator",
        text: (match?.[2] ?? chunk).trim(),
        effects: [],
        choices: []
      };
    });
}

export function defaultIdFactory(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
