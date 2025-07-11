import { useEffect, useRef, useState } from "react";
import shaka from "shaka-player/dist/shaka-player.ui.js";
import "shaka-player/dist/controls.css";

// Ensure Shaka Player supports the browser
function isShakaSupported() {
  return shaka.Player.isBrowserSupported();
}

// Ads regex list from the provided script
const adsRegexList = [
  new RegExp(
    "(?<!#EXT-X-DISCONTINUITY[\\s\\S]*)#EXT-X-DISCONTINUITY\\n(?:.*?\\n){18,24}#EXT-X-DISCONTINUITY\\n(?![\\s\\S]*#EXT-X-DISCONTINUITY)",
    "g"
  ),
  /#EXT-X-DISCONTINUITY\n(?:#EXT-X-KEY:METHOD=NONE\n(?:.*\n){18,24})?#EXT-X-DISCONTINUITY\n|convertv7\//g,
  /#EXT-X-DISCONTINUITY\n#EXTINF:3\.920000,\n.*\n#EXTINF:0\.760000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:2\.500000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:2\.420000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:0\.780000,\n.*\n#EXTINF:1\.960000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:1\.760000,\n.*\n#EXTINF:3\.200000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:1\.360000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:0\.720000,\n.*/g,
];

// Check if playlist contains ads
function isContainAds(playlist) {
  return adsRegexList.some((regex) => {
    regex.lastIndex = 0;
    return regex.test(playlist);
  });
}

// Remove ads from playlist and ensure HTTPS URLs
async function removeAds(playlistUrl) {
  try {
    // Normalize playlist URL to HTTPS
    const normalizedUrl = playlistUrl.replace(/^http:/, "https:");

    // Fetch playlist with Referer header
    const response = await fetch(normalizedUrl, {
      method: "GET",
      headers: {
        Referer: normalizedUrl,
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
        parsedUrl.protocol = "https:";
        return parsedUrl.toString();
      } catch {
        return line;
      }
    });

    // Check if playlist is a master playlist
    if (playlist.includes("#EXT-X-STREAM-INF")) {
      const variantUrl = playlist.trim().split("\n").slice(-1)[0];
      const normalizedVariantUrl = variantUrl.replace(/^http:/, "https:");
      return await removeAds(normalizedVariantUrl);
    }

    // Remove ads if detected
    if (isContainAds(playlist)) {
      playlist = adsRegexList.reduce((playlist2, regex) => {
        return playlist2.replaceAll(regex, "");
      }, playlist);
    }

    return playlist;
  } catch (error) {
    console.error("Error in removeAds:", error);
    return null; // Return null on error to signify failure
  }
}

function VideoPlayer({ options, onTimeUpdate, onEnded }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isShakaSupported()) {
      setError(
        "Trình duyệt không hỗ trợ Shaka Player. Vui lòng sử dụng Chrome, Firefox, Edge hoặc Safari."
      );
      setIsLoading(false);
      return;
    }

    const videoElement = videoRef.current;
    const containerElement = containerRef.current;
    if (!videoElement || !containerElement) return;

    videoElement.removeAttribute("controls"); // Remove native controls

    const player = new shaka.Player();
    playerRef.current = player;

    const attachPlayer = async () => {
      try {
        await player.attach(videoElement);
      } catch (err) {
        setError("Không thể khởi tạo trình phát video.");
        setIsLoading(false);
        return false;
      }
      return true;
    };

    const configureUI = () => {
      const ui = new shaka.ui.Overlay(player, containerElement, videoElement);
      ui.configure({
        controlPanelElements: [
          "play_pause",
          "time_and_duration",
          "volume",
          "mute",
          "spacer",
          "language",
          "fullscreen",
        ],
        overflowMenuButtons: ["captions", "cast", "language"],
        addBigPlayButton: true,
        enableKeyboardPlaybackControls: true,
        enableFullscreenOnRotation: true,
        fadeDelay: 3,
      });
    };

    const configurePlayer = () => {
      player.configure({
        networking: {
          forceHTTPS: true,
        },
        streaming: {
          bufferingGoal: 60,
          rebufferingGoal: 2,
          bufferBehind: 30,
          preferNativeHls: false,
          retryParameters: {
            maxAttempts: 3,
            baseDelay: 1000,
            backoffFactor: 2,
            fuzzFactor: 0.5,
            timeout: 0,
          },
        },
        abr: {
          enabled: true,
        },
      });
    };

    player.addEventListener("error", (event) => {
      setError(`Lỗi phát video: ${event.detail.message}`);
      setIsLoading(false);
    });

    // Add listeners for timeupdate and ended events
    const handleTimeUpdate = () => {
      if (videoElement && onTimeUpdate) {
        onTimeUpdate(videoElement.currentTime);
      }
    };

    const handleEnded = () => {
      if (onEnded) {
        onEnded();
      }
    };

    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('ended', handleEnded);

    const loadVideo = async () => {
      try {
        if (!options?.sources?.[0]?.src) {
          throw new Error("Không có nguồn video hợp lệ.");
        }

        const attached = await attachPlayer();
        if (!attached) return;

        configurePlayer();
        configureUI();

        const cleanedPlaylist = await removeAds(options.sources[0].src);

        if (cleanedPlaylist) {
          const dataUrl = `data:application/vnd.apple.mpegurl,${encodeURIComponent(cleanedPlaylist)}`;
          await player.load(dataUrl);
        } else {
          // Fallback to original URL if ad removal fails
          const fallbackUrl = options.sources[0].src.replace(/^http:/, "https:");
          await player.load(fallbackUrl);
        }

        setError(null);
        setIsLoading(false);

        // Restore playback position after loading
        if (options.autoplay && options.startTime) {
          videoElement.currentTime = options.startTime;
        }

        videoElement.play().catch(e => console.warn("Autoplay prevented:", e));

      } catch (err) {
        setError("Không thể tải video do lỗi kết nối hoặc nội dung hỗn hợp. Vui lòng thử lại sau.");
        setIsLoading(false);
      }
    };

    loadVideo();

    const handleResize = () => {
      if (containerElement) {
        containerElement.style.maxWidth = "100%";
        containerElement.style.height = window.innerWidth <= 640 ? "auto" : "100%";
        videoElement.style.width = "100%";
        videoElement.style.height = window.innerWidth <= 640 ? "auto" : "100%";
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('ended', handleEnded);
      window.removeEventListener("resize", handleResize);
    };
  }, [options, onTimeUpdate, onEnded]); // Add onTimeUpdate and onEnded to dependencies

  return (
    <div
      ref={containerRef}
      data-shaka-player-container
      style={{
        width: "100%",
        maxWidth: "1200px",
        margin: "0 auto",
        position: "relative",
        aspectRatio: "16 / 9",
        background: "#000",
      }}
    >
      <video
        ref={videoRef}
        data-shaka-player
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
        autoPlay
      />
      {isLoading && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#fff",
            background: "rgba(0, 0, 0, 0.8)",
            padding: "16px",
            borderRadius: "8px",
            textAlign: "center",
          }}
        >
          Đang tải...
        </div>
      )}
      {error && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#ff4d4f",
            background: "rgba(0, 0, 0, 0.8)",
            padding: "16px",
            borderRadius: "8px",
            textAlign: "center",
            maxWidth: "90%",
          }}
        >
          {error}
        </div>
      )}
      <style jsx>{`
        /* Hide native controls explicitly for Chromium */
        video::-webkit-media-controls,
        video::-webkit-media-controls-panel,
        video::-webkit-media-controls-play-button,
        video::-webkit-media-controls-volume-slider,
        video::-webkit-media-controls-timeline {
          display: none !important;
        }

        /* Ensure Shaka controls are visible */
        .shaka-custom-controls {
          background: rgba(0, 0, 0, 0.7);
          font-size: 16px;
        }

        /* Mobile adjustments */
        @media (max-width: 640px) {
          .shaka-custom-controls {
            font-size: 14px;
          }
        }
      `}</style>
    </div>
  );
}

export default VideoPlayer;
