import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

// Danh sách biểu thức chính quy để phát hiện và loại bỏ quảng cáo
const adsRegexList = [
  new RegExp(
    "(?<!#EXT-X-DISCONTINUITY[\\s\\S]*)#EXT-X-DISCONTINUITY\\n(?:.*?\\n){18,24}#EXT-X-DISCONTINUITY\\n(?![\\s\\S]*#EXT-X-DISCONTINUITY)",
    "g"
  ),
  /#EXT-X-DISCONTINUITY\n(?:#EXT-X-KEY:METHOD=NONE\n(?:.*\n){18,24})?#EXT-X-DISCONTINUITY\n|convertv7\//g,
  /#EXT-X-DISCONTINUITY\n#EXTINF:3\.920000,\n.*\n#EXTINF:0\.760000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:2\.500000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:2\.420000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:0\.780000,\n.*\n#EXTINF:1\.960000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:1\.760000,\n.*\n#EXTINF:3\.200000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:1\.360000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:0\.720000,\n.*/g,
];

// Kiểm tra xem playlist có chứa quảng cáo không
function isContainAds(playlist) {
  return adsRegexList.some((regex) => {
    regex.lastIndex = 0;
    return regex.test(playlist);
  });
}

// Loại bỏ quảng cáo từ playlist và đảm bảo URL sử dụng HTTPS
async function removeAds(playlistUrl) {
  try {
    const normalizedUrl = playlistUrl.replace(/^http:/, 'https:');
    const response = await fetch(normalizedUrl, {
      method: 'GET',
      headers: {
        Referer: normalizedUrl,
      },
      mode: 'cors',
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch playlist: ${normalizedUrl} (Status: ${response.status})`);
    }
    let playlist = await response.text();

    // Xử lý các URL tương đối trong playlist và ép buộc sử dụng HTTPS
    const baseUrl = new URL(normalizedUrl);
    playlist = playlist.replace(/^[^#].*$/gm, (line) => {
      try {
        const parsedUrl = new URL(line, baseUrl);
        parsedUrl.protocol = 'https:';
        return parsedUrl.toString();
      } catch {
        return line;
      }
    });

    // Nếu là master playlist, xử lý variant playlist
    if (playlist.includes('#EXT-X-STREAM-INF')) {
      const variantUrl = playlist.trim().split('\n').slice(-1)[0];
      const normalizedVariantUrl = variantUrl.replace(/^http:/, 'https:');
      return await removeAds(normalizedVariantUrl);
    }

    // Loại bỏ quảng cáo nếu phát hiện
    if (isContainAds(playlist)) {
      playlist = adsRegexList.reduce((playlist2, regex) => {
        return playlist2.replaceAll(regex, '');
      }, playlist);
    }

    return playlist;
  } catch (error) {
    console.error('Error in removeAds:', error);
    return null;
  }
}

function VideoPlayer({ src, videoRef, onPause, onLoadedMetadata }) {
  const hlsRef = useRef(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !src) return;

    videoElement.setAttribute('controls', '');

    const loadVideo = async () => {
      try {
        if (!src) {
          throw new Error('Không có nguồn video hợp lệ.');
        }

        let finalSource = src;

        // Loại bỏ quảng cáo
        const cleanedPlaylist = await removeAds(src);

        if (cleanedPlaylist) {
          // Tạo Blob URL cho playlist đã được làm sạch
          const blob = new Blob([cleanedPlaylist], { type: 'application/vnd.apple.mpegurl' });
          finalSource = URL.createObjectURL(blob);
        } else {
          // Sử dụng URL gốc nếu loại bỏ quảng cáo thất bại
          finalSource = src.replace(/^http:/, 'https:');
        }

        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }

        if (Hls.isSupported()) {
          const hls = new Hls({
            maxBufferLength: 60,
            maxMaxBufferLength: 120,
            maxBufferSize: 100 * 1000 * 1000,
            startFragPrefetch: true,
            enableWorker: true,
          });
          hlsRef.current = hls;
          hls.loadSource(finalSource);
          hls.attachMedia(videoElement);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            videoElement.play().catch(error => {
              console.warn('Autoplay was prevented:', error);
            });
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            console.error('HLS.js error:', data);
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  console.error('Lỗi mạng khi tải video. Vui lòng kiểm tra kết nối.');
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  console.error('Lỗi phát video. Có thể do định dạng không hỗ trợ.');
                  hls.recoverMediaError();
                  break;
                default:
                  console.error('Lỗi video nghiêm trọng. Vui lòng thử tập khác.');
                  hls.destroy();
                  break;
              }
            }
          });
        } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
          videoElement.src = finalSource;
          videoElement.play().catch(error => console.warn('Autoplay was prevented (native):', error));
        } else {
          console.error('Trình duyệt không hỗ trợ phát HLS. Vui lòng cập nhật.');
        }
      } catch (error) {
        console.error('Error loading video:', error);
      }
    };

    loadVideo();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoElement && videoElement.src.startsWith('blob:')) {
        URL.revokeObjectURL(videoElement.src);
      }
      videoElement.src = '';
      videoElement.removeAttribute('src');
      videoElement.load();
    };
  }, [src, videoRef]);

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        position: 'relative',
        aspectRatio: '16 / 9',
        background: '#000',
      }}
    >
      <video
        ref={videoRef}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
        autoPlay
        onPause={onPause}
        onLoadedMetadata={onLoadedMetadata}
      />
    </div>
  );
}

export default VideoPlayer;
