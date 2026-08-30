/**
 * CivitAI Model Manager - ComfyUI Edition
 * Copyright (C) 2025-2026 TheStygianRenegade / /dev/null Inc
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import React, { useState, useEffect } from 'react';
import {
  Download,
  Pause,
  Play,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  RefreshCw,
  Activity,
  ArrowDownCircle,
} from 'lucide-react';
import { DownloadTask } from '../types/app';

export const DownloadsTab: React.FC = () => {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);

  useEffect(() => {
    const fetchDownloads = async () => {
      if (window.civitaiAPI) {
        const currentTasks = await window.civitaiAPI.getDownloads();
        setTasks(Array.isArray(currentTasks) ? currentTasks : []);
      }
    };

    fetchDownloads();

    if (window.civitaiAPI) {
      window.civitaiAPI.onDownloadProgress((updatedTasks) => {
        setTasks(Array.isArray(updatedTasks) ? updatedTasks : []);
      });
    }
  }, []);

  const handlePause = async (id: string) => {
    if (window.civitaiAPI) await window.civitaiAPI.pauseDownload(id);
  };

  const handleResume = async (id: string) => {
    if (window.civitaiAPI) await window.civitaiAPI.resumeDownload(id);
  };

  const handleCancel = (id: string) => {
    if (window.civitaiAPI) {
      window.civitaiAPI.cancelDownload(id);
    }
  };

  const handleForceComplete = async (id: string) => {
    if (window.civitaiAPI && typeof window.civitaiAPI.forceCompleteDownload === 'function') {
      await window.civitaiAPI.forceCompleteDownload(id);
    }
  };

  const formatSpeed = (bytesPerSec: number): string => {
    if (!bytesPerSec || bytesPerSec === 0) return '0 B/s';
    if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
    return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  };

  const formatSize = (bytes: number): string => {
    if (!bytes) return '0 MB';
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const totalSpeed = tasks
    .filter((t) => t.status === 'downloading')
    .reduce((acc, t) => acc + (t.speedBps || 0), 0);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Header & Global Speed Meter */}
      <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight flex items-center gap-2.5">
            <span>Download Queue</span>
            <ArrowDownCircle size={24} className="text-purple-400" />
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Active background model downloads with automatic Range resumption and SHA256 integrity verification.
          </p>
        </div>

        <div className="glass-panel px-5 py-3.5 rounded-2xl flex items-center gap-4 border border-purple-500/30 shadow-xl glow-purple">
          <div className="p-2.5 rounded-xl bg-purple-600/20 text-purple-400">
            <Activity className="animate-pulse" size={22} />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium block">Total Speed</span>
            <span className="text-base font-extrabold text-slate-100 font-mono">{formatSpeed(totalSpeed)}</span>
          </div>
        </div>
      </div>

      {/* Queue List */}
      {tasks.length === 0 ? (
        <div className="text-center py-28 text-slate-500 text-sm glass-panel rounded-2xl">
          No active or past downloads in queue. Browse models to start downloading.
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4 shadow-xl"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-bold text-slate-100 text-base">{task.modelName}</h3>
                    <span className="bg-purple-950/80 border border-purple-500/40 text-purple-300 text-[10px] font-bold px-2.5 py-0.5 rounded-lg shadow-sm">
                      {task.versionName}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-1 truncate">
                    Target Folder: <span className="text-purple-300 font-semibold">{task.targetFolder}/</span> ({task.fileName})
                  </p>
                </div>

                {/* Status Badges & Controls */}
                <div className="flex items-center gap-3">
                  {task.status === 'downloading' && (
                    <span className="text-xs font-mono font-bold text-purple-300 bg-purple-500/10 px-3 py-1.5 rounded-xl border border-purple-500/30 flex items-center gap-2 glow-purple">
                      <RefreshCw className="animate-spin" size={14} />
                      {formatSpeed(task.speedBps)}
                    </span>
                  )}

                  {task.status === 'verifying' && (
                    <span className="text-xs font-semibold text-amber-300 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/30 flex items-center gap-2 glow-amber">
                      <RefreshCw className="animate-spin" size={14} /> Verifying SHA256
                    </span>
                  )}

                  {task.status === 'completed' && (
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/30 flex items-center gap-2 glow-emerald">
                      <CheckCircle2 size={14} /> Complete
                    </span>
                  )}

                  {task.status === 'failed' && (
                    <span className="text-xs font-bold text-red-400 bg-red-500/10 px-3 py-1.5 rounded-xl border border-red-500/30 flex items-center gap-2">
                      <AlertTriangle size={14} /> Failed
                    </span>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1.5">
                    {task.status === 'downloading' && (
                      <button
                        onClick={() => handlePause(task.id)}
                        title="Pause Download"
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                      >
                        <Pause size={18} />
                      </button>
                    )}

                    {(task.status === 'paused' || task.status === 'failed') && (
                      <button
                        onClick={() => handleResume(task.id)}
                        title="Resume Download"
                        className="p-2 rounded-xl text-purple-400 hover:text-purple-300 hover:bg-purple-500/20 transition-colors"
                      >
                        <Play size={18} />
                      </button>
                    )}

                    <button
                      onClick={() => handleCancel(task.id)}
                      title="Cancel Download"
                      className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <XCircle size={18} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Progress Bar & Numeric Stats */}
              <div className="space-y-2">
                <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800 shadow-inner">
                  <div
                    className={`h-full transition-all duration-300 ${
                      task.status === 'completed'
                        ? 'bg-linear-to-r from-emerald-500 to-teal-400'
                        : task.status === 'failed'
                        ? 'bg-red-500'
                        : 'bg-linear-to-r from-purple-600 to-indigo-500'
                    }`}
                    style={{ width: `${task.progress}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-xs text-slate-400 font-mono">
                  <span>
                    {formatSize(task.downloadedBytes)} / {formatSize(task.totalBytes)} ({task.progress}%)
                  </span>
                  {task.error && <span className="text-red-400 font-sans font-medium">{task.error}</span>}
                </div>

                {task.status === 'failed' && (task.isHashMismatch || task.error?.toLowerCase().includes('sha256') || task.error?.toLowerCase().includes('hash')) && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs animate-fadeIn glow-amber">
                    <div className="flex items-center gap-2 text-amber-300">
                      <AlertTriangle size={16} className="shrink-0 text-amber-400" />
                      <span>The download finished, but CivitAI's reported SHA256 checksum did not match. You can finalize and keep this file anyway.</span>
                    </div>
                    <button
                      onClick={() => handleForceComplete(task.id)}
                      className="px-3.5 py-1.5 bg-linear-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer shrink-0"
                    >
                      Keep & Finish File
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
