/**
 * CivitAI Model Manager - ComfyUI Edition
 * Copyright (C) 2025-2026 TheStygianRenegade / /dev/null Inc
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  ZoomIn,
  ZoomOut,
  Maximize2,
  HardDrive,
  ExternalLink,
  ChevronRight,
  Package,
  Activity,
  ArrowRight,
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
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'both' | 'map' | 'matrix'>('both');
  const [selectedNodeId, setSelectedNodeId] = useState<string | number | null>(null);

  // Resolution states for custom node classes
  const [nodeResolutions, setNodeResolutions] = useState<Record<string, NodeResolutionResult>>({});
  const [isResolvingNodes, setIsResolvingNodes] = useState<boolean>(false);

  // Active download tracking for inline progress
  const [activeTasks, setActiveTasks] = useState<Record<string, DownloadTask>>({});

  // Canvas pan & zoom state
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: y0Offset() });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingCanvas = useRef<boolean>(false);
  const dragStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  function y0Offset() {
    return 0;
  }

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

  // Load configured workflows on initial mount if none currently loaded
  useEffect(() => {
    if (workflows.length === 0) {
      loadWorkflows();
    } else if (workflows[selectedWorkflowIndex]) {
      resolveWorkflowNodes(workflows[selectedWorkflowIndex]);
    }
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

  const loadWorkflows = async () => {
    if (!window.civitaiAPI?.scanWorkflows) return;
    setIsLoadingWorkflows(true);
    try {
      const results: WorkflowInfo[] = await window.civitaiAPI.scanWorkflows();
      if (results && results.length > 0) {
        setWorkflows(results);
        setSelectedWorkflowIndex(0);
        resolveWorkflowNodes(results[0]);
      }
    } catch (err) {
      console.error('Failed to scan workflows:', err);
    } finally {
      setIsLoadingWorkflows(false);
    }
  };

  const activeWorkflow: WorkflowInfo | undefined = workflows[selectedWorkflowIndex];

  // Resolve custom node classes for active workflow
  const resolveWorkflowNodes = async (wf?: WorkflowInfo) => {
    if (!wf || !wf.nodeTypes || wf.nodeTypes.length === 0 || !window.civitaiAPI?.resolveMissingNode) {
      return;
    }

    setIsResolvingNodes(true);
    const newResolutions: Record<string, NodeResolutionResult> = {};

    // Standard ComfyUI Core built-in nodes that do not require custom extensions
    const coreBuiltinNodes = new Set([
      'KSampler',
      'KSamplerAdvanced',
      'CheckpointLoaderSimple',
      'CheckpointLoader',
      'VAELoader',
      'VAEDecode',
      'VAEEncode',
      'CLIPTextEncode',
      'CLIPLoader',
      'DualCLIPLoader',
      'TripleCLIPLoader',
      'UNETLoader',
      'DiffusionModelLoader',
      'LoraLoader',
      'LoraLoaderModelOnly',
      'ControlNetLoader',
      'ControlNetApply',
      'ControlNetApplyAdvanced',
      'EmptyLatentImage',
      'SaveImage',
      'PreviewImage',
      'LoadImage',
      'UpscaleModelLoader',
      'ImageUpscaleWithModel',
      'ImageScale',
      'ImageScaleBy',
      'LatentUpscale',
      'LatentUpscaleBy',
      'ConditioningCombine',
      'ConditioningAverage',
      'ConditioningConcat',
      'ConditioningSetArea',
      'Reroute',
      'PrimitiveNode',
      'Note',
    ]);

    for (const nodeType of wf.nodeTypes) {
      if (coreBuiltinNodes.has(nodeType)) {
        newResolutions[nodeType] = {
          nodeType,
          isInstalled: true,
          installedFolder: 'ComfyUI Core (Built-in)',
          githubCandidates: [],
        };
        continue;
      }

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
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
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

          // UI Canvas format
          const nodes = parsed.nodes || parsed.workflow?.nodes || [];
          if (Array.isArray(nodes)) {
            for (const n of nodes) {
              if (n.type) nodeTypes.add(n.type);
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
                const classType = nodeObj.class_type || nodeObj.type;
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
          const nodes = rawData.nodes || [];
          if (Array.isArray(nodes)) {
            for (const n of nodes) {
              if (n.type) nodeTypes.add(n.type);
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

  // Canvas drag & pan handlers
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDraggingCanvas.current = true;
    dragStartPos.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCanvas.current) return;
    setPanOffset({
      x: e.clientX - dragStartPos.current.x,
      y: e.clientY - dragStartPos.current.y,
    });
  };

  const handleCanvasMouseUp = () => {
    isDraggingCanvas.current = false;
  };

  // Compute node readiness status
  const getNodeStatus = (node: CanvasNode): 'ready' | 'missing-model' | 'missing-node' => {
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
  };

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
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20 transition-all cursor-pointer"
          >
            <Upload size={15} />
            <span>Upload JSON / PNG</span>
          </button>

          <button
            onClick={loadWorkflows}
            disabled={isLoadingWorkflows}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
            title="Scan configured ComfyUI directories for workflow files"
          >
            <RefreshCw size={14} className={isLoadingWorkflows ? 'animate-spin text-cyan-400' : ''} />
            <span>Scan Folders</span>
          </button>
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
                        ? 'bg-gradient-to-r from-purple-950/60 to-indigo-950/60 border-purple-500/60 shadow-lg shadow-purple-900/30'
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
      {activeWorkflow && (viewMode === 'both' || viewMode === 'map') && (
        <div className="glass-panel rounded-3xl border border-slate-800 shadow-2xl overflow-hidden space-y-2">
          {/* Map Toolbar */}
          <div className="px-6 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <Workflow size={16} className="text-cyan-400" />
              <span>Visual Node Map</span>
              <span className="text-[11px] text-slate-500 font-normal">
                (Click nodes to focus resolution cards)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.4, z - 0.15))}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut size={14} />
              </button>
              <span className="text-xs font-mono text-slate-400 min-w-[45px] text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(2.0, z + 0.15))}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Zoom In"
              >
                <ZoomIn size={14} />
              </button>
              <button
                onClick={() => {
                  setZoomLevel(1);
                  setPanOffset({ x: 0, y: 0 });
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors ml-1"
                title="Reset View"
              >
                <Maximize2 size={14} />
              </button>
            </div>
          </div>

          {/* Interactive Graph Viewport */}
          <div
            ref={canvasContainerRef}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            className="relative h-[420px] w-full overflow-hidden bg-[#0a0d14] cursor-grab active:cursor-grabbing select-none"
            style={{
              backgroundImage:
                'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          >
            <div
              className="absolute transition-transform duration-75"
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                transformOrigin: '0 0',
              }}
            >
              {/* Render Node Blocks */}
              {activeWorkflow.canvasGraph?.nodes && activeWorkflow.canvasGraph.nodes.length > 0 ? (
                activeWorkflow.canvasGraph.nodes.map((node) => {
                  const status = getNodeStatus(node);
                  const isSelected = selectedNodeId === node.id || selectedNodeId === node.type;
                  const pos = node.pos || [100, 100];

                  return (
                    <div
                      key={node.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNodeId(node.type);
                      }}
                      style={{
                        position: 'absolute',
                        left: `${pos[0]}px`,
                        top: `${pos[1]}px`,
                        minWidth: '220px',
                      }}
                      className={`p-3 rounded-2xl border transition-all shadow-xl cursor-pointer ${
                        isSelected
                          ? 'ring-2 ring-cyan-400 bg-slate-900 border-cyan-500 z-30 scale-105'
                          : status === 'ready'
                          ? 'bg-slate-900/90 border-slate-700/80 hover:border-slate-600'
                          : status === 'missing-model'
                          ? 'bg-amber-950/30 border-amber-500/60 hover:border-amber-400'
                          : 'bg-rose-950/30 border-rose-500/60 hover:border-rose-400'
                      }`}
                    >
                      {/* Node Header */}
                      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800">
                        <span className="text-xs font-bold text-slate-100 font-mono truncate">
                          {node.type}
                        </span>
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            status === 'ready'
                              ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                              : status === 'missing-model'
                              ? 'bg-amber-400 shadow-sm shadow-amber-400/50'
                              : 'bg-rose-400 shadow-sm shadow-rose-400/50'
                          }`}
                          title={
                            status === 'ready'
                              ? 'Ready'
                              : status === 'missing-model'
                              ? 'Missing Model File'
                              : 'Missing Custom Node Extension'
                          }
                        />
                      </div>

                      {/* Node Inputs / Outputs count */}
                      <div className="pt-2 text-[10px] text-slate-400 flex items-center justify-between">
                        <span>ID #{node.id}</span>
                        <span
                          className={`font-semibold ${
                            status === 'ready'
                              ? 'text-emerald-400'
                              : status === 'missing-model'
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {status === 'ready'
                            ? 'Ready'
                            : status === 'missing-model'
                            ? 'Missing Model'
                            : 'Missing Extension'}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-12 text-center text-slate-500 text-xs">
                  No visual canvas coordinates embedded. Synthesized execution layout will appear here.
                </div>
              )}
            </div>
          </div>
        </div>
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
                              className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-300"
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
