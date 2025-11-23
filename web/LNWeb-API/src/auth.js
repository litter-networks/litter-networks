const { Issuer } = require("openid-client");
const jwt = require("jsonwebtoken");
const jwkToPem = require("jwk-to-pem");
const axios = require("axios");
const { generators } = require("openid-client");
require("dotenv").config();
const crypto = require("crypto");
const { DynamoDBClient, PutItemCommand, GetItemCommand, DeleteItemCommand } = require("@aws-sdk/client-dynamodb");

// ✅ Initialize the DynamoDB Client (Make sure to use the correct region)
const ddbClient = new DynamoDBClient({ region: "eu-west-2" });

const isAWS = process.platform === "linux";
const thisDomainName = isAWS ? "aws.litternetworks.org" : "local.litternetworks.org";

const COGNITO_DOMAIN = `https://auth.litternetworks.org`;
const REDIRECT_URI = `https://${thisDomainName}/api/user/login-callback`;
const CLIENT_ID = "5mod2fr810uic05sac0ps10u2f";
const USER_POOL_ID = "eu-west-2_yDrerFef4";
const REGION = "eu-west-2";

let clientInstance = null;
let cachedSigningKeys = null;
const secureCookies = true;

async function getParameterFromStore(parameterName) {
    const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
    const ssmClient = new SSMClient({ region: "eu-west-2" });

    try {
        const command = new GetParameterCommand({ Name: parameterName, WithDecryption: true });
        const response = await ssmClient.send(command);
        return response.Parameter.Value;
    } catch (error) {
        console.error("Failed to load session secret from Parameter Store:", error);
        throw error;
    }
}

// 🔄 Initialize OpenID Client
async function initializeAuth() {
    if (clientInstance) return clientInstance;

    try {
        console.log("🔄 Discovering Cognito OpenID configuration...");
        const issuer = await Issuer.discover(`https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`);
        const CLIENT_SECRET = await getParameterFromStore("/LNWeb-API/OPENID_CLIENT_SECRET");

        clientInstance = new issuer.Client({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uris: [REDIRECT_URI],
            response_types: ["code"],
        });

        console.log("✅ OpenID client initialized.");
    } catch (err) {
        console.error("❌ OpenID client initialization failed:", err);
        throw err;
    }

    return clientInstance;
}

// 🔄 Fetch Cognito Public Keys for JWT Verification
async function fetchCognitoSigningKeys() {
    if (!cachedSigningKeys) {
        const url = `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`;
        const response = await axios.get(url);
        cachedSigningKeys = response.data.keys;
    }
    return cachedSigningKeys;
}

// 🔄 Refresh Token Function
async function refreshCognitoSession(refreshToken) {
    try {
        const response = await axios.post(
            `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}/oauth2/token`,
            new URLSearchParams({
                grant_type: "refresh_token",
                client_id: CLIENT_ID,
                refresh_token: refreshToken
            }),
            {
                headers: { "Content-Type": "application/x-www-form-urlencoded" }
            }
        );
        return response.data; // New tokens
    } catch (error) {
        console.error("❌ Failed to refresh Cognito session:", error.response?.data || error.message);
        return null; // Indicate failure
    }
}

async function isUserAuthenticated(req) {
    let idToken = req.cookies?.lnweb_auth_data;
    const refreshToken = req.cookies?.lnweb_refresh;

    if (!idToken) return false;

    const decodedToken = jwt.decode(idToken, { complete: true });
    if (!decodedToken) return false;

    // 🕒 Check if token has expired
    if (decodedToken.payload.exp * 1000 < Date.now()) {
        console.log("🔄 Token expired, attempting refresh...");

        if (!refreshToken) {
            return false;
        }

        const newTokens = await refreshCognitoSession(refreshToken);
        if (!newTokens) {
            return false;
        }

        // ✅ Successfully refreshed, update idToken for further verification
        idToken = newTokens.id_token;
        console.log("✅ Token refreshed successfully.");
    }

    try {
        const signingKeys = await fetchCognitoSigningKeys();
        const matchingKey = signingKeys.find(key => key.kid === decodedToken.header.kid);
        if (!matchingKey) return false;

        const publicKey = jwkToPem(matchingKey);

        // ✅ Properly handle `jwt.verify` with `await`
        const decoded = await new Promise((resolve, reject) => {
            jwt.verify(idToken, publicKey, {
                algorithms: ["RS256"],
                issuer: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`,
                audience: CLIENT_ID,
            }, (err, decoded) => {
                if (err) reject(err);
                else resolve(decoded);
            });
        });

        req.user = decoded; // Attach user info
        return true;

    } catch (error) {
        console.error("JWT verification error:", error);
        return false;
    }
}

async function validateAuthToken(req, res, next) {
    if (await isUserAuthenticated(req)) {
        return next(); // Proceed to next middleware/route
    }
    res.status(401).json({ isAuthenticated: false, error: "Access Denied" });
}

// 🔄 Business Logic Functions
async function handleLogin(req, res) {
    const client = await initializeAuth();
    if (!client) return res.status(500).send("Authentication service unavailable.");

    const state = generators.state();
    const nonce = generators.nonce();

    const authUrl = client.authorizationUrl({
        scope: 'email openid phone profile',
        state,
        nonce,
    });

    res.cookie("lnweb_auth_state", JSON.stringify({ state, nonce }), { httpOnly: true, secure: secureCookies, sameSite: "Strict" });
    res.redirect(authUrl);
}

async function handleLoginCallback(req, res) {
    const client = await initializeAuth();
    const params = client.callbackParams(req);

    // Retrieve state and nonce from cookie
    const authStateCookie = req.cookies?.lnweb_auth_state;
    if (!authStateCookie) {
        return res.status(400).json({ error: "Missing auth state cookie" });
    }
    const { state, nonce } = JSON.parse(authStateCookie);

    // Pass the checks object to validate the state (and nonce)
    const tokenSet = await client.callback(REDIRECT_URI, params, { state, nonce });

    res.cookie("lnweb_auth_data", tokenSet.id_token, { httpOnly: true, secure: secureCookies, sameSite: "Strict" });

    // 🔥 Generate a secure hash of the ID token
    const idTokenHash = crypto.createHash("sha256").update(tokenSet.id_token).digest("hex");

    // ✅ Store refresh token in DynamoDB (using ID token hash as key)
    await ddbClient.send(new PutItemCommand({
        TableName: "LNWeb-TempTokens",
        Item: {
            sessionId: { S: idTokenHash },
            refreshToken: { S: tokenSet.refresh_token },
            expiresAt: { N: `${Math.floor(Date.now() / 1000) + 600}` } // Auto-delete in 10 minutes
        }
    }));

    // ✅ Redirect (no sessionId in the URL)
    res.redirect("/api/user/login-set-refresh-cookie");
}

async function handleSetRefreshCookie(req, res) {
    try {
        const idToken = req.cookies?.lnweb_auth_data;
        if (!idToken) {
            return res.status(400).json({ error: "No valid ID token found." });
        }

        // 🔥 Compute the same hash of the ID token
        const idTokenHash = crypto.createHash("sha256").update(idToken).digest("hex");

        // ✅ Retrieve the refresh token from DynamoDB
        const result = await ddbClient.send(new GetItemCommand({
            TableName: "LNWeb-TempTokens",
            Key: { sessionId: { S: idTokenHash } }
        }));

        if (!result.Item || !result.Item.refreshToken) {
            return res.status(400).json({ error: "No valid refresh token found." });
        }

        const refreshToken = result.Item.refreshToken.S;

        // ✅ Delete the token from DynamoDB (ensuring one-time usage)
        await ddbClient.send(new DeleteItemCommand({
            TableName: "LNWeb-TempTokens",
            Key: { sessionId: { S: idTokenHash } }
        }));

        // ✅ Set the refresh token now
        res.cookie("lnweb_refresh", refreshToken, {
            httpOnly: true, secure: secureCookies, sameSite: "Strict", path: "/"
        });

        // ✅ Redirect to home/dashboard after both cookies are set
        res.redirect("/api/user/login-clear-state-cookie");

    } catch (error) {
        console.error("Failed to obtain a new refresh token:", error);
        res.status(500).json({ error: "Failed to obtain a new refresh token." });
    }
}

function handleClearStateCookie(req, res) {
    res.clearCookie("lnweb_auth_state", { httpOnly: true, secure: secureCookies, sameSite: "Strict", path: "/" });

    // ✅ Redirect to set login cookie after clearing state
    res.redirect("/");
}


function handleLogout(req, res) {
    res.clearCookie("lnweb_auth_data", { httpOnly: true, secure: secureCookies, sameSite: "Strict" });

    res.redirect("/api/user/logout-clear-refresh-cookie");
}

function handleClearRefreshCookie(req, res) {
    res.clearCookie("lnweb_refresh", { httpOnly: true, secure: secureCookies, sameSite: "Strict", path: "/" });

    // ✅ Redirect to AWS Cognito Logout URL
    res.redirect(`${COGNITO_DOMAIN}/logout?client_id=${CLIENT_ID}&logout_uri=https://${thisDomainName}`);
}

module.exports = {
    initializeAuth,
    isUserAuthenticated,
    validateAuthToken,
    handleLogin,
    handleLoginCallback,
    handleSetRefreshCookie,
    handleClearStateCookie,
    handleLogout,
    handleClearRefreshCookie,
    thisDomainName
};
