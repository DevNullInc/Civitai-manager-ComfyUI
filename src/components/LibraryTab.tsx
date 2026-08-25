import React, { useState, useEffect } from 'react';
import {
  FolderSearch,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Copy,
  ArrowUpCircle,
  HardDrive,
  FileText,
  Search,
  Sparkles,
} from 'lucide-react';
import { LocalModel, ScanProgress } from '../types/app';

interface LibraryTabProps {
  onCheckUpdate: (model: LocalModel) => void;
}

export const LibraryTab: React.FC<LibraryTabProps> = ({ onCheckUpdate }) => {
  const [localModels, setLocalModels] = useState<LocalModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [filter, setFilter] = useState<'all' | 'matched' | 'updates' | 'unidentified' | 'duplicates'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadLocalModels = async () => {
    setLoading(true);
    try {
      if (window.civitaiAPI) {
        const models = await window.civitaiAPI.getLocalModels();
        setLocalModels(models || []);
      }
    } catch (err) {
      console.error('Failed to load local models:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocalModels();

    if (window.civitaiAPI) {
      window.civitaiAPI.onScanProgress((prog) => {
        setScanProgress(prog);
        if (prog.status === 'completed') {
          loadLocalModels();
        }
      });
    }
  }, []);

  const triggerScan = async () => {
    try {
      if (window.civitaiAPI) {
        const config = await window.civitaiAPI.getConfig();
        if (!config.comfyui_root) {
          alert('Please configure your ComfyUI Root Path in Settings first.');
          return;
        }
        await window.civitaiAPI.scanLibrary(config.comfyui_root);
      }
    } catch (err: any) {
      alert(`Scan failed: ${err.message}`);
    }
  };

  const filteredModels = localModels.filter((model) => {
    const matchesSearch =
      model.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.filePath.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === 'matched') return model.isMatched;
    if (filter === 'updates') return model.hasUpdate;
    if (filter === 'unidentified') return !model.isMatched;
    if (filter === 'duplicates') return model.isDuplicate;
    return true;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">Local Model Library</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage scanned ComfyUI model files, check for version updates, and clean up duplicate files.
          </p>
        </div>

        <button
          onClick={triggerScan}
          disabled={scanProgress?.status === 'scanning' || scanProgress?.status === 'hashing' || scanProgress?.status === 'lookup'}
          className="flex items-center gap-2.5 px-5 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold rounded-2xl text-sm transition-all shadow-xl shadow-purple-600/30 glow-purple"
        >
          <FolderSearch size={20} />
          <span>
            {scanProgress?.status && scanProgress.status !== 'completed' && scanProgress.status !== 'idle'
              ? 'Scanning Folders...'
              : 'Scan ComfyUI Folders'}
          </span>
        </button>
      </div>

      {/* Progress Notification Banner */}
      {scanProgress && scanProgress.status !== 'idle' && scanProgress.status !== 'completed' && (
        <div className="p-5 rounded-2xl glass-panel border border-purple-500/30 flex items-center justify-between text-sm shadow-xl">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400">
              <RefreshCw className="animate-spin" size={22} />
            </div>
            <div>
              <p className="font-bold text-slate-100 capitalize text-sm">
                Scanning Library: {scanProgress.status} ({scanProgress.scannedFiles} / {scanProgress.totalFiles} files)
              </p>
              <p className="text-xs text-slate-400 line-clamp-1 font-mono mt-0.5">{scanProgress.currentFile || 'Processing...'}</p>
            </div>
          </div>
          <div className="w-48 bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full transition-all duration-200"
              style={{
                width: `${scanProgress.totalFiles > 0 ? (scanProgress.scannedFiles / scanProgress.totalFiles) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="glass-panel p-4 rounded-2xl flex flex-wrap gap-4 items-center justify-between text-sm shadow-xl">
        <div className="flex flex-wrap gap-2">
          {(['all', 'matched', 'updates', 'unidentified', 'duplicates'] as const).map((t) => {
            const count = localModels.filter((m) => {
              if (t === 'matched') return m.isMatched;
              if (t === 'updates') return m.hasUpdate;
              if (t === 'unidentified') return !m.isMatched;
              if (t === 'duplicates') return m.isDuplicate;
              return true;
            }).length;

            return (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold capitalize transition-all ${
                  filter === t
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30'
                    : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {t} ({count})
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Filter by filename or path..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-900/90 border border-slate-700/60 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 w-full"
          />
        </div>
      </div>

      {/* Model List */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 glow-purple"></div>
        </div>
      ) : filteredModels.length === 0 ? (
        <div className="text-center py-28 text-slate-500 text-sm glass-panel rounded-2xl">
          No models found in your local library. Click "Scan ComfyUI Folders" to discover models.
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredModels.map((model) => (
            <div
              key={model.id}
              className="glass-card p-4 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800/80 hover:border-purple-500/30"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-purple-400 flex-shrink-0 shadow-inner">
                  <HardDrive size={22} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-100 text-sm truncate">{model.fileName}</h3>
                    {model.isDuplicate && (
                      <span className="flex items-center gap-1 text-[10px] font-extrabold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-md glow-amber">
                        <Copy size={10} /> Duplicate
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-mono truncate mt-1">{model.filePath}</p>
                </div>
              </div>

              {/* Status Badges & Info */}
              <div className="flex flex-wrap items-center gap-4 text-xs w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-800/80">
                <span className="text-slate-300 font-mono font-semibold bg-slate-900 border border-slate-800 px-3 py-1 rounded-xl">
                  {(model.fileSize / 1024 / 1024).toFixed(1)} MB
                </span>

                {model.isMatched ? (
                  <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-xl font-semibold">
                    <CheckCircle size={14} /> Matched
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-slate-400 bg-slate-800/80 px-3 py-1 rounded-xl font-semibold">
                    <HelpCircle size={14} /> Unidentified
                  </span>
                )}

                {model.hasUpdate && (
                  <button
                    onClick={() => onCheckUpdate(model)}
                    className="flex items-center gap-1.5 text-amber-300 bg-amber-500/20 border border-amber-500/40 px-3.5 py-1.5 rounded-xl hover:bg-amber-500/30 transition-all font-bold glow-amber"
                  >
                    <ArrowUpCircle size={14} /> Update Available
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
