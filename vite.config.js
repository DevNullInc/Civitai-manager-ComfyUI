"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vite_1 = require("vite");
const plugin_react_1 = __importDefault(require("@vitejs/plugin-react"));
const vite_2 = __importDefault(require("@tailwindcss/vite"));
const path_1 = __importDefault(require("path"));
const db_1 = require("./src/db/db");
const civitaiClient_1 = require("./src/services/civitaiClient");
const libraryScanner_1 = require("./src/services/libraryScanner");
const secureStorage_1 = require("./src/utils/secureStorage");
let currentConfig = {
    comfyui_root: '',
    comfyui_folders: [],
    civitai_api_key: '',
    folder_mappings: {},
    advanced_mappings: { filename_patterns: [] },
    organize_by: { base_model: false, creator: false },
    conflict_strategy: 'rename',
    nsfw_max_visible_level: 5,
    nsfw_blur_enabled: true,
};
async function loadConfig() {
    try {
        await db_1.dbManager.init();
        const rows = await db_1.dbManager.all('SELECT key, value FROM app_config;');
        const cfgObj = {};
        rows.forEach((r) => {
            try {
                cfgObj[r.key] = JSON.parse(r.value);
            }
            catch (e) {
                cfgObj[r.key] = r.value;
            }
        });
        if (cfgObj.comfyui_root)
            currentConfig.comfyui_root = cfgObj.comfyui_root;
        if (cfgObj.comfyui_folders)
            currentConfig.comfyui_folders = cfgObj.comfyui_folders;
        if ((!currentConfig.comfyui_folders || currentConfig.comfyui_folders.length === 0) && currentConfig.comfyui_root) {
            currentConfig.comfyui_folders = [currentConfig.comfyui_root];
        }
    }
    catch (err) {
        console.error('Error loading config in Vite plugin:', err);
    }
}
function apiServerPlugin() {
    return {
        name: 'api-server-plugin',
        async configureServer(server) {
            await loadConfig();
            server.middlewares.use(async (req, res, next) => {
                if (!req.url?.startsWith('/api')) {
                    return next();
                }
                res.setHeader('Content-Type', 'application/json');
                const getBody = () => new Promise((resolve) => {
                    let data = '';
                    req.on('data', (chunk) => (data += chunk));
                    req.on('end', () => {
                        try {
                            resolve(data ? JSON.parse(data) : {});
                        }
                        catch {
                            resolve({});
                        }
                    });
                });
                try {
                    if (req.url === '/api/config' && req.method === 'GET') {
                        res.end(JSON.stringify(currentConfig));
                    }
                    else if (req.url === '/api/save-config' && req.method === 'POST') {
                        const body = await getBody();
                        currentConfig = { ...currentConfig, ...body };
                        if (body.comfyui_root !== undefined) {
                            await db_1.dbManager.run('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);', ['comfyui_root', JSON.stringify(body.comfyui_root)]);
                        }
                        if (body.comfyui_folders !== undefined) {
                            await db_1.dbManager.run('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);', ['comfyui_folders', JSON.stringify(body.comfyui_folders)]);
                        }
                        if (body.civitai_api_key !== undefined) {
                            const encrypted = (0, secureStorage_1.encryptKey)(body.civitai_api_key);
                            await db_1.dbManager.run('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);', ['civitai_api_key', JSON.stringify(encrypted)]);
                            civitaiClient_1.civitaiClient.setApiKey(body.civitai_api_key);
                        }
                        res.end(JSON.stringify(currentConfig));
                    }
                    else if (req.url === '/api/scan-library' && req.method === 'POST') {
                        const body = await getBody();
                        const models = await libraryScanner_1.libraryScanner.scanDirectory(body.rootPath);
                        res.end(JSON.stringify(models));
                    }
                    else if (req.url === '/api/local-models' && req.method === 'GET') {
                        const rows = await db_1.dbManager.all('SELECT * FROM local_models ORDER BY file_name ASC;');
                        const models = rows.map((r) => ({
                            id: r.id,
                            filePath: r.file_path,
                            fileName: r.file_name,
                            fileSize: r.file_size,
                            modifiedAt: r.modified_at,
                            sha256: r.sha256,
                            civitaiModelId: r.civitai_model_id,
                            civitaiVersionId: r.civitai_version_id,
                            isMatched: !!r.civitai_version_id,
                            isDuplicate: !!r.is_duplicate,
                        }));
                        res.end(JSON.stringify(models));
                    }
                    else if (req.url === '/api/search-models' && req.method === 'POST') {
                        const body = await getBody();
                        const result = await civitaiClient_1.civitaiClient.fetchModels(body);
                        res.end(JSON.stringify(result));
                    }
                    else if (req.url === '/api/enums' && req.method === 'GET') {
                        const enums = await civitaiClient_1.civitaiClient.fetchEnums();
                        res.end(JSON.stringify(enums));
                    }
                    else {
                        res.statusCode = 404;
                        res.end(JSON.stringify({ error: 'Endpoint not found' }));
                    }
                }
                catch (err) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: err.message }));
                }
            });
        },
    };
}
exports.default = (0, vite_1.defineConfig)({
    plugins: [(0, plugin_react_1.default)(), (0, vite_2.default)(), apiServerPlugin()],
    resolve: {
        alias: {
            '@': path_1.default.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
    },
});
