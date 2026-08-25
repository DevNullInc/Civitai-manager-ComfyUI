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
} from 'lucide-react';
import { AppConfig, ConflictStrategy, FilenamePatternRule } from '../types/app';
import { DEFAULT_FOLDER_MAP, DEFAULT_FILENAME_PATTERNS } from '../services/folderRouter';

export const SettingsTab: React.FC = () => {
  const [config, setConfig] = useState<AppConfig>({
    comfyui_root: '',
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
  const [newPattern, setNewPattern] = useState('');
  const [newFolder, setNewFolder] = useState('');

  useEffect(() => {
    const loadConfig = async () => {
      if (window.civitaiAPI) {
        const loaded = await window.civitaiAPI.getConfig();
        if (loaded) {
          setConfig({
            ...loaded,
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
      if (window.civitaiAPI) {
        await window.civitaiAPI.saveConfig(config);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (err) {
      alert('Failed to save configuration settings');
    } finally {
      setSaving(false);
    }
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
    <div className="p-6 max-w-5xl mx-auto space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Application Settings</h1>
          <p className="text-sm text-slate-400">
            Configure paths, CivitAI API credentials, ComfyUI folder mappings, and download behavior.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-xl text-sm transition-colors shadow-lg shadow-purple-600/20"
        >
          <Save size={18} />
          <span>{saving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-2 text-sm">
          <CheckCircle size={18} />
          <span>Configuration saved successfully!</span>
        </div>
      )}

      {/* ComfyUI Root Directory */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <Folder size={20} className="text-purple-400" />
          <span>ComfyUI Installation Path</span>
        </h2>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-400">
            ComfyUI Models Folder (e.g., <code className="text-purple-300">D:\ComfyUI\models</code>)
          </label>
          <input
            type="text"
            value={config.comfyui_root}
            onChange={(e) => setConfig({ ...config, comfyui_root: e.target.value })}
            placeholder="D:\ComfyUI\models"
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-purple-500 focus:outline-none"
          />
        </div>
      </div>

      {/* API Key & Dual Source */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <Key size={20} className="text-amber-400" />
          <span>CivitAI API Credentials</span>
        </h2>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-400">
              CivitAI API Key (Encrypted at rest)
            </label>
            <input
              type="password"
              value={config.civitai_api_key || ''}
              onChange={(e) => setConfig({ ...config, civitai_api_key: e.target.value })}
              placeholder="civitai_..."
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-purple-500 focus:outline-none font-mono"
            />
            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <ShieldCheck size={12} />
              Required for private/early access downloads & higher API rate limits.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-400">
              Alternative API Mirror URL (Optional)
            </label>
            <input
              type="text"
              value={config.mirror_url || ''}
              onChange={(e) => setConfig({ ...config, mirror_url: e.target.value })}
              placeholder="https://civitai.red/api/v1"
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-purple-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Download Behavior & Subfolder Organization */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <h2 className="text-base font-bold text-slate-100">Download & Subfolder Rules</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">
              Conflict Strategy (When file exists)
            </label>
            <select
              value={config.conflict_strategy}
              onChange={(e) => setConfig({ ...config, conflict_strategy: e.target.value as ConflictStrategy })}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl p-2.5 text-sm text-slate-100 focus:border-purple-500 focus:outline-none"
            >
              <option value="rename" className="bg-slate-900">Rename (keep both: model_v2.safetensors)</option>
              <option value="replace" className="bg-slate-900">Replace (overwrite existing file)</option>
              <option value="skip" className="bg-slate-900">Skip (keep existing file)</option>
            </select>
          </div>

          <div className="space-y-3">
            <span className="block text-xs font-semibold text-slate-400">Subfolder Sub-divisions</span>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={config.organize_by.base_model}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    organize_by: { ...config.organize_by, base_model: e.target.checked },
                  })
                }
                className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-purple-500"
              />
              <span>Separate models into Base Model subfolders (e.g., <code className="text-purple-300">checkpoints/SDXL 1.0/</code>)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={config.organize_by.creator}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    organize_by: { ...config.organize_by, creator: e.target.checked },
                  })
                }
                className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-purple-500"
              />
              <span>Separate models into Creator subfolders (e.g., <code className="text-purple-300">loras/CreatorName/</code>)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Filename Regex Rules */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <h2 className="text-base font-bold text-slate-100">Advanced Filename Pattern Matching</h2>
        <p className="text-xs text-slate-400">
          Models with filenames matching these regex patterns will route directly to specialized ComfyUI folders.
        </p>

        {/* Add Pattern */}
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Regex pattern (e.g., ip-adapter|photomaker|\.gguf$)"
            value={newPattern}
            onChange={(e) => setNewPattern(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
          />
          <input
            type="text"
            placeholder="Target folder (e.g., ipadapter)"
            value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)}
            className="w-48 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
          />
          <button
            onClick={addPatternRule}
            className="p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-colors"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Pattern Table */}
        <div className="max-h-60 overflow-y-auto space-y-2 pt-2">
          {config.advanced_mappings.filename_patterns.map((rule, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 text-xs"
            >
              <div className="flex items-center gap-3 font-mono">
                <span className="text-purple-300">{rule.pattern}</span>
                <span className="text-slate-600">→</span>
                <span className="text-emerald-400 font-semibold">{rule.folder}/</span>
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
