import { useEffect, useRef, useState } from "react";
import Hls from "hls.js"; // Import hls.js

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
      throw new Error(
        `Failed to fetch playlist: ${normalizedUrl} (Status: ${response.status})`
      );
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
    return null;
  }
}

function VideoPlayer({ options }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null); // Ref for HLS.js instance
  // Removed error state as it's no longer used for UI
  // const [error, setError] = useState(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Enable native controls
    videoElement.setAttribute("controls", "");

    const loadVideo = async () => {
      try {
        if (!options?.sources?.[0]?.src) {
          throw new Error("Không có nguồn video hợp lệ.");
        }

        const videoSource = options.sources[0].src;
        let finalSource = videoSource;

        // Cleanup previous Hls instance if exists
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }

        // Attempt to remove ads
        const cleanedPlaylist = await removeAds(videoSource);

        if (cleanedPlaylist) {
          // Create a Blob URL for the cleaned playlist
          const blob = new Blob([cleanedPlaylist], { type: "application/vnd.apple.mpegurl" });
          finalSource = URL.createObjectURL(blob);
        } else {
          // Fallback to original URL if ad removal fails, ensure HTTPS
          finalSource = videoSource.replace(/^http:/, "https:");
        }

        if (Hls.isSupported()) {
          // If Hls.js is supported, use it for HLS streams
          const hls = new Hls();
          hls.loadSource(finalSource);
          hls.attachMedia(videoElement);
          hls.on(Hls.Events.MANIFEST_PARSED, function () {
            videoElement.play();
          });
          hls.on(Hls.Events.ERROR, function (event, data) {
            // Error handling logic, but no UI update
            console.error("HLS.js Error:", data);
          });
          hlsRef.current = hls; // Store Hls instance
        } else if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
          // If native HLS is supported (Safari, iOS), use it
          videoElement.src = finalSource;
          videoElement.play();
        } else {
          console.error(
            "Trình duyệt của bạn không hỗ trợ phát video này. Vui lòng thử trình duyệt khác."
          );
        }

        // setError(null); // No longer needed
      } catch (err) {
        console.error("Error loading video:", err);
        // setError("Không thể tải video do lỗi. Vui lòng thử lại sau."); // No longer needed
      }
    };

    loadVideo();

    // Handle window resize for responsive layout (still relevant for video element)
    const handleResize = () => {
      if (videoElement) {
        // You might want to adjust how this behaves if you are managing the container size externally
        // For a simple video tag, it will naturally fit its parent if CSS is set
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy(); // Destroy Hls.js instance
        hlsRef.current = null;
      }
      if (videoRef.current && videoRef.current.src.startsWith("blob:")) {
        URL.revokeObjectURL(videoRef.current.src); // Revoke Blob URL
      }
      window.removeEventListener("resize", handleResize);
    };
  }, [options]);

  return (
    <div
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
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
        autoPlay
      />
      {/* Removed the custom loading and error UI */}
    </div>
  );
}

export default VideoPlayer;
