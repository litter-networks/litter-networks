const express = require("express");
const router = express.Router();
const { isUserAuthenticated, handleLogin, handleLoginCallback, handleSetRefreshCookie, handleClearStateCookie, handleLogout, handleClearRefreshCookie } = require("../auth");

// 🔄 Login
router.get('/login', handleLogin);

// 🔄 Handle Cognito Callback
router.get('/login-callback', handleLoginCallback);

// 🔄 Handle Cognito Callback
router.get('/login-set-refresh-cookie', handleSetRefreshCookie);

// 🔄 Handle Cognito Callback
router.get('/login-clear-state-cookie', handleClearStateCookie);

// 🔄 Logout
router.get('/logout', handleLogout);

// 🔄 Handle Cognito Callback
router.get('/logout-clear-refresh-cookie', handleClearRefreshCookie);

// 🔒 Protected Route (Example)
router.get('/get-user-info', async (req, res) => {
    if (await isUserAuthenticated(req)) {
        res.json({
            isAuthenticated: true,
            username: req.user["cognito:username"],
            email: req.user.email,
            name: req.user.name
        });
    }
    else {
        res.json({
            isAuthenticated: false
        });
    }
});

module.exports = router;
