import React, { useState, useEffect } from 'react';
import { Compass, HardDrive, Download, Settings as SettingsIcon, Layers } from 'lucide-react';
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
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Sidebar Navigation */}
      <aside className="w-64 glass-panel border-r border-slate-800/80 flex flex-col justify-between p-4 flex-shrink-0">
        <div className="space-y-6">
          {/* Logo Branding */}
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="p-2 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400">
              <Layers size={22} />
            </div>
            <div>
              <h1 className="font-bold text-sm text-slate-100 tracking-tight leading-none">CivitAI Manager</h1>
              <span className="text-[10px] text-purple-400 font-semibold tracking-wider uppercase">ComfyUI Edition</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveTab('browse')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'browse'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Compass size={18} />
                <span>Browse CivitAI</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('library')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'library'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <HardDrive size={18} />
                <span>Local Library</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('downloads')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'downloads'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Download size={18} />
                <span>Downloads</span>
              </div>

              {activeDownloadsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950">
                  {activeDownloadsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'settings'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <SettingsIcon size={18} />
                <span>Settings</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Footer Info */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-500 space-y-1">
          <div className="flex justify-between">
            <span>Version:</span>
            <span className="font-mono text-slate-400">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span>Engine:</span>
            <span className="text-emerald-400">Verified API</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-slate-950">
        <ErrorBoundary>
          {activeTab === 'browse' && <BrowseTab onQueueDownload={handleQueueDownload} />}
          {activeTab === 'library' && <LibraryTab onCheckUpdate={handleCheckUpdate} />}
          {activeTab === 'downloads' && <DownloadsTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </ErrorBoundary>
      </main>
    </div>
  );
}
