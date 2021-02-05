"use strict";

/**
 * Keeps track of slugs and provides convenience methods for url rewrites
 */
class SlugHelper {
  constructor(config) {
    this.idps = config.idps;
    this.routes = config.routes;
  }

  map(slug) {
    const matchedSlug = this.idps.find(item => {
      return item.slug === slug;
    });
    return matchedSlug ? matchedSlug.id : slug;
  }

}
module.exports = {
  SlugHelper,
};
