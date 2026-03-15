import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Build-time only helper — execSync is safe here as all commands are hardcoded
export function getGitVersion(): string {
  try {
    return execSync('git describe --tags').toString().trim();
  } catch {
    try {
      const pkg = JSON.parse(
        fs.readFileSync(
          path.resolve(__dirname, '..', 'package.json'),
          'utf-8'
        )
      );
      const shortHash = execSync('git rev-parse --short HEAD')
        .toString()
        .trim();
      return `v${pkg.version}-${shortHash}`;
    } catch {
      // No git available (e.g. deployed server) — fall back to package version
      const pkg = JSON.parse(
        fs.readFileSync(
          path.resolve(__dirname, '..', 'package.json'),
          'utf-8'
        )
      );
      return `v${pkg.version}`;
    }
  }
}

export function getBuildId(): string {
  return new Date()
    .toLocaleString('en-US', { timeZone: 'Europe/Moscow' })
    .replace(/\//g, '-');
}
