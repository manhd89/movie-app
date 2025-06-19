const CACHE_NAME = 'movie-m3u8-processed-v1';

self.addEventListener('install', (event) => {
  console.log('Service Worker installed.');
  self.skipWaiting(); // Kích hoạt Service Worker ngay lập tức
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activated.');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim(); // Kiểm soát các trang ngay lập tức
});

// Định nghĩa cấu hình và các hàm logic loại bỏ quảng cáo trong Service Worker
// Chúng cần được sao chép từ MovieDetail.js
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
    regex.lastIndex = 0; // Reset lastIndex cho mỗi lần kiểm tra
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

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Chỉ chặn các request đến các file M3U8 (kết thúc bằng .m3u8)
  // và các đoạn video (thường kết thúc bằng .ts) nếu bạn muốn cache cả chúng
  // Nếu chỉ muốn xử lý M3U8, hãy điều chỉnh regex
  const isM3u8Request = requestUrl.pathname.endsWith('.m3u8');
  const isSegmentRequest = requestUrl.pathname.endsWith('.ts') || requestUrl.pathname.includes('/seg-'); // Ví dụ

  if (isM3u8Request) {
    event.respondWith(
      caches.match(event.request).then(async (cachedResponse) => {
        if (cachedResponse) {
          console.log('Service Worker: Serving M3U8 from cache:', requestUrl.href);
          return cachedResponse;
        }

        console.log('Service Worker: Fetching M3U8 from network and processing:', requestUrl.href);
        try {
          let response = await fetch(event.request);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          let playlistContent = await response.text();

          // Chuyển đổi các đường dẫn tương đối trong playlist thành tuyệt đối
          playlistContent = playlistContent.replace(/^[^#].*$/gm, (line) => {
            try {
              const parsed = new URL(line, requestUrl);
              return parsed.toString();
            } catch {
              return line;
            }
          });

          // Xử lý playlist master (chứa nhiều biến thể chất lượng)
          if (playlistContent.includes('#EXT-X-STREAM-INF')) {
            const subPlaylistUrlMatch = playlistContent.match(/^(?:#EXT-X-STREAM-INF:.*?\n)(.*?)$/m);
            if (subPlaylistUrlMatch && subPlaylistUrlMatch[1]) {
                const subPlaylistRelativeUrl = subPlaylistUrlMatch[1];
                const subPlaylistAbsoluteUrl = new URL(subPlaylistRelativeUrl, requestUrl).href;

                const subResponse = await fetch(subPlaylistAbsoluteUrl);
                if (!subResponse.ok) throw new Error(`HTTP error! sub-playlist status: ${subResponse.status}`);
                playlistContent = await subResponse.text();

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

          // Áp dụng logic loại bỏ quảng cáo
          if (isContainAds(playlistContent, config.adsRegexList)) {
            playlistContent = config.adsRegexList.reduce((currentPlaylist, regex) => {
              return currentPlaylist.replaceAll(regex, '');
            }, playlistContent);
          } else if (getTotalDuration(playlistContent) <= getExceptionDuration(requestUrl.href)) {
              // No action needed
          }

          // Tạo một Response mới với nội dung đã xử lý
          const processedResponse = new Response(playlistContent, {
            headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/x-mpegURL' }
          });

          // Lưu Response đã xử lý vào cache
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, processedResponse.clone()); // Cache response gốc với nội dung đã xử lý
          console.log('Service Worker: Cached processed playlist:', requestUrl.href);
          return processedResponse;

        } catch (error) {
          console.error('Service Worker: Error processing M3U8:', error);
          // Fallback: Thử fetch lại từ mạng nếu có lỗi trong SW
          return fetch(event.request);
        }
      })
    );
  }
  // Cho phép các request khác (bao gồm các đoạn video TS nếu bạn không muốn cache chúng) đi qua mạng bình thường
  // Nếu bạn muốn cache các đoạn TS, bạn cần thêm logic caching cho chúng ở đây
  else if (isSegmentRequest) {
      event.respondWith(
          caches.match(event.request).then(async (cachedResponse) => {
              if (cachedResponse) {
                  console.log('Service Worker: Serving segment from cache:', requestUrl.href);
                  return cachedResponse;
              }
              const response = await fetch(event.request);
              if (response.ok) {
                  const cache = await caches.open(CACHE_NAME);
                  cache.put(event.request, response.clone());
                  console.log('Service Worker: Cached segment:', requestUrl.href);
              }
              return response;
          }).catch(() => {
              // Nếu cache và fetch đều thất bại, có thể trả về một lỗi hoặc fallback khác
              return new Response('Network error or segment not found', { status: 503, statusText: 'Service Unavailable' });
          })
      );
  }
  // Cho phép các request khác đi qua mạng bình thường
  return;
});
