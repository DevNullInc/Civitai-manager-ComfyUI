import path from 'path';

export function normalizePath(filePath: string): string {
  if (!filePath) return '';
  // Normalize separators to forward slashes for internal consistency or system path
  let normalized = path.normalize(filePath);
  // Ensure Windows long paths are handled if needed
  return normalized;
}

export function joinPaths(...parts: string[]): string {
  return path.join(...parts);
}

export function sanitizeFileName(name: string): string {
  // Remove problematic characters for OS filenames (\ / : * ? " < > |)
  return name.replace(/[/\\?%*:|"<>]/g, '_').trim();
}

export function getFileExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}
