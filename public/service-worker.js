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
    regex.lastIndex = 0;
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

  const isM3u8Request = requestUrl.pathname.endsWith('.m3u8');
  const isSegmentRequest = requestUrl.pathname.endsWith('.ts') || requestUrl.pathname.includes('/seg-');

  if (isM3u8Request) {
    event.respondWith(
      caches.match(event.request).then(async (cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          let response = await fetch(event.request);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          let playlistContent = await response.text();

          playlistContent = playlistContent.replace(/^[^#].*$/gm, (line) => {
            try {
              const parsed = new URL(line, requestUrl);
              return parsed.toString();
            } catch {
              return line;
            }
          });

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

          if (isContainAds(playlistContent, config.adsRegexList)) {
            playlistContent = config.adsRegexList.reduce((currentPlaylist, regex) => {
              return currentPlaylist.replaceAll(regex, '');
            }, playlistContent);
          } else if (getTotalDuration(playlistContent) <= getExceptionDuration(requestUrl.href)) {
            // No action needed
          }

          const processedResponse = new Response(playlistContent, {
            headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/x-mpegURL' }
          });

          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, processedResponse.clone());
          return processedResponse;

        } catch (error) {
          return fetch(event.request);
        }
      })
    );
  } else if (isSegmentRequest) {
    event.respondWith(
      caches.match(event.request).then(async (cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        const response = await fetch(event.request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, response.clone());
        }
        return response;
      }).catch(() => {
        return new Response('Network error or segment not found', { status: 503, statusText: 'Service Unavailable' });
      })
    );
  }
});
