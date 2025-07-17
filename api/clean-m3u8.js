import axios from 'axios';

const config = {
  adsRegexList: [
    new RegExp(
      '(?<!#EXT-X-DISCONTINUITY[\\s\\S]*)#EXT-X-DISCONTINUITY\\n(?:.*?\\n){18,24}#EXT-X-DISCONTINUITY\\n(?![\\s\\S]*#EXT-X-DISCONTINUITY)',
      'g'
    ),
    /#EXT-X-DISCONTINUITY\n(?:#EXT-X-KEY:METHOD=NONE\n(?:.*\n){18,24})?#EXT-X-DISCONTINUITY\n|convertv7\//g,
    /#EXT-X-DISCONTINUITY\n(?:#EXTINF:(?:3.92|0.76|2.00|2.50|2.00|2.42|2.00|0.78|1.96)0000,\n.*\n){9}#EXT-X-DISCONTINUITY\n(?:#EXTINF:(?:2.00|1.76|3.20|2.00|1.36|2.00|2.00|0.72)0000,\n.*\n){8}(?=#EXT-X-DISCONTINUITY)/g,
  ],
  domainBypassWhitelist: ['kkphimplayer', 'phim1280', 'opstream'],
};

function isContainAds(playlist, adsRegexList) {
  return adsRegexList.some((regex) => {
    regex.lastIndex = 0; // Reset lastIndex cho mỗi lần kiểm tra regex toàn cục
    return regex.test(playlist);
  });
}

function getTotalDuration(playlist) {
  const matches = playlist.match(/#EXTINF:([\d.]+)/g) ?? [];
  return matches.reduce((sum, match) => sum + parseFloat(match.split(':')[1]), 0);
}

function getExceptionDuration(url) {
  const parsedUrl = new URL(url);
  if (['ophim', 'opstream'].some((keyword) => parsedUrl.hostname.includes(keyword))) {
    return 600;
  } else if (['nguonc', 'streamc'].some((keyword) => parsedUrl.hostname.includes(keyword))) {
    return Infinity;
  } else {
    return 900;
  }
}

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).send('URL is required.');
  }

  // --- BỔ SUNG LOGIC CACHE TẠI ĐÂY ---
  // Hash URL gốc để tạo ETag hoặc để kiểm tra cache (tùy chọn)
  // Nếu bạn muốn cache thực sự vĩnh viễn và không bao giờ đổi, hãy dùng immutable.
  // Nếu có thể thay đổi nhưng ít, hãy dùng thời gian cache dài (ví dụ 1 ngày = 86400s)
  // và bỏ immutable.

  // Với `immutable`, nếu nội dung thay đổi, bạn phải thay đổi URL của proxy (ví dụ: thêm version param)
  // để CDN làm mới cache.

  // Kiểm tra liệu URL gốc có thể được coi là không thay đổi
  // Giả sử bạn muốn các playlist từ một số domain nhất định được cache vĩnh viễn
  const playlistUrl = new URL(url);
  const isPotentiallyImmutable = ['my-static-video-domain.com', 'another-archive.net']
                                  .some(domain => playlistUrl.hostname.includes(domain));

  try {
    const isNoNeedToBypass = config.domainBypassWhitelist.some((keyword) =>
      playlistUrl.hostname.includes(keyword)
    );

    let response = await axios.get(playlistUrl.href, { responseType: 'text' });
    let playlistContent = response.data;

    playlistContent = playlistContent.replace(/^[^#].*$/gm, (line) => {
      try {
        const parsed = new URL(line, playlistUrl);
        return parsed.toString();
      } catch {
        return line;
      }
    });

    if (playlistContent.includes('#EXT-X-STREAM-INF')) {
      const subPlaylistUrlMatch = playlistContent.match(/^(?:#EXT-X-STREAM-INF:.*?\n)(.*?)$/m);
      if (subPlaylistUrlMatch && subPlaylistUrlMatch[1]) {
        const subPlaylistRelativeUrl = subPlaylistUrlMatch[1];
        const subPlaylistAbsoluteUrl = new URL(subPlaylistRelativeUrl, playlistUrl).href;

        const subResponse = await axios.get(subPlaylistAbsoluteUrl, { responseType: 'text' });
        playlistContent = subResponse.data;

        playlistContent = playlistContent.replace(/^[^#].*$/gm, (line) => {
          try {
            const parsed = new URL(line, new URL(subPlaylistAbsoluteUrl));
            return parsed.toString();
          } catch {
            return line;
          }
        });
      }
    }

    if (isContainAds(playlistContent, config.adsRegexList)) {
      playlistContent = config.adsRegexList.reduce((currentPlaylist, regex) => {
        return currentPlaylist.replaceAll(regex, '');
      }, playlistContent);
    } else if (getTotalDuration(playlistContent) <= getExceptionDuration(playlistUrl.href)) {
        // Không làm gì
    } else {
        // console.log('Không tìm thấy quảng cáo nhưng thời lượng vượt ngưỡng:', url);
    }

    // Thiết lập Cache-Control header
    if (isPotentiallyImmutable) {
        // Cache vĩnh viễn (1 năm) với immutable nếu URL gốc là tĩnh
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
        // Cache tạm thời (ví dụ: 10 phút) cho các trường hợp khác
        res.setHeader('Cache-Control', 'public, max-age=600');
    }

    res.setHeader('Content-Type', response.headers['content-type'] || 'application/x-mpegURL');
    res.status(200).send(playlistContent);
  } catch (error) {
    console.error('Lỗi khi xử lý M3U8 playlist trong Vercel Function:', error);
    res.status(500).send('Không thể xử lý playlist video.');
  }
}
