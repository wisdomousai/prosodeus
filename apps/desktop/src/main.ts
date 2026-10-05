import { existsSync, mkdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { app, BrowserWindow, ipcMain, net, protocol, shell } from "electron";

// ESM-compatible __dirname (Node sets neither __dirname nor __filename for ESM).
const __dirname = dirname(fileURLToPath(import.meta.url));

import {
  AgentSDKClassifier,
  analyze as analyzePipeline,
  DocumentStore,
  LLMClassifier,
  splitAndHash,
} from "@prosodeus/core/node";
import { ByokStore } from "./byok-store.ts";
import { CfCredentialStore } from "./cf-credential-store.ts";
import { loadDevVars } from "./dev-vars.ts";
import { registerIpcHandlers } from "./ipc.ts";
import { buildModel } from "./model-builder.ts";
import { BetterSqlite3LocalCache, createBetterSqlite3Adapter } from "./sqlite-bs3.ts";

// The built renderer is served from app://renderer so the SPA's absolute asset URLs and
// history-based routes work; file:// would break both.
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function rendererRoot(): string {
  return app.isPackaged
    ? join(__dirname, "..", "renderer")
    : join(__dirname, "..", "..", "app", "dist");
}

function serveRenderer() {
  const root = rendererRoot();
  protocol.handle("app", (request) => {
    const { pathname } = new URL(request.url);
    const requested = join(root, decodeURIComponent(pathname));
    // Stay inside the renderer folder; unknown paths fall back to the SPA shell.
    const file =
      requested.startsWith(root) && existsSync(requested) && statSync(requested).isFile()
        ? requested
        : join(root, "index.html");
    return net.fetch(pathToFileURL(file).toString());
  });
}

// ─── Paths ───────────────────────────────────────────────────────────────────

const PROSODEUS_DIR = join(homedir(), ".prosodeus");
if (!existsSync(PROSODEUS_DIR)) mkdirSync(PROSODEUS_DIR, { recursive: true });

const CLASSIFICATION_CACHE_PATH = join(PROSODEUS_DIR, "cache.sqlite");
const DOCUMENT_STORE_PATH = join(PROSODEUS_DIR, "documents.sqlite");

// ─── App lifecycle ───────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "Prosodeus",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload uses Node modules; sandbox would block them
    },
  });

  // Open external links in the system browser, not in the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  // Pipe renderer console + load failures to the main-process stdout so they
  // show up alongside main-process logs when launching from a terminal.
  mainWindow.webContents.on("console-message", (_e, level, msg, line, src) => {
    const tag = ["log", "warn", "error", "info"][level] ?? "log";
    console.log(`[renderer:${tag}] ${msg}  (${src}:${line})`);
  });
  mainWindow.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.error(`[renderer] did-fail-load ${code} ${desc} ${url}`);
  });
  mainWindow.webContents.on("did-finish-load", () => {
    console.log(`[renderer] did-finish-load — url=${mainWindow?.webContents.getURL()}`);
  });

  // In dev, load the Vite dev server; in prod, load the built bundle.
  const devUrl = process.env.PROSODEUS_DEV_URL;
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    void mainWindow.loadURL("app://renderer/");
  }
}

app.whenReady().then(() => {
  // Wire up local services and IPC before the window opens so the renderer
  // can start querying immediately.
  const documentStore = new DocumentStore(createBetterSqlite3Adapter(DOCUMENT_STORE_PATH));
  const classificationCache = new BetterSqlite3LocalCache(CLASSIFICATION_CACHE_PATH);
  const byokStore = new ByokStore();
  const cfStore = new CfCredentialStore();
  loadDevVars();
  serveRenderer();

  registerIpcHandlers(ipcMain, {
    documentStore,
    classificationCache,
    byokStore,
    cfStore,
    analyzePipeline,
    splitAndHash,
    AgentSDKClassifier,
    LLMClassifier,
    buildModel,
    getMainWindow: () => mainWindow,
  });

  createWindow();

  // Register custom protocol handler for prosodeus://analyze and prosodeus://file
  app.setAsDefaultProtocolClient("prosodeus");

  // macOS: handle URLs opened while app is already running
  app.on("open-url", (event, url) => {
    event.preventDefault();
    handleProsodeusUrl(url, mainWindow);
  });

  // Windows/Linux: handle second-instance launch with protocol URL
  app.on("second-instance", (_event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    const url = commandLine.find((arg) => arg.startsWith("prosodeus://"));
    if (url) handleProsodeusUrl(url, mainWindow);
  });

  app.on("activate", () => {
    // macOS: re-create a window when the dock icon is clicked and no windows exist.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  // Standard cross-platform behavior: quit when last window closes (except macOS).
  if (process.platform !== "darwin") app.quit();
});

// ─── Protocol URL handler ────────────────────────────────────────────────────

function handleProsodeusUrl(url: string, win: BrowserWindow | null) {
  try {
    const u = new URL(url);
    if (u.protocol !== "prosodeus:") return;

    if (u.pathname === "/analyze" || u.hostname === "analyze") {
      const text = u.searchParams.get("text") ?? "";
      const title = u.searchParams.get("title") ?? "Untitled";
      win?.webContents.send("prosodeus:analyze", { text, title });
    } else if (u.pathname === "/file" || u.hostname === "file") {
      const path = u.searchParams.get("path");
      if (path) win?.webContents.send("prosodeus:file", { path });
    }
  } catch {
    // ignore malformed URLs
  }
}
