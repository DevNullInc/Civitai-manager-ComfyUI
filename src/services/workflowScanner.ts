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
import { WorkflowInfo, WorkflowModelReference } from '../types/app';
import { dbManager } from '../db/db';
import { logger } from '../utils/logger';

const MODEL_NODE_KEYS: Record<string, string[]> = {
  ckpt_name: ['CheckpointLoaderSimple', 'CheckpointLoader', 'Efficient Loader', 'ImpactCheckpointLoader'],
  unet_name: ['UNETLoader', 'DiffusionModelLoader'],
  lora_name: ['LoraLoader', 'LoraLoaderModelOnly', 'LoraLoader|pysssss', 'ImpactLoraLoader'],
  vae_name: ['VAELoader', 'ImpactVAELoader'],
  control_net_name: ['ControlNetLoader', 'ControlNetLoaderAdvanced'],
  clip_name: ['CLIPVisionLoader', 'CLIPLoader'],
  clip_name1: ['DualCLIPLoader'],
  clip_name2: ['DualCLIPLoader', 'TripleCLIPLoader'],
  clip_name3: ['TripleCLIPLoader'],
  model_name: ['UpscaleModelLoader'],
  ipadapter_file: ['IPAdapterModelLoader', 'IPAdapterUnifiedLoader'],
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
        if (modelRefs.length > 0) {
          results.push({
            filePath,
            fileName: path.basename(filePath),
            fileType: ext === '.json' ? 'json' : 'png',
            modelCount: modelRefs.length,
            models: modelRefs,
          });
        }
      } catch (err: any) {
        logger.warn(`Failed to process workflow file ${filePath}:`, err.message);
      }
    }

    return results;
  }

  private collectWorkflowFiles(dir: string, list: string[], depth = 0) {
    if (depth > 5 || !fs.existsSync(dir)) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
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

      let offset = 8;
      while (offset < buffer.length) {
        const length = buffer.readUInt32BE(offset);
        const type = buffer.toString('ascii', offset + 4, offset + 8);
        const dataStart = offset + 8;
        const dataEnd = dataStart + length;

        if (type === 'tEXt') {
          const chunkData = buffer.slice(dataStart, dataEnd);
          const nullIdx = chunkData.indexOf(0);
          if (nullIdx > 0) {
            const key = chunkData.slice(0, nullIdx).toString('latin1');
            const val = chunkData.slice(nullIdx + 1).toString('utf-8');
            if (key === 'prompt' || key === 'workflow') {
              try {
                return JSON.parse(val);
              } catch {}
            }
          }
        } else if (type === 'iTXt') {
          const chunkData = buffer.slice(dataStart, dataEnd);
          const nullIdx = chunkData.indexOf(0);
          if (nullIdx > 0) {
            const key = chunkData.slice(0, nullIdx).toString('utf-8');
            const compFlag = chunkData[nullIdx + 1];
            // Skip compMethod, langTag, transKey null separators
            let textOffset = nullIdx + 3;
            // Scan past lang tag null
            while (textOffset < chunkData.length && chunkData[textOffset] !== 0) textOffset++;
            textOffset++;
            // Scan past trans key null
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

            if ((key === 'prompt' || key === 'workflow') && uncompressedText) {
              try {
                return JSON.parse(uncompressedText);
              } catch {}
            }
          }
        }

        offset = dataEnd + 4; // Skip 4-byte CRC
      }
    } catch (e) {
      logger.warn(`Error parsing PNG chunks for workflow: ${filePath}`, e);
    }
    return null;
  }

  extractModelReferences(data: any, localModelMap: Map<string, string>): WorkflowModelReference[] {
    const refs: WorkflowModelReference[] = [];
    const seen = new Set<string>();

    const checkAndAdd = (nodeId: string, nodeType: string, inputName: string, modelName: string) => {
      if (!modelName || typeof modelName !== 'string') return;
      const cleanName = path.basename(modelName.trim());
      if (!cleanName || cleanName === 'None' || cleanName === 'undefined') return;

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

    // Format 1: API prompt format { "1": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": "..." } } }
    const rootNodes = data.prompt ? data.prompt : data;
    if (rootNodes && typeof rootNodes === 'object') {
      for (const [nodeId, node] of Object.entries<any>(rootNodes)) {
        if (!node || typeof node !== 'object') continue;
        const classType = node.class_type || node.type || '';
        const inputs = node.inputs || {};

        for (const [inputKey, val] of Object.entries(inputs)) {
          if (typeof val === 'string') {
            const lowerKey = inputKey.toLowerCase();
            const lowerClass = classType.toLowerCase();
            if (
              lowerKey.includes('ckpt') ||
              lowerKey.includes('lora') ||
              lowerKey.includes('vae') ||
              lowerKey.includes('model') ||
              lowerKey.includes('clip') ||
              lowerKey.includes('unet')
            ) {
              checkAndAdd(nodeId, classType || 'Loader', inputKey, val);
            }
          }
        }
      }
    }

    // Format 2: UI workflow format { "nodes": [ { "id": 1, "type": "CheckpointLoaderSimple", "widgets_values": ["..."] } ] }
    const uiWorkflow = data.workflow ? data.workflow : data;
    if (uiWorkflow && Array.isArray(uiWorkflow.nodes)) {
      for (const node of uiWorkflow.nodes) {
        if (!node) continue;
        const nodeId = node.id || 'node';
        const nodeType = node.type || 'Node';
        const widgets = node.widgets_values;

        if (Array.isArray(widgets)) {
          for (const w of widgets) {
            if (typeof w === 'string') {
              const lowerVal = w.toLowerCase();
              if (
                lowerVal.endsWith('.safetensors') ||
                lowerVal.endsWith('.ckpt') ||
                lowerVal.endsWith('.pt') ||
                lowerVal.endsWith('.pth') ||
                lowerVal.endsWith('.gguf') ||
                lowerVal.endsWith('.bin')
              ) {
                checkAndAdd(String(nodeId), nodeType, 'widget_value', w);
              }
            }
          }
        }
      }
    }

    return refs;
  }
}

export const workflowScanner = new WorkflowScanner();
