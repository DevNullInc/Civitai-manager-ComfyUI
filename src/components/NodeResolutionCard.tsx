/**
 * CivitAI Model Manager - ComfyUI Edition
 * Copyright (C) 2025-2026 TheStygianRenegade / /dev/null Inc
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import React, { useState } from 'react';
import {
  Star,
  GitBranch,
  CheckCircle2,
  ExternalLink,
  Download,
  AlertCircle,
  Terminal,
  Loader2,
  Sparkles,
  Link as LinkIcon,
  Package,
  FolderSearch,
  Search,
  ChevronDown,
} from 'lucide-react';
import { NodeResolutionResult, NodeCloneResult, CustomNodePackage } from '../types/app';

interface NodeResolutionCardProps {
  nodeType: string;
  resolution?: NodeResolutionResult | null;
  onInstalled?: (folderName: string) => void;
}

export const NodeResolutionCard: React.FC<NodeResolutionCardProps> = ({
  nodeType,
  resolution,
  onInstalled,
}) => {
  const [customGitUrl, setCustomGitUrl] = useState('');
  const [isCloning, setIsCloning] = useState<string | null>(null);
  const [cloneResult, setCloneResult] = useState<NodeCloneResult | null>(null);
  const [isInstallingDeps, setIsInstallingDeps] = useState(false);
  const [installOutput, setInstallOutput] = useState<string | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);

  // Manual fallback mapping (searchable dropdown of installed custom node folders)
  const [manualPickerOpen, setManualPickerOpen] = useState(false);
  const [manualSearch, setManualSearch] = useState('');
  const [installedFolders, setInstalledFolders] = useState<CustomNodePackage[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [isMapping, setIsMapping] = useState(false);
  const [mappingError, setMappingError] = useState<string | null>(null);

  const formatStars = (count: number): string => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    }
    return String(count);
  };

  const formatRelativeTime = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (days === 0) return 'Updated today';
      if (days === 1) return 'Updated yesterday';
      if (days < 30) return `Updated ${days} days ago`;
      const months = Math.floor(days / 30);
      return `Updated ${months} month${months > 1 ? 's' : ''} ago`;
    } catch {
      return '';
    }
  };

  const handleCloneRepo = async (gitUrl: string) => {
    if (!gitUrl || !window.civitaiAPI?.cloneCustomNode) return;
    setIsCloning(gitUrl);
    setCloneResult(null);
    setInstallOutput(null);
    setInstallError(null);

    try {
      const res: NodeCloneResult = await window.civitaiAPI.cloneCustomNode(gitUrl);
      setCloneResult(res);
      if (res.success && onInstalled) {
        onInstalled(res.folderName);
      }
    } catch (err: any) {
      setCloneResult({
        success: false,
        folderName: '',
        targetPath: '',
        hasRequirements: false,
        hasInstallScript: false,
        error: err?.message || 'Clone failed',
      });
    } finally {
      setIsCloning(null);
    }
  };

  const handleInstallDeps = async (folderPath: string) => {
    if (!window.civitaiAPI?.installNodeDependencies) return;
    setIsInstallingDeps(true);
    setInstallError(null);

    try {
      const res = await window.civitaiAPI.installNodeDependencies(folderPath);
      if (res.success) {
        setInstallOutput(res.output || 'Dependencies installed successfully.');
      } else {
        setInstallError(res.error || 'Failed to install dependencies.');
        setInstallOutput(res.output || null);
      }
    } catch (e: any) {
      setInstallError(e?.message || 'Execution error');
    } finally {
      setIsInstallingDeps(false);
    }
  };

  const handleSearchGitHub = () => {
    if (!window.civitaiAPI?.openExternal) return;
    // Open GitHub repository search in the user's browser instead of the API so we
    // never trip the unauthenticated Search API rate limit.
    const searchUrl = `https://github.com/search?q=${encodeURIComponent(`comfyui ${nodeType}`)}&type=repositories`;
    window.civitaiAPI.openExternal(searchUrl);
  };

  const handleOpenManualPicker = async () => {
    const nextOpen = !manualPickerOpen;
    setManualPickerOpen(nextOpen);
    if (nextOpen && installedFolders.length === 0 && window.civitaiAPI?.getInstalledCustomNodes) {
      setIsLoadingFolders(true);
      try {
        const pkgs = await window.civitaiAPI.getInstalledCustomNodes();
        setInstalledFolders(Array.isArray(pkgs) ? pkgs : []);
      } catch {
        setInstalledFolders([]);
      } finally {
        setIsLoadingFolders(false);
      }
    }
  };

  const handleManualSelect = async (folderName: string) => {
    if (!folderName || !window.civitaiAPI?.markCustomNodeInstalled) return;
    setIsMapping(true);
    setMappingError(null);
    try {
      const res = await window.civitaiAPI.markCustomNodeInstalled(nodeType, folderName);
      if (res?.isInstalled) {
        setManualPickerOpen(false);
        setManualSearch('');
        if (onInstalled) onInstalled(folderName);
      } else {
        setMappingError(
          'Could not map this node to that folder. The folder may have been removed from disk.'
        );
      }
    } catch (err: any) {
      setMappingError(err?.message || 'Failed to map node to folder.');
    } finally {
      setIsMapping(false);
    }
  };

  const filteredFolders = installedFolders.filter((f) =>
    f.folderName.toLowerCase().includes(manualSearch.toLowerCase())
  );

  const candidates = resolution?.githubCandidates || [];

  return (
    <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="text-cyan-400" size={18} />
          <h3 className="text-sm font-bold text-slate-100 font-mono">
            {nodeType}
          </h3>
        </div>

        {resolution?.isInstalled ? (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
            <CheckCircle2 size={13} />
            <span>Installed ({resolution.installedFolder})</span>
          </span>
        ) : (
          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold">
            Missing Node
          </span>
        )}
      </div>

      {/* On-demand GitHub search - browser-only (avoids API rate limits), available for missing nodes */}
      {!resolution?.isInstalled && (
        <div className="flex items-start gap-2.5 flex-wrap">
          <button
            onClick={handleSearchGitHub}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 rounded-xl text-xs font-bold transition-all shadow cursor-pointer"
            title="Opens GitHub repository search in your browser"
          >
            <ExternalLink size={13} />
            <span>Search GitHub</span>
          </button>
          <span className="text-[11px] text-slate-500 pt-1">
            Opens GitHub in your browser, then paste the repo URL below to install.
          </span>
        </div>
      )}

      {/* Fallback: map a "missing" node to an installed folder the scanner failed to detect */}
      {!resolution?.isInstalled && (
        <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <button
              onClick={handleOpenManualPicker}
              className="text-xs font-semibold text-cyan-300 hover:text-cyan-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Select the folder that provides this node from your installed custom nodes"
            >
              <FolderSearch size={14} />
              <span>Already have this node? Map it to its installed folder</span>
              <ChevronDown
                size={13}
                className={`transition-transform ${manualPickerOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {mappingError && <span className="text-[11px] text-rose-400">{mappingError}</span>}
          </div>

          {manualPickerOpen && (
            <div className="space-y-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search installed custom node folders..."
                  value={manualSearch}
                  onChange={(e) => setManualSearch(e.target.value)}
                  autoFocus
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/60 custom-scrollbar">
                {isLoadingFolders ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 text-[11px] text-slate-400">
                    <Loader2 size={12} className="animate-spin" />
                    <span>Scanning custom_nodes folder...</span>
                  </div>
                ) : filteredFolders.length === 0 ? (
                  <p className="px-3 py-2.5 text-[11px] text-slate-500 italic">
                    {installedFolders.length === 0
                      ? 'No custom node folders detected.'
                      : 'No folders match your search.'}
                  </p>
                ) : (
                  filteredFolders.map((f) => (
                    <button
                      key={f.folderName}
                      onClick={() => handleManualSelect(f.folderName)}
                      disabled={isMapping}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-900 text-xs text-slate-200 transition-colors cursor-pointer disabled:opacity-50 border-b border-slate-800/50 last:border-b-0"
                    >
                      <span className="font-mono truncate">{f.folderName}</span>
                      {f.nodeClasses.length > 0 && (
                        <span className="text-[10px] text-slate-500 shrink-0">
                          {f.nodeClasses.length} class{f.nodeClasses.length !== 1 ? 'es' : ''}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ComfyUI Manager Registry Match */}
      {resolution?.managerMatch && !resolution.isInstalled && (
        <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-800/40 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-purple-300 flex items-center gap-1.5">
              <Sparkles size={14} className="text-purple-400" />
              <span>Registry Match: {resolution.managerMatch.title}</span>
            </span>
            <button
              onClick={() => handleCloneRepo(resolution.managerMatch!.gitUrl)}
              disabled={isCloning === resolution.managerMatch.gitUrl}
              className="flex items-center gap-1.5 px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold text-xs transition-all shadow cursor-pointer disabled:opacity-50"
            >
              {isCloning === resolution.managerMatch.gitUrl ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Download size={13} />
              )}
              <span>Install Extension</span>
            </button>
          </div>
          <p className="text-slate-400">{resolution.managerMatch.description}</p>
          <div className="text-[11px] font-mono text-slate-500">{resolution.managerMatch.gitUrl}</div>
        </div>
      )}

      {/* GitHub Top 3 Search Candidates */}
      {candidates.length > 0 && !resolution?.isInstalled && (
        <div className="space-y-2.5">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <GitBranch size={13} className="text-cyan-400" />
            <span>GitHub Repository Matches (Top {candidates.length})</span>
          </div>

          <div className="space-y-2">
            {candidates.map((repo) => {
              const isCurrentlyCloning = isCloning === repo.cloneUrl || isCloning === repo.htmlUrl;

              return (
                <div
                  key={repo.id}
                  className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 transition-all space-y-2"
                >
                  {/* Repo Title & Select Button */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <a
                          href={repo.htmlUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => {
                            if (window.civitaiAPI?.openExternal) {
                              e.preventDefault();
                              window.civitaiAPI.openExternal(repo.htmlUrl);
                            }
                          }}
                          className="text-cyan-400 hover:text-cyan-300 font-semibold text-xs flex items-center gap-1 transition-colors"
                        >
                          <span>{repo.fullName}</span>
                          <ExternalLink size={11} className="opacity-70" />
                        </a>
                      </div>
                      {repo.description && (
                        <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                          {repo.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1 text-amber-400 text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                        <Star size={12} className="fill-amber-400 text-amber-400" />
                        <span>{formatStars(repo.stars)}</span>
                      </div>

                      <button
                        onClick={() => handleCloneRepo(repo.cloneUrl || repo.htmlUrl)}
                        disabled={isCurrentlyCloning}
                        className="flex items-center gap-1.5 px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold transition-all shadow cursor-pointer disabled:opacity-50"
                      >
                        {isCurrentlyCloning ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Download size={13} />
                        )}
                        <span>Select</span>
                      </button>
                    </div>
                  </div>

                  {/* Topics Pills */}
                  {repo.topics && repo.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {repo.topics.slice(0, 5).map((topic, tIdx) => (
                        <span
                          key={tIdx}
                          className="px-2 py-0.5 rounded-full bg-cyan-950/40 border border-cyan-800/40 text-[10px] text-cyan-300 font-mono"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Language and Updated Time */}
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                    {repo.language && (
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            repo.language.toLowerCase() === 'python'
                              ? 'bg-blue-400'
                              : repo.language.toLowerCase().includes('javascript')
                              ? 'bg-yellow-400'
                              : repo.language.toLowerCase().includes('typescript')
                              ? 'bg-blue-600'
                              : 'bg-slate-400'
                          }`}
                        />
                        <span>{repo.language}</span>
                      </span>
                    )}
                    {repo.updatedAt && (
                      <span>{formatRelativeTime(repo.updatedAt)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Post-Clone Dependency Prompt */}
      {cloneResult && (
        <div
          className={`p-3.5 rounded-xl border text-xs space-y-2.5 ${
            cloneResult.success
              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
              : 'bg-rose-950/20 border-rose-500/30 text-rose-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold flex items-center gap-1.5">
              {cloneResult.success ? (
                <CheckCircle2 size={15} className="text-emerald-400" />
              ) : (
                <AlertCircle size={15} className="text-rose-400" />
              )}
              <span>
                {cloneResult.success
                  ? `Successfully installed ${cloneResult.folderName}`
                  : `Failed to clone repository: ${cloneResult.error}`}
              </span>
            </span>
          </div>

          {cloneResult.success && (cloneResult.hasRequirements || cloneResult.hasInstallScript) && (
            <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-700/70 text-slate-300 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-100">
                    Dependencies Detected
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {cloneResult.hasRequirements && 'requirements.txt '}
                    {cloneResult.hasInstallScript && 'install.py '}
                    found. Python runtime: <code className="text-cyan-300 font-mono text-[10px]">{cloneResult.detectedPythonPath || 'default'}</code>
                  </p>
                </div>
                <button
                  onClick={() => handleInstallDeps(cloneResult.targetPath)}
                  disabled={isInstallingDeps}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow cursor-pointer disabled:opacity-50"
                >
                  {isInstallingDeps ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Terminal size={13} />
                  )}
                  <span>Run Pip Install</span>
                </button>
              </div>

              {installOutput && (
                <pre className="p-2 rounded bg-black/80 border border-slate-800 text-[10px] font-mono text-slate-300 max-h-28 overflow-y-auto whitespace-pre-wrap">
                  {installOutput}
                </pre>
              )}
              {installError && (
                <p className="text-rose-400 text-[11px]">{installError}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tier 4: Custom Git URL Input */}
      {!resolution?.isInstalled && (
        <div className="pt-1">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <LinkIcon
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                type="text"
                placeholder="Or enter custom Git repository URL (https://github.com/...)"
                value={customGitUrl}
                onChange={(e) => setCustomGitUrl(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
            <button
              type="button"
              onClick={() => handleCloneRepo(customGitUrl)}
              disabled={!customGitUrl.trim() || isCloning === customGitUrl}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 rounded-xl text-xs font-bold transition-all shadow cursor-pointer disabled:opacity-50 shrink-0"
            >
              {isCloning === customGitUrl ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <GitBranch size={13} />
              )}
              <span>Clone Repo</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
