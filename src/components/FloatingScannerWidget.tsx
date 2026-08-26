/**
 * CivitAI Model Manager - ComfyUI Edition
 * Copyright (C) 2025-2026 TheStygianRenegade / /dev/null Inc
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  RefreshCw,
  Square,
  ChevronDown,
  ChevronUp,
  GripHorizontal,
  HardDrive,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useScan } from '../context/ScanContext';

export function FloatingScannerWidget() {
  const { isScanning, scanProgress, cancelScan } = useScan();
  const [minimized, setMinimized] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // If not scanning and no progress to show, hide widget
  if (!isScanning && (!scanProgress || scanProgress.status === 'idle')) {
    return null;
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    const currentX = position?.x ?? (window.innerWidth - 380);
    const currentY = position?.y ?? (window.innerHeight - 180);
    dragOffset.current = {
      x: e.clientX - currentX,
      y: e.clientY - currentY,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const newX = Math.max(10, Math.min(window.innerWidth - 340, e.clientX - dragOffset.current.x));
      const newY = Math.max(70, Math.min(window.innerHeight - 140, e.clientY - dragOffset.current.y));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const total = scanProgress?.totalFiles || 0;
  const scanned = scanProgress?.scannedFiles || 0;
  const percent = total > 0 ? Math.min(100, Math.round((scanned / total) * 100)) : 0;
  const status = scanProgress?.status || 'scanning';

  const defaultStyle: React.CSSProperties = position
    ? {
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 9999,
      }
    : {
        position: 'fixed',
        right: '24px',
        bottom: '54px',
        zIndex: 9999,
      };

  if (minimized) {
    return (
      <div
        style={defaultStyle}
        className="glass-panel bg-slate-950/95 border border-purple-500/40 p-2.5 rounded-2xl shadow-2xl backdrop-blur-2xl flex items-center gap-3 animate-fade-in select-none"
      >
        <div
          onMouseDown={handleMouseDown}
          className="cursor-move text-slate-500 hover:text-slate-300 p-1"
          title="Drag Widget"
        >
          <GripHorizontal size={14} />
        </div>

        <div className="flex items-center gap-2">
          <RefreshCw size={14} className="text-purple-400 animate-spin" />
          <span className="text-xs font-bold text-slate-200">{percent}%</span>
          <span className="text-[10px] text-slate-400">({scanned}/{total})</span>
        </div>

        {isScanning && (
          <button
            onClick={cancelScan}
            title="Stop Scanning"
            className="p-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Square size={10} className="fill-rose-300" />
            <span>Stop</span>
          </button>
        )}

        <button
          onClick={() => setMinimized(false)}
          title="Expand Scanner HUD"
          className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 cursor-pointer"
        >
          <ChevronUp size={14} />
        </button>
      </div>
    );
  }

  return (
    <div
      style={defaultStyle}
      className="w-84 glass-panel bg-slate-950/95 border border-purple-500/50 p-4 rounded-2xl shadow-2xl backdrop-blur-2xl space-y-3 animate-fade-in select-none glow-purple"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div
          onMouseDown={handleMouseDown}
          className="flex items-center gap-2 cursor-move flex-1"
          title="Click and drag to move"
        >
          <GripHorizontal size={14} className="text-slate-500" />
          <div className="flex items-center gap-2">
            <RefreshCw
              size={14}
              className={`text-purple-400 ${isScanning ? 'animate-spin' : ''}`}
            />
            <span className="text-xs font-bold text-slate-100">Folder Scanner</span>
          </div>
          <span
            className={`text-[9px] uppercase font-extrabold px-1.5 py-0.2 rounded ${
              status === 'hashing'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : status === 'lookup'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : status === 'completed'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
            }`}
          >
            {status}
          </span>
        </div>

        <button
          onClick={() => setMinimized(true)}
          title="Minimize HUD"
          className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 cursor-pointer"
        >
          <ChevronDown size={14} />
        </button>
      </div>

      {/* Progress Stats */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
          <span>{total > 0 ? `${scanned} of ${total} files` : 'Discovering files...'}</span>
          <span className="font-mono text-purple-300">{percent}%</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
          <div
            className="bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-200 glow-purple"
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* Current File Display */}
        {scanProgress?.currentFile && (
          <p
            className="text-[11px] text-slate-400 truncate font-mono"
            title={scanProgress.currentFile}
          >
            {scanProgress.currentFile}
          </p>
        )}
      </div>

      {/* Action Footer */}
      {isScanning && (
        <div className="pt-1 flex items-center justify-end">
          <button
            onClick={cancelScan}
            className="w-full py-1.5 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/30 cursor-pointer transition-all active:scale-95"
          >
            <Square size={12} className="fill-white" />
            <span>Stop Scanning</span>
          </button>
        </div>
      )}
    </div>
  );
}
