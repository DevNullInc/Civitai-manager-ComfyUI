/**
 * Renegade Core Model Manager (RenegadeCMM)
 * Copyright (C) 2025-2026 TheStygianRenegade / /dev/null Inc
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Workflow,
  Upload,
  FolderSearch,
  CheckCircle2,
  AlertCircle,
  Download,
  GitBranch,
  Sparkles,
  Layers,
  Search,
  RefreshCw,
  Eye,
  LayoutGrid,
  FileJson,
  Image as ImageIcon,
  HardDrive,
  ExternalLink,
  ChevronRight,
  Package,
  Activity,
  ArrowRight,
  ChevronDown,
  X,
} from 'lucide-react';
import {
  WorkflowInfo,
  WorkflowModelReference,
  CanvasGraph,
  CanvasNode,
  NodeResolutionResult,
  DownloadTask,
} from '../types/app';
import { NodeResolutionCard } from './NodeResolutionCard';
import WorkflowNodeMap, { NodeStatus, WorkflowNodeMapHandle } from './WorkflowNodeMap';

// ComfyUI component/subgraph references use UUIDs as canvas node "type" values.
const UUID_TYPE_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function collectSubgraphNames(data: any): Map<string, string> {
  const map = new Map<string, string>();
  if (!data || typeof data !== 'object') return map;
  const defs = data.definitions;
  if (!defs || typeof defs !== 'object') return map;

  const list: any[] = Array.isArray(defs) ? defs : Array.isArray(defs.subgraphs) ? defs.subgraphs : [];
  for (const sub of list) {
    if (!sub || typeof sub !== 'object') continue;
    const id = sub.id != null ? String(sub.id) : '';
    const name = sub.name || sub.display_name || sub.title;
    if (id && typeof name === 'string' && name.trim()) map.set(id, name.trim());
  }

  if (!Array.isArray(defs)) {
    for (const [key, val] of Object.entries<any>(defs)) {
      if (!val || typeof val !== 'object' || Array.isArray(val) || key === 'subgraphs') continue;
      const name = val.name || val.display_name || val.title;
      if (typeof name === 'string' && name.trim()) map.set(key, name.trim());
    }
  }
  return map;
}

function resolveNodeTypeLabel(raw: any, subgraphNames: Map<string, string>): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t) return null;
  if (UUID_TYPE_RE.test(t)) return subgraphNames.get(t) || null;
  return t;
}

interface WorkflowsTabProps {
  onSearchModel?: (query: string) => void;
  onNavigateToDownloads?: () => void;
}

export const WorkflowsTab: React.FC<WorkflowsTabProps> = ({
  onSearchModel,
  onNavigateToDownloads,
}) => {
  const [workflows, setWorkflows] = useState<WorkflowInfo[]>(() => {
    try {
      const saved = sessionStorage.getItem('civitai_workflows_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [selectedWorkflowIndex, setSelectedWorkflowIndex] = useState<number>(0);
  const [savedWorkflows, setSavedWorkflows] = useState<WorkflowInfo[]>([]);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'both' | 'map' | 'matrix'>('both');
  const [selectedNodeId, setSelectedNodeId] = useState<string | number | null>(null);
  const [isMapExpanded, setIsMapExpanded] = useState<boolean>(false);

  // Resolution states for custom node classes
  const [nodeResolutions, setNodeResolutions] = useState<Record<string, NodeResolutionResult>>({});
  const [isResolvingNodes, setIsResolvingNodes] = useState<boolean>(false);

  // Active download tracking for inline progress
  const [activeTasks, setActiveTasks] = useState<Record<string, DownloadTask>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const nodeMapRef = useRef<WorkflowNodeMapHandle>(null);

  // Sync workflows with sessionStorage whenever they change
  useEffect(() => {
    try {
      if (workflows && workflows.length > 0) {
        sessionStorage.setItem('civitai_workflows_state', JSON.stringify(workflows));
      } else {
        sessionStorage.removeItem('civitai_workflows_state');
      }
    } catch {}
  }, [workflows]);

  // Load configured workflows on initial mount
  useEffect(() => {
    loadWorkflows();
  }, []);

  // Listen for real-time download progress to update inline progress bars
  useEffect(() => {
    if (window.civitaiAPI?.onDownloadProgress) {
      window.civitaiAPI.onDownloadProgress((tasks: DownloadTask[]) => {
        const taskMap: Record<string, DownloadTask> = {};
        for (const t of tasks) {
          if (t.fileName) {
            taskMap[t.fileName.toLowerCase()] = t;
          }
        }
        setActiveTasks(taskMap);
      });
    }
  }, []);

  const loadWorkflows = async (forceRescan = false) => {
    if (!window.civitaiAPI?.scanWorkflows) return;
    setIsLoadingWorkflows(true);
    try {
      const results: WorkflowInfo[] = await window.civitaiAPI.scanWorkflows();
      if (results && Array.isArray(results)) {
        setSavedWorkflows(results);
        if (workflows.length === 0 || forceRescan) {
          if (results.length > 0) {
            setWorkflows(results);
            setSelectedWorkflowIndex(0);
          }
        }
        // Always re-resolve the active workflow's nodes after a scan. Previously this
        // only ran when the queue was empty, so a queue restored from sessionStorage
        // kept nodeResolutions empty — the Custom Node Extensions panel read
        // "0 installed • 0 missing" and every map node defaulted to "ready" (green)
        // even when its extension (e.g. TIPO, MXReroute) isn't installed.
        const active = workflows.length > 0 ? workflows[selectedWorkflowIndex] : results[0];
        if (active) resolveWorkflowNodes(active);
      }
    } catch (err) {
      console.error('Failed to scan workflows:', err);
    } finally {
      setIsLoadingWorkflows(false);
    }
  };

  const handleSelectFromDropdown = (targetIdentifier: string) => {
    if (!targetIdentifier) return;

    // 1. Check if already present in loaded workflows list
    const existingIdx = workflows.findIndex(
      (w) => w.filePath === targetIdentifier || w.fileName === targetIdentifier
    );
    if (existingIdx !== -1) {
      handleSelectWorkflow(existingIdx);
      return;
    }

    // 2. Otherwise find from savedWorkflows and add to top of loaded list
    const found = savedWorkflows.find(
      (w) => w.filePath === targetIdentifier || w.fileName === targetIdentifier
    );
    if (found) {
      const nextList = [found, ...workflows];
      setWorkflows(nextList);
      setSelectedWorkflowIndex(0);
      setSelectedNodeId(null);
      resolveWorkflowNodes(found);
    }
  };

  const activeWorkflow: WorkflowInfo | undefined = workflows[selectedWorkflowIndex];

  // Resolve custom node classes for the active workflow. Resolution reads the persistent
  // SQLite cache first (so reloading a workflow never re-attempts a node), then checks
  // the local install, ComfyUI's built-in core nodes (parsed from install nodes.py +
  // comfy_extras), and the curated registry. GitHub is never queried via the API here;
  // the per-node card opens GitHub in the browser instead.
  const resolveWorkflowNodes = async (wf?: WorkflowInfo) => {
    if (!wf || !wf.nodeTypes || wf.nodeTypes.length === 0 || !window.civitaiAPI?.resolveMissingNode) {
      return;
    }

    setIsResolvingNodes(true);
    const newResolutions: Record<string, NodeResolutionResult> = {};

    for (const nodeType of wf.nodeTypes) {
      try {
        const res = await window.civitaiAPI.resolveMissingNode(nodeType);
        newResolutions[nodeType] = res;
      } catch (err) {
        newResolutions[nodeType] = {
          nodeType,
          isInstalled: false,
          githubCandidates: [],
        };
      }
    }

    setNodeResolutions(newResolutions);
    setIsResolvingNodes(false);
  };

  // Handle workflow selection
  const handleSelectWorkflow = (index: number) => {
    setSelectedWorkflowIndex(index);
    setSelectedNodeId(null);
    resolveWorkflowNodes(workflows[index]);
  };

  // Handle workflow removal from list
  const handleRemoveWorkflow = (e: React.MouseEvent, removeIdx: number) => {
    e.stopPropagation();
    const nextWorkflows = workflows.filter((_, i) => i !== removeIdx);
    setWorkflows(nextWorkflows);

    if (nextWorkflows.length === 0) {
      setSelectedWorkflowIndex(0);
      setNodeResolutions({});
      setSelectedNodeId(null);
    } else if (removeIdx === selectedWorkflowIndex) {
      const newIdx = Math.min(removeIdx, nextWorkflows.length - 1);
      setSelectedWorkflowIndex(newIdx);
      resolveWorkflowNodes(nextWorkflows[newIdx]);
    } else if (removeIdx < selectedWorkflowIndex) {
      setSelectedWorkflowIndex((prev) => prev - 1);
    }
  };

  // Handle file drop / upload
  const handleFileUpload = async (file: File) => {
    const fileName = file.name;
    const ext = fileName.split('.').pop()?.toLowerCase();

    if (ext !== 'json' && ext !== 'png') {
      alert('Please upload a valid ComfyUI workflow (.json) or generated image (.png).');
      return;
    }

    try {
      setIsLoadingWorkflows(true);

      if (ext === 'json') {
        const text = await file.text();
        let parsed: any;
        try {
          parsed = JSON.parse(text);
        } catch (e: any) {
          alert(`Invalid JSON format in "${fileName}": ${e.message}`);
          setIsLoadingWorkflows(false);
          return;
        }

        let parsedWorkflowInfo: WorkflowInfo;
        if (window.civitaiAPI?.parseWorkflow) {
          try {
            parsedWorkflowInfo = await window.civitaiAPI.parseWorkflow(parsed, fileName);
          } catch (e: any) {
            alert(e.message || `Failed to parse ComfyUI workflow: ${fileName}`);
            setIsLoadingWorkflows(false);
            return;
          }
        } else {
          // Fallback in-browser parser
          const localModels = (await window.civitaiAPI?.getLocalModels()) || [];
          const modelMap = new Map<string, string>();
          for (const m of localModels) {
            if (m.fileName) modelMap.set(m.fileName.toLowerCase(), m.filePath);
          }

          const modelRefs: WorkflowModelReference[] = [];
          const nodeTypes = new Set<string>();
          const subgraphNames = collectSubgraphNames(parsed);

          // UI Canvas format
          const nodes = parsed.nodes || parsed.workflow?.nodes || [];
          if (Array.isArray(nodes)) {
            for (const n of nodes) {
              const label = resolveNodeTypeLabel(n.type, subgraphNames);
              if (label) nodeTypes.add(label);
              if (Array.isArray(n.widgets_values)) {
                for (const w of n.widgets_values) {
                  if (typeof w === 'string' && (w.endsWith('.safetensors') || w.endsWith('.ckpt') || w.endsWith('.gguf') || w.endsWith('.pt'))) {
                    modelRefs.push({
                      nodeId: String(n.id),
                      nodeType: n.type || 'Node',
                      inputName: 'widget',
                      modelName: w,
                      isInstalled: modelMap.has(w.toLowerCase()),
                      localPath: modelMap.get(w.toLowerCase()),
                    });
                  }
                }
              }
            }
          }

          // API Prompt format
          const promptNodes = parsed.prompt || parsed;
          if (promptNodes && typeof promptNodes === 'object' && !Array.isArray(promptNodes)) {
            for (const [id, nodeObj] of Object.entries<any>(promptNodes)) {
              if (nodeObj && typeof nodeObj === 'object') {
                const classType = resolveNodeTypeLabel(nodeObj.class_type || nodeObj.type, subgraphNames);
                if (classType) nodeTypes.add(classType);
                if (nodeObj.inputs) {
                  for (const [k, v] of Object.entries(nodeObj.inputs)) {
                    if (typeof v === 'string' && (v.endsWith('.safetensors') || v.endsWith('.ckpt') || v.endsWith('.gguf') || v.endsWith('.pt'))) {
                      modelRefs.push({
                        nodeId: String(id),
                        nodeType: classType || 'Loader',
                        inputName: k,
                        modelName: v,
                        isInstalled: modelMap.has(v.toLowerCase()),
                        localPath: modelMap.get(v.toLowerCase()),
                      });
                    }
                  }
                }
              }
            }
          }

          parsedWorkflowInfo = {
            filePath: '',
            fileName,
            fileType: 'json',
            modelCount: modelRefs.length,
            models: modelRefs,
            nodeTypes: Array.from(nodeTypes),
            rawGraph: parsed,
            canvasGraph: nodes.length > 0 ? { nodes, links: parsed.links || [] } : undefined,
          };
        }

        // Strict validity verification
        const hasNodes = (parsedWorkflowInfo.canvasGraph?.nodes && parsedWorkflowInfo.canvasGraph.nodes.length > 0) || (parsedWorkflowInfo.nodeTypes && parsedWorkflowInfo.nodeTypes.length > 0);
        if (!hasNodes && parsedWorkflowInfo.modelCount === 0) {
          alert(`Invalid ComfyUI workflow JSON: No recognizable ComfyUI nodes or prompt execution graph found in "${fileName}". Please ensure this is an exported ComfyUI workflow (.json) or ComfyUI API prompt.`);
          setIsLoadingWorkflows(false);
          return;
        }

        const updated = [parsedWorkflowInfo, ...workflows];
        setWorkflows(updated);
        setSelectedWorkflowIndex(0);
        resolveWorkflowNodes(parsedWorkflowInfo);
      } else if (ext === 'png') {
        // PNG Workflow extraction
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Read PNG tEXt & iTXt chunks in browser
        const extracted = parsePngWorkflowInBrowser(uint8Array);
        if (!extracted) {
          alert(`No ComfyUI workflow metadata found embedded in PNG file "${fileName}".`);
          setIsLoadingWorkflows(false);
          return;
        }

        let parsedWorkflowInfo: WorkflowInfo;
        if (window.civitaiAPI?.parseWorkflow) {
          try {
            parsedWorkflowInfo = await window.civitaiAPI.parseWorkflow(extracted, fileName);
          } catch (e: any) {
            alert(e.message || `Failed to parse ComfyUI workflow embedded in PNG: ${fileName}`);
            setIsLoadingWorkflows(false);
            return;
          }
        } else {
          const localModels = (await window.civitaiAPI?.getLocalModels()) || [];
          const modelMap = new Map<string, string>();
          for (const m of localModels) {
            if (m.fileName) modelMap.set(m.fileName.toLowerCase(), m.filePath);
          }

          const modelRefs: WorkflowModelReference[] = [];
          const nodeTypes = new Set<string>();

          const rawData = extracted.workflow || extracted.prompt || extracted;
          const subgraphNames = collectSubgraphNames(rawData);
          const nodes = rawData.nodes || [];
          if (Array.isArray(nodes)) {
            for (const n of nodes) {
              const label = resolveNodeTypeLabel(n.type, subgraphNames);
              if (label) nodeTypes.add(label);
              if (Array.isArray(n.widgets_values)) {
                for (const w of n.widgets_values) {
                  if (typeof w === 'string' && (w.endsWith('.safetensors') || w.endsWith('.ckpt') || w.endsWith('.gguf') || w.endsWith('.pt'))) {
                    modelRefs.push({
                      nodeId: String(n.id),
                      nodeType: n.type || 'Node',
                      inputName: 'widget',
                      modelName: w,
                      isInstalled: modelMap.has(w.toLowerCase()),
                      localPath: modelMap.get(w.toLowerCase()),
                    });
                  }
                }
              }
            }
          }

          parsedWorkflowInfo = {
            filePath: '',
            fileName,
            fileType: 'png',
            modelCount: modelRefs.length,
            models: modelRefs,
            nodeTypes: Array.from(nodeTypes),
            rawGraph: rawData,
            canvasGraph: nodes.length > 0 ? { nodes, links: rawData.links || [] } : undefined,
          };
        }

        const hasNodes = (parsedWorkflowInfo.canvasGraph?.nodes && parsedWorkflowInfo.canvasGraph.nodes.length > 0) || (parsedWorkflowInfo.nodeTypes && parsedWorkflowInfo.nodeTypes.length > 0);
        if (!hasNodes && parsedWorkflowInfo.modelCount === 0) {
          alert(`Invalid ComfyUI workflow in PNG: No recognizable ComfyUI nodes found in "${fileName}".`);
          setIsLoadingWorkflows(false);
          return;
        }

        const updated = [parsedWorkflowInfo, ...workflows];
        setWorkflows(updated);
        setSelectedWorkflowIndex(0);
        resolveWorkflowNodes(parsedWorkflowInfo);
      }
    } catch (err: any) {
      console.error('Error processing uploaded workflow:', err);
      alert(`Error parsing workflow file: ${err?.message || err}`);
    } finally {
      setIsLoadingWorkflows(false);
    }
  };

  // Browser PNG Chunks Parser
  const parsePngWorkflowInBrowser = (bytes: Uint8Array): any => {
    if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) {
      return null;
    }

    let workflowData: any = null;
    let promptData: any = null;
    const view = new DataView(bytes.buffer);
    let offset = 8;

    while (offset < bytes.length) {
      if (offset + 8 > bytes.length) break;
      const length = view.getUint32(offset);
      const chunkType = String.fromCharCode(
        bytes[offset + 4],
        bytes[offset + 5],
        bytes[offset + 6],
        bytes[offset + 7]
      );
      const dataStart = offset + 8;
      const dataEnd = dataStart + length;
      if (dataEnd > bytes.length) break;

      if (chunkType === 'tEXt') {
        const slice = bytes.slice(dataStart, dataEnd);
        let nullIdx = -1;
        for (let i = 0; i < slice.length; i++) {
          if (slice[i] === 0) {
            nullIdx = i;
            break;
          }
        }
        if (nullIdx > 0) {
          const key = new TextDecoder('latin1').decode(slice.slice(0, nullIdx));
          const val = new TextDecoder('utf-8').decode(slice.slice(nullIdx + 1));
          try {
            if (key === 'workflow') workflowData = JSON.parse(val);
            if (key === 'prompt') promptData = JSON.parse(val);
          } catch {}
        }
      }

      offset = dataEnd + 4;
    }

    if (workflowData) return { workflow: workflowData, prompt: promptData };
    if (promptData) return { prompt: promptData };
    return null;
  };

  // Compute node readiness status
  const getNodeStatus = useCallback(
    (node: CanvasNode): NodeStatus => {
      const nodeType = node.type;
      const res = nodeResolutions[nodeType];
      if (res && !res.isInstalled) {
        return 'missing-node';
      }

      // Check if any widget value references a missing model
      if (activeWorkflow?.models) {
        const nodeModels = activeWorkflow.models.filter(
          (m) => String(m.nodeId) === String(node.id) || m.nodeType === node.type
        );
        if (nodeModels.some((m) => !m.isInstalled)) {
          return 'missing-model';
        }
      }

      return 'ready';
    },
    [nodeResolutions, activeWorkflow]
  );


  // Computed summary metrics
  const totalModelsCount = activeWorkflow?.models?.length || 0;
  const installedModelsCount = activeWorkflow?.models?.filter((m) => m.isInstalled).length || 0;
  const missingModelsCount = totalModelsCount - installedModelsCount;

  const totalCustomNodesCount = Object.keys(nodeResolutions).length;
  const installedCustomNodesCount = Object.values(nodeResolutions).filter((r) => r.isInstalled).length;
  const missingCustomNodesCount = totalCustomNodesCount - installedCustomNodesCount;

  const isWorkflowFullyReady = missingModelsCount === 0 && missingCustomNodesCount === 0;

  return (
    <div className="flex flex-col h-full w-full space-y-6 pb-12 overflow-y-auto px-6 pt-2 select-none">
      {/* Top Header & Overview */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-slate-800 shadow-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30">
              <Workflow size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-100 tracking-tight flex items-center gap-2.5">
                <span>ComfyUI Workflows & Dependency Resolver</span>
              </h1>
              <p className="text-xs text-slate-400">
                Inspect visual workflow maps, resolve missing Checkpoints/LoRAs, and 1-click install custom node extensions.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
            accept=".json,.png"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20 transition-all cursor-pointer"
          >
            <Upload size={15} />
            <span>Upload JSON / PNG</span>
          </button>

          <button
            onClick={() => loadWorkflows(true)}
            disabled={isLoadingWorkflows}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
            title="Scan configured ComfyUI directories for workflow files"
          >
            <RefreshCw size={14} className={isLoadingWorkflows ? 'animate-spin text-cyan-400' : ''} />
            <span>Scan Folders</span>
          </button>
        </div>
      </div>

      {/* Saved ComfyUI Workflows Dropdown Selector */}
      <div className="glass-panel p-4 rounded-3xl border border-slate-800/90 shadow-xl bg-slate-900/50 backdrop-blur-md space-y-2.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
              <Workflow size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-slate-100">
                  Select Existing ComfyUI Workflow
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {savedWorkflows.length} {savedWorkflows.length === 1 ? 'workflow' : 'workflows'} found
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Workflows automatically detected in your ComfyUI directory (<code className="text-purple-300 text-[10px]">workflows/</code>, <code className="text-purple-300 text-[10px]">user/default/workflows/</code>)
              </p>
            </div>
          </div>

          <button
            onClick={() => loadWorkflows(true)}
            disabled={isLoadingWorkflows}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-purple-900/30 border border-slate-700 hover:border-purple-500/50 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-95"
            title="Rescan ComfyUI directories for newly downloaded or modified workflows"
          >
            <RefreshCw size={12} className={isLoadingWorkflows ? 'animate-spin text-purple-400' : ''} />
            <span>Rescan ComfyUI Folder</span>
          </button>
        </div>

        {/* Custom Styled Select Dropdown */}
        <div className="relative w-full">
          <select
            value={activeWorkflow?.filePath || activeWorkflow?.fileName || ''}
            onChange={(e) => handleSelectFromDropdown(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-700/80 hover:border-purple-500/60 focus:border-purple-400 rounded-2xl px-4 py-2.5 text-xs md:text-sm text-slate-100 font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all cursor-pointer pr-10"
          >
            <option value="" disabled>
              {savedWorkflows.length > 0
                ? '-- Select an existing ComfyUI workflow to load & map --'
                : '-- No saved workflows found in ComfyUI workflow folders --'}
            </option>
            {savedWorkflows.map((wf, idx) => (
              <option key={wf.filePath || `${wf.fileName}-${idx}`} value={wf.filePath || wf.fileName}>
                {wf.fileName} ({wf.fileType.toUpperCase()}) — {wf.modelCount} model{wf.modelCount !== 1 ? 's' : ''}, {wf.nodeTypes?.length || 0} nodes
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
            <ChevronDown size={16} />
          </div>
        </div>
      </div>

      {/* Drag and Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileUpload(e.dataTransfer.files[0]);
          }
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-3xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
          isDragOver
            ? 'border-cyan-400 bg-cyan-950/30 scale-[1.01]'
            : 'border-slate-800/80 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/60'
        }`}
      >
        <div className="p-3 rounded-full bg-slate-800/80 text-cyan-400 shadow-inner">
          <Upload size={22} className={isDragOver ? 'animate-bounce' : ''} />
        </div>
        <p className="text-sm font-bold text-slate-200">
          Drop any ComfyUI <code className="text-cyan-300 font-mono text-xs">.json</code> workflow or generated <code className="text-cyan-300 font-mono text-xs">.png</code> here
        </p>
        <p className="text-xs text-slate-400">
          CMM extracts embedded canvas layouts, models, and custom node dependencies automatically
        </p>
      </div>

      {/* Workflows Loaded Selector Carousel */}
      {workflows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Layers size={14} className="text-purple-400" />
              <span>Loaded Workflows ({workflows.length})</span>
            </span>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('both')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  viewMode === 'both'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Split View
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  viewMode === 'map'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Visual Map
              </button>
              <button
                onClick={() => setViewMode('matrix')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  viewMode === 'matrix'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Dependency Matrix
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto pb-2 custom-scrollbar">
            {workflows.map((wf, idx) => {
              const isSelected = idx === selectedWorkflowIndex;
              return (
                <div key={idx} className="relative group shrink-0">
                  <button
                    onClick={() => handleSelectWorkflow(idx)}
                    className={`flex items-center gap-2.5 pl-4 pr-8 py-3 rounded-2xl border transition-all cursor-pointer text-left ${
                      isSelected
                        ? 'bg-linear-to-r from-purple-950/60 to-indigo-950/60 border-purple-500/60 shadow-lg shadow-purple-900/30'
                        : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    {wf.fileType === 'png' ? (
                      <ImageIcon size={18} className="text-emerald-400 shrink-0" />
                    ) : (
                      <FileJson size={18} className="text-purple-400 shrink-0" />
                    )}
                    <div>
                      <p className="text-xs font-bold text-slate-100 truncate max-w-[180px]">
                        {wf.fileName}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {wf.modelCount} model{wf.modelCount !== 1 ? 's' : ''} • {wf.nodeTypes?.length || 0} nodes
                      </p>
                    </div>
                  </button>

                  {/* Top-Right (X) Dismiss / Remove Button */}
                  <button
                    onClick={(e) => handleRemoveWorkflow(e, idx)}
                    className="absolute top-2 right-2 p-1 rounded-full bg-slate-800/90 hover:bg-rose-600 border border-slate-700/80 hover:border-rose-500 text-slate-400 hover:text-white transition-all shadow-md cursor-pointer opacity-70 group-hover:opacity-100"
                    title="Remove workflow from list"
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Workflow Health Banner */}
      {activeWorkflow && (
        <div className="glass-panel p-5 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`p-3 rounded-2xl ${
                isWorkflowFullyReady
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              {isWorkflowFullyReady ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">{activeWorkflow.fileName}</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                  {activeWorkflow.fileType}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isWorkflowFullyReady
                  ? 'All models and custom node dependencies are installed and ready.'
                  : `Missing ${missingModelsCount} model${missingModelsCount !== 1 ? 's' : ''} and ${missingCustomNodesCount} custom node extension${missingCustomNodesCount !== 1 ? 's' : ''}.`}
              </p>
            </div>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
                missingModelsCount === 0
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-950/40 text-amber-300 border-amber-500/30'
              }`}
            >
              {installedModelsCount}/{totalModelsCount} Models Ready
            </span>
            <span
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
                missingCustomNodesCount === 0
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-950/40 text-rose-300 border-rose-500/30'
              }`}
            >
              {installedCustomNodesCount}/{totalCustomNodesCount} Nodes Ready
            </span>
          </div>
        </div>
      )}

      {/* Visual Node Map Canvas */}
      {activeWorkflow && (
        <WorkflowNodeMap
          ref={nodeMapRef}
          graph={activeWorkflow.canvasGraph}
          getNodeStatus={getNodeStatus}
          onFocusNode={setSelectedNodeId}
          viewMode={viewMode}
          isMapExpanded={isMapExpanded}
          onToggleExpand={() => setIsMapExpanded((prev) => !prev)}
        />
      )}

      {/* Dependency Matrix & Resolution Cards */}
      {activeWorkflow && (viewMode === 'both' || viewMode === 'matrix') && (
        <div className="space-y-6">
          {/* 1. Model Dependencies Section */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-slate-100 font-bold text-base">
                <HardDrive className="text-purple-400" size={20} />
                <h2>Model Dependencies ({totalModelsCount})</h2>
              </div>
              <span className="text-xs text-slate-400">
                {installedModelsCount} installed • {missingModelsCount} missing
              </span>
            </div>

            {activeWorkflow.models.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">
                No model files detected in this workflow.
              </p>
            ) : (
              <div className="space-y-2.5">
                {activeWorkflow.models.map((model, mIdx) => {
                  const task = activeTasks[model.modelName.toLowerCase()];
                  const isDownloading = task && (task.status === 'downloading' || task.status === 'pending');

                  return (
                    <div
                      key={mIdx}
                      className={`p-4 rounded-2xl border transition-all ${
                        model.isInstalled
                          ? 'bg-slate-900/60 border-slate-800/80 text-slate-200'
                          : 'bg-amber-950/10 border-amber-500/30 text-amber-200'
                      }`}
                    >
                      <div className="flex items-start md:items-center justify-between gap-4 flex-col md:flex-row">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {model.isInstalled ? (
                              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                            ) : (
                              <AlertCircle size={16} className="text-amber-400 shrink-0" />
                            )}
                            <span className="font-bold text-xs font-mono text-slate-100">
                              {model.modelName}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                              {model.nodeType}
                            </span>
                          </div>

                          {model.isInstalled ? (
                            <p className="text-[11px] text-slate-400 font-mono truncate max-w-xl">
                              {model.localPath}
                            </p>
                          ) : (
                            <p className="text-[11px] text-amber-300/80">
                              Model file not found locally. Download from CivitAI or Hugging Face.
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        {!model.isInstalled && (
                          <div className="flex items-center gap-2 shrink-0">
                            {onSearchModel && (
                              <button
                                onClick={() => {
                                  const cleanSearchTerm = model.modelName
                                    .replace(/\.(safetensors|ckpt|pt|pth|gguf)$/i, '')
                                    .replace(/[-_]/g, ' ');
                                  onSearchModel(cleanSearchTerm);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow cursor-pointer"
                              >
                                <Search size={13} />
                                <span>Search CivitAI</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Inline Download Progress Bar */}
                      {isDownloading && task && (
                        <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-mono text-cyan-300">
                            <span>Downloading: {task.progress}%</span>
                            <span>{(task.speedBps / (1024 * 1024)).toFixed(1)} MB/s</span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-linear-to-r from-cyan-500 to-blue-500 h-full transition-all duration-300"
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Custom Node Extensions Section */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-slate-100 font-bold text-base">
                <Package className="text-cyan-400" size={20} />
                <h2>Custom Node Extensions ({totalCustomNodesCount})</h2>
              </div>
              <span className="text-xs text-slate-400">
                {installedCustomNodesCount} installed • {missingCustomNodesCount} missing
              </span>
            </div>

            {Object.keys(nodeResolutions).length === 0 && !isResolvingNodes ? (
              <p className="text-xs text-slate-500 italic py-2">
                No custom node classes detected in this workflow.
              </p>
            ) : (
              <div className="space-y-4">
                {Object.entries(nodeResolutions).map(([nodeType, resolution]) => {
                  const isSelected = selectedNodeId === nodeType;

                  return (
                    <div
                      key={nodeType}
                      className={`transition-all ${isSelected ? 'ring-2 ring-cyan-400 rounded-2xl' : ''}`}
                    >
                      <NodeResolutionCard
                        nodeType={nodeType}
                        resolution={resolution}
                        onLocateInWorkflow={(type) => {
                          setSelectedNodeId(type);
                          nodeMapRef.current?.zoomToNodeType(type);
                        }}
                        onInstalled={(folderName) => {
                          // Update resolution locally
                          setNodeResolutions((prev) => ({
                            ...prev,
                            [nodeType]: {
                              ...prev[nodeType],
                              isInstalled: true,
                              installedFolder: folderName,
                            },
                          }));
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};