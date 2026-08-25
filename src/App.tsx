import React, { useState, useEffect } from 'react';
import { Compass, HardDrive, Download, Settings as SettingsIcon, Layers, Sparkles, Activity } from 'lucide-react';
import { BrowseTab } from './components/BrowseTab';
import { LibraryTab } from './components/LibraryTab';
import { DownloadsTab } from './components/DownloadsTab';
import { SettingsTab } from './components/SettingsTab';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CivitAIModel, CivitAIModelVersion } from './types/civitai';

type Tab = 'browse' | 'library' | 'downloads' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('browse');
  const [activeDownloadsCount, setActiveDownloadsCount] = useState<number>(0);

  useEffect(() => {
    if (window.civitaiAPI) {
      window.civitaiAPI.onDownloadProgress((tasks) => {
        const downloading = tasks.filter(
          (t) => t.status === 'downloading' || t.status === 'pending' || t.status === 'verifying'
        );
        setActiveDownloadsCount(downloading.length);
      });
    }
  }, []);

  const handleQueueDownload = async (model: CivitAIModel, version: CivitAIModelVersion) => {
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
    };

    if (window.civitaiAPI) {
      await window.civitaiAPI.addDownload(taskParams);
    }
  };

  const handleCheckUpdate = (_localModel: any) => {
    setActiveTab('browse');
  };

  return (
    <div className="flex h-screen w-screen bg-[#07090e] text-slate-100 overflow-hidden select-none">
      {/* Sidebar Navigation */}
      <aside className="w-64 glass-panel border-r border-slate-800/60 flex flex-col justify-between p-4 flex-shrink-0 relative z-20">
        <div className="space-y-6">
          {/* Logo Branding Header */}
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 flex items-center justify-center">
              <Layers size={22} />
            </div>
            <div>
              <h1 className="font-bold text-sm text-slate-100 tracking-tight leading-none flex items-center gap-1.5">
                <span>CivitAI Manager</span>
              </h1>
              <span className="text-[10px] gradient-text font-bold tracking-wider uppercase mt-1 block">
                ComfyUI Edition
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveTab('browse')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold transition-all duration-200 ${
                activeTab === 'browse'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 scale-[1.02]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Compass size={18} className={activeTab === 'browse' ? 'text-white' : 'text-purple-400'} />
                <span>Browse Models</span>
              </div>
              {activeTab === 'browse' && <Sparkles size={14} className="text-purple-200 animate-pulse" />}
            </button>

            <button
              onClick={() => setActiveTab('library')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold transition-all duration-200 ${
                activeTab === 'library'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 scale-[1.02]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <HardDrive size={18} className={activeTab === 'library' ? 'text-white' : 'text-blue-400'} />
                <span>Local Library</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('downloads')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold transition-all duration-200 ${
                activeTab === 'downloads'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 scale-[1.02]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Download size={18} className={activeTab === 'downloads' ? 'text-white' : 'text-emerald-400'} />
                <span>Downloads Queue</span>
              </div>

              {activeDownloadsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 animate-pulse glow-amber">
                  {activeDownloadsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold transition-all duration-200 ${
                activeTab === 'settings'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 scale-[1.02]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <SettingsIcon size={18} className={activeTab === 'settings' ? 'text-white' : 'text-slate-400'} />
                <span>Settings</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Footer Info Widget */}
        <div className="p-3.5 rounded-2xl bg-slate-900/50 border border-slate-800/80 text-[11px] text-slate-400 space-y-1.5 backdrop-blur-md">
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5 text-slate-300 font-medium">
              <Activity size={13} className="text-emerald-400" />
              API Engine
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
              Verified
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1 border-t border-slate-800/60">
            <span>ComfyUI Auto-Sorter</span>
            <span className="font-mono text-purple-400">v1.0.0</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-[#07090e] relative">
        {/* Subtle background glow accents */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-1/3 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 min-h-full">
          <ErrorBoundary>
            {activeTab === 'browse' && <BrowseTab onQueueDownload={handleQueueDownload} />}
            {activeTab === 'library' && <LibraryTab onCheckUpdate={handleCheckUpdate} />}
            {activeTab === 'downloads' && <DownloadsTab />}
            {activeTab === 'settings' && <SettingsTab />}
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
