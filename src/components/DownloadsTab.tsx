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
} from 'lucide-react';
import { DownloadTask } from '../types/app';

export const DownloadsTab: React.FC = () => {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);

  useEffect(() => {
    const fetchDownloads = async () => {
      if (window.civitaiAPI) {
        const currentTasks = await window.civitaiAPI.getDownloads();
        setTasks(currentTasks || []);
      }
    };

    fetchDownloads();

    if (window.civitaiAPI) {
      window.civitaiAPI.onDownloadProgress((updatedTasks) => {
        setTasks(updatedTasks || []);
      });
    }
  }, []);

  const handlePause = async (id: string) => {
    if (window.civitaiAPI) await window.civitaiAPI.pauseDownload(id);
  };

  const handleResume = async (id: string) => {
    if (window.civitaiAPI) await window.civitaiAPI.resumeDownload(id);
  };

  const handleCancel = async (id: string) => {
    if (window.civitaiAPI) await window.civitaiAPI.cancelDownload(id);
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
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header & Global Speed Meter */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Download Queue</h1>
          <p className="text-sm text-slate-400">
            Active background model downloads with automatic resume and SHA256 integrity verification.
          </p>
        </div>

        <div className="glass-panel px-4 py-2.5 rounded-xl flex items-center gap-3 border border-purple-500/20">
          <Download className="text-purple-400 animate-pulse" size={20} />
          <div>
            <span className="text-xs text-slate-400 block">Total Bandwidth</span>
            <span className="text-sm font-bold text-slate-100">{formatSpeed(totalSpeed)}</span>
          </div>
        </div>
      </div>

      {/* Queue List */}
      {tasks.length === 0 ? (
        <div className="text-center py-20 text-slate-500 text-sm glass-panel rounded-xl">
          No active or past downloads in queue. Browse models to start downloading.
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="glass-card p-5 rounded-2xl border border-slate-800 space-y-3"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-100 text-base">{task.modelName}</h3>
                    <span className="bg-purple-950/80 border border-purple-500/30 text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded">
                      {task.versionName}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                    Routing to: <span className="text-slate-300">{task.targetFolder}/</span> ({task.fileName})
                  </p>
                </div>

                {/* Status Badges & Controls */}
                <div className="flex items-center gap-3">
                  {task.status === 'downloading' && (
                    <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20 flex items-center gap-1.5">
                      <RefreshCw className="animate-spin" size={14} />
                      {formatSpeed(task.speedBps)}
                    </span>
                  )}

                  {task.status === 'verifying' && (
                    <span className="text-xs text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 flex items-center gap-1.5">
                      <RefreshCw className="animate-spin" size={14} /> Verifying SHA256
                    </span>
                  )}

                  {task.status === 'completed' && (
                    <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 flex items-center gap-1.5">
                      <CheckCircle2 size={14} /> Complete
                    </span>
                  )}

                  {task.status === 'failed' && (
                    <span className="text-xs text-red-400 bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/20 flex items-center gap-1.5">
                      <AlertTriangle size={14} /> Failed
                    </span>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {task.status === 'downloading' && (
                      <button
                        onClick={() => handlePause(task.id)}
                        title="Pause Download"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                      >
                        <Pause size={16} />
                      </button>
                    )}

                    {(task.status === 'paused' || task.status === 'failed') && (
                      <button
                        onClick={() => handleResume(task.id)}
                        title="Resume Download"
                        className="p-1.5 rounded-lg text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition-colors"
                      >
                        <Play size={16} />
                      </button>
                    )}

                    <button
                      onClick={() => handleCancel(task.id)}
                      title="Cancel Download"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <XCircle size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Progress Bar & Detailed Numbers */}
              <div className="space-y-1.5">
                <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-all duration-300 ${
                      task.status === 'completed'
                        ? 'bg-emerald-500'
                        : task.status === 'failed'
                        ? 'bg-red-500'
                        : 'bg-purple-500'
                    }`}
                    style={{ width: `${task.progress}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-[11px] text-slate-400 font-mono">
                  <span>
                    {formatSize(task.downloadedBytes)} / {formatSize(task.totalBytes)} ({task.progress}%)
                  </span>
                  {task.error && <span className="text-red-400 font-sans">{task.error}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
