import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import Hls from 'hls.js'; // <-- Import Hls.js trực tiếp
import { FaArrowLeft, FaRegPlayCircle } from 'react-icons/fa'; // <-- Import icons
import 'react-toastify/dist/ReactToastify.css';
import 'react-lazy-load-image-component/src/effects/blur.css';
import './MovieDetail.css';

// Ad-blocking CSS from the script (only ad-related styles)
const adBlockCSS = `
  .bg-opacity-40.bg-white.w-full.text-center.space-x-2.bottom-0.absolute {
    display: none !important;
  }
`;

// --- Đặt config và caches BÊN NGOÀI component để đảm bảo chúng không bị khởi tạo lại ---
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

const caches = { blob: {} };

// Các hàm xử lý quảng cáo cũng có thể đặt ở đây
function getTotalDuration(playlist) {
  const matches = playlist.match(/#EXTINF:([\d.]+)/g) ?? [];
  return matches.reduce((sum, match) => sum + parseFloat(match.split(':')[1]), 0);
}

function isContainAds(playlist) {
  // Thêm kiểm tra an toàn cho config.adsRegexList
  if (!config || !Array.isArray(config.adsRegexList)) {
    console.error("Lỗi: config hoặc adsRegexList không được định nghĩa đúng cách.");
    return false;
  }
  return config.adsRegexList.some((regex) => {
    regex.lastIndex = 0;
    return regex.test(playlist);
  });
}

function getExceptionDuration(url) {
  url = new URL(url);
  if (['ophim', 'opstream'].some((keyword) => url.hostname.includes(keyword))) {
    return 600;
  } else if (['nguonc', 'streamc'].some((keyword) => url.hostname.includes(keyword))) {
    return Infinity;
  } else {
    return 900;
  }
}

async function removeAds(playlistUrl) {
  playlistUrl = new URL(playlistUrl);
  if (caches.blob[playlistUrl.href]) {
    return caches.blob[playlistUrl.href];
  }
  const isNoNeedToBypass = config.domainBypassWhitelist.some((keyword) =>
    playlistUrl.hostname.includes(keyword)
  );
  try {
    let req = await fetch(playlistUrl);
    if (!req.ok) { // Kiểm tra xem request có thành công không
      throw new Error(`HTTP error! status: ${req.status}`);
    }
    let playlist = await req.text();
    playlist = playlist.replace(/^[^#].*$/gm, (line) => {
      try {
        const parsed = new URL(line, playlistUrl);
        return parsed.toString();
      } catch {
        return line;
      }
    });
    if (playlist.includes('#EXT-X-STREAM-INF')) {
      caches.blob[playlistUrl.href] = await removeAds(
        playlist.trim().split('\n').slice(-1)[0]
      );
      return caches.blob[playlistUrl.href];
    }
    if (isContainAds(playlist)) {
      playlist = config.adsRegexList.reduce((playlist2, regex) => {
        return playlist2.replaceAll(regex, '');
      }, playlist);
    } else if (getTotalDuration(playlist) <= getExceptionDuration(playlistUrl)) {
      // No action needed for short playlists
    } else {
      toast.error('Không tìm thấy quảng cáo. Vui lòng báo cáo nếu video chứa quảng cáo.');
    }
    caches.blob[playlistUrl.href] = URL.createObjectURL(
      new Blob([playlist], {
        type: req.headers.get('Content-Type') ?? 'text/plain',
      })
    );
    return caches.blob[playlistUrl.href];
  } catch (error) {
    console.error("Lỗi khi fetch hoặc xử lý playlist:", error);
    toast.error(`Không thể tải playlist video: ${error.message}`);
    throw error;
  }
}
// --- KẾT THÚC PHẦN config và caches ---

function MovieDetail() {
  const { slug, episodeSlug } = useParams();
  const [movie, setMovie] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [selectedServer, setSelectedServer] = useState(() => {
    return parseInt(localStorage.getItem(`selectedServer-${slug}`)) || 0;
  });
  const [currentEpisode, setCurrentEpisode] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true); // Chỉ dùng cho loading ban đầu khi fetch data
  const videoRef = useRef(null); // Ref cho thẻ <video>
  const hlsInstanceRef = useRef(null); // Ref để lưu trữ Hls instance

  // Inject ad-blocking CSS
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = adBlockCSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  // Fetch movie data
  useEffect(() => {
    const fetchMovie = async () => {
      try {
        setInitialLoading(true);
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/phim/${slug}`, {
          timeout: 5000,
        });
        setMovie(response.data.movie);
        setEpisodes(response.data.episodes || []);

        const validServerIndex = selectedServer < response.data.episodes.length ? selectedServer : 0;
        setSelectedServer(validServerIndex);

        const episode = episodeSlug
          ? response.data.episodes[validServerIndex]?.server_data.find(
              (ep) => ep.slug === episodeSlug
            )
          : null;

        setCurrentEpisode(episode || null);
        setInitialLoading(false);
      } catch (error) {
        console.error('Lỗi khi lấy dữ liệu phim:', error);
        if (error.response?.status === 404) {
          toast.error('Phim hoặc tập phim không tồn tại.');
        } else {
          toast.error('Lỗi kết nối server. Vui lòng thử lại sau.');
        }
        setInitialLoading(false);
      }
    };
    fetchMovie();
  }, [slug, episodeSlug, selectedServer]);

  // Persist selected server
  useEffect(() => {
    localStorage.setItem(`selectedServer-${slug}`, selectedServer);
  }, [selectedServer, slug]);

  // Handle video playback with HLS.js
  useEffect(() => {
    if (currentEpisode?.link_m3u8 && videoRef.current) {
      const video = videoRef.current;
      const loadVideo = async () => {
        // Hủy instance Hls cũ nếu có
        if (hlsInstanceRef.current) {
          hlsInstanceRef.current.destroy();
          hlsInstanceRef.current = null;
        }

        try {
          const cleanPlaylistUrl = await removeAds(currentEpisode.link_m3u8);
          console.log("URL video (HLS.js):", cleanPlaylistUrl);

          if (Hls.isSupported()) {
            const hls = new Hls();
            hlsInstanceRef.current = hls; // Lưu trữ instance Hls
            hls.loadSource(cleanPlaylistUrl);
            hls.attachMedia(video);

            // Bắt các sự kiện lỗi của Hls.js để debug
            hls.on(Hls.Events.ERROR, (event, data) => {
              console.error('HLS.js error:', data);
              if (data.fatal) {
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    toast.error('Lỗi mạng khi tải video. Vui lòng kiểm tra kết nối.');
                    hls.startLoad(); // Thử tải lại
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    toast.error('Lỗi phát video. Có thể do định dạng không hỗ trợ.');
                    hls.recoverMediaError(); // Thử phục hồi
                    break;
                  default:
                    // Không thể phục hồi lỗi nghiêm trọng
                    toast.error('Lỗi video nghiêm trọng. Vui lòng thử tập khác.');
                    hls.destroy();
                    break;
                }
              }
            });

            // Tự động phát video khi sẵn sàng
            video.play().catch(error => {
              console.warn("Autoplay was prevented:", error);
              // Có thể hiển thị nút play lớn cho người dùng
            });

          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Đối với Safari và iOS, có hỗ trợ HLS native
            video.src = cleanPlaylistUrl;
            video.play().catch(error => console.warn("Autoplay was prevented (native):", error));
          } else {
            toast.error('Trình duyệt không hỗ trợ phát HLS. Vui lòng cập nhật.');
          }
        } catch (error) {
          console.error('Error loading video:', error);
          // Toast đã được xử lý trong hàm removeAds
        }
      };
      loadVideo();

      // Cleanup function: Hủy Hls instance khi component unmount hoặc currentEpisode thay đổi
      return () => {
        if (hlsInstanceRef.current) {
          hlsInstanceRef.current.destroy();
          hlsInstanceRef.current = null;
        }
        // Giải phóng Blob URL nếu có
        if (video.src && video.src.startsWith('blob:')) {
          URL.revokeObjectURL(video.src);
          video.src = ''; // Xóa src của video
          video.removeAttribute('src'); // Đảm bảo src bị loại bỏ hoàn toàn
          video.load(); // Khôi phục video element
        }
      };
    }
  }, [currentEpisode]);

  const handleServerChange = (index) => {
    setSelectedServer(index);
    setCurrentEpisode(null); // Reset current episode để xóa video cũ
    window.history.pushState({}, '', `/movie/${slug}`);
  };

  const handleEpisodeSelect = (episode) => {
    setCurrentEpisode(episode);
    window.history.pushState({}, '', `/movie/${slug}/${episode.slug}`);
  };

  const getImageUrl = (url) => {
    if (url && url.startsWith('https://')) {
      return url;
    }
    return url ? `${process.env.REACT_APP_API_CDN_IMAGE}/${url}` : '/fallback-image.jpg';
  };

  const truncateDescription = (text, maxLength = 160) => {
    if (!text) return '';
    const stripped = text.replace(/<[^>]+>/g, '');
    return stripped.length > maxLength ? stripped.substring(0, maxLength) + '...' : stripped;
  };

  const isValidUrl = (url) => {
    try {
      new URL(url);
      return url.startsWith('https://');
    } catch {
      return false;
    }
  };

  if (initialLoading) return <div className="container"><div className="spinner"></div></div>;
  if (!movie) return <div className="container">Phim không tồn tại.</div>;

  return (
    <div className="container">
      <Helmet>
        <title>
          {currentEpisode
            ? `${movie.name} - ${currentEpisode.name || 'Tập phim'}`
            : movie.seoOnPage?.titleHead || movie.name}
        </title>
        <meta
          name="description"
          content={movie.seoOnPage?.descriptionHead || truncateDescription(movie.content)}
        />
      </Helmet>
      <ToastContainer />
      <h1 className="movie-title">
        {movie.name}
        {currentEpisode ? ` - ${currentEpisode.name || 'Tập phim'}` : ''}
      </h1>
      <div className="movie-detail">
        {currentEpisode && isValidUrl(currentEpisode.link_m3u8) ? (
          <>
            <div className="video-player">
              <video
                ref={videoRef}
                controls // Hiển thị controls mặc định của trình duyệt
                width="100%"
                height="100%"
                aria-label={`Video player for ${currentEpisode.name || 'Tập phim'}`}
              />
            </div>
            <button
              onClick={() => {
                setCurrentEpisode(null);
                window.history.pushState({}, '', `/movie/${slug}`);
              }}
              className="back-button"
              aria-label="Quay lại thông tin phim"
            >
              <FaArrowLeft className="icon" /> Quay lại thông tin phim
            </button>
          </>
        ) : currentEpisode ? (
          <p>Video không khả dụng cho tập này.</p>
        ) : (
          <>
            <LazyLoadImage
              src={getImageUrl(movie.poster_url)}
              alt={movie.name}
              className="movie-poster"
              effect="blur"
              width="300"
              height="450"
            />
            <div className="movie-info">
              <p><strong>Tên gốc:</strong> {movie.origin_name}</p>
              <p><strong>Năm:</strong> {movie.year}</p>
              <p>
                <strong>Thể loại:</strong>{' '}
                {movie.category?.map((cat) => cat.name).join(', ') || 'N/A'}
              </p>
              <p>
                <strong>Quốc gia:</strong>{' '}
                {movie.country?.map((c) => c.name).join(', ') || 'N/A'}
              </p>
              <p><strong>Chất lượng:</strong> {movie.quality || 'N/A'}</p>
              <p><strong>Ngôn ngữ:</strong> {movie.lang || 'N/A'}</p>
              <p><strong>Thời lượng:</strong> {movie.time || 'N/A'}</p>
              <p><strong>Trạng thái:</strong> {movie.episode_current || 'Full'}</p>
              <p><strong>Nội dung:</strong> {movie.content || 'Không có mô tả.'}</p>
            </div>
          </>
        )}
      </div>
      {episodes.length > 0 && (
        <div className="episode-list">
          <h3>Danh sách tập</h3>
          <div className="server-list">
            {/* Đã bỏ dòng "Chọn server/ngôn ngữ:" */}
            {episodes.map((server, index) => (
              <button
                key={server.server_name}
                onClick={() => handleServerChange(index)}
                className={`server-button ${index === selectedServer ? 'active' : ''}`}
                aria-label={`Chọn server ${server.server_name}`}
              >
                <FaRegPlayCircle className="icon" /> {server.server_name}
              </button>
            ))}
          </div>
          <div className="episodes">
            {episodes[selectedServer]?.server_data?.length > 0 ? (
              episodes[selectedServer].server_data.map((ep, index) => (
                <button
                  key={ep.slug}
                  onClick={() => handleEpisodeSelect(ep)}
                  className={`episode-button ${ep.slug === currentEpisode?.slug ? 'active' : ''}`}
                  aria-label={`Xem ${ep.name || `Tập ${index + 1}`}`}
                >
                  {ep.name || `Tập ${index + 1}`}
                </button>
              ))
            ) : (
              <p>Không có tập phim cho server này.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MovieDetail;
