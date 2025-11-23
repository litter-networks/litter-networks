const express = require("express");
const cookieParser = require('cookie-parser');

console.log(`LNWeb-API - Running Node.js version: ${process.version}`);

const app = express();

function debugListRoutes(layer, prefix = "") {
    if (layer.route) {
        // Direct route (GET, POST, etc.)
        const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase()).join(", ");
        console.log(`${methods} ${prefix}${layer.route.path}`);
    } else if (layer.name === "router" && layer.handle.stack) {
        // Sub-router (avoid raw regex, use layer.path if available)
        const newPrefix = prefix + (layer.path || "");
        layer.handle.stack.forEach(subLayer => debugListRoutes(subLayer, newPrefix));
    }
}

async function setupMiddleware() {

    console.log("Setting up middleware...");

    app.use(cookieParser());

    const cors = require('cors');

    const allowedHostPattern = /^https?:\/\/([a-z0-9-]+\.)*litternetworks\.org(?::\d+)?$/i;

    app.use(cors({
        origin: (origin, callback) => {
            if (!origin || allowedHostPattern.test(origin)) {
                callback(null, true);
            } else {
                console.warn(`CORS ERROR: Blocked origin: ${origin || "unknown"}`);
                callback(new Error("CORS policy does not allow this origin"), false);
            }
        },
        credentials: true,
        optionsSuccessStatus: 204,
    }));

    // Middleware to parse JSON requests (useful for POST requests)
    console.log("Setting up middleware:misc...");
    app.use(express.json());

    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] Request: ${JSON.stringify(req.method)} ${JSON.stringify(req.url)}`);
        next();
    });

    // Load routes asynchronously
    console.log("Setting up middleware:routes...");
    const routes = await require("./routes/index");
    app.use("/", routes);

    // Fallback for unknown routes
    app.use((req, res) => res.status(404).json({ error: "Not found", path: req.path }));

    // keep this "catch all" at end of stack:
    app.use((err, req, res, next) => {
        console.error('Error:', err.message || err);
        res.status(500).json({ error: err.message || 'Internal Server Error' });
    });
}

// Export an async function that initializes the app with secrets loaded
module.exports = async function initializeApp() {
    try {
        await setupMiddleware();
    } catch (err) {
        console.error('Error:', err.message || err);
    }
    return app;
};
