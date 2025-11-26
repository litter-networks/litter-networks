// CloudFront Function that turns top-level SPA routes (anything without a "."
// extension and not ending in "/") into /index.html so the React app can
// handle client-side routing. Static assets (/assets/*.js, /api/*, etc.)
// bypass this rewrite.
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (!uri.includes('.') && (uri === '/' || !uri.endsWith('/'))) {
    request.uri = '/index.html';
  }

  return request;
}
