# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

**Please do not open public issues for security vulnerabilities.**

Instead, report security concerns privately:

- **Email**: bug-report@renegadeinc.net with subject line "CMM Security Issue"
- **GitHub**: Use the [Private Vulnerability Reporting](https://github.com/DevNullInc/RenegadeCMM/security/advisories) feature

### What to Include
- Description of the vulnerability
- Steps to reproduce
- Potential impact (local file access, remote code execution, etc.)
- Your environment (OS, Node version, CMM version)

### Response Timeline
- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 7 days
- **Fix & release**: Depends on severity, typically 14-30 days for verified issues
- **Public disclosure**: After fix is released and users have had time to update

### Scope
CMM handles file system operations, external API calls (CivitAI), and executes SHA256 hashing. Vulnerabilities in these areas are especially critical.

### Out of Scope
- ComfyUI itself (report to [ComfyUI](https://github.com/comfyanonymous/ComfyUI))
- CivitAI API vulnerabilities (report to [CivitAI](https://civitai.com))
- Electron/Chromium security issues (report to [Electron](https://github.com/electron/electron))
