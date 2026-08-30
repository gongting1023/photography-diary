/**
 * Album Detail API
 * 
 * 用于获取单个相册的详细信息
 */

require('dotenv').config();
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const params = event.queryStringParameters || {};
  const folder = params.folder;
  
  if (!folder) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing folder parameter' }) };
  }

  if (!/^\d{4}-\d{2}-\d{2}(\/[\w-]+)*$/.test(folder)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid folder format' }) };
  }

  try {
    const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;

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

    function withTimeout(promise, ms) {
      return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
    }

    // Try Search API for metadata (optional), then always use Admin API for reliable resource listing
    let metadataMap = new Map();
    try {
      const metaResult = await withTimeout(cloudinary.search
        .expression(`resource_type:image AND asset_folder:"${folder.replace(/"/g, '\\"')}"`) 
        .max_results(500)
        .with_field('image_metadata')
        .execute(), 5000);
      (metaResult.resources || []).forEach(r => {
        metadataMap.set(r.public_id, parseExif(r.image_metadata));
      });
    } catch (e) {
      console.warn('Search API metadata fetch failed:', e.message);
    }

    const result = await withTimeout(cloudinary.api.resources_by_asset_folder(folder, { max_results: 500 }), 8000);
    const resources = result.resources || [];

    resources.sort((a, b) => (new Date(a.created_at || 0)) - (new Date(b.created_at || 0)));

    const images = resources.map(resource => {
      const originalFilename = resource.display_name || (resource.public_id || '').split('/').pop();
      return {
        url: `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_auto,q_auto${resource.version ? '/v' + resource.version : ''}/${resource.public_id}.${resource.format}`,
        filename: originalFilename,
        publicId: resource.public_id,
        format: resource.format,
        width: resource.width,
        height: resource.height,
        createdAt: resource.created_at,
        bytes: resource.bytes,
        metadata: metadataMap.get(resource.public_id) || null
      };
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      },
      body: JSON.stringify({ folder, images, total: images.length })
    };

  } catch (error) {
    console.error('Cloudinary API error:', error);
    console.error('Album detail error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: '获取相册详情失败' }) };
  }
};
