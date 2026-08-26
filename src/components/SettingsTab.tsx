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
  Settings,
  Folder,
  Key,
  Save,
  Plus,
  Trash2,
  DownloadCloud,
  UploadCloud,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  FolderPlus,
  Star,
  RefreshCw,
  Power,
} from 'lucide-react';
import { AppConfig, ConflictStrategy, FilenamePatternRule, DEFAULT_FOLDER_MAP, DEFAULT_FILENAME_PATTERNS } from '../types/app';

export const SettingsTab: React.FC = () => {
  const [config, setConfig] = useState<AppConfig>({
    comfyui_root: '',
    comfyui_folders: [],
    civitai_api_key: '',
    mirror_url: '',
    folder_mappings: { ...DEFAULT_FOLDER_MAP },
    advanced_mappings: { filename_patterns: [...DEFAULT_FILENAME_PATTERNS] },
    organize_by: { base_model: false, creator: false },
    conflict_strategy: 'rename',
    nsfw_max_visible_level: 5,
    nsfw_blur_enabled: true,
  });

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [newFolderInput, setNewFolderInput] = useState('');
  const [newPattern, setNewPattern] = useState('');
  const [newFolder, setNewFolder] = useState('');
  const [appAction, setAppAction] = useState<'restarting' | 'shutting-down' | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      if (window.civitaiAPI) {
        const loaded = await window.civitaiAPI.getConfig();
        if (loaded) {
          const folders = loaded.comfyui_folders && loaded.comfyui_folders.length > 0
            ? loaded.comfyui_folders
            : (loaded.comfyui_root ? [loaded.comfyui_root] : []);

          setConfig({
            ...loaded,
            comfyui_folders: folders,
            folder_mappings: { ...DEFAULT_FOLDER_MAP, ...(loaded.folder_mappings || {}) },
            advanced_mappings: {
              filename_patterns:
                loaded.advanced_mappings?.filename_patterns || [...DEFAULT_FILENAME_PATTERNS],
            },
          });
        }
      }
    };
    loadConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!window.civitaiAPI) {
        alert('Electron IPC connection unavailable. Please launch the desktop application via npm run electron:dev.');
        setSaving(false);
        return;
      }
      const primaryRoot = config.comfyui_folders[0] || config.comfyui_root || '';
      const payload = {
        ...config,
        comfyui_root: primaryRoot,
      };
      await window.civitaiAPI.saveConfig(payload);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to save configuration:', err);
      alert(`Failed to save settings: ${err?.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRestart = async () => {
    if (!confirm('Are you sure you want to restart the application?')) return;
    setAppAction('restarting');
    try {
      await window.civitaiAPI.restartApp();
    } catch (e) {
      setAppAction(null);
      alert('Failed to restart app. You may need to restart manually.');
    }
  };

  const handleShutdown = async () => {
    if (!confirm('Are you sure you want to shut down the application?')) return;
    setAppAction('shutting-down');
    try {
      await window.civitaiAPI.shutdownApp();
    } catch (e) {
      setAppAction(null);
      alert('Failed to shut down app.');
    }
  };

  const addFolder = () => {
    const trimmed = newFolderInput.trim();
    if (!trimmed) return;
    if (config.comfyui_folders.includes(trimmed)) return;

    const updatedFolders = [...config.comfyui_folders, trimmed];
    setConfig({
      ...config,
      comfyui_folders: updatedFolders,
      comfyui_root: updatedFolders[0] || '',
    });
    setNewFolderInput('');
  };

  const removeFolder = (index: number) => {
    const updatedFolders = config.comfyui_folders.filter((_, i) => i !== index);
    setConfig({
      ...config,
      comfyui_folders: updatedFolders,
      comfyui_root: updatedFolders[0] || '',
    });
  };

  const addPatternRule = () => {
    if (!newPattern.trim() || !newFolder.trim()) return;
    const updatedPatterns = [
      ...config.advanced_mappings.filename_patterns,
      { pattern: newPattern.trim(), folder: newFolder.trim(), case_sensitive: false },
    ];
    setConfig({
      ...config,
      advanced_mappings: { filename_patterns: updatedPatterns },
    });
    setNewPattern('');
    setNewFolder('');
  };

  const removePatternRule = (index: number) => {
    const updated = config.advanced_mappings.filename_patterns.filter((_, i) => i !== index);
    setConfig({
      ...config,
      advanced_mappings: { filename_patterns: updated },
    });
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 pb-16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">Application Settings</h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure multi-folder model directories, CivitAI API credentials, and auto-sorting rules.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-2xl text-sm transition-all shadow-xl shadow-purple-600/30 glow-purple"
        >
          <Save size={18} />
          <span>{saving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-2.5 text-sm font-semibold glow-emerald">
          <CheckCircle size={20} />
          <span>Configuration saved successfully!</span>
        </div>
      )}

      {appAction && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-semibold animate-pulse ${
          appAction === 'restarting'
            ? 'bg-indigo-500/10 border border-indigo-500/30 text-indigo-300'
            : 'bg-red-500/10 border border-red-500/30 text-red-300'
        }`}>
          {appAction === 'restarting' ? (
            <RefreshCw size={20} className="animate-spin" />
          ) : (
            <Power size={20} />
          )}
          <span>
            {appAction === 'restarting'
              ? 'Restarting application... The window will close and reopen momentarily.'
              : 'Shutting down application... The window will close shortly.'}
          </span>
        </div>
      )}

      {/* Multi-Folder ComfyUI Directory List */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2.5">
            <FolderPlus size={20} className="text-purple-400" />
            <span>ComfyUI Model Folders List</span>
          </h2>
          <span className="text-xs text-slate-400 font-medium">
            {config.comfyui_folders.length} folder{config.comfyui_folders.length !== 1 ? 's' : ''} configured
          </span>
        </div>

        <p className="text-xs text-slate-400">
          Add multiple ComfyUI model directories (across different drives or paths). CMM will scan and manage models across all configured folders.
        </p>

        {/* Add Folder Bar */}
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={newFolderInput}
            onChange={(e) => setNewFolderInput(e.target.value)}
            placeholder="Enter directory path (e.g. D:\ComfyUI\models or E:\AI_Models)"
            className="flex-1 bg-slate-900/90 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-purple-500 focus:outline-none"
          />
          <button
            onClick={addFolder}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition-all shadow-md"
          >
            <Plus size={16} />
            <span>Add Folder</span>
          </button>
        </div>

        {/* Managed Folders List */}
        <div className="space-y-2.5 pt-2">
          {config.comfyui_folders.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
              No model folders added yet. Add your ComfyUI models directory path above.
            </div>
          ) : (
            config.comfyui_folders.map((folderPath, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-slate-900/70 p-3.5 rounded-xl border border-slate-800 text-xs font-mono"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Folder size={16} className={index === 0 ? 'text-purple-400' : 'text-slate-500'} />
                  <span className="text-slate-200 font-semibold truncate">{folderPath}</span>
                  {index === 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-purple-300 bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 rounded-md font-sans flex-shrink-0">
                      <Star size={10} className="fill-purple-400 text-purple-400" /> Primary
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-md font-sans flex-shrink-0">
                    <CheckCircle size={11} /> Configured
                  </span>

                  <button
                    onClick={() => removeFolder(index)}
                    className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                    title="Remove folder"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* API Key Credentials */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-5 shadow-xl">
        <h2 className="text-base font-bold text-slate-100 flex items-center gap-2.5">
          <Key size={20} className="text-amber-400" />
          <span>CivitAI API Credentials</span>
        </h2>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-400">
              CivitAI API Key (Encrypted at rest)
            </label>
            <input
              type="password"
              value={config.civitai_api_key || ''}
              onChange={(e) => setConfig({ ...config, civitai_api_key: e.target.value })}
              placeholder="civitai_..."
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-purple-500 focus:outline-none font-mono"
            />
            <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-emerald-400" />
              Required for early access downloads & higher API rate limits.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-400">
              Alternative API Mirror URL (Optional)
            </label>
            <input
              type="text"
              value={config.mirror_url || ''}
              onChange={(e) => setConfig({ ...config, mirror_url: e.target.value })}
              placeholder="https://civitai.red/api/v1"
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-purple-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

       {/* App Control */}
       <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-5 shadow-xl mt-8">
         <h2 className="text-base font-bold text-slate-100 flex items-center gap-2.5">
           <Power size={20} className="text-purple-400" />
           <span>Application Control</span>
         </h2>
         <p className="text-xs text-slate-400">
           Restart the app to apply changes, or shut it down entirely.
         </p>
         <div className="flex gap-4">
           <button
             onClick={handleRestart}
             disabled={!!appAction}
             className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
           >
             <RefreshCw size={16} className={appAction === 'restarting' ? 'animate-spin' : ''} />
             <span>{appAction === 'restarting' ? 'Restarting...' : 'Restart App'}</span>
           </button>
           <button
             onClick={handleShutdown}
             disabled={!!appAction}
             className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-red-600/20 cursor-pointer"
           >
             <Power size={16} />
             <span>{appAction === 'shutting-down' ? 'Shutting Down...' : 'Shut Down'}</span>
           </button>
         </div>
       </div>

      {/* Download Behavior Rules */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-5 shadow-xl">
        <h2 className="text-base font-bold text-slate-100">Download & Subfolder Rules</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Conflict Strategy (When file exists)
            </label>
            <select
              value={config.conflict_strategy}
              onChange={(e) => setConfig({ ...config, conflict_strategy: e.target.value as ConflictStrategy })}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl p-3 text-sm text-slate-100 focus:border-purple-500 focus:outline-none font-semibold"
            >
              <option value="rename" className="bg-slate-900">Rename (keep both: model_v2.safetensors)</option>
              <option value="replace" className="bg-slate-900">Replace (overwrite existing file)</option>
              <option value="skip" className="bg-slate-900">Skip (keep existing file)</option>
            </select>
          </div>

          <div className="space-y-3">
            <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Subfolder Sub-divisions</span>

            <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={config.organize_by.base_model}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    organize_by: { ...config.organize_by, base_model: e.target.checked },
                  })
                }
                className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-purple-500 w-4 h-4"
              />
              <span>Separate models into Base Model subfolders (e.g., <code className="text-purple-300">checkpoints/SDXL 1.0/</code>)</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={config.organize_by.creator}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    organize_by: { ...config.organize_by, creator: e.target.checked },
                  })
                }
                className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-purple-500 w-4 h-4"
              />
              <span>Separate models into Creator subfolders (e.g., <code className="text-purple-300">loras/CreatorName/</code>)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Regex Pattern Rules */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
        <h2 className="text-base font-bold text-slate-100">Advanced Filename Pattern Routing</h2>
        <p className="text-xs text-slate-400">
          Models matching these regex patterns automatically route directly to specialized ComfyUI subfolders.
        </p>

        {/* Add Pattern */}
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Regex pattern (e.g. ip-adapter|photomaker|\.gguf$)"
            value={newPattern}
            onChange={(e) => setNewPattern(e.target.value)}
            className="flex-1 bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
          />
          <input
            type="text"
            placeholder="Target folder (e.g. ipadapter)"
            value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)}
            className="w-48 bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
          />
          <button
            onClick={addPatternRule}
            className="p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-colors shadow-md"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Pattern List */}
        <div className="max-h-60 overflow-y-auto space-y-2 pt-2">
          {config.advanced_mappings.filename_patterns.map((rule, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between bg-slate-900/70 p-3 rounded-xl border border-slate-800 text-xs"
            >
              <div className="flex items-center gap-3 font-mono">
                <span className="text-purple-300 font-semibold">{rule.pattern}</span>
                <span className="text-slate-600">→</span>
                <span className="text-emerald-400 font-bold">{rule.folder}/</span>
              </div>
              <button
                onClick={() => removePatternRule(idx)}
                className="text-slate-500 hover:text-red-400 p-1 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
