/** Allow CLI scripts to import Next `server-only` modules under Node. */
/* eslint-disable @typescript-eslint/no-require-imports */
const Module = require("node:module");
const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "server-only") {
    return {};
  }
  return originalLoad(request, parent, isMain);
};
