import JSZip from "jszip";
import { gameSchema, projectSchema } from "./schema";
import type { ResourceAsset, VNgineGame, VNgineProject } from "./types";
import { collectResourceRefs } from "./validation";

export type ResourceFile = ResourceAsset & {
  file: File;
  url: string;
};

export function createNewProject(): VNgineProject {
  const titleNodeId = createId("node");
  return {
    format: "vngine.project",
    version: 1,
    title: "Untitled Visual Novel",
    titleNodeId,
    startNodeId: null,
    resources: [],
    nodes: [
      {
        id: titleNodeId,
        kind: "title",
        title: "Title Screen",
        position: { x: 0, y: 0 },
        titleScreen: { displayTitle: "Untitled Visual Novel", subtitle: "A VNgine story" },
        phrases: []
      }
    ],
    editor: {
      selectedNodeId: titleNodeId,
      selectedPhraseId: null,
      map: { zoom: 1, pan: { x: 0, y: 0 } }
    }
  };
}

export function projectToGame(project: VNgineProject): VNgineGame {
  return {
    format: "vngine.game",
    version: 1,
    title: project.title,
    titleNodeId: project.titleNodeId,
    startNodeId: project.startNodeId,
    nodes: project.nodes,
    resources: project.resources.filter((asset) => collectResourceRefs(project.nodes).includes(asset.path))
  };
}

export function serializeJson(value: unknown): Blob {
  return new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
}

export async function exportProjectZip(project: VNgineProject, resources: ResourceFile[]): Promise<Blob> {
  const zip = new JSZip();
  zip.file("project.json", JSON.stringify(project, null, 2));
  addResources(zip, project.resources, resources);
  return zip.generateAsync({ type: "blob" });
}

export async function exportGameZip(game: VNgineGame, resources: ResourceFile[]): Promise<Blob> {
  const zip = new JSZip();
  zip.file("game.json", JSON.stringify(game, null, 2));
  addResources(zip, game.resources, resources);
  return zip.generateAsync({ type: "blob" });
}

export async function openProjectFile(file: File): Promise<{ project: VNgineProject; resources: ResourceFile[] }> {
  if (file.name.endsWith(".zip")) {
    const zip = await JSZip.loadAsync(file);
    const projectText = await zip.file("project.json")?.async("string");
    if (!projectText) throw new Error("ZIP does not contain project.json.");
    const project = projectSchema.parse(JSON.parse(projectText));
    return { project, resources: await readZipResources(zip) };
  }
  return { project: projectSchema.parse(JSON.parse(await file.text())), resources: [] };
}

export async function openGameFile(file: File): Promise<{ game: VNgineGame; resources: ResourceFile[] }> {
  if (file.name.endsWith(".zip")) {
    const zip = await JSZip.loadAsync(file);
    const gameText = await zip.file("game.json")?.async("string");
    if (!gameText) throw new Error("ZIP does not contain game.json.");
    const game = gameSchema.parse(JSON.parse(gameText));
    return { game, resources: await readZipResources(zip) };
  }
  return { game: gameSchema.parse(JSON.parse(await file.text())), resources: [] };
}

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
}

function addResources(zip: JSZip, manifest: ResourceAsset[], resources: ResourceFile[]) {
  const resourceByPath = new Map(resources.map((resource) => [resource.path, resource]));
  for (const asset of manifest) {
    const resource = resourceByPath.get(asset.path);
    if (resource) zip.file(`resources/${asset.path}`, resource.file);
  }
}

async function readZipResources(zip: JSZip): Promise<ResourceFile[]> {
  const resources: ResourceFile[] = [];
  const entries = Object.values(zip.files).filter((entry) => !entry.dir && entry.name.startsWith("resources/"));
  for (const entry of entries) {
    const blob = await entry.async("blob");
    const path = entry.name.replace(/^resources\//, "");
    const file = new File([blob], path.split("/").at(-1) || path, { type: blob.type || guessType(path) });
    resources.push({ path, name: file.name, type: file.type || guessType(path), size: file.size, file, url: URL.createObjectURL(file) });
  }
  return resources;
}

function guessType(path: string) {
  if (path.match(/\.png$/i)) return "image/png";
  if (path.match(/\.jpe?g$/i)) return "image/jpeg";
  if (path.match(/\.webp$/i)) return "image/webp";
  if (path.match(/\.gif$/i)) return "image/gif";
  return "application/octet-stream";
}
