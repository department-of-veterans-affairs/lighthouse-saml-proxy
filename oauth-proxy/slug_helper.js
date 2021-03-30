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
   * Rewrites a slug to a value based on configuration settings.
   *
   * If more than one slug is provided, the first non-empty value will be rewritten.
   *
   * @param {string} slugs The slugs (in preferred order) to rewrite.
   * @returns {string|null} a rewritten value or null.
   */
  rewrite(...slugs) {
    for (const slug of slugs) {
      if (slug) {
        if (!this.idps) {
          return slug;
        }
        const matchedSlug = this.idps.find((item) => {
          return item.slug === slug;
        });
        return matchedSlug ? matchedSlug.id : slug;
      }
    }

    return null;
  }
}

module.exports = {
  SlugHelper,
};
