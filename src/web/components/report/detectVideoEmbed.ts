export type VideoProvider = 'youtube' | 'vimeo' | 'rutube' | 'vk';

export interface VideoEmbed {
  provider: VideoProvider;
  embedUrl: string;
}

export function detectVideoEmbed(url: string): VideoEmbed | null {
  if (!url.startsWith('https://')) {
    return null;
  }

  const yt =
    url.match(/^https:\/\/(?:www\.)?youtube\.com\/watch\?v=([\w-]{6,})/) ||
    url.match(/^https:\/\/(?:www\.)?youtube\.com\/shorts\/([\w-]{6,})/) ||
    url.match(/^https:\/\/youtu\.be\/([\w-]{6,})/) ||
    url.match(/^https:\/\/(?:www\.)?youtube\.com\/embed\/([\w-]{6,})/);

  if (yt) {
    return {
      provider: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${yt[1]}`,
    };
  }

  const vimeo = url.match(/^https:\/\/(?:www\.)?vimeo\.com\/(\d+)/);

  if (vimeo) {
    return {
      provider: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${vimeo[1]}`,
    };
  }

  const rutube = url.match(/^https:\/\/rutube\.ru\/video\/(\w{6,})/);

  if (rutube) {
    return {
      provider: 'rutube',
      embedUrl: `https://rutube.ru/play/embed/${rutube[1]}`,
    };
  }

  const vkA = url.match(/^https:\/\/(?:www\.)?vk\.com\/video(-?\d+_\d+)/);

  if (vkA) {
    const [oid, id] = vkA[1].split('_');

    return {
      provider: 'vk',
      embedUrl: `https://vk.com/video_ext.php?oid=${oid}&id=${id}`,
    };
  }

  const vkB = url.match(
    /^https:\/\/(?:www\.)?vk\.com\/video\?z=video(-?\d+_\d+)/
  );

  if (vkB) {
    const [oid, id] = vkB[1].split('_');

    return {
      provider: 'vk',
      embedUrl: `https://vk.com/video_ext.php?oid=${oid}&id=${id}`,
    };
  }

  return null;
}
