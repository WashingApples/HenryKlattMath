import { cp, mkdir } from "node:fs/promises";

const root = new URL("../", import.meta.url);
await mkdir(new URL("public/vendor/", root), { recursive: true });
await cp(new URL("node_modules/chess.js/dist/esm/chess.js", root), new URL("public/vendor/chess.js", root));
await cp(new URL("node_modules/chess.js/LICENSE", root), new URL("public/vendor/chess-LICENSE.txt", root));
