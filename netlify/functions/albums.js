const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

function coverUrl(r) {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_auto,q_auto${r.version ? '/v' + r.version : ''}/${r.public_id}.${r.format}`;
}

// 并发池：限制同时发起的请求数，避免 46 个全量并行触发 Cloudinary 免费版限流（429）
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  const workers = [];
  const n = Math.min(limit, items.length);
  for (let w = 0; w < n; w++) workers.push(worker());
  await Promise.all(workers);
  return results;
}

async function getAlbums() {
  // 1. 列顶层 folder（即相册），替代全量拉取
  const folderResult = await withTimeout(cloudinary.api.sub_folders(''), 8000);
  const folders = (folderResult.folders || []).map(f => f.name).filter(Boolean);

  // 2. 并发池（一次 8 个）查每个相册的封面（最新一张）+ 照片数（total_count）
  const albums = await mapLimit(folders, 8, async (folder) => {
    try {
      const res = await withTimeout(cloudinary.search
        .expression(`resource_type:image AND asset_folder:"${folder.replace(/"/g, '\\"')}"`)
        .sort_by('created_at', 'desc')
        .max_results(1)
        .execute(), 8000);
      const cover = (res.resources || [])[0];
      return {
        folderName: folder,
        date: folder,
        title: folder,
        url: folder,
        coverImage: cover ? coverUrl(cover) : '',
        count: res.total_count || 0
      };
    } catch (e) {
      console.warn('Folder query failed:', folder, e.message);
      return null;
    }
  });

  return albums.filter(Boolean).sort((a, b) => b.folderName.localeCompare(a.folderName));
}

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const albums = await getAlbums();
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        'Netlify-CDN-Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400'
      },
      body: JSON.stringify({ albums, total: albums.length })
    };
  } catch (e) {
    console.error('Album list error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: '获取相册列表失败' }) };
  }
};
