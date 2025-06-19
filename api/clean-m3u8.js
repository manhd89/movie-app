import axios from 'axios';

// Định nghĩa cấu hình và các hàm logic loại bỏ quảng cáo
// Các hàm này cần được định nghĩa lại ở đây vì đây là môi trường Node.js riêng biệt
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
    regex.lastIndex = 0; // Reset lastIndex cho mỗi lần kiểm tra regex toàn cục
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

// Hàm xử lý chính cho Vercel Function (API Route)
export default async function handler(req, res) {
  const { url } = req.query; // Lấy URL M3U8 gốc từ query parameter

  if (!url) {
    return res.status(400).send('URL is required.');
  }

  try {
    const playlistUrl = new URL(url);
    const isNoNeedToBypass = config.domainBypassWhitelist.some((keyword) =>
      playlistUrl.hostname.includes(keyword)
    );

    // Fetch playlist gốc
    let response = await axios.get(playlistUrl.href, { responseType: 'text' });
    let playlistContent = response.data;

    // Chuyển đổi các đường dẫn tương đối trong playlist thành tuyệt đối
    playlistContent = playlistContent.replace(/^[^#].*$/gm, (line) => {
      try {
        const parsed = new URL(line, playlistUrl);
        return parsed.toString();
      } catch {
        return line; // Trả về dòng gốc nếu không thể parse URL
      }
    });

    // Xử lý playlist master (chứa nhiều biến thể chất lượng)
    if (playlistContent.includes('#EXT-X-STREAM-INF')) {
      // Tìm URL của sub-playlist đầu tiên (thường là chất lượng cao nhất hoặc mặc định)
      const subPlaylistUrlMatch = playlistContent.match(/^(?:#EXT-X-STREAM-INF:.*?\n)(.*?)$/m);
      if (subPlaylistUrlMatch && subPlaylistUrlMatch[1]) {
        const subPlaylistRelativeUrl = subPlaylistUrlMatch[1];
        const subPlaylistAbsoluteUrl = new URL(subPlaylistRelativeUrl, playlistUrl).href;

        // Fetch và xử lý sub-playlist
        const subResponse = await axios.get(subPlaylistAbsoluteUrl, { responseType: 'text' });
        playlistContent = subResponse.data;

        // Chuyển đổi các đường dẫn tương đối trong sub-playlist thành tuyệt đối
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
    } else if (getTotalDuration(playlistContent) <= getExceptionDuration(playlistUrl.href)) {
        // Không làm gì nếu không chứa quảng cáo và thời lượng dưới ngưỡng
    } else {
        // Bạn có thể thêm logic logging ở đây nếu muốn theo dõi các trường hợp này
        // console.log('Không tìm thấy quảng cáo nhưng thời lượng vượt ngưỡng:', url);
    }

    // Thiết lập header Content-Type phù hợp (quan trọng cho trình duyệt/HLS.js nhận diện)
    res.setHeader('Content-Type', response.headers['content-type'] || 'application/x-mpegURL');
    res.status(200).send(playlistContent); // Trả về playlist đã được xử lý
  } catch (error) {
    console.error('Lỗi khi xử lý M3U8 playlist trong Vercel Function:', error);
    res.status(500).send('Không thể xử lý playlist video.');
  }
}
