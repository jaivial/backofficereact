// Keep Bun event loop alive (avoids exit after top-level async completion)
import "./server/index.ts";
setInterval(() => {}, 86400000);
