import React, { useState, useEffect } from 'react';
import { civitaiClient } from '../services/civitaiClient';
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
  Sparkles,
  Layers,
  Calendar,
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

  const [baseModels, setBaseModels] = useState<string[]>([
    'All',
    'SD 1.5',
    'SDXL 1.0',
    'Illustrious',
    'Flux.1 D',
    'Pony',
    'Qwen',
    'Wan Video',
  ]);
  const [enumsLoaded, setEnumsLoaded] = useState(false);

  // Fetch base models from API on mount
  useEffect(() => {
    const loadEnums = async () => {
      // Check cache first (24 hour TTL)
      const cached = localStorage.getItem('civitai_enums');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
          setBaseModels(['All', ...data.baseModels]);
          setEnumsLoaded(true);
          return;
        }
      }

      // Fetch fresh from API
      try {
        const data = await civitaiClient.fetchEnums();
        localStorage.setItem('civitai_enums', JSON.stringify({
          data,
          timestamp: Date.now()
        }));
        setBaseModels(['All', ...data.baseModels]);
        setEnumsLoaded(true);
      } catch (err) {
        console.error('Failed to load base models:', err);
        setEnumsLoaded(true); // Keep defaults on error
      }
    };

    loadEnums();
  }, []);

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

  const formatCount = (count?: number): string => {
    if (!count) return '0';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight flex items-center gap-2">
            <span>Discover AI Models</span>
            <Sparkles size={24} className="text-purple-400 animate-pulse" />
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Search across CivitAI with verified API integration and direct ComfyUI folder auto-sorting.
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-400" size={18} />
            <input
              type="text"
              placeholder="Search checkpoints, LoRAs, ControlNets..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-700/60 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all shadow-inner"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-purple-600/25 flex items-center gap-2"
          >
            <span>Search</span>
          </button>
        </form>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-panel p-4 rounded-2xl flex flex-wrap gap-4 items-center justify-between text-sm shadow-xl">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Model Type */}
          <div className="flex items-center gap-2 bg-slate-900/90 px-3.5 py-2 rounded-xl border border-slate-800 shadow-sm">
            <Filter size={15} className="text-purple-400" />
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Type:</span>
            <select
              value={selectedType}
              disabled={!enumsLoaded}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-transparent text-slate-100 text-xs font-semibold focus:outline-none cursor-pointer"
            >
              {modelTypes.map((t) => (
                <option key={t} value={t} className="bg-slate-900 text-slate-100">
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Base Model */}
          <div className="flex items-center gap-2 bg-slate-900/90 px-3.5 py-2 rounded-xl border border-slate-800 shadow-sm">
            <HardDrive size={15} className="text-indigo-400" />
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Base:</span>
            <select
              value={selectedBaseModel}
              onChange={(e) => setSelectedBaseModel(e.target.value)}
              className="bg-transparent text-slate-100 text-xs font-semibold focus:outline-none cursor-pointer"
            >
              {baseModels.map((b) => (
                <option key={b} value={b} className="bg-slate-900 text-slate-100">
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 bg-slate-900/90 px-3.5 py-2 rounded-xl border border-slate-800 shadow-sm">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Sort:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="bg-transparent text-slate-100 text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value="Most Downloaded" className="bg-slate-900">Most Downloaded</option>
              <option value="Highest Rated" className="bg-slate-900">Highest Rated</option>
              <option value="Newest" className="bg-slate-900">Newest</option>
              <option value="Most Liked" className="bg-slate-900">Most Liked</option>
            </select>
          </div>
        </div>

        {/* NSFW Controls */}
        <div className="flex items-center gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-800/80 w-full sm:w-auto justify-between">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-300">
            <input
              type="checkbox"
              checked={includeNsfw}
              onChange={(e) => setIncludeNsfw(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-purple-500 w-4 h-4"
            />
            <span>Include Mature Content</span>
          </label>

          {includeNsfw && (
            <button
              onClick={() => setNsfwBlur(!nsfwBlur)}
              className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20 hover:bg-amber-500/20 transition-all font-semibold"
            >
              {nsfwBlur ? <EyeOff size={14} className="text-amber-400" /> : <Eye size={14} className="text-slate-400" />}
              <span>{nsfwBlur ? 'Blur NSFW' : 'Show Unblurred'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Model Cards Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-28 space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 glow-purple"></div>
          <span className="text-xs text-slate-400 font-medium">Fetching model catalog...</span>
        </div>
      ) : error ? (
        <div className="p-5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
          <span>{error}</span>
        </div>
      ) : models.length === 0 ? (
        <div className="text-center py-28 text-slate-500 text-sm glass-panel rounded-2xl">
          No models found matching your search parameters. Try adjusting filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {models.map((model) => {
            const firstVersion = model.modelVersions?.[0];
            const coverImage = firstVersion?.images?.[0]?.url;
            const isNsfw = model.nsfw || (model.nsfwLevel && model.nsfwLevel > 5);

            return (
              <div
                key={model.id}
                onClick={() => openModelDetails(model)}
                className="glass-card rounded-2xl overflow-hidden cursor-pointer flex flex-col group border border-slate-800/80 hover:border-purple-500/40"
              >
                {/* Image Preview Container */}
                <div className="relative aspect-[4/3] bg-slate-950 overflow-hidden">
                  {coverImage ? (
                    <img
                      src={coverImage}
                      alt={model.name}
                      className={`w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 ${isNsfw && nsfwBlur ? 'blur-lg scale-110' : ''
                        }`}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-700 font-mono text-xs gap-1 bg-slate-900/50">
                      <Layers size={24} className="text-slate-800" />
                      <span>NO PREVIEW</span>
                    </div>
                  )}

                  {/* Type Badge */}
                  <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-slate-950/80 border border-purple-500/40 text-purple-300 backdrop-blur-md shadow-md">
                    {model.type}
                  </span>

                  {/* NSFW Badge */}
                  {isNsfw && (
                    <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-lg text-[9px] font-extrabold bg-red-950/90 border border-red-500/40 text-red-400 backdrop-blur-md">
                      NSFW
                    </span>
                  )}
                </div>

                {/* Model Info */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="font-bold text-slate-100 text-sm line-clamp-1 group-hover:text-purple-300 transition-colors">
                      {model.name}
                    </h3>
                    {model.creator && (
                      <p className="text-slate-400 text-xs flex items-center gap-1 mt-1 font-medium">
                        <User size={12} className="text-purple-400" />
                        <span className="line-clamp-1">{model.creator.username}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-800/80">
                    <span className="flex items-center gap-1 text-slate-300 font-semibold">
                      <Download size={13} className="text-purple-400" />
                      {formatCount(model.stats?.downloadCount)}
                    </span>
                    {firstVersion?.baseModel && (
                      <span className="bg-slate-900 border border-slate-800 px-2.5 py-0.5 rounded-md text-[10px] text-slate-300 font-medium">
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
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-3xl rounded-3xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-700/60 shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/50">
              <div>
                <h2 className="text-xl font-bold text-slate-100">{activeModel.name}</h2>
                <p className="text-xs text-slate-400 flex items-center gap-3 mt-1 font-medium">
                  <span>Type: <strong className="text-purple-400">{activeModel.type}</strong></span>
                  {activeModel.creator && <span>Creator: <strong className="text-slate-300">{activeModel.creator.username}</strong></span>}
                </p>
              </div>
              <button
                onClick={() => setActiveModel(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-slate-300">
              {downloadSuccess && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-2.5 text-xs font-semibold glow-emerald">
                  <CheckCircle2 size={18} />
                  <span>{downloadSuccess}</span>
                </div>
              )}

              {/* Version Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Select Target Version
                </label>
                <select
                  value={selectedVersion?.id || ''}
                  onChange={(e) => {
                    const ver = activeModel.modelVersions.find((v) => v.id === parseInt(e.target.value, 10));
                    if (ver) setSelectedVersion(ver);
                  }}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl p-3 text-sm text-slate-100 focus:border-purple-500 focus:outline-none font-medium"
                >
                  {activeModel.modelVersions.map((v) => (
                    <option key={v.id} value={v.id} className="bg-slate-900">
                      {v.name} ({v.baseModel}) {v.publishedAt ? `- ${new Date(v.publishedAt).toLocaleDateString()}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Version Specs Grid */}
              {selectedVersion && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 text-xs">
                    <div>
                      <span className="text-slate-400 block font-medium">Base Architecture:</span>
                      <span className="font-bold text-slate-100 text-sm mt-0.5 block">{selectedVersion.baseModel}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">Primary File:</span>
                      <span className="font-semibold text-slate-200 truncate block mt-0.5">
                        {selectedVersion.files?.[0]?.name || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">Download Size:</span>
                      <span className="font-semibold text-slate-200 mt-0.5 block">
                        {selectedVersion.files?.[0]?.sizeKB
                          ? `${(selectedVersion.files[0].sizeKB / 1024 / 1024).toFixed(2)} GB`
                          : 'Unknown'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">SHA256 Checksum:</span>
                      <span className="font-mono text-[10px] text-purple-300 truncate block mt-0.5">
                        {selectedVersion.files?.[0]?.hashes?.SHA256 || 'Not available'}
                      </span>
                    </div>
                  </div>

                  {/* Gallery */}
                  {selectedVersion.images && selectedVersion.images.length > 0 && (
                    <div>
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                        Sample Gallery
                      </span>
                      <div className="flex gap-3 overflow-x-auto pb-2">
                        {selectedVersion.images.slice(0, 5).map((img, idx) => (
                          <img
                            key={idx}
                            src={img.url}
                            alt="Preview sample"
                            className="w-32 h-32 object-cover rounded-xl border border-slate-800 bg-slate-950 flex-shrink-0"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="p-5 border-t border-slate-800/80 flex items-center justify-between bg-slate-900/50">
              <a
                href={`https://civitai.com/models/${activeModel.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors font-medium"
              >
                <span>View on CivitAI.com</span>
                <ExternalLink size={13} />
              </a>

              {selectedVersion && (
                <button
                  onClick={() => triggerDownload(selectedVersion)}
                  className="flex items-center gap-2.5 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-2xl text-sm transition-all shadow-xl shadow-purple-600/30 glow-purple"
                >
                  <Download size={18} />
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
