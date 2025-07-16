import { useEffect, useRef } from "react";
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
          hlsRef.current = hls; // Store Hls instance
        } else if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
          // If native HLS is supported (Safari, iOS), use it
          videoElement.src = finalSource;
          videoElement.play();
        } else {
          console.error("Trình duyệt không hỗ trợ phát video này.");
        }
      } catch (err) {
        console.error("Error loading video:", err);
      }
    };

    loadVideo();

    // Cleanup
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy(); // Destroy Hls.js instance
        hlsRef.current = null;
      }
      if (videoRef.current && videoRef.current.src.startsWith("blob:")) {
        URL.revokeObjectURL(videoRef.current.src); // Revoke Blob URL
      }
    };
  }, [options]);

  return (
    <video
      ref={videoRef}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "contain",
      }}
      autoPlay
      controls
    />
  );
}

export default VideoPlayer;
