// api/movie.js

import { Redis } from '@upstash/redis';
import axios from 'axios';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { slug } = req.query;

  if (!slug) {
    return res.status(400).json({ message: 'Missing slug parameter' });
  }

  const cacheKey = `movie:${slug}`;
  // const CACHE_TTL_SECONDS = 3600; // KHÔNG CẦN DÙNG NỮA VÌ CACHE VĨNH VIỄN

  try {
    // 1. Cố gắng lấy dữ liệu từ Redis
    // Upstash Redis client sẽ tự động parse JSON string thành object JS
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      console.log(`[Cache Hit] Data for ${slug} fetched from Redis.`);
      
      // Kiểm tra đơn giản xem cachedData có phải là một đối tượng hợp lệ không
      if (typeof cachedData === 'object' && cachedData !== null && !Array.isArray(cachedData)) {
          // Giả định dữ liệu API phim của bạn trả về object, không phải mảng
          return res.status(200).json(cachedData);
      } else {
          // Nếu cachedData không phải là object (ví dụ: null, undefined, hoặc một string lỗi),
          // coi như cache hỏng hoặc không tồn tại.
          console.log(`[Cache Debug] Cached data for ${slug} is not a valid object, treating as cache miss.`);
          // Xóa cache bị lỗi nếu nó không phải là null/undefined
          if (cachedData !== null && cachedData !== undefined) {
              await redis.del(cacheKey);
              console.log(`[Cache Debug] Corrupted/Invalid cached data for ${slug} deleted.`);
          }
      }
    }

    // 2. Nếu không có trong cache, hoặc cache bị lỗi, thì fetch từ API gốc
    console.log(`[Cache Miss] Fetching data for ${slug} from external API.`);

    const apiResponse = await axios.get(`${process.env.REACT_APP_API_URL}/phim/${slug}`, {
      timeout: 8000,
    });
    const movieData = apiResponse.data; // movieData bây giờ là một object JS

    // 3. Lưu dữ liệu vào Upstash Redis cache VĨNH VIỄN
    // Bỏ tham số 'ex' để không đặt TTL
    await redis.set(cacheKey, movieData); 
    console.log(`Data for ${slug} cached in Redis (permanent).`);

    return res.status(200).json(movieData);

  } catch (error) {
    console.error(`Error fetching or caching movie data for ${slug}:`, error.message);

    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        return res.status(404).json({ message: 'Movie not found.' });
      } else if (error.code === 'ECONNABORTED') {
        return res.status(504).json({ message: 'API request timed out.' });
      }
    }
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
