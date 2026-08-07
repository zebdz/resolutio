import fs from 'fs/promises';
import path from 'path';

export interface AddressCapReachedLogEntry {
  route: 'suggest' | 'flats';
  dailyMax: number;
  retryAfterSeconds: number;
  fellBackToNominatim: boolean;
}

export interface AddressQuotaRejectedLogEntry {
  route: 'suggest' | 'flats';
  statusCode: number;
}

export class AddressQuotaLogger {
  private readonly logFile: string;
  private dirEnsured = false;

  constructor(logsDir?: string) {
    const dir = logsDir ?? path.join(process.cwd(), 'logs');
    this.logFile = path.join(dir, 'address-quota.log');
  }

  /** Our own daily cap tripped before DaData was called. */
  async logCapReached(entry: AddressCapReachedLogEntry): Promise<void> {
    await this.append(
      this.formatLine({ level: 'warn', event: 'daily_cap_reached', ...entry })
    );
  }

  /** DaData itself rejected us — the real quota signal, not our estimate. */
  async logQuotaRejected(entry: AddressQuotaRejectedLogEntry): Promise<void> {
    await this.append(
      this.formatLine({
        level: 'error',
        event: 'dadata_quota_rejected',
        ...entry,
      })
    );
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
    // Must never throw — a logging failure must not break an address lookup.
    // NOTE: AILogger's append() has no try/catch (verified by reading it), so
    // this is not a literal copy despite matching its directory-ensure and
    // JSON-line shape exactly. Without a catch here, a bad logsDir would
    // reject and propagate into the caller (the address routes / provider),
    // which is exactly the failure mode this class exists to prevent — see
    // the "never throws when the log directory cannot be written" test.
    try {
      if (!this.dirEnsured) {
        await fs.mkdir(path.dirname(this.logFile), { recursive: true });
        this.dirEnsured = true;
      }

      await fs.appendFile(this.logFile, data, 'utf-8');
    } catch {
      // Swallow — see note above
    }
  }
}
