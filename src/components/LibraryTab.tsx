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
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Local Model Library</h1>
          <p className="text-sm text-slate-400">
            Manage scanned ComfyUI models, check for version updates, and find duplicate files.
          </p>
        </div>

        <button
          onClick={triggerScan}
          disabled={scanProgress?.status === 'scanning' || scanProgress?.status === 'hashing' || scanProgress?.status === 'lookup'}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-colors shadow-lg shadow-purple-600/20"
        >
          <FolderSearch size={18} />
          <span>{scanProgress?.status && scanProgress.status !== 'completed' && scanProgress.status !== 'idle' ? 'Scanning Folders...' : 'Scan Folders'}</span>
        </button>
      </div>

      {/* Progress Notification Banner */}
      {scanProgress && scanProgress.status !== 'idle' && scanProgress.status !== 'completed' && (
        <div className="p-4 rounded-xl glass-panel border border-purple-500/30 flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <RefreshCw className="animate-spin text-purple-400" size={20} />
            <div>
              <p className="font-semibold text-slate-200 capitalize">
                Status: {scanProgress.status} ({scanProgress.scannedFiles} / {scanProgress.totalFiles} files)
              </p>
              <p className="text-xs text-slate-400 line-clamp-1">{scanProgress.currentFile || 'Processing...'}</p>
            </div>
          </div>
          <div className="w-32 bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-purple-500 h-full transition-all duration-200"
              style={{
                width: `${scanProgress.totalFiles > 0 ? (scanProgress.scannedFiles / scanProgress.totalFiles) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="glass-panel p-4 rounded-xl flex flex-wrap gap-4 items-center justify-between text-sm">
        <div className="flex flex-wrap gap-2">
          {(['all', 'matched', 'updates', 'unidentified', 'duplicates'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                filter === t
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {t} ({localModels.filter((m) => {
                if (t === 'matched') return m.isMatched;
                if (t === 'updates') return m.hasUpdate;
                if (t === 'unidentified') return !m.isMatched;
                if (t === 'duplicates') return m.isDuplicate;
                return true;
              }).length})
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Filter library models..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 w-full sm:w-64"
        />
      </div>

      {/* Model List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500"></div>
        </div>
      ) : filteredModels.length === 0 ? (
        <div className="text-center py-20 text-slate-500 text-sm glass-panel rounded-xl">
          No models found in your local library. Click "Scan Folders" above to discover models.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredModels.map((model) => (
            <div
              key={model.id}
              className="glass-card p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5 flex-1 min-w-0">
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-purple-400 flex-shrink-0">
                  <HardDrive size={22} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-100 text-sm truncate">{model.fileName}</h3>
                    {model.isDuplicate && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                        <Copy size={10} /> Duplicate
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-mono truncate mt-0.5">{model.filePath}</p>
                </div>
              </div>

              {/* Status Badges & Info */}
              <div className="flex flex-wrap items-center gap-4 text-xs w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-800">
                <span className="text-slate-400 font-mono">
                  {(model.fileSize / 1024 / 1024).toFixed(1)} MB
                </span>

                {model.isMatched ? (
                  <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                    <CheckCircle size={14} /> Matched
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-lg">
                    <HelpCircle size={14} /> Unidentified
                  </span>
                )}

                {model.hasUpdate && (
                  <button
                    onClick={() => onCheckUpdate(model)}
                    className="flex items-center gap-1.5 text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2.5 py-1 rounded-lg hover:bg-amber-500/30 transition-colors font-medium"
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
