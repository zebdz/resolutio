import fs from 'fs/promises';
import path from 'path';

export interface UnreadableAddressLogEntry {
  userId: string;
  reason: string; // the thrown domain code
  method: string; // e.g. 'searchUsers'
}

export class AddressIntegrityLogger {
  private readonly logFile: string;
  private dirEnsured = false;

  constructor(logsDir?: string) {
    const dir = logsDir ?? path.join(process.cwd(), 'logs');
    this.logFile = path.join(dir, 'address-integrity.log');
  }

  /**
   * A stored address row failed reconstitution — Address.create() rejected it,
   * so the row violates a domain invariant (e.g. the apartment-required check).
   * Carries userId + reason so an operator can find and fix the row; the
   * recovery SQL lives in readmes/2026-08-06-address-dadata-design.md.
   */
  async logUnreadableAddress(entry: UnreadableAddressLogEntry): Promise<void> {
    await this.append(
      this.formatLine({ level: 'error', event: 'unreadable_address', ...entry })
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
    // Must never throw — a logging failure must not break a user list read.
    // NOTE: AILogger's append() has no try/catch (verified by reading it), so
    // this is not a literal copy despite matching its directory-ensure and
    // JSON-line shape exactly. Without a catch here, a bad logsDir would
    // reject and propagate into the caller (PrismaUserRepository.searchUsers),
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
