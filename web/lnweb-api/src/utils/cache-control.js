/**
 * Create Express middleware that sets a public Cache-Control header with the provided max-age and s-maxage for GET and HEAD requests.
 * @param {Object} [options] - Configuration for cache durations.
 * @param {number} [options.maxAge] - Browser cache lifetime in seconds to use for `max-age`.
 * @param {number} [options.sMaxAge] - Shared (proxy) cache lifetime in seconds to use for `s-maxage`.
 * @returns {function} An Express middleware that sets the `Cache-Control` header to `public, max-age={maxAge}, s-maxage={sMaxAge}` for GET and HEAD requests and then calls `next()`.
 */

function setCacheControl({ maxAge, sMaxAge } = {}) {
    return (req, res, next) => {
        if (req.method === "GET" || req.method === "HEAD") {
            res.set("Cache-Control", `public, max-age=${maxAge}, s-maxage=${sMaxAge}`);
        }
        next();
    };
}

/**
 * Create Express middleware that disables client and proxy caching for GET and HEAD requests.
 *
 * The middleware sets headers to prevent storage and reuse by browsers, proxies, and surrogate caches.
 *
 * @returns {function} An Express-style middleware function (req, res, next) that sets cache-disabling headers for GET and HEAD requests and then calls `next()`.
 */
function setNoCache() {
    return (req, res, next) => {
        if (req.method === "GET" || req.method === "HEAD") {
            res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
            res.setHeader("Pragma", "no-cache");
            res.setHeader("Expires", "0");
            res.setHeader("Surrogate-Control", "no-store");
        }
        next();
    };
}

module.exports = { setCacheControl, setNoCache };