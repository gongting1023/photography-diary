const fs = require('fs');
const path = require('path');

module.exports = function(config) {
  config.addPassthroughCopy("static");
  config.addPassthroughCopy("favicon.svg");
  config.addPassthroughCopy("netlify");
  config.addPassthroughCopy("e4fa9ed9ad7776dc34e6f0c969e91c8d.txt");

  // Auto-build hero video playlist from static/video (numeric order, existing files only)
  config.addGlobalData('heroVideos', () => {
    const dir = path.join(__dirname, 'static', 'video');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => /^\d+\.webm$/.test(f) && fs.statSync(path.join(dir, f)).size > 0)
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
      .map(f => '/static/video/' + f);
  });

  return {
    dir: {
      input: ".",
      includes: "_includes",
      layouts: "_includes/layouts",
      data: "_data",
      output: "_site"
    }
  };
};
