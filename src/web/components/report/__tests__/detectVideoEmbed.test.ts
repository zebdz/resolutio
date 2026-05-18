import { describe, it, expect } from 'vitest';
import { detectVideoEmbed } from '../detectVideoEmbed';

describe('detectVideoEmbed', () => {
  it('returns null for http URLs', () => {
    expect(
      detectVideoEmbed('http://youtube.com/watch?v=dQw4w9WgXcQ')
    ).toBeNull();
  });

  it('returns null for unknown https URLs', () => {
    expect(detectVideoEmbed('https://example.com/video/123')).toBeNull();
  });

  describe('YouTube', () => {
    it('detects watch URL', () => {
      const result = detectVideoEmbed(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      );
      expect(result).toEqual({
        provider: 'youtube',
        embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      });
    });

    it('detects shorts URL', () => {
      const result = detectVideoEmbed(
        'https://www.youtube.com/shorts/dQw4w9WgXcQ'
      );
      expect(result).toEqual({
        provider: 'youtube',
        embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      });
    });

    it('detects youtu.be short URL', () => {
      const result = detectVideoEmbed('https://youtu.be/dQw4w9WgXcQ');
      expect(result).toEqual({
        provider: 'youtube',
        embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      });
    });

    it('detects existing embed URL', () => {
      const result = detectVideoEmbed(
        'https://www.youtube.com/embed/dQw4w9WgXcQ'
      );
      expect(result).toEqual({
        provider: 'youtube',
        embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      });
    });
  });

  describe('Vimeo', () => {
    it('detects vimeo URL', () => {
      const result = detectVideoEmbed('https://vimeo.com/123456789');
      expect(result).toEqual({
        provider: 'vimeo',
        embedUrl: 'https://player.vimeo.com/video/123456789',
      });
    });

    it('detects www.vimeo.com URL', () => {
      const result = detectVideoEmbed('https://www.vimeo.com/987654321');
      expect(result).toEqual({
        provider: 'vimeo',
        embedUrl: 'https://player.vimeo.com/video/987654321',
      });
    });
  });

  describe('Rutube', () => {
    it('detects rutube URL', () => {
      const result = detectVideoEmbed('https://rutube.ru/video/abcdef123456/');
      expect(result).toEqual({
        provider: 'rutube',
        embedUrl: 'https://rutube.ru/play/embed/abcdef123456',
      });
    });
  });

  describe('VK', () => {
    it('detects vk.com/video{oid}_{id} URL', () => {
      const result = detectVideoEmbed('https://vk.com/video-12345_67890');
      expect(result).toEqual({
        provider: 'vk',
        embedUrl: 'https://vk.com/video_ext.php?oid=-12345&id=67890',
      });
    });

    it('detects vk.com/video?z=video URL', () => {
      const result = detectVideoEmbed(
        'https://vk.com/video?z=video-12345_67890'
      );
      expect(result).toEqual({
        provider: 'vk',
        embedUrl: 'https://vk.com/video_ext.php?oid=-12345&id=67890',
      });
    });
  });
});
