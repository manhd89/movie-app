import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import axios from 'axios';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import Hls from 'hls.js';
import { FaArrowLeft, FaRegPlayCircle, FaHistory } from 'react-icons/fa';
import 'react-lazy-load-image-component/src/effects/blur.css';
import './MovieDetail.css';

// --- Ad-blocking and Playlist Processing Logic using Blob ---
// Ad-blocking CSS
const adBlockCSS = `
  .bg-opacity-40.bg-white.w-full.text-center.space-x-2.bottom-0.absolute {
    display: none !important;
  }
`;

// Regex list to detect ads in M3U8 playlists
const adsRegexList = [
  new RegExp(
    "(?<!#EXT-X-DISCONTINUITY[\\s\\S]*)#EXT-X-DISCONTINUITY\\n(?:.*?\\n){18,24}#EXT-X-DISCONTINUITY\\n(?![\\s\\S]*#EXT-X-DISCONTINUITY)",
    "g"
  ),
  /#EXT-X-DISCONTINUITY\n(?:#EXT-X-KEY:METHOD=NONE\n(?:.*\n){18,24})?#EXT-X-DISCONTINUITY\n|convertv7\//g,
  /#EXT-X-DISCONTINUITY\n(?:#EXTINF:(?:3.92|0.76|2.00|2.50|2.00|2.42|2.00|0.78|1.96)0000,\n.*\n){9}#EXT-X-DISCONTINUITY\n(?:#EXTINF:(?:2.00|1.76|3.20|2.00|1.36|2.00|2.00|0.72)0000,\n.*\n){8}(?=#EXT-X-DISCONTINUITY)/g,
];

// Checks if a playlist contains ad patterns
function isContainAds(playlist) {
  return adsRegexList.some((regex) => {
    regex.lastIndex = 0; // Reset regex state for each test
    return regex.test(playlist);
  });
}

// Fetches and removes ads from an M3U8 playlist, returning the cleaned content
async function fetchAndRemoveAdsFromPlaylist(playlistUrl) {
  try {
    const normalizedUrl = playlistUrl.replace(/^http:/, "https:"); // Force HTTPS

    const response = await fetch(normalizedUrl, {
      method: "GET",
      headers: {
        Referer: normalizedUrl, // Add Referer header
      },
      mode: "cors",
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch playlist: ${normalizedUrl} (Status: ${response.status})`);
    }
    let playlist = await response.text();

    // Resolve relative URLs in playlist and force HTTPS
    const baseUrl = new URL(normalizedUrl);
    playlist = playlist.replace(/^[^#].*$/gm, (line) => {
      try {
        const parsedUrl = new URL(line, baseUrl);
        parsedUrl.protocol = "https:"; // Force HTTPS for segments
        return parsedUrl.toString();
      } catch {
        return line;
      }
    });

    // Handle master playlist (fetch sub-playlist if found)
    if (playlist.includes("#EXT-X-STREAM-INF")) {
      const variantUrlMatch = playlist.split('\n').find(line => !line.startsWith('#') && line.trim() !== '');
      if (variantUrlMatch) {
          const normalizedVariantUrl = new URL(variantUrlMatch, baseUrl).href.replace(/^http:/, "https:");
          console.log("MovieDetail: Fetching sub-playlist for ad removal:", normalizedVariantUrl);
          return await fetchAndRemoveAdsFromPlaylist(normalizedVariantUrl); // Recursive call for sub-playlist
      }
    }

    // Remove ads if detected
    if (isContainAds(playlist)) {
      console.log("MovieDetail: Removing ads from playlist using Blob.");
      playlist = adsRegexList.reduce((currentPlaylist, regex) => {
        return currentPlaylist.replaceAll(regex, "");
      }, playlist);
    } else {
        console.log("MovieDetail: No ads detected in playlist.");
    }

    return playlist;
  } catch (error) {
    console.error("MovieDetail: Error in fetchAndRemoveAdsFromPlaylist:", error);
    return null; // Return null if there's an error
  }
}
// --- End: Ad-blocking and Playlist Processing Logic ---


const PLAYBACK_SAVE_THRESHOLD_SECONDS = 5;
const LAST_PLAYED_KEY_PREFIX = 'lastPlayedPosition-';
const WATCH_HISTORY_KEY = 'watchHistory';
const SAVE_INTERVAL_SECONDS = 10; // Save playback position every 10 seconds

function MovieDetail() {
  const { slug, episodeSlug } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [selectedServer, setSelectedServer] = useState(() => {
    return parseInt(localStorage.getItem(`selectedServer-${slug}`)) || 0;
  });
  const [currentEpisode, setCurrentEpisode] = useState(null);
  const [showMovieInfoPanel, setShowMovieInfoPanel] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [videoLoading, setVideoLoading] = useState(false);
  const videoRef = useRef(null);
  const hlsInstanceRef = useRef(null);
  const currentPlaybackPositionRef = useRef(0);
  const [lastViewedPosition, setLastViewedPosition] = useState(0);
  const [lastViewedEpisodeInfo, setLastViewedEpisodeInfo] = useState(null);
  const saveIntervalRef = useRef(null); // Ref for the interval timer

  // Ref to hold the Blob URL if created, for proper revocation
  const currentBlobUrlRef = useRef(null); 

  useEffect(() => {
    // Inject ad-blocking CSS into the document head
    const style = document.createElement('style');
    style.textContent = adBlockCSS;
    document.head.appendChild(style);
    return () => style.remove(); // Clean up CSS on component unmount
  }, []);

  useEffect(() => {
    const fetchMovieData = async () => {
      try {
        setInitialLoading(true);
        const response = await axios.get(`/api/movie?slug=${slug}`, {
          timeout: 5000,
        });
        if (response.data && response.data.movie && response.data.episodes) {
          setMovie(response.data.movie);
          setEpisodes(response.data.episodes || []);
        } else if (response.data && response.data.item) {
            setMovie(response.data.item);
            setEpisodes(response.data.item.episodes || []);
        } else {
            console.error("API data format is incorrect:", response.data);
            setMovie(null);
            setEpisodes([]);
        }

        setInitialLoading(false);

        // Load watch history for the current movie
        const history = JSON.parse(localStorage.getItem(WATCH_HISTORY_KEY) || '[]');
        const currentMovieHistory = history.find(item => item.slug === slug);
        if (currentMovieHistory) {
            setLastViewedPosition(currentMovieHistory.position);
            setLastViewedEpisodeInfo(currentMovieHistory.episode || null);
        } else {
            setLastViewedPosition(0);
            setLastViewedEpisodeInfo(null);
        }

      } catch (error) {
        console.error('Error fetching movie data:', error);
        setInitialLoading(false);
      }
    };
    fetchMovieData();
  }, [slug]);

  useEffect(() => {
    if (movie && episodes.length > 0) {
      const validServerIndex = selectedServer < episodes.length ? selectedServer : 0;
      setSelectedServer(validServerIndex);

      const serverData = episodes[validServerIndex]?.server_data;

      if (!episodeSlug) {
        setShowMovieInfoPanel(true);
        setCurrentEpisode(null);
      } else {
        if (serverData && serverData.length > 0) {
          const episodeToLoad = serverData.find((ep) => ep.slug === episodeSlug);
          if (episodeToLoad) {
            setCurrentEpisode(episodeToLoad);
            setShowMovieInfoPanel(false);
          } else {
            setCurrentEpisode(null);
            setShowMovieInfoPanel(true);
            navigate(`/movie/${slug}`, { replace: true });
          }
        } else {
          setCurrentEpisode(null);
          setShowMovieInfoPanel(true);
          navigate(`/movie/${slug}`, { replace: true });
        }
      }
    } else if (movie && episodes.length === 0) {
      setCurrentEpisode(null);
      setShowMovieInfoPanel(true);
      if (episodeSlug) {
        navigate(`/movie/${slug}`, { replace: true });
      }
    }
  }, [movie, episodes, selectedServer, episodeSlug, navigate, slug]);

  useEffect(() => {
    // Save selected server to local storage
    localStorage.setItem(`selectedServer-${slug}`, selectedServer);
  }, [selectedServer, slug]);

  const getPlaybackPositionKey = useCallback((epSlug) => {
    return `${LAST_PLAYED_KEY_PREFIX}${slug}-${epSlug}`;
  }, [slug]);

  const saveMovieToHistory = useCallback((movieData, episodeData, position) => {
    if (!movieData || !episodeData || position < PLAYBACK_SAVE_THRESHOLD_SECONDS) return;

    const historyEntry = {
      slug: movieData.slug,
      name: movieData.name,
      origin_name: movieData.origin_name,
      poster_url: movieData.poster_url,
      year: movieData.year,
      quality: movieData.quality,
      episode_current: movieData.episode_current,
      episode: {
        slug: episodeData.slug,
        name: episodeData.name,
        server_name: episodes[selectedServer]?.server_name || 'N/A',
      },
      position: Math.floor(position),
      timestamp: Date.now(),
    };

    let history = JSON.parse(localStorage.getItem(WATCH_HISTORY_KEY) || '[]');
    history = history.filter(item => item.slug !== movieData.slug); // Remove old entry if exists
    history.unshift(historyEntry); // Add new entry to the beginning
    localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(history.slice(0, 20))); // Keep only last 20
    console.log(`Saved movie to history: ${movieData.name} - ${episodeData.name} at ${position}s`);
  }, [episodes, selectedServer]);


  const savePlaybackPosition = useCallback(() => {
    const video = videoRef.current;
    if (video && currentEpisode && video.currentTime > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
      const key = getPlaybackPositionKey(currentEpisode.slug);
      localStorage.setItem(key, video.currentTime.toString());
      console.log(`Saved playback position for ${currentEpisode.name}: ${video.currentTime}s`);

      if (movie) {
        saveMovieToHistory(movie, currentEpisode, video.currentTime);
      }
    }
  }, [currentEpisode, getPlaybackPositionKey, movie, saveMovieToHistory]);


  const loadVideo = useCallback(async () => {
    const video = videoRef.current;
    if (showMovieInfoPanel || !currentEpisode?.link_m3u8 || !video) {
        setVideoLoading(false);
        // Clear previous video source and stop playback
        if (video) {
            video.src = '';
            video.removeAttribute('src');
            video.load(); // Reset the media element
        }
        if (!showMovieInfoPanel && currentEpisode && !isValidUrl(currentEpisode.link_m3u8)) {
            console.error('Video is not available for this episode.');
        }
        return;
    }

    setVideoLoading(true);

    // Clear any existing save interval
    if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
        saveIntervalRef.current = null;
    }

    // Destroy existing HLS instance if any
    if (hlsInstanceRef.current) {
      hlsInstanceRef.current.destroy();
      hlsInstanceRef.current = null;
    }

    // Revoke any previous Blob URL to free up memory
    if (currentBlobUrlRef.current) {
      URL.revokeObjectURL(currentBlobUrlRef.current);
      currentBlobUrlRef.current = null;
    }

    try {
      const originalM3u8Url = currentEpisode.link_m3u8;
      let finalM3u8Url = originalM3u8Url.replace(/^http:/, "https:"); // Default to original HTTPS URL

      // Fetch, clean ads, and create Blob URL
      const cleanedPlaylist = await fetchAndRemoveAdsFromPlaylist(originalM3u8Url);

      if (cleanedPlaylist) {
        const blob = new Blob([cleanedPlaylist], { type: "application/vnd.apple.mpegurl" });
        finalM3u8Url = URL.createObjectURL(blob);
        currentBlobUrlRef.current = finalM3u8Url; // Store Blob URL for revocation
        console.log("MovieDetail: Using Blob URL for cleaned playlist.");
      } else {
        console.log("MovieDetail: Failed to clean playlist, falling back to original URL.");
      }

      if (Hls.isSupported()) {
        const hls = new Hls({
            maxBufferLength: 60,
            maxMaxBufferLength: 120,
            maxBufferSize: 100 * 1000 * 1000,
            startFragPrefetch: true,
            enableWorker: true,
        });
        hlsInstanceRef.current = hls; // Store HLS instance
        hls.loadSource(finalM3u8Url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setVideoLoading(false);

          const savedPositionKey = getPlaybackPositionKey(currentEpisode.slug);
          const savedTime = parseFloat(localStorage.getItem(savedPositionKey));

          if (!isNaN(savedTime) && savedTime > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
            video.currentTime = savedTime;
            console.log(`Restored playback position for ${currentEpisode.name}: ${savedTime}s`);
          } else {
            video.currentTime = 0;
          }

          video.play().catch(error => {
            console.warn("Autoplay was prevented:", error);
          });
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS.js error:', data);
          setVideoLoading(false);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error('Network error when loading video. Please check your connection.');
                hls.startLoad(); // Attempt to retry loading
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error('Video playback error. Format might not be supported.');
                hls.recoverMediaError(); // Attempt to recover
                break;
              default:
                console.error('Fatal video error. Please try another episode.');
                hls.destroy(); // Destroy and restart if necessary
                break;
            }
          }
        });

      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Fallback to native HLS playback for browsers that support it (e.g., Safari)
        video.src = finalM3u8Url;

        const savedPositionKey = getPlaybackPositionKey(currentEpisode.slug);
        const savedTime = parseFloat(localStorage.getItem(savedPositionKey));

        video.onloadedmetadata = () => {
            if (!isNaN(savedTime) && savedTime > PLAYBACK_SAVE_THRESHOLD_SECONDS) {
                video.currentTime = savedTime;
                console.log(`Restored playback position (native) for ${currentEpisode.name}: ${savedTime}s`);
            } else {
                video.currentTime = 0;
            }
            setVideoLoading(false);
            video.play().catch(error => console.warn("Autoplay was prevented (native):", error));
        };
      } else {
        console.error('Your browser does not support HLS playback. Please update.');
        setVideoLoading(false);
      }

      // Start periodic save interval
      if (video) {
        saveIntervalRef.current = setInterval(() => {
          if (!video.paused) {
            savePlaybackPosition();
          }
        }, SAVE_INTERVAL_SECONDS * 1000);
        console.log(`Started periodic save every ${SAVE_INTERVAL_SECONDS} seconds.`);
      }

    } catch (error) {
      console.error('Error loading video:', error);
      setVideoLoading(false);
    }
  }, [currentEpisode, showMovieInfoPanel, getPlaybackPositionKey, savePlaybackPosition]);

  useEffect(() => {
    // Capture the current value of the ref for cleanup
    const video = videoRef.current; 

    loadVideo();
    return () => {
      savePlaybackPosition(); // Save position on unmount/re-render
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy(); // Destroy HLS instance
        hlsInstanceRef.current = null;
      }
      if (video) { 
        video.src = ''; // Clear video source
        video.removeAttribute('src');
        video.load();
      }
      if (saveIntervalRef.current) {
          clearInterval(saveIntervalRef.current); // Clear save interval
          saveIntervalRef.current = null;
          console.log("Cleared periodic save interval.");
      }
      if (currentBlobUrlRef.current) {
          URL.revokeObjectURL(currentBlobUrlRef.current); // Revoke Blob URL
          currentBlobUrlRef.current = null;
      }
    };
  }, [currentEpisode, loadVideo, savePlaybackPosition]); // Dependencies for useEffect

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleVideoPause = () => {
        savePlaybackPosition();
    };

    const handleTimeUpdate = () => {
        currentPlaybackPositionRef.current = video.currentTime;
    };

    video.addEventListener('pause', handleVideoPause);
    video.addEventListener('timeupdate', handleTimeUpdate);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (!video.paused) {
          video.pause();
          console.log("Video paused due to tab going into background.");
        }
        savePlaybackPosition();
      } else {
        if (video.src && !showMovieInfoPanel) {
            // Attempt to recover/restart HLS if tab comes to foreground
            if (hlsInstanceRef.current && hlsInstanceRef.current.media && hlsInstanceRef.current.media.readyState < 4) {
                console.log("Attempting to recover HLS.js media error on foreground.");
                hlsInstanceRef.current.recoverMediaError();
                hlsInstanceRef.current.startLoad();
            }

            video.play().catch(error => {
                console.warn("Autoplay was prevented on visibility change:", error);
            });
            console.log("Video attempted to play due to tab coming into foreground.");
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      video.removeEventListener('pause', handleVideoPause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [showMovieInfoPanel, savePlaybackPosition]);


  const handleServerChange = useCallback((index) => {
    if (episodes.length === 0) return;

    savePlaybackPosition(); // Save position before changing server

    setSelectedServer(index);
    setShowMovieInfoPanel(false); // Hide info panel to show video

    const newServerData = episodes[index]?.server_data;
    let targetEpisode = null;

    if (newServerData && newServerData.length > 0) {
      // Try to find the current episode in the new server's data
      targetEpisode = newServerData.find(ep => ep.slug === currentEpisode?.slug);
      if (!targetEpisode) {
        // If not found, default to the first episode of the new server
        targetEpisode = newServerData[0];
      }
      setCurrentEpisode(targetEpisode);
      navigate(`/movie/${slug}/${targetEpisode.slug}`, { replace: true });
    } else {
      // If no episodes for the new server
      setCurrentEpisode(null);
      navigate(`/movie/${slug}`, { replace: true }); // Go back to movie info
    }
  }, [slug, navigate, episodes, currentEpisode, savePlaybackPosition]);


  const handleEpisodeSelect = useCallback((episode) => {
    savePlaybackPosition(); // Save position before changing episode

    setCurrentEpisode(episode);
    setShowMovieInfoPanel(false); // Hide info panel to show video
    navigate(`/movie/${slug}/${episode.slug}`);
  }, [slug, navigate, savePlaybackPosition]);

  const handleContinueWatching = useCallback(() => {
    if (lastViewedEpisodeInfo && movie) {
        // Find the server that has the last viewed episode
        const serverIndex = episodes.findIndex(server => server.server_name === lastViewedEpisodeInfo.server_name);

        if (serverIndex !== -1) {
            setSelectedServer(serverIndex);
            const targetEpisode = episodes[serverIndex].server_data.find(ep => ep.slug === lastViewedEpisodeInfo.slug);
            if (targetEpisode) {
                setCurrentEpisode(targetEpisode);
                setShowMovieInfoPanel(false);
                navigate(`/movie/${movie.slug}/${targetEpisode.slug}`);
            } else {
                // If episode not found on its original server, try other servers
                let foundOnOtherServer = false;
                for (let i = 0; i < episodes.length; i++) {
                    const ep = episodes[i].server_data.find(epData => epData.slug === lastViewedEpisodeInfo.slug);
                    if (ep) {
                        setSelectedServer(i);
                        setCurrentEpisode(ep);
                        setShowMovieInfoPanel(false);
                        navigate(`/movie/${movie.slug}/${ep.slug}`);
                        foundOnOtherServer = true;
                        break;
                    }
                }
                if (!foundOnOtherServer) {
                    console.warn("Episode not found on any server, showing movie info.");
                    setCurrentEpisode(null);
                    setShowMovieInfoPanel(true);
                    navigate(`/movie/${movie.slug}`, { replace: true });
                }
            }
        } else {
            console.warn("Server not found, showing movie info.");
            setCurrentEpisode(null);
            setShowMovieInfoPanel(true);
            navigate(`/movie/${movie.slug}`, { replace: true });
        }
    } else {
        console.warn("No last viewed episode info, showing movie info.");
        setCurrentEpisode(null);
        setShowMovieInfoPanel(true);
        navigate(`/movie/${movie.slug}`, { replace: true });
    }
  }, [episodes, lastViewedEpisodeInfo, navigate, movie]);


  const getImageUrl = (url) => {
    if (url && url.startsWith('https://')) {
      return url;
    }
    return url ? `${process.env.REACT_APP_API_CDN_IMAGE}/${url}` : '/fallback-image.jpg';
  };

  const truncateDescription = (text, maxLength = 160) => {
    if (!text) return '';
    const stripped = text.replace(/<[^>]+>/g, ''); // Remove HTML tags
    return stripped.length > maxLength ? stripped.substring(0, maxLength) + '...' : stripped;
  };

  const isValidUrl = (url) => {
    try {
      new URL(url);
      return url.startsWith('https://'); // Only consider HTTPS valid
    } catch {
      return false;
    }
  };

  if (initialLoading) {
    return (
      <div className="container">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!movie) {
    return <div className="container">Movie not found.</div>;
  }

  return (
    <div className="container">
      <Helmet>
        <title>
          {currentEpisode
            ? `${movie.name} - ${currentEpisode.name || 'Episode'}`
            : movie.seoOnPage?.titleHead || movie.name}
        </title>
        <meta
          name="description"
          content={movie.seoOnPage?.descriptionHead || truncateDescription(movie.content)}
        />
      </Helmet>
      <h1 className="movie-title">
        {movie.name}
        {currentEpisode && ` - ${currentEpisode.name || 'Episode'}`}
      </h1>
      <div className="movie-detail">
        {showMovieInfoPanel ? (
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
              <p><strong>Original Title:</strong> {movie.origin_name}</p>
              <p><strong>Year:</strong> {movie.year}</p>
              <p>
                <strong>Genre:</strong>{' '}
                {movie.category?.map((cat) => cat.name).join(', ') || 'N/A'}
              </p>
              <p>
                <strong>Country:</strong>{' '}
                {movie.country?.map((c) => c.name).join(', ') || 'N/A'}
              </p>
              <p><strong>Quality:</strong> {movie.quality || 'N/A'}</p>
              <p><strong>Language:</strong> {movie.lang || 'N/A'}</p>
              <p><strong>Duration:</strong> {movie.time || 'N/A'}</p>
              <p><strong>Status:</strong> {movie.episode_current || 'Full'}</p>
              <p><strong>Content:</strong> {movie.content || 'No description available.'}</p>

              {lastViewedPosition > PLAYBACK_SAVE_THRESHOLD_SECONDS && lastViewedEpisodeInfo && (
                <button
                  onClick={handleContinueWatching}
                  className="continue-watching-detail-button"
                  aria-label={`Continue watching ${lastViewedEpisodeInfo.name || 'Episode'}`}
                >
                  <FaHistory /> Continue watching{' '}
                  {lastViewedEpisodeInfo.name || `last episode`}
                  {' '}at {Math.floor(lastViewedPosition / 60)} minutes {Math.floor(lastViewedPosition % 60)} seconds
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="video-player">
              {videoLoading && (
                <div className="video-overlay-spinner">
                  <div className="spinner"></div>
                </div>
              )}
              {currentEpisode && isValidUrl(currentEpisode.link_m3u8) ? (
                <video
                  ref={videoRef}
                  controls // Display native video controls
                  width="100%"
                  height="100%"
                  aria-label={`Video player for ${currentEpisode.name || 'Episode'}`}
                  className={videoLoading ? 'hidden-video' : ''} // Hide video while loading
                />
              ) : (
                <div className="video-error-message" style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: '#fff',
                    fontSize: '1.2rem',
                    textAlign: 'center',
                    padding: '20px',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    borderRadius: '8px',
                    zIndex: 5
                }}>
                    <p>Video is not available for this episode.</p>
                    <FaRegPlayCircle style={{ fontSize: '3rem', marginTop: '10px' }} />
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setShowMovieInfoPanel(true);
                setCurrentEpisode(null);
                // Navigate without episode slug to show movie info
                navigate(`/movie/${slug}`, { replace: true });
              }}
              className="back-button"
              aria-label="Back to movie information"
            >
              <FaArrowLeft className="icon" /> Back to movie information
            </button>
          </>
        )}
      </div>
      {episodes.length > 0 && (
        <div className="episode-list">
          <h3>Episode List</h3>
          <div className="server-list">
            {episodes.map((server, index) => (
              <button
                key={server.server_name}
                onClick={() => handleServerChange(index)}
                className={`server-button ${index === selectedServer ? 'active' : ''}`}
                aria-label={`Select server ${server.server_name}`}
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
                  aria-label={`Watch ${ep.name || `Episode ${index + 1}`}`}
                >
                  {ep.name || `Episode ${index + 1}`}
                </button>
              ))
            ) : (
              <p>No episodes available for this server.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MovieDetail;
