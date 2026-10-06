require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const express = require('express');
const cors = require('cors');
const path = require('path');

if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error('\n⚠️  缺少 Cloudinary 配置！');
  console.error('   请将 .env.example 复制为 .env，并填入你的 Cloudinary 密钥。');
  console.error('   参考: https://cloudinary.com/console\n');
  process.exit(1);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const app = express();
app.use(cors());
app.get('/exhibition/', (req, res) => res.redirect('/'));
app.get('/exhibition', (req, res) => res.redirect('/'));
app.use(express.static('_site'));

// In-memory albums cache with TTL + request dedup
let albumsCache = null;
let albumsCacheTime = 0;
let albumsPending = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

app.get('/album/*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '_site', 'album', 'index.html'));
});

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

async function getAlbums() {
  // Return cached data if fresh
  if (albumsCache && Date.now() - albumsCacheTime < CACHE_TTL) {
    return albumsCache;
  }

  // Dedup concurrent requests while first fetch is in progress
  if (albumsPending) return albumsPending;

  try {
    console.log('Fetching album list from Cloudinary folders...');
    albumsPending = (async () => {
      // 列顶层 folder（即相册），替代全量拉取
      const folderResult = await withTimeout(cloudinary.api.sub_folders(''), 8000);
      const folders = (folderResult.folders || []).map(f => f.name).filter(Boolean);

      // 并行查每个相册的封面（最新一张）+ 照片数（total_count）
      const albums = await Promise.all(folders.map(async (folder) => {
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
            coverImage: cover
              ? `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_auto,q_auto${cover.version ? '/v' + cover.version : ''}/${cover.public_id}.${cover.format}`
              : '',
            count: res.total_count || 0
          };
        } catch (e) {
          console.warn('Folder query failed:', folder, e.message);
          return null;
        }
      }));

      return albums.filter(Boolean).sort((a, b) => b.folderName.localeCompare(a.folderName));
    })();

    const result = await albumsPending;
    albumsCache = result;
    albumsCacheTime = Date.now();
    return result;
  } finally {
    albumsPending = null;
  }
}

function parseExif(meta) {
  if (!meta) return null;
  const m = {};
  if (meta['exif:Make'] || meta['exif:Model']) m.camera = [meta['exif:Make'], meta['exif:Model']].filter(Boolean).join(' ');
  if (meta['exif:FNumber']) m.aperture = 'f/' + parseFloat(meta['exif:FNumber']).toFixed(1);
  if (meta['exif:FocalLength']) m.focalLength = meta['exif:FocalLength'].replace('.0', '');
  if (meta['exif:ISOSpeedRatings']) m.iso = 'ISO ' + meta['exif:ISOSpeedRatings'];
  if (meta['exif:ExposureTime']) m.shutter = meta['exif:ExposureTime'];
  return Object.keys(m).length ? m : null;
}

async function getAlbum(folder) {
  // EXIF 元数据与照片列表并行拉取，EXIF 用短超时，拿不到就降级（不阻塞照片返回）
  const metadataPromise = (async () => {
    try {
      const searchPromise = cloudinary.search
        .expression(`resource_type:image AND asset_folder:"${folder.replace(/"/g, '\\"')}"`)
        .sort_by('created_at', 'asc')
        .max_results(500)
        .with_field('image_metadata')
        .execute();
      const searchResult = await Promise.race([
        searchPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
      ]);
      const map = new Map();
      (searchResult.resources || []).forEach(r => {
        map.set(r.public_id, parseExif(r.image_metadata));
      });
      return map;
    } catch (e) {
      return new Map();
    }
  })();

  // Use Admin API for fast resource listing
  const result = await withTimeout(cloudinary.api.resources_by_asset_folder(folder, { max_results: 500 }), 8000);
  const resources = result.resources || [];

  // Sort by created_at ascending (Admin API doesn't support custom sort)
  resources.sort((a, b) => (new Date(a.created_at || 0)) - (new Date(b.created_at || 0)));

  const metadataMap = await metadataPromise;

  return resources.map(r => ({
    url: `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_auto,q_auto${r.version ? '/v' + r.version : ''}/${r.public_id}.${r.format}`,
    filename: r.display_name || (r.public_id || '').split('/').pop(),
    width: r.width,
    height: r.height,
    metadata: metadataMap.get(r.public_id) || null
  }));
}

app.get('/.netlify/functions/albums', async (req, res) => {
  try {
    const albums = await getAlbums();
    res.json({ albums, total: albums.length });
  } catch (e) {
    console.error('Error:', e.message);
    res.status(500).json({ error: '获取相册列表失败' });
  }
});

app.get('/.netlify/functions/album', async (req, res) => {
  try {
    const { folder } = req.query;
    if (!folder) return res.status(400).json({ error: 'Missing folder' });
    if (!/^\d{4}-\d{2}-\d{2}(\/[\w-]+)*$/.test(folder)) return res.status(400).json({ error: 'Invalid folder format' });
    const images = await getAlbum(folder);
    res.json({ folder, images, total: images.length });
  } catch (e) {
    console.error('Error:', e.message);
    res.status(500).json({ error: '获取相册详情失败' });
  }
});

const PORT = 1023;

// Test Cloudinary connectivity at startup
async function testConnection() {
  try {
    await cloudinary.api.ping();
    console.log('Cloudinary API connection OK');
  } catch (e) {
    console.error('\n⚠️  无法连接 Cloudinary API:', e.message);
    console.error('   请检查网络连接或 .env 配置\n');
  }
}

testConnection();
app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`📡 Albums: http://localhost:${PORT}/.netlify/functions/albums`);
  console.log(`📷 Album: http://localhost:${PORT}/.netlify/functions/album?folder=2023-09-16\n`);
});
