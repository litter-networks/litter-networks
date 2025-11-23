// cache-control.js

function setCacheControl({ maxAge, sMaxAge } = {}) {
    return (req, res, next) => {
        if (req.method === "GET" || req.method === "HEAD") {
            res.set("Cache-Control", `public, max-age=${maxAge}, s-maxage=${sMaxAge}`);
        }
        next();
    };
}

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
