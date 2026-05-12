import { Background, Controls, ReactFlow, type Edge, type Node } from "@xyflow/react";
import { ArrowDown, ArrowUp, Download, FileUp, FolderOpen, GripVertical, ImagePlus, Play, Plus, Route, Scissors, Search, Wand2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { createNewProject, normalizeLoadedResourcePath, openProjectFile, type ChoiceCondition, type ResourceFile } from "@vngine/shared";
import { useEditorStore } from "./store";

export function App() {
  const fileInput = useRef<HTMLInputElement>(null);
  const directoryInput = useRef<HTMLInputElement>(null);
  const store = useEditorStore();
  const selectedNode = store.project.nodes.find((node) => node.id === store.project.editor.selectedNodeId);
  const selectedPhrase = store.project.nodes.flatMap((node) => node.phrases).find((phrase) => phrase.id === store.project.editor.selectedPhraseId);
  const missing = store.issues.filter((issue) => issue.message.startsWith("Missing resource"));
  const canPlayFromHere = selectedNode?.kind === "story";

  async function openProject(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const opened = await openProjectFile(file);
    store.setProject(opened.project, opened.resources);
  }

  async function loadResources(files: FileList | null) {
    if (!files) return;
    const images = [...files].filter((file) => file.type.startsWith("image/"));
    const resources: ResourceFile[] = images.map((file) => {
      const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      const path = normalizeLoadedResourcePath(relativePath);
      return { path, name: file.name, type: file.type, size: file.size, file, url: URL.createObjectURL(file) };
    });
    store.setResources(resources);
  }

  return (
    <div className="app">
      <header className="toolbar">
        <div className="brand">VNgine Editor</div>
        <input value={store.project.title} onChange={(event) => store.setTitle(event.target.value)} aria-label="Project title" />
        <button onClick={() => store.setProject(createNewProject())}>New</button>
        <button onClick={() => fileInput.current?.click()}><FileUp size={16} /> Open</button>
        <button onClick={() => directoryInput.current?.click()}><FolderOpen size={16} /> Resources</button>
        <button onClick={() => store.setImportOpen(true)}><Wand2 size={16} /> Import Content</button>
        <button disabled={!canPlayFromHere} title={canPlayFromHere ? "Open the engine at the selected node" : "Select a story node to playtest"} onClick={store.playFromSelectedNode}><Play size={16} /> Play From Here</button>
        <button onClick={store.validate}>Validate</button>
        <div className="menu">
          <button><Download size={16} /> Export</button>
          <div className="menuPanel">
            <button onClick={store.exportLeanProject}>Lean Project</button>
            <button onClick={store.exportFullProject}>Full Project</button>
            <button onClick={store.exportLeanGame}>Lean Game</button>
            <button onClick={store.exportFullGame}>Full Game</button>
          </div>
        </div>
        <button onClick={store.loadSample}>Sample</button>
        <input ref={fileInput} hidden type="file" accept=".vngproj,.zip,.json" onChange={(event) => openProject(event.target.files)} />
        <input ref={directoryInput} hidden type="file" multiple accept="image/*" {...{ webkitdirectory: "true" }} onChange={(event) => loadResources(event.target.files)} />
      </header>

      <main className="grid">
        <section className="panel nodeList">
          <NodeList />
        </section>
        <section className="panel mapPanel">
          <NodeMap />
        </section>
        <section className="panel editorPanel">
          <NodeEditor />
        </section>
        <section className="panel imagePanel">
          <ImageBrowser />
        </section>
      </main>

      <footer className={`status ${store.issues.some((issue) => issue.severity === "error") ? "bad" : ""}`}>
        {store.issues.length === 0 ? "No validation issues." : `${store.issues.length} validation issue${store.issues.length === 1 ? "" : "s"}.`}
        {selectedNode ? ` Selected: ${selectedNode.title}` : ""}
        {selectedPhrase ? ` / ${selectedPhrase.speaker}` : ""}
      </footer>

      {store.importOpen && <ImportModal />}
      {store.missingOpen && missing.length > 0 && <MissingResourcesModal missing={missing.map((issue) => issue.path || issue.message)} />}
    </div>
  );
}

function NodeList() {
  const [query, setQuery] = useState("");
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const { project, selectNode, moveNode, reorderNodes, issues } = useEditorStore();
  const filtered = project.nodes.filter((node) => searchableNode(node).includes(query.toLowerCase()));
  const allStoryNodeIds = project.nodes.filter((node) => node.kind === "story").map((node) => node.id);
  return (
    <>
      <div className="panelHead"><h2>Nodes</h2><div className="search"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search nodes" /></div></div>
      <div className="scroll">
        {filtered.map((node) => {
          const nodeIssues = issues.filter((issue) => issue.path === node.id || node.phrases.some((phrase) => phrase.id === issue.path));
          return (
            <div
              key={node.id}
              className={`nodeRow ${project.editor.selectedNodeId === node.id ? "selected" : ""}`}
              draggable={node.kind === "story"}
              onDragStart={() => setDraggedNodeId(node.id)}
              onDragOver={(event) => node.kind === "story" && event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (!draggedNodeId || draggedNodeId === node.id || node.kind !== "story") return;
                reorderNodes(reorderDraggedId(allStoryNodeIds, draggedNodeId, node.id));
                setDraggedNodeId(null);
              }}
              onClick={() => selectNode(node.id)}
            >
              <GripVertical size={14} />
              <span>{node.title}</span>
              <small>{node.kind}</small>
              {nodeIssues.length > 0 && <b>{nodeIssues.length}</b>}
              {node.kind === "story" && <button title="Move node up" onClick={(event) => { event.stopPropagation(); moveNode(node.id, "up"); }}><ArrowUp size={13} /></button>}
              {node.kind === "story" && <button title="Move node down" onClick={(event) => { event.stopPropagation(); moveNode(node.id, "down"); }}><ArrowDown size={13} /></button>}
            </div>
          );
        })}
      </div>
    </>
  );
}

function NodeMap() {
  const store = useEditorStore();
  const resourceMap = new Map(store.resources.map((resource) => [resource.path, resource.url]));
  const nodes: Node[] = useMemo(() => store.project.nodes.map((node) => {
    const firstImage = node.titleScreen?.image?.path || node.phrases.find((phrase) => phrase.image)?.image?.path;
    return {
      id: node.id,
      position: node.position,
      data: { label: node.title, kind: node.kind, image: firstImage ? resourceMap.get(firstImage) : null },
      className: node.id === store.project.editor.selectedNodeId ? "flowNode selected" : "flowNode"
    };
  }), [store.project.nodes, store.project.editor.selectedNodeId, store.resources]);
  const edges: Edge[] = useMemo(() => store.project.nodes.flatMap((node) =>
    node.phrases.flatMap((phrase) => phrase.choices.filter((choice) => choice.targetNodeId).map((choice) => ({
      id: `${choice.id}-${choice.targetNodeId}`,
      source: node.id,
      target: choice.targetNodeId!,
      label: choice.text
    })))
  ), [store.project.nodes]);
  const onNodeDragStop = (_event: unknown, node: Node) => store.updateNodePosition(node.id, node.position);
  return (
    <>
      <div className="panelHead">
        <h2>Node Map</h2>
        <div className="actions">
          <button onClick={store.addNode}><Plus size={15} /> Node</button>
          <button onClick={store.autoOrganize}><Route size={15} /> Organize</button>
        </div>
      </div>
      <ReactFlow nodes={nodes} edges={edges} onNodeClick={(_, node) => store.selectNode(node.id)} onNodeDragStop={onNodeDragStop} fitView nodesDraggable multiSelectionKeyCode="Control">
        <Background />
        <Controls />
      </ReactFlow>
    </>
  );
}

function NodeEditor() {
  const store = useEditorStore();
  const [draggedPhraseId, setDraggedPhraseId] = useState<string | null>(null);
  const node = store.project.nodes.find((candidate) => candidate.id === store.project.editor.selectedNodeId);
  const storyNodes = store.project.nodes.filter((candidate) => candidate.kind === "story");
  if (!node) return <Empty title="No node selected" />;
  if (node.kind === "title") {
    return (
      <>
        <div className="panelHead"><h2>Title Screen</h2></div>
        <div className="form">
          <label>Display Title<input value={node.titleScreen?.displayTitle ?? ""} onChange={(e) => store.updateTitleScreen({ displayTitle: e.target.value })} /></label>
          <label>Subtitle<input value={node.titleScreen?.subtitle ?? ""} onChange={(e) => store.updateTitleScreen({ subtitle: e.target.value })} /></label>
          <label>Image<input readOnly value={node.titleScreen?.image?.path ?? "No image assigned"} /></label>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="panelHead"><h2>{node.title}</h2><button onClick={() => store.insertPhrase(store.project.editor.selectedPhraseId, "below")}><Plus size={15} /> Phrase</button></div>
      <div className="scroll phrases">
        <label>Node Name<input value={node.title} onChange={(event) => store.updateNodeTitle(node.id, event.target.value)} /></label>
        <label className="compact">Start node <input type="checkbox" checked={store.project.startNodeId === node.id} onChange={() => store.setProject({ ...store.project, startNodeId: node.id })} /></label>
        {node.phrases.map((phrase, index) => (
          <article
            key={phrase.id}
            className={`phrase ${store.project.editor.selectedPhraseId === phrase.id ? "selected" : ""}`}
            draggable
            onDragStart={() => setDraggedPhraseId(phrase.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (!draggedPhraseId || draggedPhraseId === phrase.id) return;
              store.reorderPhrases(node.id, reorderDraggedId(node.phrases.map((item) => item.id), draggedPhraseId, phrase.id));
              setDraggedPhraseId(null);
            }}
            onClick={() => store.selectPhrase(phrase.id)}
          >
            <div className="phraseTop">
              <span className="dragLabel"><GripVertical size={14} /><strong>Phrase {index + 1}</strong></span>
              <div className="phraseActions">
                <button title="Insert phrase above" onClick={(event) => { event.stopPropagation(); store.insertPhrase(phrase.id, "above"); }}><Plus size={13} /> Above</button>
                <button title="Insert phrase below" onClick={(event) => { event.stopPropagation(); store.insertPhrase(phrase.id, "below"); }}><Plus size={13} /> Below</button>
                <button title="Move phrase up" onClick={(event) => { event.stopPropagation(); store.movePhrase(phrase.id, "up"); }}><ArrowUp size={13} /></button>
                <button title="Move phrase down" onClick={(event) => { event.stopPropagation(); store.movePhrase(phrase.id, "down"); }}><ArrowDown size={13} /></button>
                <button title="Split node here" disabled={index === 0} onClick={(event) => { event.stopPropagation(); store.splitNode(phrase.id); }}><Scissors size={13} /> Split</button>
                <button onClick={(event) => { event.stopPropagation(); store.deletePhrase(phrase.id); }}>Delete</button>
              </div>
            </div>
            <input value={phrase.speaker} onChange={(e) => store.updatePhrase(phrase.id, { speaker: e.target.value })} placeholder="Speaker" />
            <textarea value={phrase.text} onChange={(e) => store.updatePhrase(phrase.id, { text: e.target.value })} placeholder="Dialog text" />
            <input readOnly value={phrase.image?.path ?? "No image assigned"} />
            <div className="subhead">Effects <button onClick={() => store.addEffect(phrase.id)}>Add</button></div>
            {phrase.effects.map((effect) => (
              <div className="row" key={effect.id}>
                <input value={effect.key} onChange={(e) => store.updateEffect(phrase.id, effect.id, { key: e.target.value })} />
                <select value={effect.operation} onChange={(e) => store.updateEffect(phrase.id, effect.id, { operation: e.target.value as never })}>
                  <option value="set">set</option><option value="increment">increment</option><option value="append">append</option>
                </select>
                <input value={String(effect.value)} onChange={(e) => store.updateEffect(phrase.id, effect.id, { value: parseMaybeNumber(e.target.value) })} />
                <button onClick={() => store.deleteEffect(phrase.id, effect.id)}>Remove</button>
              </div>
            ))}
            <div className="subhead">Choices <button onClick={() => store.addChoice(phrase.id)}>Add</button></div>
            {phrase.choices.map((choice) => (
              <div className="choice" key={choice.id}>
                <input value={choice.text} onChange={(e) => store.updateChoice(phrase.id, choice.id, { text: e.target.value })} placeholder="Choice text" />
                <select value={choice.targetNodeId ?? ""} onChange={(e) => store.updateChoice(phrase.id, choice.id, { targetNodeId: e.target.value || null })}>
                  <option value="">Ending</option>
                  {storyNodes.map((storyNode) => <option key={storyNode.id} value={storyNode.id}>{storyNode.title}</option>)}
                </select>
                <button onClick={() => store.addCondition(phrase.id, choice.id)}>Condition</button>
                <button onClick={() => store.deleteChoice(phrase.id, choice.id)}>Remove</button>
                {choice.conditions.map((condition) => <ConditionRow key={condition.id} phraseId={phrase.id} choiceId={choice.id} condition={condition} />)}
              </div>
            ))}
          </article>
        ))}
        {node.phrases.length === 0 && <Empty title="Add phrases or import content" />}
      </div>
    </>
  );
}

function ConditionRow({ phraseId, choiceId, condition }: { phraseId: string; choiceId: string; condition: ChoiceCondition }) {
  const store = useEditorStore();
  return (
    <div className="row condition">
      <input value={condition.key} onChange={(e) => store.updateCondition(phraseId, choiceId, condition.id, { key: e.target.value })} />
      <select value={condition.operator} onChange={(e) => store.updateCondition(phraseId, choiceId, condition.id, { operator: e.target.value as never })}>
        {["exists", "notExists", "eq", "neq", "gt", "gte", "lt", "lte"].map((op) => <option key={op} value={op}>{op}</option>)}
      </select>
      <input value={condition.value === undefined ? "" : String(condition.value)} onChange={(e) => store.updateCondition(phraseId, choiceId, condition.id, { value: parseMaybeNumber(e.target.value) })} />
      <button onClick={() => store.deleteCondition(phraseId, choiceId, condition.id)}>Remove</button>
    </div>
  );
}

function ImageBrowser() {
  const store = useEditorStore();
  const resources = store.resources.filter((resource) => resource.path.toLowerCase().includes(store.resourceFilter.toLowerCase()));
  const selectedResource = store.resources.find((resource) => resource.path === store.selectedResourcePath) ?? resources[0];
  return (
    <>
      <div className="panelHead"><h2>Images</h2><button disabled={!store.selectedResourcePath} onClick={store.applySelectedResource}><ImagePlus size={15} /> Apply</button></div>
      <div className="imageBrowserBody">
        <div className="imageBrowserList">
          <div className="imageControls"><input value={store.resourceFilter} onChange={(e) => store.setResourceFilter(e.target.value)} placeholder="Filter images" /><input type="range" min="60" max="180" value={store.resourceSize} onChange={(e) => store.setResourceSize(Number(e.target.value))} /></div>
          <div className="imageGrid scroll" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${store.resourceSize}px, 1fr))` }}>
            {resources.map((resource) => <button key={resource.path} className={store.selectedResourcePath === resource.path ? "selected" : ""} onClick={() => store.setSelectedResourcePath(resource.path)}><img src={resource.url} /><span>{resource.path}</span></button>)}
            {resources.length === 0 && <Empty title="Load a resources folder" />}
          </div>
        </div>
        <div className="imagePreview">
          {selectedResource ? (
            <>
              <img src={selectedResource.url} alt="" />
              <div className="imagePreviewMeta">
                <strong>{selectedResource.name}</strong>
                <span>{selectedResource.path}</span>
              </div>
            </>
          ) : (
            <Empty title="Select an image to preview" />
          )}
        </div>
      </div>
    </>
  );
}

function ImportModal() {
  const [text, setText] = useState("");
  const store = useEditorStore();
  return (
    <div className="modal"><div className="dialog"><h2>Import Content</h2><textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="[john] What a lovely day today&#10;&#10;A narrator phrase." /><div className="actions"><button onClick={() => store.setImportOpen(false)}>Cancel</button><button onClick={() => { store.appendImportedText(text); store.setImportOpen(false); }}>Import</button></div></div></div>
  );
}

function MissingResourcesModal({ missing }: { missing: string[] }) {
  const store = useEditorStore();
  return (
    <div className="modal"><div className="dialog"><h2>Missing Resources</h2><textarea readOnly value={missing.join("\n")} /><div className="actions"><button onClick={() => navigator.clipboard.writeText(missing.join("\n"))}>Copy to Clipboard</button><button onClick={() => store.setMissingOpen(false)}>Close</button></div></div></div>
  );
}

function Empty({ title }: { title: string }) {
  return <div className="empty">{title}</div>;
}

function searchableNode(node: ReturnType<typeof useEditorStore.getState>["project"]["nodes"][number]) {
  return [node.title, node.kind, ...node.phrases.flatMap((phrase) => [phrase.speaker, phrase.text, ...phrase.effects.flatMap((effect) => [effect.key, String(effect.value)]), ...phrase.choices.flatMap((choice) => [choice.text, ...choice.conditions.flatMap((condition) => [condition.key, String(condition.value ?? "")])])])].join(" ").toLowerCase();
}

function parseMaybeNumber(value: string) {
  return value.trim() !== "" && !Number.isNaN(Number(value)) ? Number(value) : value;
}

function reorderDraggedId(ids: string[], draggedId: string, targetId: string): string[] {
  const next = ids.filter((id) => id !== draggedId);
  const targetIndex = next.indexOf(targetId);
  if (targetIndex === -1) return ids;
  next.splice(targetIndex, 0, draggedId);
  return next;
}
