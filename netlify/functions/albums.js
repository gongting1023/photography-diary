require('dotenv').config();
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;

async function getAllResources() {
  let allResources = [];
  let cursor = null;
  let pages = 0;

  do {
    let query = cloudinary.search
      .expression('resource_type:image')
      .sort_by('created_at', 'desc')
      .max_results(500);

    if (cursor) query = query.next_cursor(cursor);

    const result = await Promise.race([
      query.execute(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
    ]);
    allResources = allResources.concat(result.resources || []);
    cursor = result.next_cursor;
    pages++;

  } while (cursor && pages < 20);

  return allResources;
}

async function getAlbums() {
  const resources = await getAllResources();
  const folderMap = new Map();

  resources.forEach(resource => {
    const folder = resource.asset_folder || resource.folder || '';
    if (!folder) return;

    if (!folderMap.has(folder)) {
      folderMap.set(folder, { folderName: folder, images: [] });
    }

      folderMap.get(folder).images.push({
        url: `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_auto,q_auto${resource.version ? '/v' + resource.version : ''}/${resource.public_id}.${resource.format}`,
        filename: resource.display_name || (resource.public_id || '').split('/').pop(),
      width: resource.width,
      height: resource.height
    });
  });

  return Array.from(folderMap.values())
    .filter(a => a.folderName)
    .sort((a, b) => b.folderName.localeCompare(a.folderName))
    .map(a => ({
      ...a,
      date: a.folderName,
      title: a.folderName,
      coverImage: a.images[0]?.url || '',
      url: a.folderName
    }));
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
        'Cache-Control': 'public, max-age=300, s-maxage=300'
      },
      body: JSON.stringify({ albums, total: albums.length })
    };
  } catch (e) {
    console.error('Album list error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: '获取相册列表失败' }) };
  }
};
