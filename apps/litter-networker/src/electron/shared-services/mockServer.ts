import http from "node:http";

type MockServer = {
  urlBase: string;
  close: () => Promise<void>;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const startMockServer = (port = 3939, latencyMs = 1000): MockServer => {
  const server = http.createServer(async (req, res) => {
    const url = req.url ?? "/";
    const match = url.match(/^\/mock\/([^/?#]+)/);

    if (!match) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }

    const networkId = decodeURIComponent(match[1]);
    await delay(latencyMs);

    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*"
    });

    res.end(`
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Mock Network ${networkId}</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #0b0f1a;
        color: #e5f7ff;
        font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      }
      .card {
        padding: 32px 40px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 20px 60px rgba(0,0,0,0.35);
        text-align: center;
      }
      h1 { margin: 0 0 8px; font-size: 24px; }
      p { margin: 4px 0; color: rgba(255,255,255,0.7); }
      .timer { color: #7ce9ff; font-variant-numeric: tabular-nums; margin-top: 8px; transition: color 0.3s ease; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Mock network: ${networkId}</h1>
      <p>Served locally with a deliberate ${latencyMs}ms delay.</p>
      <p class="timer" id="elapsed-line">Elapsed: <span id="elapsed">0.0</span>s</p>
    </div>
    <script>
      const start = performance.now();
      const el = document.getElementById('elapsed');
      const line = document.getElementById('elapsed-line');
      function tick() {
        const secs = (performance.now() - start) / 1000;
        if (el) {
          el.textContent = secs.toFixed(1);
          if (line) {
            // Yellow for first second, then fade to blue over the next two seconds.
            const t = Math.min(Math.max((secs - 1) / 2, 0), 1); // 0 -> 1 over 1..3s
            const lerp = (a, b, x) => a + (b - a) * x;
            const from = { r: 246, g: 211, b: 45 }; // yellow
            const to = { r: 124, g: 233, b: 255 }; // blue
            const r = Math.round(lerp(from.r, to.r, t));
            const g = Math.round(lerp(from.g, to.g, t));
            const b = Math.round(lerp(from.b, to.b, t));
            line.style.color = "rgb(" + r + "," + g + "," + b + ")";
          }
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    </script>
  </body>
</html>
    `);
  });

  server.listen(port, "127.0.0.1");

  return {
    urlBase: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      })
  };
};
