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
  Trash2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { LocalModel, ScanProgress, ModelType } from '../types/app';

interface LibraryTabProps {
  onCheckUpdate: (model: LocalModel) => void;
}

export const LibraryTab: React.FC<LibraryTabProps> = ({ onCheckUpdate }) => {
  const [localModels, setLocalModels] = useState<LocalModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [filter, setFilter] = useState<'all' | 'matched' | 'updates' | 'unidentified' | 'duplicates'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ModelType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortAsc, setSortAsc] = useState(true);

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
          setIsScanning(false);
          loadLocalModels();
          setTimeout(() => {
            setScanProgress((current) => (current?.status === 'completed' ? null : current));
          }, 3000);
        }
      });
    }
  }, []);

  const triggerScan = async () => {
    if (isScanning) return;
    setIsScanning(true);
    setScanProgress({
      scannedFiles: 0,
      totalFiles: 0,
      status: 'scanning',
      currentFile: 'Initializing folder scanner...',
    });

    try {
      if (window.civitaiAPI) {
        const config = await window.civitaiAPI.getConfig();
        const folders = config?.comfyui_folders && config.comfyui_folders.length > 0
          ? config.comfyui_folders
          : (config?.comfyui_root ? [config.comfyui_root] : []);

        if (!folders || folders.length === 0 || !folders[0]) {
          alert('No model folders configured! Please add your ComfyUI model folder path in Settings.');
          setIsScanning(false);
          setScanProgress(null);
          return;
        }

        await window.civitaiAPI.scanLibrary(folders as any);
        await loadLocalModels();
      }
    } catch (err: any) {
      alert(`Scan failed: ${err.message}`);
      setScanProgress(null);
    } finally {
      setIsScanning(false);
    }
  };

  const filteredModels = localModels
    .filter((model) => {
      const matchesSearch =
        (model.fileName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (model.filePath || '').toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // Type filter
      if (typeFilter !== 'all' && model.modelType !== typeFilter) return false;

      // Top-level filter
      if (filter === 'matched') return model.isMatched;
      if (filter === 'updates') return model.hasUpdate;
      if (filter === 'unidentified') return !model.isMatched;
      if (filter === 'duplicates') return model.isDuplicate;
      return true;
    })
    .sort((a, b) => {
      const nameA = a.fileName.toLowerCase();
      const nameB = b.fileName.toLowerCase();
      if (nameA < nameB) return sortAsc ? -1 : 1;
      if (nameA > nameB) return sortAsc ? 1 : -1;
      return 0;
    });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">Local Model Library</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage scanned ComfyUI model files ({localModels.length} models found), check for version updates, and clean up duplicate files.
          </p>
        </div>

        <button
          onClick={triggerScan}
          disabled={isScanning}
          className="flex items-center gap-2.5 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-60 text-white font-bold rounded-2xl text-sm transition-all shadow-xl shadow-purple-600/30 glow-purple cursor-pointer"
        >
          {isScanning ? (
            <>
              <RefreshCw size={20} className="animate-spin" />
              <span>Scanning Folders...</span>
            </>
          ) : (
            <>
              <FolderSearch size={20} />
              <span>Scan ComfyUI Folders</span>
            </>
          )}
        </button>
      </div>

      {/* Hero Scan Progress Bar Banner */}
      {scanProgress && scanProgress.status !== 'idle' && (
        <div className="p-6 rounded-3xl glass-panel border border-purple-500/40 space-y-3 shadow-2xl glow-purple animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-purple-500/20 text-purple-300">
                <RefreshCw className="animate-spin" size={22} />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-100 text-sm capitalize">
                  {scanProgress.status === 'scanning' && '1. Scanning Directory Structure'}
                  {scanProgress.status === 'hashing' && '2. Computing SHA256 Model Hashes'}
                  {scanProgress.status === 'lookup' && '3. CivitAI Database Matching'}
                  {scanProgress.status === 'completed' && 'Scan Complete!'}
                </h3>
                <p className="text-xs text-slate-400 font-mono line-clamp-1 mt-0.5">
                  {scanProgress.currentFile || 'Processing files...'}
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-base font-extrabold text-purple-300 font-mono">
                {scanProgress.totalFiles > 0
                  ? `${Math.round((scanProgress.scannedFiles / scanProgress.totalFiles) * 100)}%`
                  : '0%'}
              </span>
              <span className="text-xs text-slate-400 block font-mono">
                {scanProgress.scannedFiles} / {scanProgress.totalFiles} files
              </span>
            </div>
          </div>

          <div className="w-full bg-slate-950 rounded-full h-3.5 overflow-hidden border border-slate-800/80 shadow-inner">
            <div
              className="bg-gradient-to-r from-purple-600 via-indigo-500 to-purple-500 h-full transition-all duration-300 rounded-full glow-purple"
              style={{
                width: `${
                  scanProgress.totalFiles > 0
                    ? Math.min(100, Math.round((scanProgress.scannedFiles / scanProgress.totalFiles) * 100))
                    : scanProgress.status === 'completed' ? 100 : 5
                }%`,
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
                className={`px-3.5 py-2 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
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

        <div className="flex items-center gap-4">
          {/* Model Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="bg-slate-900 border border-slate-700 rounded-xl p-2 text-sm text-slate-100"
          >
            <option value="all">All Types</option>
            {['Checkpoint','LORA','LoCon','DoRA','TextualInversion','Hypernetwork','VAE','Controlnet','Upscaler','MotionModule','AestheticGradient','Poses','Wildcards','Workflows','Detection','Other'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {/* Sort Toggle */}
          <button
            onClick={() => setSortAsc(!sortAsc)}
            className="flex items-center gap-1 px-3 py-1 bg-slate-800 rounded-xl text-slate-100"
          >
            Sort {sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
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
        <div className="text-center py-28 text-slate-500 text-sm glass-panel rounded-3xl p-8 border border-slate-800 space-y-3">
          <HardDrive size={40} className="mx-auto text-slate-600 stroke-[1.5]" />
          <h3 className="text-base font-bold text-slate-300">No Models Displayed</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {localModels.length > 0
              ? 'No models matched your active filter or search query. Try clearing your search input.'
              : 'Add your ComfyUI model folder paths in Settings and click "Scan ComfyUI Folders" above.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredModels.map((model) => (
            <div
              key={model.id}
              className="glass-card p-4.5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800/80 hover:border-purple-500/30 shadow-md"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Preview thumbnail if available */}
                  {model.previewUrl ? (
                    <img src={model.previewUrl} alt="preview" className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-purple-400 flex-shrink-0 shadow-inner">
                      <HardDrive size={22} />
                    </div>
                  )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-100 text-sm truncate">{model.fileName}</h3>
                    {model.civitaiType && (
                      <span className="text-[10px] font-bold text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md">
                        {model.civitaiType}
                      </span>
                    )}
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
              <div className="flex flex-wrap items-center gap-3 text-xs w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-800/80">
                <span className="text-slate-300 font-mono font-semibold bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
                  {(model.fileSize / 1024 / 1024).toFixed(1)} MB
                </span>

                {model.isMatched ? (
                  <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl font-semibold">
                    <CheckCircle size={14} /> Matched
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-xl font-semibold">
                    <HelpCircle size={14} /> Unidentified
                  </span>
                )}

                {model.hasUpdate && (
                  <button
                    onClick={() => onCheckUpdate(model)}
                    className="flex items-center gap-1.5 text-amber-300 bg-amber-500/20 border border-amber-500/40 px-3.5 py-1.5 rounded-xl hover:bg-amber-500/30 transition-all font-bold glow-amber cursor-pointer"
                  >
                    <ArrowUpCircle size={14} /> Update Available
                  </button>
                )}
                {/* Delete button */}
                <button
                  onClick={async () => {
                    const res = await window.civitaiAPI.deleteLocalModel(model.id);
                    if (res?.success) {
                      // Refresh list after deletion
                      loadLocalModels();
                    } else {
                      alert(res?.error || 'Failed to delete model');
                    }
                  }}
                  className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                  title="Delete model"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
