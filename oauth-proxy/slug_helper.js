"use strict";

/**
 * Keeps track of slugs and provides convenience methods for url rewrites
 */
class SlugHelper {
  constructor(config) {
    if (config) {
      this.idps = config.idps;
    }
  }

  /**
   * Rewrites the slug to a target url based on configuration settings.
   *
   * @param {*} slug The slug to rewrite.
   */
  rewrite(slug) {
    if (!this.idps) {
      return slug;
    }
    const matchedSlug = this.idps.find((item) => {
      return item.slug === slug;
    });
    return matchedSlug ? matchedSlug.id : slug;
  }
}

module.exports = {
  SlugHelper,
};
