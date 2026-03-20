import fs from 'fs/promises';
import path from 'path';

export interface SmsRuSuccessLogEntry {
  phone: string;
  locale: string;
  statusCode: number;
  smsId: string;
  balance: number;
  testMode: boolean;
}

export interface SmsRuErrorLogEntry {
  phone: string;
  locale: string;
  statusCode: number;
  error: string;
  retryAttempt: number;
  testMode: boolean;
}

export class SmsRuLogger {
  private readonly logFile: string;
  private readonly errorLogFile: string;
  private dirEnsured = false;

  constructor(logsDir?: string) {
    const dir = logsDir ?? path.join(process.cwd(), 'logs');
    this.logFile = path.join(dir, 'sms-ru.log');
    this.errorLogFile = path.join(dir, 'sms-ru.error.log');
  }

  async logSuccess(entry: SmsRuSuccessLogEntry): Promise<void> {
    const line = this.formatLine(entry);
    await this.append(this.logFile, line);
  }

  async logError(entry: SmsRuErrorLogEntry): Promise<void> {
    const line = this.formatLine(entry);
    await this.append(this.logFile, line);
    await this.append(this.errorLogFile, line);
  }

  private formatLine(entry: SmsRuSuccessLogEntry | SmsRuErrorLogEntry): string {
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

  private async append(filePath: string, data: string): Promise<void> {
    if (!this.dirEnsured) {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      this.dirEnsured = true;
    }

    await fs.appendFile(filePath, data, 'utf-8');
  }
}
