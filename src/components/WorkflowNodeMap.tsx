/**
 * Renegade Core Model Manager (RenegadeCMM)
 * Copyright (C) 2025-2026 TheStygianRenegade / /dev/null Inc
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { LGraph, LGraphCanvas, LGraphNode } from 'litegraph.js';
import 'litegraph.js/css/litegraph.css';
import { ZoomIn, ZoomOut, Maximize2, Crosshair, X, Workflow } from 'lucide-react';
import { CanvasGraph, CanvasNode } from '../types/app';

export type NodeStatus = 'ready' | 'missing-model' | 'missing-node';
export type WorkflowViewMode = 'both' | 'map' | 'matrix';

export interface WorkflowNodeMapHandle {
  /** Pans and zooms the map so the first node of the given type fills the viewport. */
  zoomToNodeType: (nodeType: string | number | null) => void;
}

const STATUS_COLORS: Record<NodeStatus, { color: string; bgcolor: string }> = {
  ready: { color: '#10b981', bgcolor: '#0b1220' },
  'missing-model': { color: '#f59e0b', bgcolor: '#2a1608' },
  'missing-node': { color: '#f43f5e', bgcolor: '#320a14' },
};

const NODE_WIDTH = 220;
const NODE_HEIGHT = 140;

interface WorkflowNodeMapProps {
  graph?: CanvasGraph;
  getNodeStatus: (node: CanvasNode) => NodeStatus;
  onFocusNode: (nodeType: string | number | null) => void;
  viewMode: WorkflowViewMode;
  isMapExpanded: boolean;
  onToggleExpand: () => void;
}

/**
 * Read-only LiteGraph renderer for a workflow's visual node map.
 *
 * The workflow's `canvasGraph` is already in LiteGraph's serialized format (nodes with
 * `id`/`type`/`pos`/`size`/`inputs`/`outputs`, plus `links`), so nodes carry their own
 * embedded canvas coordinates and wire definitions. Because node `type`s are arbitrary
 * ComfyUI class names (not LiteGraph-registered node classes), the graph is assembled
 * manually rather than through `LGraph.configure`.
 *
 * Editing is disabled (read-only). Pan/zoom via mouse works as expected; nodes are
 * colored by their readiness (ready / missing-model / missing-node) and clicking a node
 * focuses the resolution cards below via `onFocusNode`.
 *
 * NOTE: This component is currently read-only. Full LiteGraph editing support is tracked
 * for v1.6.0 (see ROADMAP) — to enable editing later, flip `read_only`/`allow_dragnodes`
 * below and set whole-graph moved/connect callbacks back into the app.
 */
export const WorkflowNodeMap = forwardRef<WorkflowNodeMapHandle, WorkflowNodeMapProps>(
  function WorkflowNodeMap(
    { graph, getNodeStatus, onFocusNode, viewMode, isMapExpanded, onToggleExpand },
    ref
  ) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const graphRef = useRef<LGraph | null>(null);
  const canvasRef = useRef<LGraphCanvas | null>(null);
  const [zoomPercent, setZoomPercent] = useState(100);

  const visible = viewMode === 'both' || viewMode === 'map';

  // Create the LiteGraph graph + canvas exactly once for this component's lifetime.
  useEffect(() => {
    if (graphRef.current || !canvasElRef.current) return;
    const g = new LGraph();
    const c = new LGraphCanvas(canvasElRef.current, g, { autoresize: false }) as LGraphCanvas & {
      read_only: boolean;
      allow_connect_output_to_input: boolean;
      setCanvas: (el: HTMLCanvasElement | null, skip?: boolean) => void;
    };

    // Read-only for now (editing tracked for v1.6.0). Keep background pan enabled.
    c.read_only = true;
    c.allow_dragnodes = false;
    c.allow_connect_output_to_input = false;
    c.allow_reconnect_links = false;
    c.allow_interaction = false;
    c.ds.max_scale = 2;
    c.ds.min_scale = 0.2;
    c.show_info = false;

    // The bundled render loop dies permanently if a single draw() call throws (e.g. an
    // aberrant workflow node/link), which freezes the canvas and makes pan/zoom/fit appear
    // dead. Wrap draw so one bad node can never kill the whole renderer.
    const drawImpl = c.draw.bind(c);
    (c as any).draw = (...rest: any[]) => {
      try {
        return drawImpl(...rest);
      } catch (err) {
        console.error('WorkflowNodeMap render error:', err);
      }
    };

    // LiteGraph's own wheel handlers zoom around the canvas CENTER (DragAndScale.onMouse)
    // or raw client coordinates (processMouseWheel) — neither tracks the pointer inside a
    // nested panel, so touchpad pinch / scroll visibly jumps away from the cursor. Replace
    // the canvas wheel listeners with one anchored at the pointer's canvas-relative point.
    const onWheel = (e: WheelEvent) => {
      if (!c.graph || !c.allow_dragcanvas || !c.canvas) return;
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16; // line-based scrolling
      else if (e.deltaMode === 2) dy *= 100; // page-based scrolling
      if (dy === 0) return;
      const rect = c.canvas.getBoundingClientRect();
      const zoomCenter: [number, number] = [e.clientX - rect.left, e.clientY - rect.top];
      const k = Math.pow(1.2, -dy / 120);
      const next = Math.max(c.ds.min_scale, Math.min(c.ds.max_scale, c.ds.scale * k));
      if (next === c.ds.scale) return;
      c.ds.changeScale(next, zoomCenter);
      setZoomPercent(Math.round(c.ds.scale * 100));
      e.preventDefault();
      e.stopPropagation();
    };
    const wheelCallback = (c as any)._mousewheel_callback as ((e: Event) => void) | undefined;
    const canvasEl = canvasElRef.current;
    const wheelListener = onWheel as unknown as EventListener;
    const elAny = canvasEl as any;
    if (wheelCallback) {
      elAny.removeEventListener('mousewheel', wheelCallback);
      elAny.removeEventListener('DOMMouseScroll', wheelCallback);
    }
    elAny.addEventListener('wheel', onWheel, { passive: false });
    elAny.addEventListener('mousewheel', wheelListener, { passive: false });
    elAny.addEventListener('DOMMouseScroll', wheelListener);

    graphRef.current = g;
    canvasRef.current = c;

    return () => {
      try {
        c.stopRendering();
        const el = canvasEl as any;
        el.removeEventListener('wheel', onWheel);
        el.removeEventListener('mousewheel', wheelListener);
        el.removeEventListener('DOMMouseScroll', wheelListener);
        // LiteGraph's own unbindEvents() cannot remove its capture-phase listeners:
        // bindEvents registers "down"/"up"/"keydown" with capture=true, but
        // pointerListenerRemove()/removeEventListener default the capture flag to
        // false (and it even passes _mousedown_callback when clearing "move"). A torn
        // down LGraphCanvas therefore keeps its "mousedown" capture listener alive,
        // and with this.canvas nulled it throws "Cannot read properties of null
        // (reading 'focus')" on every canvas click (React StrictMode's dev double
        // mount leaks exactly this). Remove the exact bound callbacks ourselves.
        const anyC = c as any;
        if (anyC._mousedown_callback) el.removeEventListener('mousedown', anyC._mousedown_callback, true);
        if (anyC._mouseup_callback) el.removeEventListener('mouseup', anyC._mouseup_callback, true);
        if (anyC._mousemove_callback) el.removeEventListener('mousemove', anyC._mousemove_callback);
        if (anyC._key_callback) {
          el.removeEventListener('keydown', anyC._key_callback, true);
          document.removeEventListener('keyup', anyC._key_callback, true);
        }
        c.setCanvas(null, false);
      } catch {
        /* ignore teardown errors */
      }
      graphRef.current = null;
      canvasRef.current = null;
    };
  }, []);

  // Force an immediate synchronous redraw so view changes never depend solely on the
  // internal requestAnimationFrame loop staying healthy.
  const forceDraw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    try {
      c.setDirty(true, true);
      c.draw(true, true);
    } catch (err) {
      console.error('WorkflowNodeMap render error:', err);
    }
  }, []);

  // Fit the whole graph into the current viewport.
  const fitToView = useCallback(() => {
    const c = canvasRef.current;
    const g = graphRef.current;
    const host = hostRef.current;
    if (!c || !g || !host) return;
    const nodes = (g as any)._nodes ?? [];
    if (!nodes.length) {
      c.ds.offset = [0, 0];
      c.ds.scale = 1;
      setZoomPercent(100);
      forceDraw();
      return;
    }

    // Keep the drawing buffer in sync with the host before computing the transform.
    // Otherwise the graph is fitted to (and drawn into) a stale or zero-sized buffer,
    // which makes Fit to View appear to do nothing.
    const hostW = host.clientWidth || 0;
    const hostH = host.clientHeight || 0;
    if (hostW > 0 && hostH > 0) {
      try {
        c.resize();
      } catch {
        /* ignore resize errors */
      }
    }

    const vw = hostW || c.canvas.width || 600;
    const vh = hostH || c.canvas.height || 400;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of nodes) {
      const x = n.pos ? n.pos[0] : 0;
      const y = n.pos ? n.pos[1] : 0;
      const w = n.size && n.size[0] ? n.size[0] : NODE_WIDTH;
      const h = n.size && n.size[1] ? n.size[1] : NODE_HEIGHT;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }
    const bw = maxX - minX || 1;
    const bh = maxY - minY || 1;
    const pad = 80;
    const scale = Math.max(0.1, Math.min(1, (vw - pad) / bw, (vh - pad) / bh));
    c.ds.scale = scale;
    c.ds.offset = [(vw - bw * scale) / 2 - minX * scale, (vh - bh * scale) / 2 - minY * scale];
    setZoomPercent(Math.round(scale * 100));
    forceDraw();
  }, [forceDraw]);

  // (Re)build the LiteGraph graph whenever the data or node statuses change.
  useEffect(() => {
    const c = canvasRef.current;
    const g = graphRef.current;
    if (!c || !g) return;
    g.clear();
    c.clear();

    if (!graph?.nodes || graph.nodes.length === 0) {
      c.setDirty(true, true);
      return;
    }

    const nodeMap = new Map<string | number, LGraphNode>();
    for (const cn of graph.nodes) {
      const label = cn.title || String(cn.type ?? 'Node');
      const lg: LGraphNode = new LGraphNode(label);
      lg.type = String(cn.type ?? 'Node');
      (lg as any).title = label;
      if (Array.isArray(cn.pos)) {
        lg.pos = [Number(cn.pos[0]) || 0, Number(cn.pos[1]) || 0];
      }
      if (Array.isArray(cn.size)) {
        lg.size = [Number(cn.size[0]) || NODE_WIDTH, Number(cn.size[1]) || NODE_HEIGHT];
      } else {
        lg.size = [NODE_WIDTH, NODE_HEIGHT];
      }
      for (const inp of cn.inputs ?? []) {
        lg.addInput(inp.name || inp.type || 'in', inp.type || 'any');
      }
      for (const out of cn.outputs ?? []) {
        lg.addOutput(out.name || out.type || 'out', out.type || 'any');
      }
      const pal = STATUS_COLORS[getNodeStatus(cn)];
      lg.color = pal.color;
      lg.bgcolor = pal.bgcolor;
      lg.onMouseDown = () => {
        onFocusNode(cn.type);
      };
      g.add(lg, true);
      nodeMap.set(cn.id, lg);
    }

    for (const link of graph.links ?? []) {
      const nl = normalizeLink(link);
      if (!nl) continue;
      const src = nodeMap.get(nl.origin_id);
      const dst = nodeMap.get(nl.target_id);
      if (!src || !dst) continue;
      try {
        src.connect(nl.origin_slot, dst, nl.target_slot);
      } catch {
        /* skip malformed link */
      }
    }

    fitToView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, getNodeStatus, onFocusNode, visible]);

  // Re-size and re-fit whenever visibility/fullscreen changes.
  useEffect(() => {
    if (!visible) return;
    fitToView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMapExpanded, visible]);

  // Collapse the expanded map via the X button or the Escape key.
  useEffect(() => {
    if (!isMapExpanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        e.stopPropagation();
        onToggleExpand();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isMapExpanded, onToggleExpand]);

  // Center the first node of the requested type in the viewport so the user can see
  // exactly which section of the workflow a resolution card refers to.
  const zoomToNodeType = useCallback(
    (nodeType: string | number | null) => {
      const c = canvasRef.current;
      const g = graphRef.current;
      const host = hostRef.current;
      if (!c || !g || !host || nodeType == null) return;
      const want = String(nodeType);
      const nodes = (g as any)._nodes as LGraphNode[];
      const target = nodes.find((n) => String(n.type) === want);
      if (!target) return;

      let hostW = host.clientWidth || 0;
      let hostH = host.clientHeight || 0;
      if (hostW > 0 && hostH > 0) {
        try {
          c.resize();
        } catch {
          /* ignore resize errors */
        }
      }
      const vw = hostW || c.canvas.width || 600;
      const vh = hostH || c.canvas.height || 400;

      const w = target.size && target.size[0] ? target.size[0] : NODE_WIDTH;
      const h = target.size && target.size[1] ? target.size[1] : NODE_HEIGHT;
      const [x, y] = target.pos || [0, 0];
      const scale = Math.max(
        c.ds.min_scale,
        Math.min(2, (vw * 0.8) / (w || 1), (vh * 0.8) / (h || 1), 1.25)
      );
      c.ds.scale = scale;
      c.ds.offset = [vw / 2 - (x + w / 2) * scale, vh / 2 - (y + h / 2) * scale];
      setZoomPercent(Math.round(scale * 100));
      forceDraw();
    },
    [forceDraw]
  );

  useImperativeHandle(ref, () => ({ zoomToNodeType }), [zoomToNodeType]);

  const zoomBy = (delta: number) => {
    const c = canvasRef.current;
    const host = hostRef.current;
    if (!c || !host) return;
    const next = Math.max(0.2, Math.min(2, c.ds.scale + delta));
    const prev = c.ds.scale;
    const k = next / prev;
    const cx = (host.clientWidth || 600) / 2;
    const cy = (host.clientHeight || 400) / 2;
    c.ds.scale = next;
    c.ds.offset = [cx - (cx - c.ds.offset[0]) * k, cy - (cy - c.ds.offset[1]) * k];
    setZoomPercent(Math.round(next * 100));
    forceDraw();
  };

  const showButtons = visible;

  return (
    <div
      className={`${
        isMapExpanded
          ? 'fixed inset-0 z-[100] flex flex-col bg-[#0a0d14] border border-slate-800 shadow-2xl'
          : 'glass-panel rounded-3xl border border-slate-800 shadow-2xl overflow-hidden space-y-2'
      } ${showButtons ? '' : 'hidden'}`}
    >
      {/* Map Toolbar */}
      <div
        className={`px-6 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 ${
          isMapExpanded ? 'shrink-0' : ''
        }`}
      >
        <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
          <Workflow size={16} className="text-cyan-400" />
          <span>Visual Node Map</span>
          <span className="text-[11px] text-slate-500 font-normal">
            (Click nodes to focus resolution cards)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => zoomBy(-0.1)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-xs font-mono text-slate-400 min-w-[45px] text-center">
            {zoomPercent}%
          </span>
          <button
            onClick={() => zoomBy(0.1)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={fitToView}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors ml-1"
            title="Fit to View"
          >
            <Crosshair size={14} />
          </button>
          {isMapExpanded ? (
            <button
              onClick={onToggleExpand}
              className="p-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white transition-colors ml-1"
              title="Shrink Back From Fullscreen"
            >
              <X size={14} />
            </button>
          ) : (
            <button
              onClick={onToggleExpand}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors ml-1"
              title="Expand to Fullscreen"
            >
              <Maximize2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* LiteGraph Viewport */}
      <div
        ref={hostRef}
        className={`relative overflow-hidden bg-[#0a0d14] select-none ${
          isMapExpanded ? 'flex-1 w-full min-h-0' : 'w-full h-[420px]'
        }`}
      >
        <canvas
          ref={canvasElRef}
          className="block w-full h-full"
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>
    </div>
  );
});

export default WorkflowNodeMap;

function normalizeLink(
  link: any
): { origin_id: string | number; origin_slot: number; target_id: string | number; target_slot: number } | null {
  if (Array.isArray(link)) {
    // LiteGraph serialized link array: [id, origin_id, origin_slot, target_id, target_slot, type]
    if (link.length >= 5) {
      return {
        origin_id: link[1],
        origin_slot: Number(link[2]) || 0,
        target_id: link[3],
        target_slot: Number(link[4]) || 0,
      };
    }
  } else if (link && typeof link === 'object') {
    return {
      origin_id: link.origin_id,
      origin_slot: Number(link.origin_slot) || 0,
      target_id: link.target_id,
      target_slot: Number(link.target_slot) || 0,
    };
  }
  return null;
}
