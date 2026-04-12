import fs from 'fs/promises';
import path from 'path';

export interface AISuccessLogEntry {
  pollId: string;
  userId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  annotationCount: number;
  overallRisk: string;
  message: string;
}

export interface AIErrorLogEntry {
  pollId: string;
  userId: string;
  model: string;
  error: string;
  stack?: string;
}

export class AILogger {
  private readonly logFile: string;
  private dirEnsured = false;

  constructor(logsDir?: string) {
    const dir = logsDir ?? path.join(process.cwd(), 'logs');
    this.logFile = path.join(dir, 'ai.log');
  }

  async logSuccess(entry: AISuccessLogEntry): Promise<void> {
    await this.append(this.formatLine({ level: 'info', ...entry }));
  }

  async logError(entry: AIErrorLogEntry): Promise<void> {
    await this.append(this.formatLine({ level: 'error', ...entry }));
  }

  private formatLine(entry: Record<string, unknown>): string {
    const now = new Date();
    const timestamp = now.toISOString();
    const timestamp_msk = this.toMoscowTime(now);

    return JSON.stringify({ timestamp, timestamp_msk, ...entry }) + '\n';
  }

  private toMoscowTime(date: Date): string {
    return date.toLocaleString('ru-RU', {
      timeZone: 'Europe/Moscow',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  private async append(data: string): Promise<void> {
    if (!this.dirEnsured) {
      await fs.mkdir(path.dirname(this.logFile), { recursive: true });
      this.dirEnsured = true;
    }

    await fs.appendFile(this.logFile, data, 'utf-8');
  }
}
