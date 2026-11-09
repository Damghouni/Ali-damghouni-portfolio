import "dotenv/config";
import { createServer } from "http";
import { createApp } from "../app";
import { closeDatabase, initializeDatabase } from "../mongo/connection";
import { serveStatic, setupVite } from "./vite";

async function startServer() {
  await initializeDatabase();
  const app = createApp();
  const server = createServer(app);
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid PORT");
  server.on("error", error => {
    console.error("Server failed:", error.message);
    process.exit(1);
  });
  server.listen(port, "0.0.0.0", () =>
    console.log(`Server listening on port ${port}`)
  );
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    server.close();
    await closeDatabase();
    process.exit(0);
  };
  process.once("SIGINT", () => {
    void shutdown();
  });
  process.once("SIGTERM", () => {
    void shutdown();
  });
}

startServer().catch(() => {
  console.error("Server startup failed. Check runtime configuration.");
  process.exit(1);
});
