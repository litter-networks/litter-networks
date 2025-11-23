# litter-networks

## Building the Litter Networker binary for Linux

1. `cd apps/litter-networker && npm install` (if you haven’t already) to populate dependencies.
2. Run `npm run dist` from the same directory. This runs the renderer/electron builds, copies the Python helpers, and then invokes `electron-builder --linux`.
3. The packaged artifacts land under `apps/litter-networker/dist/release`. `electron-builder` emits both an `.AppImage` and a `tar.gz`; the AppImage can be launched directly (`./dist/release/LitterNetworker-<version>.AppImage`) while the tarball contains the unpacked executable that you can move into a path like `/usr/local/bin` or wire into your desktop environment.

You can now treat the resulting AppImage/binary as a standalone application—move it into a global `bin`, drop it on the desktop, or integrate it with your distro’s package manager. The Electron entry point used for the packaged app is `dist/electron/electron/main/main.js`, so anything under `dist/` will be bundled automatically.
