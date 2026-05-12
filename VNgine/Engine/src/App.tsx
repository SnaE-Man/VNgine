import { ArrowLeft, ArrowRight, FolderOpen, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createInitialRuntimeState, openGameFile } from "@vngine/shared";
import { currentViewModel, useEngineStore } from "./store";

export function App() {
  const store = useEngineStore();
  const input = useRef<HTMLInputElement>(null);
  const isPreview = new URL(window.location.href).searchParams.get("preview") === "1";

  useEffect(() => {
    const url = new URL(window.location.href);
    const gameUrl = url.searchParams.get("game");
    if (!gameUrl) return;
    fetch(gameUrl)
      .then((response) => response.blob())
      .then((blob) => openGameFile(new File([blob], gameUrl.split("/").at(-1) || "game.vngame")))
      .then(({ game, resources }) => useEngineStore.setState({ game, resources, state: createInitialRuntimeState(game) }))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isPreview) return;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.opener) return;
      if (event.data?.type !== "vngine.preview") return;
      store.loadPreview(event.data.game, event.data.resources ?? []);
    };
    window.addEventListener("message", onMessage);
    window.opener?.postMessage({ type: "vngine.preview.ready" }, "*");
    return () => window.removeEventListener("message", onMessage);
  }, [isPreview, store]);

  if (!store.game || !store.state) {
    if (isPreview) return <PreviewWaiting />;
    return <MainMenu onOpen={() => input.current?.click()} input={<input ref={input} hidden type="file" accept=".vngame,.zip,.json" onChange={(e) => e.target.files?.[0] && store.loadGameFile(e.target.files[0])} />} />;
  }

  return <Player />;
}

function MainMenu({ onOpen, input }: { onOpen: () => void; input: React.ReactNode }) {
  const { saveSlots, loadSave, deleteSave } = useEngineStore();
  return (
    <main className="mainMenu">
      {input}
      <section>
        <h1>VNgine</h1>
        <p>Load a visual novel game file to begin.</p>
        <button onClick={onOpen}><FolderOpen size={18} /> Load Game File</button>
      </section>
      <section className="saves">
        <h2>Browser Saves</h2>
        {saveSlots.length === 0 && <p>No save slots yet.</p>}
        {saveSlots.map((slot) => (
          <div key={slot.id} className="saveRow">
            <button onClick={() => loadSave(slot)}>{slot.gameTitle}<small>{new Date(slot.savedAt).toLocaleString()}</small></button>
            <button onClick={() => deleteSave(slot.id)} aria-label="Delete save"><Trash2 size={16} /></button>
          </div>
        ))}
      </section>
    </main>
  );
}

function Player() {
  const store = useEngineStore();
  const { game, state, resources, issues } = store;
  const [debugOpen, setDebugOpen] = useState(false);
  const resourceMap = useMemo(() => new Map(resources.map((resource) => [resource.path, resource.url])), [resources]);
  const titleNode = game!.nodes.find((node) => node.id === game!.titleNodeId);
  const { phrase, choices } = currentViewModel(game, state);
  const imagePath = state!.mode === "title" ? titleNode?.titleScreen?.image?.path : state!.imagePath;
  const imageUrl = imagePath ? resourceMap.get(imagePath) : null;
  const missing = issues.filter((issue) => issue.message.startsWith("Missing resource"));

  return (
    <main className="player">
      {imageUrl ? <img className="backdrop" src={imageUrl} /> : <div className="backdrop placeholder" />}
      <div className="topBar">
        <strong>{store.previewMode ? `${game!.title} - Preview` : game!.title}</strong>
        <div>
          <button onClick={store.back} disabled={state!.history.length === 0}><ArrowLeft size={16} /> Back</button>
          <button onClick={store.forward}><ArrowRight size={16} /> Forward</button>
          <button onClick={store.save}><Save size={16} /> Save</button>
        </div>
      </div>

      {state!.mode === "title" && (
        <section className="titleScreen">
          <h1>{titleNode?.titleScreen?.displayTitle || game!.title}</h1>
          {titleNode?.titleScreen?.subtitle && <p>{titleNode.titleScreen.subtitle}</p>}
          <button onClick={store.start}>Start</button>
        </section>
      )}

      {state!.mode === "story" && phrase && (
        <section className="dialogue">
          <div className="speaker" style={{ color: speakerColor(phrase.speaker) }}>{phrase.speaker}</div>
          <p>{phrase.text}</p>
          {phrase.effects.length > 0 && <button className="debugToggle" onClick={() => setDebugOpen(!debugOpen)}>Effects: {phrase.effects.length}</button>}
          {debugOpen && <pre>{JSON.stringify({ effects: phrase.effects, blackboard: state!.blackboard }, null, 2)}</pre>}
          {phrase.choices.length > 0 && (
            <div className="choices">
              {choices.map((choice) => <button key={choice.id} onClick={() => store.chooseChoice(choice)}>{choice.text}</button>)}
              {choices.length === 0 && <span>No available choices.</span>}
            </div>
          )}
        </section>
      )}

      {state!.mode === "ending" && (
        <section className="dialogue">
          <div className="speaker">Ending</div>
          <p>The story path has ended.</p>
        </section>
      )}

      {missing.length > 0 && <MissingBanner missing={missing.map((issue) => issue.path || issue.message)} onLoadResources={store.loadResourceFiles} />}
    </main>
  );
}

function PreviewWaiting() {
  return (
    <main className="mainMenu">
      <section>
        <h1>VNgine</h1>
        <p>Waiting for editor preview...</p>
      </section>
    </main>
  );
}

function MissingBanner({ missing, onLoadResources }: { missing: string[]; onLoadResources: (files: FileList | File[]) => void }) {
  const [open, setOpen] = useState(true);
  const input = useRef<HTMLInputElement>(null);
  if (!open) return null;
  return (
    <aside className="missing">
      <strong>Missing resources</strong>
      <textarea readOnly value={missing.join("\n")} />
      <input ref={input} hidden type="file" multiple accept="image/*" {...{ webkitdirectory: "true" }} onChange={(event) => event.target.files && onLoadResources(event.target.files)} />
      <div>
        <button onClick={() => input.current?.click()}><FolderOpen size={16} /> Load Resources</button>
        <button onClick={() => navigator.clipboard.writeText(missing.join("\n"))}>Copy to Clipboard</button>
        <button onClick={() => setOpen(false)}>Close</button>
      </div>
    </aside>
  );
}

function speakerColor(name: string) {
  let hash = 0;
  for (const char of name) hash = char.charCodeAt(0) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360} 78% 72%)`;
}
