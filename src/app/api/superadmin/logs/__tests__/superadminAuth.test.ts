import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mockRequireSuperadminApi = vi.fn();

vi.mock('@/web/lib/superadminApiAuth', () => ({
  requireSuperadminApi: mockRequireSuperadminApi,
}));

vi.mock('@/infrastructure/logs/logSources', () => ({
  LOG_SOURCES: [],
  resolveLogPath: vi.fn(),
  getLogSource: vi.fn(),
  listArchiveFiles: vi.fn().mockReturnValue([]),
  isArchivedFileJson: vi.fn(),
  resolveArchivePath: vi.fn(),
  ARCHIVE_DIR: '/tmp/test-archive',
}));

vi.mock('@/infrastructure/logs/logFileReader', () => ({
  countLines: vi.fn(),
  readChunk: vi.fn(),
}));

vi.mock('@/infrastructure/logs/logArchiveReader', () => ({
  countArchivedLines: vi.fn(),
  readArchivedChunk: vi.fn(),
}));

vi.mock('@/infrastructure/logs/logTimestampParser', () => ({
  buildArchiveFilename: vi.fn(),
}));

const { GET: listLogs } = await import('../route');
const { POST: archiveLog } = await import('../[id]/archive/route');
const { GET: downloadLog } = await import('../[id]/download/route');
const { GET: followLog } = await import('../[id]/follow/route');
const { GET: readLog } = await import('../[id]/read/route');

const makeRequest = (path = '/api/superadmin/logs') =>
  new NextRequest(`http://localhost${path}`);

const makeParams = (id = 'test') => ({
  params: Promise.resolve({ id }),
});

describe('superadmin logs API routes - auth enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe.each([
    ['GET /logs', () => listLogs()],
    ['POST /logs/[id]/archive', () => archiveLog(makeRequest(), makeParams())],
    ['GET /logs/[id]/download', () => downloadLog(makeRequest(), makeParams())],
    ['GET /logs/[id]/follow', () => followLog(makeRequest(), makeParams())],
    ['GET /logs/[id]/read', () => readLog(makeRequest(), makeParams())],
  ])('%s', (_name, callRoute) => {
    it('returns 401 when not authenticated', async () => {
      mockRequireSuperadminApi.mockResolvedValue({
        userId: '',
        error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      });

      const response = await callRoute();

      expect(response.status).toBe(401);
    });

    it('returns 403 when not superadmin', async () => {
      mockRequireSuperadminApi.mockResolvedValue({
        userId: '',
        error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      });

      const response = await callRoute();

      expect(response.status).toBe(403);
    });
  });
});
