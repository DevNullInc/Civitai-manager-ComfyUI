/**
 * CivitAI Model Manager - ComfyUI Edition
 * Copyright (C) 2025-2026 TheStygianRenegade / /dev/null Inc
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Compass,
  HardDrive,
  Download,
  Settings as SettingsIcon,
  Layers,
  Sparkles,
  ChevronUp,
  Activity,
  Info as InfoIcon,
  Github,
  Workflow,
  ExternalLink,
  Heart,
  WifiOff,
} from 'lucide-react';
import { BrowseTab } from './components/BrowseTab';
import { LibraryTab } from './components/LibraryTab';
import { WorkflowsTab } from './components/WorkflowsTab';
import { DownloadsTab } from './components/DownloadsTab';
import { SettingsTab } from './components/SettingsTab';
import { AboutTab } from './components/AboutTab';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ScanStatusBar } from './components/ScanStatusBar';
import { DownloadFolderPromptModal } from './components/DownloadFolderPromptModal';
import { DevelopmentUpdateBanner } from './components/DevelopmentUpdateBanner';
import { ScanProvider, useScan } from './context/ScanContext';
import { CivitAIModel, CivitAIModelVersion } from './types/civitai';
import { LocalModel } from './types/app';

type Tab = 'browse' | 'library' | 'workflows' | 'downloads' | 'settings' | 'about';

export default function App() {
  return (
    <ScanProvider>
      <AppContent />
    </ScanProvider>
  );
}

function AppContent() {
  const { isScanning, scanProgress } = useScan();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const saved = localStorage.getItem('civitai_active_tab');
    if (
      saved === 'browse' ||
      saved === 'library' ||
      saved === 'downloads' ||
      saved === 'settings' ||
      saved === 'about'
    ) {
      return saved;
    }
    return 'browse';
  });
  const [activeDownloadsCount, setActiveDownloadsCount] = useState<number>(0);
  const [hasFoldersConfigured, setHasFoldersConfigured] = useState<boolean>(true);
  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [browseInitialQuery, setBrowseInitialQuery] = useState<string>('');
  const [pendingDownloadPrompt, setPendingDownloadPrompt] = useState<{
    model: CivitAIModel;
    version: CivitAIModelVersion;
    taskParams: any;
    folders: string[];
  } | null>(null);

  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('civitai_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    let isMounted = true;

    const checkHealth = async () => {
      try {
        if (window.civitaiAPI?.getConfig) {
          const cfg = await Promise.race([
            window.civitaiAPI.getConfig(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500)),
          ]) as any;
          if (isMounted) {
            setIsBackendOnline(true);
            const hasFolders = Boolean(
              (cfg?.comfyui_folders && cfg.comfyui_folders.length > 0 && cfg.comfyui_folders[0]) ||
                cfg?.comfyui_root
            );
            setHasFoldersConfigured(hasFolders);
          }
        } else {
          const res = await fetch('http://127.0.0.1:5174/api/health', {
            method: 'GET',
            signal: AbortSignal.timeout(2500),
          });
          if (isMounted) {
            setIsBackendOnline(res.ok);
          }
        }
      } catch {
        if (isMounted) {
          setIsBackendOnline(false);
        }
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeTab]);

  useEffect(() => {
    if (window.civitaiAPI) {
      window.civitaiAPI.onDownloadProgress((tasks) => {
        const taskArr = Array.isArray(tasks) ? tasks : [];
        const downloading = taskArr.filter(
          (t) => t.status === 'downloading' || t.status === 'pending' || t.status === 'verifying'
        );
        setActiveDownloadsCount(downloading.length);
      });
    }

    const handleScroll = () => {
      const scrollPosition = mainRef.current?.scrollTop || window.scrollY;
      setShowScrollTop(scrollPosition > 400);
    };

    const element = mainRef.current;
    if (element) {
      element.addEventListener('scroll', handleScroll);
    }
    window.addEventListener('scroll', handleScroll);

    return () => {
      if (element) {
        element.removeEventListener('scroll', handleScroll);
      }
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQueueDownload = async (
    model: CivitAIModel,
    version: CivitAIModelVersion,
    options?: { deleteOldVersionFile?: string; deleteOldModelId?: string }
  ) => {
    const primaryFile = version.files?.[0];
    const fileName = primaryFile?.name || `${model.name}_${version.name}.safetensors`;

    const taskParams = {
      modelVersionId: version.id,
      modelId: model.id,
      modelName: model.name,
      versionName: version.name,
      modelType: model.type,
      baseModel: version.baseModel,
      creator: model.creator?.username,
      fileName,
      downloadUrl: version.downloadUrl || `https://civitai.com/api/download/models/${version.id}`,
      sizeKB: primaryFile?.sizeKB || 0,
      sha256: primaryFile?.hashes?.SHA256,
      deleteOldVersionFile: options?.deleteOldVersionFile,
      deleteOldModelId: options?.deleteOldModelId,
    };

    if (!window.civitaiAPI) return;

    try {
      const config = await window.civitaiAPI.getConfig();
      const rawFolders = (config?.comfyui_folders && config.comfyui_folders.length > 0)
        ? config.comfyui_folders
        : (config?.comfyui_root ? [config.comfyui_root] : []);
      const folders = rawFolders.filter(Boolean);

      // If user has multiple folders and hasn't locked a default download destination, prompt them
      if (folders.length > 1 && !config?.default_download_folder) {
        setPendingDownloadPrompt({
          model,
          version,
          taskParams,
          folders,
        });
        return;
      }

      // Single folder or locked default folder
      const targetRoot = config?.default_download_folder || folders[0] || '';
      await window.civitaiAPI.addDownload({ ...taskParams, targetRoot });
    } catch (err) {
      console.error('Failed to initiate download:', err);
      await window.civitaiAPI.addDownload(taskParams);
    }
  };

  const handleConfirmFolderDownload = async (selectedFolder: string, rememberChoice: boolean) => {
    if (!pendingDownloadPrompt || !window.civitaiAPI) return;
    const { taskParams } = pendingDownloadPrompt;

    try {
      if (rememberChoice) {
        const config = await window.civitaiAPI.getConfig();
        if (config) {
          await window.civitaiAPI.saveConfig({
            ...config,
            default_download_folder: selectedFolder,
          });
        }
      }
      await window.civitaiAPI.addDownload({
        ...taskParams,
        targetRoot: selectedFolder,
      });
    } catch (err) {
      console.error('Error during confirmed download:', err);
    } finally {
      setPendingDownloadPrompt(null);
    }
  };

  const handleCheckUpdate = (localModel: LocalModel) => {
    const rawName = localModel?.civitaiName || localModel?.fileName || '';
    const query = rawName
      .replace(/\.(safetensors|pt|ckpt|bin)$/i, '')
      .replace(/_/g, ' ')
      .trim();
    setBrowseInitialQuery(query);
    setActiveTab('browse');
  };

  const openRepo = () => {
    const url = 'https://github.com/DevNullInc/Civitai-manager-ComfyUI';
    if (window.civitaiAPI && typeof window.civitaiAPI.openExternal === 'function') {
      window.civitaiAPI.openExternal(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#07090e] text-slate-100 overflow-hidden select-none">
      {/* Development Update Notice Banner */}
      <DevelopmentUpdateBanner />

      {/* Sticky Top Navigation Bar */}
      <header className="sticky top-0 z-50 glass-panel border-b border-slate-800/80 backdrop-blur-xl px-6 py-3 shadow-2xl flex items-center justify-between gap-6 w-full shrink-0">
        {/* Left: Brand Logo & Title */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="p-2.5 rounded-2xl bg-linear-to-tr from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 flex items-center justify-center">
            <Layers size={22} />
          </div>
          <div>
            <h1 className="font-extrabold text-sm text-slate-100 tracking-tight leading-none">
              CivitAI Manager
            </h1>
            <span className="text-[10px] gradient-text font-extrabold tracking-wider uppercase mt-0.5 block">
              ComfyUI Edition
            </span>
          </div>
        </div>

        {/* Center: Flexible Responsive Menu Buttons */}
        <nav className="flex items-center justify-center gap-3 flex-1 max-w-3xl">
          <button
            onClick={() => setActiveTab('browse')}
            className={`flex-1 min-w-[110px] max-w-[160px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-sm cursor-pointer whitespace-nowrap ${
              activeTab === 'browse'
                ? 'bg-linear-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 scale-105 glow-purple'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 border border-slate-800/80'
            }`}
          >
            <Compass size={16} className={activeTab === 'browse' ? 'text-white' : 'text-purple-400'} />
            <span>Browse</span>
          </button>

          <button
            onClick={() => setActiveTab('library')}
            className={`flex-1 min-w-[100px] max-w-[140px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-sm cursor-pointer whitespace-nowrap ${
              activeTab === 'library'
                ? 'bg-linear-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 scale-105 glow-purple'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 border border-slate-800/80'
            }`}
          >
            <HardDrive size={16} className={activeTab === 'library' ? 'text-white' : 'text-blue-400'} />
            <span>Library</span>
          </button>

          <button
            onClick={() => setActiveTab('workflows')}
            className={`flex-1 min-w-[100px] max-w-[140px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-sm cursor-pointer whitespace-nowrap ${
              activeTab === 'workflows'
                ? 'bg-linear-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 scale-105 glow-purple'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 border border-slate-800/80'
            }`}
          >
            <Workflow size={16} className={activeTab === 'workflows' ? 'text-white' : 'text-cyan-400'} />
            <span>Workflows</span>
          </button>

          <button
            onClick={() => setActiveTab('downloads')}
            className={`flex-1 min-w-[100px] max-w-[140px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-sm cursor-pointer relative whitespace-nowrap ${
              activeTab === 'downloads'
                ? 'bg-linear-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 scale-105 glow-purple'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 border border-slate-800/80'
            }`}
          >
            <Download size={16} className={activeTab === 'downloads' ? 'text-white' : 'text-emerald-400'} />
            <span>Downloads</span>

            {activeDownloadsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-400 text-slate-950 animate-pulse glow-amber">
                {activeDownloadsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 min-w-[110px] max-w-[160px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-sm cursor-pointer whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-linear-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 scale-105 glow-purple'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 border border-slate-800/80'
            }`}
          >
            <SettingsIcon size={16} className={activeTab === 'settings' ? 'text-white' : 'text-slate-400'} />
            <span>Settings</span>
          </button>

          <button
            onClick={() => setActiveTab('about')}
            className={`flex-1 min-w-[110px] max-w-[160px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-sm cursor-pointer whitespace-nowrap ${
              activeTab === 'about'
                ? 'bg-linear-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 scale-105 glow-purple'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 border border-slate-800/80'
            }`}
          >
            <InfoIcon size={16} className={activeTab === 'about' ? 'text-white' : 'text-indigo-400'} />
            <span>About</span>
          </button>
        </nav>

        {/* Multi-Purpose Dynamic Header Status Badge */}
        {(() => {
          if (!isBackendOnline) {
            return (
              <div
                className="flex items-center gap-2 shrink-0 bg-rose-500/15 border border-rose-500/40 px-3.5 py-1.5 rounded-xl text-[11px] font-bold text-rose-400 shadow-sm"
                title="CivitAI Model Manager backend is offline or disconnected. Start the application with ./cmm.sh"
              >
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                </span>
                <WifiOff size={13} className="text-rose-400" />
                <span>Offline</span>
              </div>
            );
          }

          if (isScanning) {
            const pct = scanProgress?.totalFiles
              ? Math.round((scanProgress.scannedFiles / scanProgress.totalFiles) * 100)
              : 0;
            return (
              <button
                onClick={() => setActiveTab('library')}
                className="flex items-center gap-2 shrink-0 bg-amber-500/10 border border-amber-500/30 px-3.5 py-1.5 rounded-xl text-[11px] font-semibold text-amber-300 hover:bg-amber-500/20 transition-all cursor-pointer shadow-sm animate-pulse"
                title="Library scan in progress. Click to view Library."
              >
                <Activity size={14} className="text-amber-400 animate-spin" />
                <span>Scanning Library {pct > 0 ? `(${pct}%)` : '...'}</span>
              </button>
            );
          }

          if (activeDownloadsCount > 0) {
            return (
              <button
                onClick={() => setActiveTab('downloads')}
                className="flex items-center gap-2 shrink-0 bg-purple-500/15 border border-purple-500/30 px-3.5 py-1.5 rounded-xl text-[11px] font-semibold text-purple-300 hover:bg-purple-500/25 transition-all cursor-pointer shadow-sm glow-purple"
                title={`${activeDownloadsCount} download(s) in progress. Click to view Downloads.`}
              >
                <Download size={14} className="text-purple-400 animate-bounce" />
                <span>
                  {activeDownloadsCount} {activeDownloadsCount === 1 ? 'Download' : 'Downloads'} Active
                </span>
              </button>
            );
          }

          if (!hasFoldersConfigured) {
            return (
              <button
                onClick={() => setActiveTab('settings')}
                className="flex items-center gap-2 shrink-0 bg-amber-500/10 border border-amber-500/30 px-3.5 py-1.5 rounded-xl text-[11px] font-semibold text-amber-400 hover:bg-amber-500/20 transition-all cursor-pointer shadow-sm"
                title="No ComfyUI model folder paths configured. Click to configure in Settings."
              >
                <Layers size={14} className="text-amber-400" />
                <span>Configure Folders</span>
              </button>
            );
          }

          return (
            <button
              onClick={() => setActiveTab('settings')}
              className="flex items-center gap-2 shrink-0 bg-slate-900/80 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 px-3.5 py-1.5 rounded-xl text-[11px] font-medium text-slate-300 hover:text-white transition-all cursor-pointer"
              title="ComfyUI Auto-Sorter active & ready. Click to manage Folder Mappings in Settings."
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <Activity size={13} className="text-emerald-400" />
              <span>Auto-Sorter Ready</span>
            </button>
          );
        })()}
      </header>

      {/* Scrollable Container */}
      <main
        ref={mainRef}
        className="flex-1 overflow-y-auto bg-[#07090e] relative scroll-smooth"
      >
        {/* Background Radial Glow Accents */}
        <div className="absolute top-10 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-1/3 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 min-h-full pb-8">
          <ErrorBoundary>
            <div style={{ display: activeTab === 'browse' ? 'block' : 'none' }}>
              <BrowseTab
                onQueueDownload={handleQueueDownload}
                initialQuery={browseInitialQuery}
              />
            </div>
            <div style={{ display: activeTab === 'library' ? 'block' : 'none' }}>
              <LibraryTab onCheckUpdate={handleCheckUpdate} />
            </div>
            <div style={{ display: activeTab === 'workflows' ? 'block' : 'none' }}>
              <WorkflowsTab
                onSearchModel={(query) => {
                  setBrowseInitialQuery(query);
                  setActiveTab('browse');
                }}
                onNavigateToDownloads={() => setActiveTab('downloads')}
              />
            </div>
            <div style={{ display: activeTab === 'downloads' ? 'block' : 'none' }}>
              <DownloadsTab />
            </div>
            <div style={{ display: activeTab === 'settings' ? 'block' : 'none' }}>
              <SettingsTab />
            </div>
            <div style={{ display: activeTab === 'about' ? 'block' : 'none' }}>
              <AboutTab />
            </div>
          </ErrorBoundary>
        </div>

        {/* Download Folder Prompt Modal */}
        {pendingDownloadPrompt && (
          <DownloadFolderPromptModal
            modelName={pendingDownloadPrompt.model.name}
            versionName={pendingDownloadPrompt.version.name}
            folders={pendingDownloadPrompt.folders}
            onConfirm={handleConfirmFolderDownload}
            onCancel={() => setPendingDownloadPrompt(null)}
          />
        )}

        {/* Floating Return to Top Button */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            title="Return to Top"
            className="fixed bottom-14 right-8 z-[100] p-3.5 rounded-2xl bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-2xl shadow-purple-600/50 hover:scale-110 active:scale-95 transition-all duration-200 border border-purple-400/40 glow-purple flex items-center justify-center cursor-pointer"
          >
            <ChevronUp size={20} className="stroke-[3]" />
          </button>
        )}
      </main>

      {/* Persistent Bottom Scan Status Bar */}
      <ScanStatusBar onNavigateToLibrary={() => setActiveTab('library')} activeTab={activeTab} />

      {/* Persistent Footer */}
      <footer className="sticky bottom-0 z-40 glass-panel border-t border-slate-800/80 backdrop-blur-xl px-6 py-2 shadow-2xl flex items-center justify-between text-xs text-slate-400 w-full shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-300">CivitAI Model Manager</span>
          <span className="text-slate-600">•</span>
          <span className="text-purple-400 font-medium">ComfyUI Edition</span>
          <span className="text-slate-600">•</span>
          <span className="px-1.5 py-0.2 rounded bg-slate-800/80 text-[10px] text-slate-400 border border-slate-700/50 font-mono">GPL-3.0</span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-400 text-[11px] hidden sm:flex">
          <span>Crafted with</span>
          <Heart size={12} className="text-rose-500 fill-rose-500 inline" />
          <span>by</span>
          <span className="font-bold text-purple-300">TheStygianRenegade</span>
          <span className="text-slate-500">/</span>
          <span className="font-semibold text-slate-300">/dev/null Inc</span>
        </div>

        <button
          onClick={openRepo}
          title="Open GitHub Repository (DevNullInc/Civitai-manager-ComfyUI)"
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-purple-300 border border-slate-800 hover:border-purple-500/40 transition-all cursor-pointer font-medium text-xs group shadow-sm"
        >
          <Github size={13} className="text-purple-400 group-hover:scale-110 transition-transform" />
          <span>GitHub</span>
          <ExternalLink size={10} className="text-slate-500 group-hover:text-purple-400" />
        </button>
      </footer>
    </div>
  );
}
