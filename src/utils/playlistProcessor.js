// Cấu hình các biểu thức chính quy để nhận diện quảng cáo
export const config = {
  adsRegexList: [
    new RegExp(
      '(?<!#EXT-X-DISCONTINUITY[\\s\\S]*)#EXT-X-DISCONTINUITY\\n(?:.*?\\n){18,24}#EXT-X-DISCONTINUITY\\n(?![\\s\\S]*#EXT-X-DISCONTINUITY)',
      'g'
    ),
    /#EXT-X-DISCONTINUITY\n(?:#EXT-X-KEY:METHOD=NONE\n(?:.*\n){18,24})?#EXT-X-DISCONTINUITY\n|convertv7\//g,
    /#EXT-X-DISCONTINUITY\n(?:#EXTINF:(?:3.92|0.76|2.00|2.50|2.00|2.42|2.00|0.78|1.96)0000,\n.*\n){9}#EXT-X-DISCONTINUITY\n(?:#EXTINF:(?:2.00|1.76|3.20|2.00|1.36|2.00|2.00|0.72)0000,\n.*\n){8}(?=#EXT-X-DISCONTINUITY)/g,
  ],
};

// Kiểm tra xem playlist có chứa quảng cáo không
export function isContainAds(playlist) {
  return config.adsRegexList.some((regex) => {
    regex.lastIndex = 0; // Reset regex state
    return regex.test(playlist);
  });
}

// Lấy tổng thời lượng của playlist (chỉ dùng trong Service Worker hiện tại, nhưng có thể hữu ích)
export function getTotalDuration(playlist) {
  const matches = playlist.match(/#EXTINF:([\d.]+)/g) ?? [];
  return matches.reduce((sum, match) => sum + parseFloat(match.split(':')[1]), 0);
}

// Hàm fetch và loại bỏ quảng cáo (dùng cả trong Service Worker và MovieDetail)
export async function processPlaylistForAds(playlistUrl) {
  try {
    const normalizedUrl = playlistUrl.replace(/^http:/, "https:");

    const response = await fetch(normalizedUrl, {
      method: "GET",
      headers: {
        Referer: normalizedUrl, // Thêm Referer header
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

    // Remove ads if detected
    if (isContainAds(playlist)) {
      playlist = config.adsRegexList.reduce((playlist2, regex) => {
        return playlist2.replaceAll(regex, "");
      }, playlist);
    }

    return playlist;
  } catch (error) {
    console.error("Error processing playlist:", error);
    return null; // Return null if there's an error
  }
}
