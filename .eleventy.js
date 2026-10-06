module.exports = function(config) {
  config.addPassthroughCopy("static");
  config.addPassthroughCopy("favicon.svg");
  config.addPassthroughCopy("e4fa9ed9ad7776dc34e6f0c969e91c8d.txt");

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
