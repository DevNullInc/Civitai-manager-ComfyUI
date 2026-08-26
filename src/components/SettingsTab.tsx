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
  FileJson,
  Copy,
  Check,
  Upload,
  Download,
  Code,
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
    strict_hash_verification: true,
    max_concurrent_downloads: 2,
  });

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [newFolderInput, setNewFolderInput] = useState('');
  const [newPattern, setNewPattern] = useState('');
  const [newFolder, setNewFolder] = useState('');
  const [appAction, setAppAction] = useState<'restarting' | 'shutting-down' | null>(null);

  // JSON Import & Export State
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pastedJsonText, setPastedJsonText] = useState('');
  const [copiedJson, setCopiedJson] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const normalizeFolderPath = (p: string): string => {
    if (!p) return '';
    return p.trim().replace(/\\{2,}/g, '\\');
  };

  useEffect(() => {
    const loadConfig = async () => {
      if (window.civitaiAPI) {
        const loaded = await window.civitaiAPI.getConfig();
        if (loaded) {
          const rawFolders = loaded.comfyui_folders && loaded.comfyui_folders.length > 0
            ? loaded.comfyui_folders
            : (loaded.comfyui_root ? [loaded.comfyui_root] : []);

          const folders = rawFolders.map(normalizeFolderPath).filter(Boolean);

          setConfig({
            comfyui_root: normalizeFolderPath(loaded.comfyui_root || folders[0] || ''),
            comfyui_folders: folders,
            civitai_api_key: loaded.civitai_api_key || '',
            mirror_url: loaded.mirror_url || '',
            folder_mappings: { ...DEFAULT_FOLDER_MAP, ...(loaded.folder_mappings || {}) },
            advanced_mappings: {
              filename_patterns:
                loaded.advanced_mappings?.filename_patterns || [...DEFAULT_FILENAME_PATTERNS],
            },
            organize_by: {
              base_model: !!loaded.organize_by?.base_model,
              creator: !!loaded.organize_by?.creator,
            },
            conflict_strategy: loaded.conflict_strategy || 'rename',
            nsfw_max_visible_level:
              typeof loaded.nsfw_max_visible_level === 'number'
                ? loaded.nsfw_max_visible_level
                : 5,
            nsfw_blur_enabled: loaded.nsfw_blur_enabled !== false,
            strict_hash_verification: loaded.strict_hash_verification !== false,
            max_concurrent_downloads:
              typeof loaded.max_concurrent_downloads === 'number'
                ? loaded.max_concurrent_downloads
                : 2,
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
      const normalizedFolders = config.comfyui_folders.map(normalizeFolderPath).filter(Boolean);
      const primaryRoot = normalizedFolders[0] || normalizeFolderPath(config.comfyui_root || '');
      const payload = {
        ...config,
        comfyui_folders: normalizedFolders,
        comfyui_root: primaryRoot,
      };
      await window.civitaiAPI.saveConfig(payload);
      setConfig(payload);
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
    const trimmed = normalizeFolderPath(newFolderInput);
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

  const handleExportJson = () => {
    try {
      const exportData = {
        _format: 'civitai-model-manager-settings',
        version: '1.1.0',
        exportedAt: new Date().toISOString(),
        settings: config,
      };

      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `civitai-manager-settings-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  const handleCopyJson = async () => {
    try {
      const exportData = {
        _format: 'civitai-model-manager-settings',
        version: '1.1.0',
        exportedAt: new Date().toISOString(),
        settings: config,
      };
      await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2500);
    } catch (e) {
      alert('Could not copy to clipboard.');
    }
  };

  const processImportedConfig = async (rawObj: any) => {
    const imported: Partial<AppConfig> = rawObj?.settings || rawObj;
    if (typeof imported !== 'object' || imported === null) {
      throw new Error('Invalid JSON structure. Expected an object with settings.');
    }

    const merged: AppConfig = {
      comfyui_root: imported.comfyui_root || (imported.comfyui_folders?.[0] || ''),
      comfyui_folders: Array.isArray(imported.comfyui_folders)
        ? imported.comfyui_folders
        : imported.comfyui_root
        ? [imported.comfyui_root]
        : [],
      civitai_api_key: imported.civitai_api_key || '',
      mirror_url: imported.mirror_url || '',
      folder_mappings: { ...DEFAULT_FOLDER_MAP, ...(imported.folder_mappings || {}) },
      advanced_mappings: {
        filename_patterns: Array.isArray(imported.advanced_mappings?.filename_patterns)
          ? imported.advanced_mappings.filename_patterns
          : [...DEFAULT_FILENAME_PATTERNS],
      },
      organize_by: {
        base_model: !!imported.organize_by?.base_model,
        creator: !!imported.organize_by?.creator,
      },
      conflict_strategy: imported.conflict_strategy || 'rename',
      nsfw_max_visible_level:
        typeof imported.nsfw_max_visible_level === 'number'
          ? imported.nsfw_max_visible_level
          : 5,
      nsfw_blur_enabled: imported.nsfw_blur_enabled !== false,
    };

    setConfig(merged);

    if (window.civitaiAPI) {
      await window.civitaiAPI.saveConfig(merged);
    }

    setImportFeedback(
      `Successfully loaded settings (${merged.comfyui_folders.length} folder(s), ${merged.advanced_mappings.filename_patterns.length} pattern rules)!`
    );
    setTimeout(() => setImportFeedback(null), 5000);
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setImportError(null);
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        await processImportedConfig(parsed);
      } catch (err: any) {
        console.error('Import parse error:', err);
        setImportError(`Import failed: ${err.message || 'Invalid JSON format'}`);
        setTimeout(() => setImportError(null), 6000);
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const handlePasteImportSubmit = async () => {
    try {
      setImportError(null);
      const parsed = JSON.parse(pastedJsonText.trim());
      await processImportedConfig(parsed);
      setShowPasteModal(false);
      setPastedJsonText('');
    } catch (err: any) {
      alert(`Invalid JSON: ${err.message}`);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 pb-16">
      {/* Hidden File Input for JSON import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportJsonFile}
        accept=".json,application/json"
        className="hidden"
      />

      {/* Top Header & Action Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">Application Settings</h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure multi-folder model directories, CivitAI API credentials, and auto-sorting rules.
          </p>
        </div>

        {/* Primary Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-2xl text-sm transition-all shadow-xl shadow-purple-600/30 glow-purple cursor-pointer active:scale-95 shrink-0"
        >
          <Save size={18} />
          <span>{saving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </div>

      {/* Success / Feedback Banners */}
      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-2.5 text-sm font-semibold glow-emerald animate-fadeIn">
          <CheckCircle size={20} />
          <span>Configuration saved successfully!</span>
        </div>
      )}

      {importFeedback && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-2.5 text-sm font-semibold glow-emerald animate-fadeIn">
          <CheckCircle size={20} />
          <span>{importFeedback}</span>
        </div>
      )}

      {importError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-2.5 text-sm font-semibold glow-rose animate-fadeIn">
          <AlertCircle size={20} />
          <span>{importError}</span>
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
          <span>{appAction === 'restarting' ? 'Restarting application... The window will close and reopen momentarily.' : 'Shutting down application...'}</span>
        </div>
      )}

      {/* Configuration Backup & JSON Sync Card */}
      <div className="glass-panel p-6 rounded-3xl border border-purple-500/30 space-y-4 shadow-xl glow-purple relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-purple-500/20 text-purple-300">
              <FileJson size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Cross-Browser Configuration Sync & JSON Backup</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Export your settings to a portable JSON file or paste JSON to instantly replicate folders and rules across any browser or machine.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportJson}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-semibold transition-all cursor-pointer"
            >
              <Download size={14} />
              <span>Download JSON</span>
            </button>

            <button
              onClick={handleCopyJson}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
            >
              {copiedJson ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-slate-400" />}
              <span>{copiedJson ? 'Copied!' : 'Copy JSON'}</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 text-xs font-semibold transition-all cursor-pointer"
            >
              <Upload size={14} />
              <span>Upload JSON File</span>
            </button>

            <button
              onClick={() => setShowPasteModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
            >
              <Code size={14} className="text-indigo-400" />
              <span>Paste JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* ComfyUI Model Folders Manager */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-100 font-bold text-base">
            <Folder className="text-purple-400" size={20} />
            <h2>ComfyUI Model Folders</h2>
          </div>
          <span className="text-xs text-slate-400">
            {config.comfyui_folders.length} folder{config.comfyui_folders.length !== 1 ? 's' : ''} configured
          </span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Specify all root directories where your ComfyUI models are stored. The scanner will traverse all subdirectories across every folder listed below.
        </p>

        {/* Add Folder Input */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. D:\ComfyUI\models or /home/user/ComfyUI/models"
            value={newFolderInput}
            onChange={(e) => setNewFolderInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addFolder(); }}
            className="flex-1 bg-slate-900/90 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-purple-500 font-mono"
          />
          <button
            onClick={addFolder}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            <FolderPlus size={16} />
            <span>Add Folder</span>
          </button>
        </div>

        {/* Folder List */}
        <div className="space-y-2 pt-1">
          {config.comfyui_folders.length === 0 ? (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
              <AlertCircle size={16} />
              <span>No model folders configured! Please add at least one folder path above.</span>
            </div>
          ) : (
            config.comfyui_folders.map((folderPath, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800 text-xs font-mono text-slate-200"
              >
                <div className="flex items-center gap-2.5 truncate flex-1 mr-3">
                  {idx === 0 ? (
                    <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase tracking-wider shrink-0">
                      Primary
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider shrink-0">
                      Secondary
                    </span>
                  )}
                  <span className="truncate">{folderPath}</span>
                </div>
                <button
                  onClick={() => removeFolder(idx)}
                  className="text-slate-500 hover:text-red-400 p-1.5 transition-colors cursor-pointer rounded-lg hover:bg-slate-800"
                  title="Remove folder"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* CivitAI API & Credentials */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center gap-2 text-slate-100 font-bold text-base">
          <Key className="text-indigo-400" size={20} />
          <h2>CivitAI API Credentials</h2>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              CivitAI API Key (Optional — for NSFW/Private Models & Higher Rate Limits)
            </label>
            <input
              type="password"
              placeholder="Enter your CivitAI API Key..."
              value={config.civitai_api_key || ''}
              onChange={(e) => setConfig({ ...config, civitai_api_key: e.target.value })}
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Get an API key from CivitAI: Account Settings → API Keys.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Custom API Base URL / Mirror (Optional)
            </label>
            <input
              type="text"
              placeholder="https://civitai.com/api/v1"
              value={config.mirror_url || ''}
              onChange={(e) => setConfig({ ...config, mirror_url: e.target.value })}
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Content & NSFW Filtering */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center gap-2 text-slate-100 font-bold text-base">
          <ShieldCheck className="text-emerald-400" size={20} />
          <h2>Content & NSFW Preferences</h2>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-300">
                NSFW Max Visible Level (1 = Soft, 5 = All)
              </label>
              <span className="text-xs font-bold text-purple-400">{config.nsfw_max_visible_level}</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              value={config.nsfw_max_visible_level}
              onChange={(e) =>
                setConfig({ ...config, nsfw_max_visible_level: parseInt(e.target.value, 10) })
              }
              className="w-full accent-purple-500 cursor-pointer"
            />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300">
            <input
              type="checkbox"
              checked={config.nsfw_blur_enabled}
              onChange={(e) => setConfig({ ...config, nsfw_blur_enabled: e.target.checked })}
              className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-purple-500 w-4 h-4"
            />
            <span>Enable NSFW Blur on model preview cards</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300">
            <input
              type="checkbox"
              checked={config.strict_hash_verification !== false}
              onChange={(e) => setConfig({ ...config, strict_hash_verification: e.target.checked })}
              className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-purple-500 w-4 h-4"
            />
            <span>Strict SHA256 Hash Verification (If unchecked, warns but saves files with invalid CivitAI hashes)</span>
          </label>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-300">
                Max Concurrent Downloads (Queue Amount)
              </label>
              <span className="text-xs font-bold text-indigo-400 font-mono">
                {config.max_concurrent_downloads ?? 2} simultaneous { (config.max_concurrent_downloads ?? 2) === 1 ? 'download' : 'downloads' }
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={config.max_concurrent_downloads ?? 2}
              onChange={(e) =>
                setConfig({ ...config, max_concurrent_downloads: parseInt(e.target.value, 10) })
              }
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Set how many models can download simultaneously (1 to 10). Lower values prevent bandwidth saturation on slower internet connections.
            </p>
          </div>
        </div>
      </div>

      {/* Auto-Sorting & Subfolder Routing Options */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center gap-2 text-slate-100 font-bold text-base">
          <Folder className="text-blue-400" size={20} />
          <h2>Automated Subfolder Sorting</h2>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Duplicate File Strategy
            </label>
            <select
              value={config.conflict_strategy}
              onChange={(e) =>
                setConfig({ ...config, conflict_strategy: e.target.value as ConflictStrategy })
              }
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
            >
              <option value="rename">Rename automatically (e.g., model_1.safetensors)</option>
              <option value="overwrite">Overwrite existing file</option>
              <option value="skip">Skip download if file exists</option>
            </select>
          </div>

          <div className="space-y-2 pt-2">
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
              <span>Separate models into Base Model subfolders</span>
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
              <span>Separate models into Creator subfolders</span>
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
            className="p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-colors shadow-md cursor-pointer"
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
                className="text-slate-500 hover:text-red-400 p-1 transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Application Lifecycle Control */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-5 shadow-xl">
        <h2 className="text-base font-bold text-slate-100 flex items-center gap-2.5">
          <Power size={20} className="text-purple-400" />
          <span>Application Control</span>
        </h2>
        <p className="text-xs text-slate-400">
          Restart the app to refresh system caches or shut down all background listeners.
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

      {/* Paste JSON Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="glass-panel bg-slate-950 border border-purple-500/40 p-6 rounded-3xl max-w-xl w-full space-y-4 shadow-2xl glow-purple">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-100">
                <Code size={18} className="text-purple-400" />
                <span>Paste Settings JSON</span>
              </div>
              <button
                onClick={() => setShowPasteModal(false)}
                className="text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Paste the exported JSON payload below to immediately apply and persist your configuration.
            </p>

            <textarea
              rows={10}
              placeholder='{ "settings": { "comfyui_folders": [...] } }'
              value={pastedJsonText}
              onChange={(e) => setPastedJsonText(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-2xl p-3.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-purple-500"
            />

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setShowPasteModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handlePasteImportSubmit}
                disabled={!pastedJsonText.trim()}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-purple-600/30 cursor-pointer"
              >
                Apply & Save JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
