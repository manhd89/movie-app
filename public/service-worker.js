importScripts('/utils/playlistProcessor.js');

const CACHE_NAME = 'movie-m3u8-processed-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  const isM3u8Request = requestUrl.pathname.endsWith('.m3u8') || requestUrl.pathname.endsWith('.m3u8?');
  const isSegmentRequest = requestUrl.pathname.endsWith('.ts') || requestUrl.pathname.includes('/seg-');

  // Truy cập các hàm và config từ đối tượng global được importScripts() cung cấp
  const { config, isContainAds, getTotalDuration, getExceptionDuration, processPlaylistForAds } = self;


  if (isM3u8Request) {
    event.respondWith(
      caches.match(event.request).then(async (cachedResponse) => {
        if (cachedResponse) {
          console.log(`Service Worker: Serving M3U8 from cache: ${requestUrl.href}`);
          return cachedResponse;
        }

        try {
          // Sử dụng hàm dùng chung để xử lý playlist
          const processedPlaylistContent = await processPlaylistForAds(requestUrl.href);

          if (!processedPlaylistContent) {
            throw new Error("Failed to process playlist content.");
          }

          // Kiểm tra và loại bỏ quảng cáo nếu cần (logic đã được chuyển vào processPlaylistForAds, nhưng bạn có thể thêm điều kiện ở đây nếu muốn Service Worker quyết định dựa trên config riêng)
          const isBypassed = config.domainBypassWhitelist.some(domain => requestUrl.hostname.includes(domain));
          const isShortDuration = getTotalDuration(processedPlaylistContent) <= getExceptionDuration(requestUrl.href);

          let finalPlaylistForSW = processedPlaylistContent;
          if (!isBypassed && isContainAds(processedPlaylistContent) && !isShortDuration) {
              console.log(`Service Worker: Re-applying ad removal for specific SW logic: ${requestUrl.href}`);
              // Nếu bạn muốn SW thực hiện lại việc loại bỏ quảng cáo với logic riêng của nó
              finalPlaylistForSW = config.adsRegexList.reduce((currentPlaylist, regex) => {
                return currentPlaylist.replaceAll(regex, '');
              }, processedPlaylistContent);
          } else {
              console.log(`Service Worker: Ads not removed (bypassed, no ads found, or short duration) by SW specific logic for: ${requestUrl.href}`);
          }


          const processedResponse = new Response(finalPlaylistForSW, {
            headers: { 'Content-Type': 'application/x-mpegURL' } // Đảm bảo Content-Type đúng
          });

          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, processedResponse.clone());
          console.log(`Service Worker: Cached and serving processed M3U8 for: ${requestUrl.href}`);
          return processedResponse;

        } catch (error) {
          console.error(`Service Worker: Error processing M3U8 for ${requestUrl.href}:`, error);
          return fetch(event.request); // Fallback to original fetch
        }
      })
    );
  }
  else if (isSegmentRequest) {
    event.respondWith(
      caches.match(event.request).then(async (cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        try {
          const response = await fetch(event.request);
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, response.clone());
          }
          return response;
        } catch (error) {
          console.error(`Service Worker: Error fetching or caching segment for ${requestUrl.href}:`, error);
          return new Response('Network error or segment not found', { status: 503, statusText: 'Service Unavailable' });
        }
      })
    );
  }
});
