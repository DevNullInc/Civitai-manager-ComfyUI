import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Download,
  Eye,
  EyeOff,
  Star,
  HardDrive,
  User,
  ExternalLink,
  X,
  CheckCircle2,
} from 'lucide-react';
import { CivitAIModel, CivitAIModelVersion, ModelType, SearchParams } from '../types/civitai';

interface BrowseTabProps {
  onQueueDownload: (model: CivitAIModel, version: CivitAIModelVersion) => void;
}

export const BrowseTab: React.FC<BrowseTabProps> = ({ onQueueDownload }) => {
  const [models, setModels] = useState<CivitAIModel[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [query, setQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [selectedBaseModel, setSelectedBaseModel] = useState<string>('All');
  const [sort, setSort] = useState<'Most Downloaded' | 'Highest Rated' | 'Newest' | 'Most Liked'>('Most Downloaded');
  const [period, setPeriod] = useState<'AllTime' | 'Year' | 'Month' | 'Week' | 'Day'>('AllTime');
  const [nsfwBlur, setNsfwBlur] = useState<boolean>(true);
  const [includeNsfw, setIncludeNsfw] = useState<boolean>(false);

  // Detail Modal
  const [activeModel, setActiveModel] = useState<CivitAIModel | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<CivitAIModelVersion | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const modelTypes: string[] = [
    'All',
    'Checkpoint',
    'LORA',
    'LoCon',
    'DoRA',
    'TextualInversion',
    'Hypernetwork',
    'VAE',
    'Controlnet',
    'Upscaler',
    'MotionModule',
    'Wildcards',
    'Workflows',
    'Detection',
  ];

  const baseModels: string[] = [
    'All',
    'SD 1.5',
    'SDXL 1.0',
    'Illustrious',
    'Flux.1 D',
    'Pony',
    'Qwen',
    'Wan Video',
  ];

  const fetchModels = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: SearchParams = {
        query: query.trim() || undefined,
        types: selectedType !== 'All' ? [selectedType as ModelType] : undefined,
        baseModels: selectedBaseModel !== 'All' ? [selectedBaseModel] : undefined,
        sort,
        period,
        nsfw: includeNsfw,
        limit: 50,
      };

      let result;
      if (window.civitaiAPI) {
        result = await window.civitaiAPI.searchModels(params);
      } else {
        // Fallback mock for browser preview
        result = { items: [] };
      }
      setModels(result.items || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch models from CivitAI');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, [selectedType, selectedBaseModel, sort, period, includeNsfw]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchModels();
  };

  const openModelDetails = (model: CivitAIModel) => {
    setActiveModel(model);
    if (model.modelVersions && model.modelVersions.length > 0) {
      setSelectedVersion(model.modelVersions[0]);
    } else {
      setSelectedVersion(null);
    }
  };

  const triggerDownload = (version: CivitAIModelVersion) => {
    if (!activeModel) return;
    onQueueDownload(activeModel, version);
    setDownloadSuccess(`Queued download for ${activeModel.name} (${version.name})`);
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Browse CivitAI Models</h1>
          <p className="text-sm text-slate-400">Discover and download models directly into your ComfyUI folders.</p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search CivitAI..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/60 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm rounded-lg transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-panel p-4 rounded-xl flex flex-wrap gap-4 items-center justify-between text-sm">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Model Type */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <Filter size={14} className="text-purple-400" />
            <span className="text-slate-400 text-xs font-medium">Type:</span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none cursor-pointer"
            >
              {modelTypes.map((t) => (
                <option key={t} value={t} className="bg-slate-900 text-slate-200">
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Base Model */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <HardDrive size={14} className="text-blue-400" />
            <span className="text-slate-400 text-xs font-medium">Base:</span>
            <select
              value={selectedBaseModel}
              onChange={(e) => setSelectedBaseModel(e.target.value)}
              className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none cursor-pointer"
            >
              {baseModels.map((b) => (
                <option key={b} value={b} className="bg-slate-900 text-slate-200">
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-slate-400 text-xs font-medium">Sort:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none cursor-pointer"
            >
              <option value="Most Downloaded" className="bg-slate-900">Most Downloaded</option>
              <option value="Highest Rated" className="bg-slate-900">Highest Rated</option>
              <option value="Newest" className="bg-slate-900">Newest</option>
              <option value="Most Liked" className="bg-slate-900">Most Liked</option>
            </select>
          </div>
        </div>

        {/* NSFW Controls */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
            <input
              type="checkbox"
              checked={includeNsfw}
              onChange={(e) => setIncludeNsfw(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-purple-500"
            />
            <span>Include NSFW</span>
          </label>

          {includeNsfw && (
            <button
              onClick={() => setNsfwBlur(!nsfwBlur)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800 transition-colors"
            >
              {nsfwBlur ? <EyeOff size={14} className="text-amber-400" /> : <Eye size={14} className="text-slate-400" />}
              <span>{nsfwBlur ? 'Blur NSFW' : 'Unblur NSFW'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Model Cards Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500"></div>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      ) : models.length === 0 ? (
        <div className="text-center py-20 text-slate-500 text-sm">
          No models found matching your search criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {models.map((model) => {
            const firstVersion = model.modelVersions?.[0];
            const coverImage = firstVersion?.images?.[0]?.url;
            const isNsfw = model.nsfw || (model.nsfwLevel && model.nsfwLevel > 5);

            return (
              <div
                key={model.id}
                onClick={() => openModelDetails(model)}
                className="glass-card rounded-xl overflow-hidden cursor-pointer flex flex-col group"
              >
                {/* Image Preview Container */}
                <div className="relative aspect-[4/3] bg-slate-900 overflow-hidden">
                  {coverImage ? (
                    <img
                      src={coverImage}
                      alt={model.name}
                      className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                        isNsfw && nsfwBlur ? 'blur-md scale-110' : ''
                      }`}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-700 font-mono text-xs">
                      NO PREVIEW
                    </div>
                  )}

                  {/* Type Badge */}
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-950/80 border border-purple-500/40 text-purple-300 backdrop-blur-sm">
                    {model.type}
                  </span>

                  {/* NSFW Badge */}
                  {isNsfw && (
                    <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-950/80 border border-red-500/40 text-red-300 backdrop-blur-sm">
                      NSFW
                    </span>
                  )}
                </div>

                {/* Model Info */}
                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <h3 className="font-semibold text-slate-100 text-sm line-clamp-1 group-hover:text-purple-300 transition-colors">
                      {model.name}
                    </h3>
                    {model.creator && (
                      <p className="text-slate-400 text-xs flex items-center gap-1 mt-0.5">
                        <User size={12} />
                        <span className="line-clamp-1">{model.creator.username}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                    <span className="flex items-center gap-1">
                      <Download size={12} className="text-slate-500" />
                      {(model.stats?.downloadCount || 0).toLocaleString()}
                    </span>
                    {firstVersion?.baseModel && (
                      <span className="bg-slate-800/80 px-2 py-0.5 rounded text-[10px] text-slate-300">
                        {firstVersion.baseModel}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Model Detail Modal */}
      {activeModel && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-800">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-100">{activeModel.name}</h2>
                <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                  <span>Type: <strong className="text-purple-400">{activeModel.type}</strong></span>
                  {activeModel.creator && <span>By: {activeModel.creator.username}</span>}
                </p>
              </div>
              <button
                onClick={() => setActiveModel(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-slate-300">
              {downloadSuccess && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-2 text-xs">
                  <CheckCircle2 size={16} />
                  <span>{downloadSuccess}</span>
                </div>
              )}

              {/* Version Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Select Model Version
                </label>
                <select
                  value={selectedVersion?.id || ''}
                  onChange={(e) => {
                    const ver = activeModel.modelVersions.find((v) => v.id === parseInt(e.target.value, 10));
                    if (ver) setSelectedVersion(ver);
                  }}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg p-2.5 text-sm text-slate-100 focus:border-purple-500 focus:outline-none"
                >
                  {activeModel.modelVersions.map((v) => (
                    <option key={v.id} value={v.id} className="bg-slate-900">
                      {v.name} ({v.baseModel}) - {v.publishedAt ? new Date(v.publishedAt).toLocaleDateString() : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Version Details */}
              {selectedVersion && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80 text-xs">
                    <div>
                      <span className="text-slate-400 block">Base Model:</span>
                      <span className="font-semibold text-slate-200">{selectedVersion.baseModel}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Primary File:</span>
                      <span className="font-semibold text-slate-200">
                        {selectedVersion.files?.[0]?.name || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">File Size:</span>
                      <span className="font-semibold text-slate-200">
                        {selectedVersion.files?.[0]?.sizeKB
                          ? `${(selectedVersion.files[0].sizeKB / 1024 / 1024).toFixed(2)} GB`
                          : 'Unknown'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">SHA256 Hash:</span>
                      <span className="font-mono text-[10px] text-purple-300 truncate block">
                        {selectedVersion.files?.[0]?.hashes?.SHA256 || 'Not available'}
                      </span>
                    </div>
                  </div>

                  {/* Image Preview Grid */}
                  {selectedVersion.images && selectedVersion.images.length > 0 && (
                    <div>
                      <span className="block text-xs font-semibold text-slate-400 mb-2">Version Gallery</span>
                      <div className="flex gap-3 overflow-x-auto pb-2">
                        {selectedVersion.images.slice(0, 4).map((img, idx) => (
                          <img
                            key={idx}
                            src={img.url}
                            alt="Sample preview"
                            className="w-28 h-28 object-cover rounded-lg border border-slate-800 bg-slate-900"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/40">
              <a
                href={`https://civitai.com/models/${activeModel.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                <span>View on CivitAI</span>
                <ExternalLink size={12} />
              </a>

              {selectedVersion && (
                <button
                  onClick={() => triggerDownload(selectedVersion)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-xl text-sm transition-colors shadow-lg shadow-purple-600/20"
                >
                  <Download size={16} />
                  <span>Download to ComfyUI</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
