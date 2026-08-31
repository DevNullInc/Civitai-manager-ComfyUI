# 🔐 CivitAI Model Manager (CMM) — API Key & Secret Storage Security

**Audience:** Users, contributors, and security reviewers.
**Scope:** How the CivitAI API key and HuggingFace access token are handled, encrypted, stored, transmitted, and used at runtime — in both the desktop (Electron) and browser (dev) builds of this app.

> **Trust is paramount.** The CivitAI API key can spend compute credits and is effectively a credential to your CivitAI account; the HuggingFace token can access private/gated models. This document explains exactly what the app does with them so you can make an informed decision about whether (and where) to store them.

---

## 1. What secrets does the app store?

| Secret | Settings field | What it unlocks |
|--------|----------------|-----------------|
| **CivitAI API key** | "CivitAI API Key" | NSFW / private / creator-restricted downloads, higher rate limits |
| **HuggingFace access token** (`hf_...`) | "HuggingFace Token" | Downloading gated models from HuggingFace |

These are **optional**. The app functions fully without them for public models.

---

## 2. Where secrets live after you save them

| Layer | Storage location | Format |
|-------|------------------|--------|
| **On disk (persisted)** | SQLite `app_config` table, keys `civitai_api_key` and `huggingface_token` | AES-256-GCM ciphertext, JSON-quoted in a `key/value` row |
| **In memory (runtime)** | The process `currentConfig` object | Plaintext (required to sign requests) |
| **Network (transmit)** | CivitAI downloads / HuggingFace requests | Token passed to the remote API (see §4) |
| **Renderer** | Settings tab `<input type="password">` | In memory in the renderer; never written to `localStorage` |

The database file location:

- **Electron (packaged):** `%APPDATA%/<app>/` on Windows, `~/Library/Application Support/<app>/` on macOS, `~/.config/<app>/` on Linux.
- **Browser dev build (vite):** the vite dev-server database in the project directory (dev-only; not meant for production).

---

## 3. How keys are encrypted at rest

All secrets are encrypted **before** being written to the `app_config` table, using the app's `src/utils/secureStorage.ts`:

- **Algorithm:** `AES-256-GCM` (authenticated encryption — detects tampering).
- **Key derivation:** `crypto.scryptSync(secret, salt, 32)` producing a 256-bit key.
- **Per-value IV:** a fresh random 12-byte IV per encryption.
- **Auth tag:** GCM auth tag is stored with the ciphertext and verified on decrypt.
- **Record format:** `ivHex:authTagHex:ciphertextHex` stored as a single string value.

The full write path (`ipcMain.handle('save-config')` and the matching HTTP/CLI paths):

```
user types key  →  encryptKey(plaintext)  →  JSON.stringify(ciphertext)
              →  INSERT OR REPLACE INTO app_config ('civitai_api_key', value)
```

The full read path (`loadConfigFromDb()` at startup):

```
app_config row  →  decryptKey(ciphertext)  →  plaintext
              →  currentConfig.civitai_api_key  →  civitaiClient.setApiKey(key)
```

---

## 4. How secrets are used at runtime

- **CivitAI API:** The key is never stored raw in the DB. At runtime it is either sent as an HTTP `Authorization: Bearer <key>` header on API calls, or appended as `?token=<key>` to model download URLs when a download is queued.
- **HuggingFace:** The token is sent as an `Authorization: Bearer <token>` header to `huggingface.co`.
- **Never logged:** The app does not log keys or tokens. Secrets are redacted from diagnostics.

---

## 5. Honest limitations (read this before trusting at-rest encryption)

> This is the important, non-hand-wavy part.

- **The encryption key is embedded in the application source.** The key material is derived from a fixed secret + fixed salt hard-coded in `secureStorage.ts`. This is *encryption at rest against accidental exposure* (e.g. someone reading a leaked config file), **not** a defense against someone who has the app itself. Anyone with the app binary/source can derive the key and decrypt any config they also possess.
- **There is no OS-backed keychain (this is a known gap).** On desktop, the most trustworthy approach would use the operating system's protected secret store (Windows Credential Manager via `safeStorage`, macOS Keychain, Linux Secret Service / libsecret). That integration is **not currently implemented**.
- **Consequence to communicate to users:** Treat the stored key roughly like a saved password in a standard app — fine for convenience, but the at-rest protection should *not* be advertised as unbreakable. If you want maximum safety, do not store the key; enter it per-session and clear it from Settings when done.

Because of these constraints, the app's at-rest encryption is best described as:

> **Obfuscation + tamper detection at rest, not hardware-grade/keychain protection.**

---

## 6. Practical security guidance for users

Since a leaked CivitAI key can **cost you money** (credits) and expose private/NSFW content tied to your account:

- **Use a token with scoped permissions** where possible, and revoke it if you no longer use it. CivitAI lets you create and revoke API tokens from **Account Settings → API Keys** — a full token can perform actions as you.
- **Do not share** your config file, database, or screenshots containing the key field.
- **Starting fresh / removing a key:** clear the field in Settings and **Save**. This writes an empty/omitted value and stops using it. (If the value is blank, the app stores nothing for that key.)
- **Backup hygiene:** If you back up the app DB, be aware it contains encrypted secrets tied to your key — keep backups private.
- **Log out / clear on shared machines:** On a machine you don't fully trust, don't save the key; use it per-session only.

---

## 7. Guidelines for developers / contributors

- **Never log a key or token.** Verify any log or diagnostic line redacts secrets before merging.
- **Keep secrets out of `localStorage`.** Secrets live only in the DB (encrypted) and memory — never in `localStorage`.
- **Never send a secret to a non-CivitAI/HuggingFace host.** Download URLs always target the configured mirror/API base.
- **Route auth-required links through the OS browser.** Links to CivitAI account/API-key pages and HuggingFace token pages open via `shell.openExternal` (the user's real browser) so users can verify the HTTPS certificate/URL themselves — never inside the embedded Electron window.

### Recommended roadmap to close the at-rest gap

1. Replace the static key derivation with Electron's `safeStorage` (which uses the OS keychain/DPAPI) as the key source when running under Electron, falling back to the current scheme only in the browser dev build.
2. Optionally gate downloads with sensitive-account tokens behind an explicit per-session unlock rather than auto-loading from the DB.
3. Add a "revoke / clear all stored secrets" action in Settings.

---

## 8. Related files

| Concern | Location |
|---------|----------|
| Encryption / decryption primitives | `src/utils/secureStorage.ts` |
| Config load at startup | `src/main/index.ts` → `loadConfigFromDb()` |
| Config save / key write | `src/main/index.ts` → `ipcMain.handle('save-config')` |
| Browser (dev) equivalents | `vite.config.ts`, `src/utils/webBridge.ts` |
| CLI config loader | `src/cli/index.ts` |
| External link handling | `src/main/index.ts` → `ipcMain.handle('open-external')` |

---

*Last reviewed against source: current development build. This document is honest about the current trade-offs and updates whenever the storage scheme changes.*
