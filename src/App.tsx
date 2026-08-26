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
} from 'lucide-react';
import { BrowseTab } from './components/BrowseTab';
import { LibraryTab } from './components/LibraryTab';
import { DownloadsTab } from './components/DownloadsTab';
import { SettingsTab } from './components/SettingsTab';
import { AboutTab } from './components/AboutTab';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CivitAIModel, CivitAIModelVersion } from './types/civitai';

type Tab = 'browse' | 'library' | 'downloads' | 'settings' | 'about';

export default function App() {
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
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('civitai_active_tab', activeTab);
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

    const handleGlobalScroll = () => {
      const mainTop = mainRef.current ? mainRef.current.scrollTop : 0;
      const winTop = window.scrollY || document.documentElement.scrollTop || 0;
      if (mainTop > 150 || winTop > 150) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener('scroll', handleGlobalScroll, true);
    return () => window.removeEventListener('scroll', handleGlobalScroll, true);
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (scrollTop > 150) {
      setShowScrollTop(true);
    } else {
      setShowScrollTop(false);
    }
  };

  const scrollToTop = () => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
    <div className="flex flex-col h-screen w-screen bg-[#07090e] text-slate-100 overflow-hidden select-none">
      {/* Sticky 3-Column Top Navigation Bar */}
      <header className="sticky top-0 z-50 glass-panel border-b border-slate-800/80 backdrop-blur-xl px-8 py-3.5 shadow-2xl grid grid-cols-3 items-center w-full flex-shrink-0">
        {/* Left: Brand Logo & Title */}
        <div className="flex items-center gap-3 justify-self-start">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 flex items-center justify-center">
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

        {/* Center: Perfectly Centered Fixed-Width Menu Buttons */}
        <nav className="flex items-center justify-center gap-2.5 justify-self-center flex-wrap">
          <button
            onClick={() => setActiveTab('browse')}
            className={`w-36 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-sm cursor-pointer ${
              activeTab === 'browse'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 scale-105 glow-purple'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 border border-slate-800/80'
            }`}
          >
            <Compass size={16} className={activeTab === 'browse' ? 'text-white' : 'text-purple-400'} />
            <span>Browse</span>
          </button>

          <button
            onClick={() => setActiveTab('library')}
            className={`w-36 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-sm cursor-pointer ${
              activeTab === 'library'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 scale-105 glow-purple'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 border border-slate-800/80'
            }`}
          >
            <HardDrive size={16} className={activeTab === 'library' ? 'text-white' : 'text-blue-400'} />
            <span>Library</span>
          </button>

          <button
            onClick={() => setActiveTab('downloads')}
            className={`w-36 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-sm cursor-pointer relative ${
              activeTab === 'downloads'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 scale-105 glow-purple'
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
            className={`w-36 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-sm cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 scale-105 glow-purple'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 border border-slate-800/80'
            }`}
          >
            <SettingsIcon size={16} className={activeTab === 'settings' ? 'text-white' : 'text-slate-400'} />
            <span>Settings</span>
          </button>

          <button
            onClick={() => setActiveTab('about')}
            className={`w-36 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-sm cursor-pointer ${
              activeTab === 'about'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 scale-105 glow-purple'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 border border-slate-800/80'
            }`}
          >
            <InfoIcon size={16} className={activeTab === 'about' ? 'text-white' : 'text-indigo-400'} />
            <span>About</span>
          </button>
        </nav>

        {/* Right: Engine Status Badge */}
        <div className="flex items-center gap-2 justify-self-end bg-slate-900/80 border border-slate-800 px-3.5 py-1.5 rounded-xl text-[11px] font-medium text-slate-400">
          <Activity size={14} className="text-emerald-400" />
          <span>Auto-Sorter Ready</span>
        </div>
      </header>

      {/* Scrollable Container */}
      <main
        ref={mainRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-[#07090e] relative scroll-smooth"
      >
        {/* Background Radial Glow Accents */}
        <div className="absolute top-10 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-1/3 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 min-h-full">
          <ErrorBoundary>
            {activeTab === 'browse' && <BrowseTab onQueueDownload={handleQueueDownload} />}
            {activeTab === 'library' && <LibraryTab onCheckUpdate={handleCheckUpdate} />}
            {activeTab === 'downloads' && <DownloadsTab />}
            {activeTab === 'settings' && <SettingsTab />}
            {activeTab === 'about' && <AboutTab />}
          </ErrorBoundary>
        </div>

        {/* Floating Return to Top Button */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            title="Return to Top"
            className="fixed bottom-8 right-8 z-[100] p-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-2xl shadow-purple-600/50 hover:scale-110 active:scale-95 transition-all duration-200 border border-purple-400/40 glow-purple flex items-center justify-center cursor-pointer"
          >
            <ChevronUp size={24} className="stroke-[3]" />
          </button>
        )}
      </main>
    </div>
  );
}
