// Server startup script for running the app directly (not through Lambda)

const initializeApp = require('./app');

/**
 * Initialize the application and start an HTTP server on localhost:8080.
 *
 * Starts a startup timer and logs initialization progress. On successful initialization, begins listening on 127.0.0.1:8080 and ends the timer; on failure, logs the error and exits the process with code 1.
 */
async function startServer() {
    try {
        console.time('App startup time');

        console.log('LNWeb-API - Initializing app...');
        const app = await initializeApp();
        console.log('App successfully initialized');

        // start http server - only listen on localhost:
        app.listen(8080, '127.0.0.1', () => {
            console.timeEnd('App startup time');
            console.log('App listening on http://local.litternetworks.org:8080');
        });

    } catch (error) {
        console.error('Failed to initialize app:', error);
        process.exit(1);
    }
}

startServer();
