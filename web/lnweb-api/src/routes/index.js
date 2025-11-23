const express = require("express");
const router = express.Router();

const { setCacheControl, setNoCache } = require("../utils/cache-control");


async function initializeRoutes() {

    console.log("Routes initializing...");

    // Route handlers
    router.get("/", (req, res) => res.json({ message: "Welcome to LNWeb-API!" }));

    router.use("/user", setNoCache(), await require("./user"));
    // ^- user-authentication endpoints should never be cached

    router.use("/info",  setCacheControl({ maxAge: 300, sMaxAge: 24 * 60 * 60 }), await require("./info"));
    router.use("/maps",  setCacheControl({ maxAge: 300, sMaxAge: 24 * 60 * 60 }), await require("./maps"));
    router.use("/news",  setCacheControl({ maxAge: 300, sMaxAge: 24 * 60 * 60 }), await require("./news"));
    router.use("/stats", setCacheControl({ maxAge: 300, sMaxAge: 24 * 60 * 60 }), await require("./stats"));
    router.use("/knowledge", setCacheControl({ maxAge: 300, sMaxAge: 24 * 60 * 60 }), await require("./knowledge"));
    router.use("/join-in", setCacheControl({ maxAge: 300, sMaxAge: 24 * 60 * 60 }), await require("./join-in"));
    // ^- client should cache these responses for 5 min, CDN should cache for 24 hours (unless we invalidate))

    // Fallback for unknown routes
    router.use((req, res) => res.status(404).json({ error: "Not found", path: req.path }));

    console.log("Routes initialized");

    return router;
}

module.exports = initializeRoutes();
