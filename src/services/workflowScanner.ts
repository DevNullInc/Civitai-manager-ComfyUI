/**
 * CivitAI Model Manager - ComfyUI Edition
 * Copyright (C) 2025-2026 TheStygianRenegade / /dev/null Inc
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { WorkflowInfo, WorkflowModelReference, CanvasGraph } from '../types/app';
import { dbManager } from '../db/db';
import { logger } from '../utils/logger';

const MODEL_NODE_KEYS: Record<string, string[]> = {
  ckpt_name: ['CheckpointLoaderSimple', 'CheckpointLoader', 'Efficient Loader', 'ImpactCheckpointLoader', 'CMMDownloadModel'],
  unet_name: ['UNETLoader', 'DiffusionModelLoader', 'CMMDownloadModel'],
  lora_name: ['LoraLoader', 'LoraLoaderModelOnly', 'LoraLoader|pysssss', 'ImpactLoraLoader', 'CMMDownloadModel'],
  vae_name: ['VAELoader', 'ImpactVAELoader', 'CMMDownloadModel'],
  control_net_name: ['ControlNetLoader', 'ControlNetLoaderAdvanced', 'CMMDownloadModel'],
  clip_name: ['CLIPVisionLoader', 'CLIPLoader'],
  clip_name1: ['DualCLIPLoader'],
  clip_name2: ['DualCLIPLoader', 'TripleCLIPLoader'],
  clip_name3: ['TripleCLIPLoader'],
  model_name: ['UpscaleModelLoader', 'CMMDownloadModel', 'CMMCheckHuggingFace'],
  ipadapter_file: ['IPAdapterModelLoader', 'IPAdapterUnifiedLoader', 'CMMDownloadModel'],
  photomaker_model_name: ['PhotoMakerLoader'],
  gligen_name: ['GLIGENLoader'],
};

export class WorkflowScanner {
  async scanWorkflows(folderPaths: string | string[]): Promise<WorkflowInfo[]> {
    const paths = Array.isArray(folderPaths) ? folderPaths : [folderPaths];
    const existingPaths = paths.filter((p) => p && fs.existsSync(p));
    if (existingPaths.length === 0) {
      return [];
    }

    const workflowFiles: string[] = [];
    for (const p of existingPaths) {
      this.collectWorkflowFiles(p, workflowFiles);
    }

    logger.info(`Discovered ${workflowFiles.length} workflow file(s) for analysis.`);

    // Load all known local model filenames from SQLite for instant matching
    const localRows: any[] = await dbManager.all('SELECT file_name, file_path FROM local_models;');
    const localModelMap = new Map<string, string>();
    for (const r of localRows) {
      if (r.file_name) {
        localModelMap.set(r.file_name.toLowerCase(), r.file_path);
      }
      if (r.file_path) {
        localModelMap.set(path.basename(r.file_path).toLowerCase(), r.file_path);
      }
    }

    const results: WorkflowInfo[] = [];

    for (const filePath of workflowFiles) {
      try {
        const ext = path.extname(filePath).toLowerCase();
        let parsedData: any = null;

        if (ext === '.json') {
          const raw = fs.readFileSync(filePath, 'utf-8');
          try {
            parsedData = JSON.parse(raw);
          } catch {
            continue;
          }
        } else if (ext === '.png') {
          parsedData = this.extractPngWorkflow(filePath);
        }

        if (!parsedData) continue;

        const modelRefs = this.extractModelReferences(parsedData, localModelMap);
        const nodeTypes = this.extractNodeTypes(parsedData);
        const canvasGraph = this.buildCanvasGraph(parsedData);
        if (modelRefs.length > 0 || nodeTypes.length > 0 || canvasGraph) {
          results.push({
            filePath,
            fileName: path.basename(filePath),
            fileType: ext === '.json' ? 'json' : 'png',
            modelCount: modelRefs.length,
            models: modelRefs,
            nodeTypes,
            rawGraph: parsedData,
            canvasGraph,
          });
        }
      } catch (err: any) {
        logger.warn(`Failed to process workflow file ${filePath}:`, err.message);
      }
    }

    return results;
  }

  /**
   * Deep normalizer for ComfyUI workflow JSON formats (Canvas UI, Prompt API, stringified metadata wrappers).
   */
  normalizeWorkflowData(raw: any): any {
    if (!raw) return null;
    let data = raw;

    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e: any) {
        throw new Error(`Invalid workflow JSON format: ${e.message}`);
      }
    }

    if (!data || typeof data !== 'object') {
      throw new Error('Workflow payload must be a valid JSON object');
    }

    // Check if root is an array of nodes
    if (Array.isArray(data)) {
      return { nodes: data, links: [] };
    }

    // Unpack stringified subfields
    if (typeof data.workflow === 'string') {
      try {
        data.workflow = JSON.parse(data.workflow);
      } catch {}
    }
    if (typeof data.prompt === 'string') {
      try {
        data.prompt = JSON.parse(data.prompt);
      } catch {}
    }

    // Unpack CivitAI / extra_pnginfo metadata wrappers
    if (data.extra_pnginfo?.workflow) {
      const nested =
        typeof data.extra_pnginfo.workflow === 'string'
          ? JSON.parse(data.extra_pnginfo.workflow)
          : data.extra_pnginfo.workflow;
      data = { ...data, ...nested, workflow: nested };
    }
    if (data.extra?.prompt) {
      const nested =
        typeof data.extra.prompt === 'string'
          ? JSON.parse(data.extra.prompt)
          : data.extra.prompt;
      data = { ...data, prompt: nested };
    }

    // If data.workflow is an object containing nodes, promote nodes to top level
    if (data.workflow && typeof data.workflow === 'object' && Array.isArray(data.workflow.nodes)) {
      data = { ...data.workflow, ...data, nodes: data.workflow.nodes, links: data.workflow.links || [] };
    }

    return data;
  }

  /**
   * Parse a raw JSON workflow or API prompt object/string directly from memory
   * with strict validation.
   */
  async parseWorkflow(workflowData: any, workflowName = 'direct_workflow.json'): Promise<WorkflowInfo> {
    const normalized = this.normalizeWorkflowData(workflowData);
    if (!normalized) {
      throw new Error(`Invalid workflow JSON format in "${workflowName}": Unable to parse JSON object.`);
    }

    // Load known local models from SQLite for instant matching
    let localModelMap = new Map<string, string>();
    try {
      if (!(dbManager as any).db) {
        await dbManager.init().catch(() => {});
      }
      const localRows: any[] = (await dbManager.all('SELECT file_name, file_path FROM local_models;')) || [];
      for (const r of localRows) {
        if (r.file_name) {
          localModelMap.set(r.file_name.toLowerCase(), r.file_path);
        }
        if (r.file_path) {
          localModelMap.set(path.basename(r.file_path).toLowerCase(), r.file_path);
        }
      }
    } catch {}

    const modelRefs = this.extractModelReferences(normalized, localModelMap);
    const nodeTypes = this.extractNodeTypes(normalized);
    const canvasGraph = this.buildCanvasGraph(normalized);

    const hasNodes = (canvasGraph?.nodes && canvasGraph.nodes.length > 0) || nodeTypes.length > 0;
    if (!hasNodes && modelRefs.length === 0) {
      throw new Error(
        `Invalid ComfyUI workflow JSON: No recognizable ComfyUI nodes or prompt execution graph found in "${workflowName}". Please ensure this is an exported ComfyUI workflow (.json) or ComfyUI API prompt.`
      );
    }

    return {
      filePath: '',
      fileName: workflowName,
      fileType: 'json',
      modelCount: modelRefs.length,
      models: modelRefs,
      nodeTypes,
      rawGraph: normalized,
      canvasGraph,
    };
  }

  buildCanvasGraph(data: any): CanvasGraph | undefined {
    if (!data || typeof data !== 'object') return undefined;
    const normalized = this.normalizeWorkflowData(data) || data;

    // 1. Full UI Canvas Workflow format (nodes with positions & link definitions)
    const uiWorkflow = normalized.workflow ? normalized.workflow : (normalized.nodes ? normalized : null);
    if (uiWorkflow && Array.isArray(uiWorkflow.nodes)) {
      return {
        nodes: uiWorkflow.nodes.map((n: any) => ({
          id: n.id,
          type: n.type || n.class_type || 'Node',
          pos: Array.isArray(n.pos) ? [n.pos[0], n.pos[1]] : [100, 100],
          size: n.size || [220, 120],
          inputs: Array.isArray(n.inputs) ? n.inputs : [],
          outputs: Array.isArray(n.outputs) ? n.outputs : [],
          widgets_values: Array.isArray(n.widgets_values) ? n.widgets_values : [],
          title: n.title,
          color: n.color,
          bgcolor: n.bgcolor,
        })),
        links: Array.isArray(uiWorkflow.links) ? uiWorkflow.links : [],
        groups: Array.isArray(uiWorkflow.groups) ? uiWorkflow.groups : [],
      };
    }

    // 2. Fallback: Synthesize spatial layout from prompt execution dictionary
    const promptNodes = normalized.prompt ? normalized.prompt : normalized;
    if (promptNodes && typeof promptNodes === 'object' && !Array.isArray(promptNodes)) {
      const nodeEntries = Object.entries<any>(promptNodes).filter(([_, v]) => v && typeof v === 'object' && (v.class_type || v.type || v.inputs));
      if (nodeEntries.length > 0) {
        const nodes: any[] = [];
        const links: any[] = [];
        let linkIdCounter = 1;

        nodeEntries.forEach(([id, nodeObj], index) => {
          const col = index % 4;
          const row = Math.floor(index / 4);
          const classType = nodeObj.class_type || nodeObj.type || 'Node';
          const inputs = nodeObj.inputs || {};

          const nodeInputs: any[] = [];
          for (const [inKey, inVal] of Object.entries(inputs)) {
            if (Array.isArray(inVal) && inVal.length === 2 && typeof inVal[0] === 'string') {
              const srcNodeId = inVal[0];
              const srcSlot = inVal[1];
              const linkId = linkIdCounter++;
              nodeInputs.push({ name: inKey, type: 'any', link: linkId });
              links.push([linkId, Number(srcNodeId) || srcNodeId, srcSlot, Number(id) || id, nodeInputs.length - 1, 'any']);
            } else {
              nodeInputs.push({ name: inKey, type: typeof inVal, link: null });
            }
          }

          nodes.push({
            id: Number(id) || id,
            type: classType,
            pos: [80 + col * 320, 80 + row * 220],
            size: [240, 140],
            inputs: nodeInputs,
            outputs: [{ name: 'OUT', type: 'any' }],
          });
        });

        return { nodes, links, groups: [] };
      }
    }

    return undefined;
  }

  extractNodeTypes(data: any): string[] {
    const types = new Set<string>();
    if (!data || typeof data !== 'object') return [];
    const normalized = this.normalizeWorkflowData(data) || data;

    // Format 1: UI workflow format
    const uiWorkflow = normalized.workflow ? normalized.workflow : normalized;
    if (uiWorkflow && Array.isArray(uiWorkflow.nodes)) {
      for (const node of uiWorkflow.nodes) {
        if (node && typeof node === 'object') {
          const t = node.type || node.class_type;
          if (t && typeof t === 'string' && t.trim()) {
            types.add(t.trim());
          }
        }
      }
    }

    // Format 2: API prompt format
    const rootNodes = normalized.prompt ? normalized.prompt : (uiWorkflow?.nodes ? null : normalized);
    if (rootNodes && typeof rootNodes === 'object' && !Array.isArray(rootNodes)) {
      for (const node of Object.values<any>(rootNodes)) {
        if (node && typeof node === 'object') {
          const t = node.class_type || node.type;
          if (t && typeof t === 'string' && t.trim()) {
            types.add(t.trim());
          }
        }
      }
    }

    return Array.from(types).sort((a, b) => a.localeCompare(b));
  }

  /** Directories that should never be traversed when looking for workflow files. */
  private static readonly EXCLUDED_DIRS = new Set([
    'node_modules', '.git', '.venv', 'venv', '__pycache__', '.cache',
    'dist', 'build', 'output', 'temp', 'tmp', '.temp', '.tmp',
    'web', 'web_custom_versions', 'tests', 'test',
    '.tox', '.mypy_cache', '.pytest_cache', '.eggs',
  ]);

  private collectWorkflowFiles(dir: string, list: string[], depth = 0) {
    if (depth > 5 || !fs.existsSync(dir)) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (WorkflowScanner.EXCLUDED_DIRS.has(entry.name.toLowerCase())) continue;
          this.collectWorkflowFiles(fullPath, list, depth + 1);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (ext === '.json' || ext === '.png') {
            list.push(fullPath);
          }
        }
      }
    } catch {}
  }

  extractPngWorkflow(filePath: string): any {
    try {
      const buffer = fs.readFileSync(filePath);
      return this.extractPngWorkflowFromBuffer(buffer);
    } catch (e: any) {
      logger.warn(`Error reading PNG workflow file: ${filePath}`, e);
      return null;
    }
  }

  extractPngWorkflowFromBuffer(buffer: Buffer): any {
    try {
      // Verify PNG signature: 89 50 4E 47 0D 0A 1A 0A
      if (
        buffer[0] !== 0x89 ||
        buffer[1] !== 0x50 ||
        buffer[2] !== 0x4e ||
        buffer[3] !== 0x47 ||
        buffer[4] !== 0x0d ||
        buffer[5] !== 0x0a ||
        buffer[6] !== 0x1a ||
        buffer[7] !== 0x0a
      ) {
        return null;
      }

      let workflowData: any = null;
      let promptData: any = null;

      let offset = 8;
      while (offset < buffer.length) {
        if (offset + 8 > buffer.length) break;
        const length = buffer.readUInt32BE(offset);
        const type = buffer.toString('ascii', offset + 4, offset + 8);
        const dataStart = offset + 8;
        const dataEnd = dataStart + length;
        if (dataEnd > buffer.length) break;

        if (type === 'tEXt') {
          const chunkData = buffer.slice(dataStart, dataEnd);
          const nullIdx = chunkData.indexOf(0);
          if (nullIdx > 0) {
            const key = chunkData.slice(0, nullIdx).toString('latin1');
            const val = chunkData.slice(nullIdx + 1).toString('utf-8');
            try {
              if (key === 'workflow') {
                workflowData = JSON.parse(val);
              } else if (key === 'prompt') {
                promptData = JSON.parse(val);
              }
            } catch {}
          }
        } else if (type === 'iTXt') {
          const chunkData = buffer.slice(dataStart, dataEnd);
          const nullIdx = chunkData.indexOf(0);
          if (nullIdx > 0) {
            const key = chunkData.slice(0, nullIdx).toString('utf-8');
            const compFlag = chunkData[nullIdx + 1];
            // Skip compMethod, langTag, transKey null separators
            let textOffset = nullIdx + 3;
            while (textOffset < chunkData.length && chunkData[textOffset] !== 0) textOffset++;
            textOffset++;
            while (textOffset < chunkData.length && chunkData[textOffset] !== 0) textOffset++;
            textOffset++;

            const textBuffer = chunkData.slice(textOffset);
            let uncompressedText = '';
            if (compFlag === 1) {
              try {
                uncompressedText = zlib.inflateSync(textBuffer).toString('utf-8');
              } catch {}
            } else {
              uncompressedText = textBuffer.toString('utf-8');
            }

            if (uncompressedText) {
              try {
                if (key === 'workflow') {
                  workflowData = JSON.parse(uncompressedText);
                } else if (key === 'prompt') {
                  promptData = JSON.parse(uncompressedText);
                }
              } catch {}
            }
          }
        }

        offset = dataEnd + 4; // Skip 4-byte CRC
      }

      if (workflowData && promptData) {
        return { ...workflowData, workflow: workflowData, prompt: promptData };
      }
      if (workflowData) return workflowData;
      if (promptData) return promptData;
    } catch (e) {
      logger.warn('Error parsing PNG chunks for workflow buffer', e);
    }
    return null;
  }

  extractModelReferences(data: any, localModelMap: Map<string, string>): WorkflowModelReference[] {
    const refs: WorkflowModelReference[] = [];
    const seen = new Set<string>();
    const normalized = this.normalizeWorkflowData(data) || data;

    const checkAndAdd = (nodeId: string, nodeType: string, inputName: string, modelName: any) => {
      if (!modelName || typeof modelName !== 'string') return;
      const cleanName = path.basename(modelName.trim());
      if (
        !cleanName ||
        cleanName === 'None' ||
        cleanName === 'undefined' ||
        cleanName === 'null' ||
        cleanName.startsWith('http://') ||
        cleanName.startsWith('https://')
      ) {
        return;
      }

      const lowerName = cleanName.toLowerCase();
      const isKnownModelExt =
        lowerName.endsWith('.safetensors') ||
        lowerName.endsWith('.ckpt') ||
        lowerName.endsWith('.pt') ||
        lowerName.endsWith('.pth') ||
        lowerName.endsWith('.gguf') ||
        lowerName.endsWith('.bin') ||
        lowerName.endsWith('.onnx');

      const isModelLoader =
        nodeType.toLowerCase().includes('loader') ||
        nodeType.toLowerCase().includes('checkpoint') ||
        nodeType.toLowerCase().includes('lora') ||
        nodeType.toLowerCase().includes('unet') ||
        nodeType.toLowerCase().includes('diffusion') ||
        nodeType.toLowerCase().includes('vae');

      const isModelKey =
        inputName.toLowerCase().includes('ckpt') ||
        inputName.toLowerCase().includes('lora') ||
        inputName.toLowerCase().includes('vae') ||
        inputName.toLowerCase().includes('unet') ||
        inputName.toLowerCase().includes('model') ||
        inputName.toLowerCase().includes('clip') ||
        inputName.toLowerCase().includes('control_net') ||
        inputName.toLowerCase().includes('widget');

      if (!isKnownModelExt && !(isModelLoader && isModelKey)) {
        return;
      }

      const key = `${nodeType}:${inputName}:${cleanName.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);

      const localPath = localModelMap.get(cleanName.toLowerCase());
      refs.push({
        nodeId: String(nodeId),
        nodeType,
        inputName,
        modelName: cleanName,
        isInstalled: !!localPath,
        localPath,
      });
    };

    // 1. UI workflow format { "nodes": [ ... ] }
    const uiWorkflow = normalized.workflow ? normalized.workflow : normalized;
    if (uiWorkflow && Array.isArray(uiWorkflow.nodes)) {
      for (const node of uiWorkflow.nodes) {
        if (!node) continue;
        const nodeId = node.id || 'node';
        const nodeType = node.type || node.class_type || 'Node';
        const widgets = node.widgets_values;

        if (Array.isArray(widgets)) {
          for (let i = 0; i < widgets.length; i++) {
            const w = widgets[i];
            if (typeof w === 'string') {
              checkAndAdd(String(nodeId), nodeType, `widget_${i}`, w);
            }
          }
        } else if (widgets && typeof widgets === 'object') {
          for (const [k, v] of Object.entries(widgets)) {
            if (typeof v === 'string') {
              checkAndAdd(String(nodeId), nodeType, k, v);
            }
          }
        }

        if (node.inputs && typeof node.inputs === 'object') {
          const inputList = Array.isArray(node.inputs) ? node.inputs : Object.values(node.inputs);
          for (const inObj of inputList as any[]) {
            if (inObj && typeof inObj === 'object' && typeof inObj.value === 'string') {
              checkAndAdd(String(nodeId), nodeType, inObj.name || 'input', inObj.value);
            }
          }
        }
      }
    }

    // 2. API prompt format { "1": { "class_type": "...", "inputs": { ... } } }
    const rootNodes = normalized.prompt ? normalized.prompt : (uiWorkflow?.nodes ? null : normalized);
    if (rootNodes && typeof rootNodes === 'object' && !Array.isArray(rootNodes)) {
      for (const [nodeId, node] of Object.entries<any>(rootNodes)) {
        if (!node || typeof node !== 'object') continue;
        const classType = node.class_type || node.type || '';
        const inputs = node.inputs || {};

        for (const [inputKey, val] of Object.entries(inputs)) {
          if (typeof val === 'string') {
            checkAndAdd(nodeId, classType || 'Loader', inputKey, val);
          }
        }
      }
    }

    return refs;
  }
}

export const workflowScanner = new WorkflowScanner();
