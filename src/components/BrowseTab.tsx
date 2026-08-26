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
  RefreshCw,
  Terminal,
  Code2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { FallbackImage } from './FallbackImage';
import { CivitAIModel, CivitAIModelVersion, ModelType, SearchParams } from '../types/civitai';

export interface DebugInfo {
  timestamp: string;
  durationMs?: number;
  status: 'idle' | 'loading' | 'success' | 'error';
  requestParams: Record<string, any>;
  apiUrl: string;
  resultCount?: number;
  error?: string;
}

const DEFAULT_BASE_MODELS = [
  'All',
  'SD 1.5',
  'SDXL 1.0',
  'SD 3.5',
  'Pony',
  'Illustrious',
  'NoobAI',
  'Flux.1 D',
  'Flux.1 S',
  'Wan Video',
  'CogVideoX',
  'Hunyuan Video',
  'Qwen',
];

interface BrowseTabProps {
  onQueueDownload: (model: CivitAIModel, version: CivitAIModelVersion) => void;
}

export const BrowseTab: React.FC<BrowseTabProps> = ({ onQueueDownload }) => {
  const [models, setModels] = useState<CivitAIModel[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Debug Diagnostics
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    timestamp: new Date().toLocaleTimeString(),
    status: 'idle',
    requestParams: {},
    apiUrl: 'https://civitai.com/api/v1/models',
  });

  // Filters with LocalStorage Persistence
  const [query, setQuery] = useState<string>(() => localStorage.getItem('civitai_browse_query') || '');
  const [selectedType, setSelectedType] = useState<string>(() => localStorage.getItem('civitai_browse_type') || 'All');
  const [selectedBaseModel, setSelectedBaseModel] = useState<string>(() => localStorage.getItem('civitai_browse_base_model') || 'All');
  const [sort, setSort] = useState<'Most Downloaded' | 'Highest Rated' | 'Newest' | 'Most Liked'>(() => (localStorage.getItem('civitai_browse_sort') as any) || 'Most Downloaded');
  const [period, setPeriod] = useState<'AllTime' | 'Year' | 'Month' | 'Week' | 'Day'>(() => (localStorage.getItem('civitai_browse_period') as any) || 'AllTime');
  const [nsfwBlur, setNsfwBlur] = useState<boolean>(() => localStorage.getItem('civitai_browse_nsfw_blur') !== 'false');
  const [includeNsfw, setIncludeNsfw] = useState<boolean>(() => localStorage.getItem('civitai_browse_include_nsfw') === 'true');

  // Dynamic Base Models with localStorage Cache & Loading State
  const [baseModels, setBaseModels] = useState<string[]>(() => {
    try {
      const cached = localStorage.getItem('civitai_cached_base_models');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {}
    return DEFAULT_BASE_MODELS;
  });
  const [loadingBases, setLoadingBases] = useState<boolean>(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(() => {
    const saved = localStorage.getItem('civitai_browse_page');
    return saved ? Math.max(1, parseInt(saved, 10)) : 1;
  });
  const [pageCursors, setPageCursors] = useState<{ [page: number]: string }>({});
  const [metadata, setMetadata] = useState<{
    totalItems?: number;
    currentPage?: number;
    pageSize?: number;
    totalPages?: number;
    nextPage?: string;
    prevPage?: string;
    nextCursor?: string;
  }>({});

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

  const fetchModels = async (pageToFetch?: number, cursorOverride?: string) => {
    const pageNum = pageToFetch ?? currentPage;
    const targetCursor = cursorOverride !== undefined ? cursorOverride : (pageNum > 1 ? pageCursors[pageNum] : undefined);

    setLoading(true);
    setError(null);
    const startTime = performance.now();

    const params: SearchParams = {
      query: query.trim() || undefined,
      types: selectedType !== 'All' ? [selectedType as ModelType] : undefined,
      baseModels: selectedBaseModel !== 'All' ? [selectedBaseModel] : undefined,
      sort,
      period,
      nsfw: includeNsfw,
      limit: 50,
      page: pageNum,
      cursor: targetCursor,
    };

    // Construct preview URL for debug panel
    const urlParams = new URLSearchParams();
    if (params.query) urlParams.append('query', params.query);
    if (params.types) params.types.forEach((t) => urlParams.append('types', t));
    if (params.baseModels) params.baseModels.forEach((b) => urlParams.append('baseModels', b));
    if (params.sort) urlParams.append('sort', params.sort);
    if (params.period) urlParams.append('period', params.period);
    if (params.nsfw !== undefined) urlParams.append('nsfw', String(params.nsfw));
    urlParams.append('limit', '50');
    if (targetCursor) {
      urlParams.append('cursor', targetCursor);
    } else if (pageNum > 1) {
      urlParams.append('page', String(pageNum));
    }

    const constructedUrl = `https://civitai.com/api/v1/models?${urlParams.toString()}`;

    setDebugInfo({
      timestamp: new Date().toLocaleTimeString(),
      status: 'loading',
      requestParams: params,
      apiUrl: constructedUrl,
    });

    try {
      let result;
      if (window.civitaiAPI) {
        result = await window.civitaiAPI.searchModels(params);
      } else {
        result = { items: [] };
      }

      const items = result?.items || [];
      const durationMs = Math.round(performance.now() - startTime);

      setModels(items);
      const meta = result?.metadata || { currentPage: pageNum, pageSize: 50 };
      setMetadata(meta);

      // Extract nextCursor from metadata or from nextPage url if present
      let nextCursor = meta.nextCursor;
      if (!nextCursor && meta.nextPage) {
        try {
          const parsedUrl = new URL(meta.nextPage);
          const c = parsedUrl.searchParams.get('cursor');
          if (c) nextCursor = c;
        } catch (e) {}
      }

      if (nextCursor) {
        setPageCursors((prev) => ({
          ...prev,
          [pageNum + 1]: nextCursor,
        }));
      }

      setDebugInfo({
        timestamp: new Date().toLocaleTimeString(),
        durationMs,
        status: 'success',
        requestParams: params,
        apiUrl: constructedUrl,
        resultCount: items.length,
      });
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - startTime);
      const errMsg = err?.message || 'Failed to fetch models from CivitAI';
      setError(errMsg);
      setModels([]);
      setDebugInfo({
        timestamp: new Date().toLocaleTimeString(),
        durationMs,
        status: 'error',
        requestParams: params,
        apiUrl: constructedUrl,
        resultCount: 0,
        error: errMsg,
      });
      // Automatically expand debug info on error so the user sees the issue immediately
      setShowDebug(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadBaseModels = async () => {
      setLoadingBases(true);
      try {
        if (window.civitaiAPI) {
          const enums = await window.civitaiAPI.getEnums();
          if (enums && Array.isArray(enums.baseModels) && enums.baseModels.length > 0) {
            const cleanBases: string[] = Array.from(new Set(enums.baseModels.filter(Boolean)));
            cleanBases.sort((a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
            const populated = ['All', ...cleanBases];
            setBaseModels(populated);
            localStorage.setItem('civitai_cached_base_models', JSON.stringify(populated));
          }
        }
      } catch (err) {
        console.warn('Failed to load CivitAI base model enums:', err);
      } finally {
        setLoadingBases(false);
      }
    };

    loadBaseModels();
  }, []);

  useEffect(() => {
    localStorage.setItem('civitai_browse_query', query);
  }, [query]);

  useEffect(() => {
    localStorage.setItem('civitai_browse_type', selectedType);
  }, [selectedType]);

  useEffect(() => {
    localStorage.setItem('civitai_browse_base_model', selectedBaseModel);
  }, [selectedBaseModel]);

  useEffect(() => {
    localStorage.setItem('civitai_browse_sort', sort);
  }, [sort]);

  useEffect(() => {
    localStorage.setItem('civitai_browse_period', period);
  }, [period]);

  useEffect(() => {
    localStorage.setItem('civitai_browse_nsfw_blur', String(nsfwBlur));
  }, [nsfwBlur]);

  useEffect(() => {
    localStorage.setItem('civitai_browse_include_nsfw', String(includeNsfw));
  }, [includeNsfw]);

  useEffect(() => {
    localStorage.setItem('civitai_browse_page', String(currentPage));
  }, [currentPage]);

  // Fetch models on initial mount or when filters change (resets to page 1)
  useEffect(() => {
    setCurrentPage(1);
    setPageCursors({});
    fetchModels(1, '');
  }, [selectedType, selectedBaseModel, sort, period, includeNsfw]);

  // Strict NSFW & Mature Content Filtering for Clean View
  const displayedModels = models.filter((model) => {
    if (!includeNsfw) {
      if (model.nsfw === true) return false;
      const firstVersion = model.modelVersions?.[0];
      const firstImg = firstVersion?.images?.[0];
      if (firstImg?.nsfw === true || firstImg?.nsfw === 'Mature' || firstImg?.nsfw === 'X') {
        return false;
      }
    }
    return true;
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    setPageCursors({});
    fetchModels(1, '');
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1) return;
    setCurrentPage(newPage);
    const targetCursor = newPage === 1 ? '' : (pageCursors[newPage] || undefined);
    fetchModels(newPage, targetCursor);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
            {loadingBases && (
              <span title="Refreshing CivitAI base models...">
                <RefreshCw size={12} className="animate-spin text-indigo-400" />
              </span>
            )}
            <select
              value={selectedBaseModel}
              onChange={(e) => setSelectedBaseModel(e.target.value)}
              className="bg-transparent text-slate-100 text-xs font-semibold focus:outline-none cursor-pointer max-w-[150px] truncate"
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
      ) : displayedModels.length === 0 ? (
        <div className="text-center py-28 text-slate-500 text-sm glass-panel rounded-2xl">
          No models found matching your search parameters. Try adjusting filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {displayedModels.map((model) => {
            const firstVersion = model.modelVersions?.[0];
            const candidateImages: string[] = [];
            model.modelVersions?.forEach((v) => {
              v.images?.forEach((img) => {
                if (img?.url && !candidateImages.includes(img.url)) {
                  candidateImages.push(img.url);
                }
              });
            });
            const isNsfw = model.nsfw || (typeof model.nsfwLevel === 'number' && model.nsfwLevel > 1);

            return (
              <div
                key={model.id}
                onClick={() => openModelDetails(model)}
                className="glass-card rounded-2xl overflow-hidden cursor-pointer flex flex-col group border border-slate-800/80 hover:border-purple-500/40"
              >
                {/* Image Preview Container */}
                <div className="relative aspect-[4/3] bg-slate-950 overflow-hidden">
                  <FallbackImage
                    src={candidateImages[0]}
                    candidateUrls={candidateImages}
                    alt={model.name}
                    isBlurred={isNsfw && nsfwBlur}
                    className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  />

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

      {/* Pagination Controls */}
      {!loading && !error && displayedModels.length > 0 && (
        <div className="glass-panel p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 text-xs font-semibold shadow-xl border border-slate-800">
          {/* Left: Info / Total Count */}
          <div className="text-slate-400 font-medium flex items-center gap-2">
            <span>
              Page <strong className="text-purple-300 font-bold">{currentPage}</strong>
              {metadata.totalPages ? ` of ${metadata.totalPages}` : ''}
            </span>
            <span className="text-slate-600">•</span>
            <span>
              Showing <strong className="text-slate-200">{displayedModels.length}</strong> models
              {metadata.totalItems ? ` (${metadata.totalItems.toLocaleString()} total)` : ''}
            </span>
          </div>

          {/* Right: Navigation Controls */}
          <div className="flex items-center gap-2">
            {/* First Page */}
            {currentPage > 2 && (
              <button
                onClick={() => handlePageChange(1)}
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-all flex items-center gap-1 cursor-pointer"
                title="First Page"
              >
                <ChevronsLeft size={16} />
              </button>
            )}

            {/* Previous Page */}
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className={`px-3.5 py-2 rounded-xl border flex items-center gap-1.5 transition-all ${
                currentPage <= 1
                  ? 'bg-slate-950/40 border-slate-900 text-slate-600 cursor-not-allowed'
                  : 'bg-slate-900 border-slate-800 text-slate-200 hover:text-white hover:bg-slate-800 hover:border-purple-500/40 cursor-pointer shadow-sm'
              }`}
            >
              <ChevronLeft size={15} />
              <span>Previous</span>
            </button>

            {/* Page Indicator Pill */}
            <div className="px-3.5 py-2 bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30 text-purple-200 font-bold rounded-xl shadow-inner flex items-center gap-1">
              <span>Page</span>
              <span className="text-white font-extrabold">{currentPage}</span>
              {metadata.totalPages ? (
                <span className="text-slate-400">/ {metadata.totalPages}</span>
              ) : null}
            </div>

            {/* Next Page */}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!metadata.nextPage && !metadata.nextCursor && !pageCursors[currentPage + 1] && displayedModels.length < 50}
              className={`px-4 py-2 rounded-xl border flex items-center gap-1.5 transition-all ${
                !metadata.nextPage && !metadata.nextCursor && !pageCursors[currentPage + 1] && displayedModels.length < 50
                  ? 'bg-slate-950/40 border-slate-900 text-slate-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold border-transparent shadow-lg shadow-purple-600/25 cursor-pointer glow-purple'
              }`}
            >
              <span>Next</span>
              <ChevronRight size={15} />
            </button>
          </div>
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
                          <FallbackImage
                            key={idx}
                            src={img.url}
                            candidateUrls={selectedVersion.images ? selectedVersion.images.slice(idx).map((i) => i.url) : []}
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

      {/* API Debug & Diagnostics Inspector */}
      <div className="glass-panel rounded-2xl border border-slate-800/80 shadow-2xl overflow-hidden mt-12 transition-all">
        {/* Header / Summary Bar */}
        <div
          onClick={() => setShowDebug(!showDebug)}
          className="p-4 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-slate-800/40 transition-colors bg-slate-950/40"
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border ${
              debugInfo.status === 'error'
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : debugInfo.status === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
            }`}>
              <Terminal size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200">API Diagnostics & Query Inspector</span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                  debugInfo.status === 'error'
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                    : debugInfo.status === 'success'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : debugInfo.status === 'loading'
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 animate-pulse'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {debugInfo.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate max-w-xl">
                {debugInfo.apiUrl}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {debugInfo.durationMs !== undefined && (
              <span className="text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
                {debugInfo.durationMs}ms
              </span>
            )}
            {debugInfo.resultCount !== undefined && (
              <span className="text-xs font-mono text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-lg">
                {debugInfo.resultCount} models
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDebug(!showDebug);
              }}
              className="text-slate-400 hover:text-slate-200 p-1 rounded-lg bg-slate-900/80 border border-slate-800 transition-colors"
            >
              {showDebug ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* Expanded Diagnostics Details */}
        {showDebug && (
          <div className="p-5 border-t border-slate-800/80 space-y-4 bg-slate-950/80 text-xs animate-fadeIn">
            {/* Error Banner */}
            {debugInfo.error && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <span className="font-bold block text-red-200">API Error Response:</span>
                  <pre className="font-mono text-[11px] mt-1 whitespace-pre-wrap break-all text-red-300 bg-red-950/50 p-2.5 rounded-lg border border-red-500/20">
                    {debugInfo.error}
                  </pre>
                </div>
              </div>
            )}

            {/* Request URL with Copy */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">Constructed Request URL</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(debugInfo.apiUrl);
                    setCopiedUrl(true);
                    setTimeout(() => setCopiedUrl(false), 2000);
                  }}
                  className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 transition-colors"
                >
                  {copiedUrl ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span>{copiedUrl ? 'Copied URL' : 'Copy URL'}</span>
                </button>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300 break-all select-all">
                {debugInfo.apiUrl}
              </div>
            </div>

            {/* Active Parameters Inspector */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="font-bold text-slate-300 uppercase tracking-wider text-[10px] block mb-1.5">
                  Parsed Query Parameters
                </span>
                <pre className="p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-indigo-300 overflow-x-auto">
                  {JSON.stringify(debugInfo.requestParams, null, 2)}
                </pre>
              </div>

              <div>
                <span className="font-bold text-slate-300 uppercase tracking-wider text-[10px] block mb-1.5">
                  Request Metadata
                </span>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Last Executed:</span>
                    <span className="text-slate-300">{debugInfo.timestamp}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Roundtrip Latency:</span>
                    <span className="text-slate-300">{debugInfo.durationMs ?? 0} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">HTTP Status:</span>
                    <span className={debugInfo.status === 'success' ? 'text-emerald-400 font-bold' : debugInfo.status === 'error' ? 'text-red-400 font-bold' : 'text-slate-300'}>
                      {debugInfo.status === 'success' ? '200 OK' : debugInfo.status === 'error' ? 'Failed' : 'Pending'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Returned Count:</span>
                    <span className="text-purple-300 font-bold">{debugInfo.resultCount ?? 0} models</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
