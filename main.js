const { app, BrowserWindow, session, globalShortcut, ipcMain } = require("electron");

let mainWindow, leAIWindow;
let opacityLevel = 1.0; // Target full opacity
let launchUrl = "https://thatoneweirddev.github.io/arch/";
let isHidden = false;

// Parse custom arch:// protocol
const parseArchUrl = (archUrl) => {
  if (!archUrl) return launchUrl;
  let url = archUrl.replace(/^arch:\/\//, "").trim();
  if (/^https?:\/\//.test(url) || url.includes(".")) {
    return `https://${url.replace(/^https?:\/\//, "")}`;
  } else {
    return `https://www.google.com/search?q=${encodeURIComponent(url)}`;
  }
};

let startupUrl = process.argv.find(arg => arg.startsWith("arch://"));
if (startupUrl) {
  launchUrl = parseArchUrl(startupUrl);
}

// Fading helper function - fixed to start from 0 and fade to target
function fadeToOpacity(win, targetOpacity = 1.0, step = 0.05, interval = 10) {
  let current = 0.0;
  win.setOpacity(current);
  win.show();

  const fade = setInterval(() => {
    current = Math.min(current + step, targetOpacity);
    win.setOpacity(current);
    if (current >= targetOpacity) {
      clearInterval(fade);
    }
  }, interval);
}

// Create main app window
const createMainWindow = () => {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 400,
    x: 20,
    y: 20,
    opacity: 0, // Start completely transparent
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    show: false, // Don't show until fade starts
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      webviewTag: true,
      devTools: false
    },
  });

  const htmlContent = `
    <html>
      <head>
        <style>
          body { margin: 0; overflow: hidden; }
          .drag-bar {
            width: 100%;
            height: 30px;
            background: rgba(0, 0, 0, 0.2);
            -webkit-app-region: drag;
            position: absolute;
            top: 0;
            left: 0;
            z-index: 9999;
          }
          webview {
            position: absolute;
            top: 30px;
            width: 100%;
            height: calc(100% - 30px);
            border: none;
          }
        </style>
      </head>
      <body>
        <div class="drag-bar"></div>
        <webview 
          id="webview"
          src="${launchUrl}" 
          allowpopups 
          disablewebsecurity
          webpreferences="javascript=yes, plugins=no">
        </webview>
        <script>
          const { ipcRenderer } = require('electron');
          const webview = document.getElementById('webview');
          ipcRenderer.on('navigate', (_, newUrl) => { webview.src = newUrl; });
          webview.addEventListener('dom-ready', () => {
            webview.insertCSS("::-webkit-scrollbar { display: none; }");
            ipcRenderer.send('webview-ready');
          });
        </script>
      </body>
    </html>
  `;

  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

  session.defaultSession.webRequest.onHeadersReceived({ urls: ["*://*/*"] }, (details, callback) => {
    const headers = details.responseHeaders;
    for (const key in headers) {
      const lower = key.toLowerCase();
      if (lower === "x-frame-options" || lower === "content-security-policy") {
        delete headers[key];
      }
    }
    callback({ cancel: false, responseHeaders: headers });
  });

  ipcMain.once("webview-ready", () => {
    fadeToOpacity(mainWindow, opacityLevel);
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.webContents.send("navigate", launchUrl);
  });
};

// Create LE-AI window
const createLEAIWindow = () => {
  leAIWindow = new BrowserWindow({
    width: 500,
    height: 500,
    x: 60,
    y: 60,
    opacity: 0, // Start completely transparent
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    show: false, // Don't show until fade starts
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      devTools: false
    },
  });

  const leAIHtml = `
    <html>
      <head>
        <style>
          body { margin: 0; overflow: hidden; }
          .drag-bar {
            width: 100%;
            height: 30px;
            background: rgba(0, 0, 0, 0.2);
            -webkit-app-region: drag;
            position: absolute;
            top: 0;
            left: 0;
            z-index: 9999;
          }
          iframe {
            position: absolute;
            top: 30px;
            width: 100%;
            height: calc(100% - 30px);
            border: none;
          }
        </style>
      </head>
      <body>
        <div class="drag-bar"></div>
        <iframe src="https://thatoneweirddev.github.io/LE-AI/" sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-modals"></iframe>
      </body>
    </html>
  `;

  leAIWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(leAIHtml)}`);

  leAIWindow.once("ready-to-show", () => {
    fadeToOpacity(leAIWindow, opacityLevel);
  });
};

app.setAsDefaultProtocolClient("arch");

app.on("open-url", (event, url) => {
  event.preventDefault();
  const newUrl = parseArchUrl(url);
  if (mainWindow) {
    mainWindow.webContents.send("navigate", newUrl);
  } else {
    launchUrl = newUrl;
  }
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (event, argv) => {
    const url = argv.find(arg => arg.startsWith("arch://"));
    if (url) {
      const parsedUrl = parseArchUrl(url);
      if (mainWindow) {
        mainWindow.webContents.send("navigate", parsedUrl);
        if (isHidden) {
          mainWindow.setOpacity(opacityLevel);
          mainWindow.setIgnoreMouseEvents(false);
          isHidden = false;
        }
        mainWindow.show();
      } else {
        launchUrl = parsedUrl;
        createMainWindow();
      }
    }
  });
}

app.whenReady().then(() => {
  createMainWindow();

  globalShortcut.register("CommandOrControl+Option+=", () => {
    opacityLevel = Math.min(opacityLevel + 0.05, 1);
    if (!isHidden) {
      if (mainWindow) mainWindow.setOpacity(opacityLevel);
      if (leAIWindow) leAIWindow.setOpacity(opacityLevel);
    }
  });

  globalShortcut.register("CommandOrControl+Option+-", () => {
    opacityLevel = Math.max(opacityLevel - 0.05, 0.02);
    if (!isHidden) {
      if (mainWindow) mainWindow.setOpacity(opacityLevel);
      if (leAIWindow) leAIWindow.setOpacity(opacityLevel);
    }
  });

  globalShortcut.register("Command+H", () => {
    if (!isHidden) {
      if (mainWindow) {
        mainWindow.setOpacity(0);
        mainWindow.setIgnoreMouseEvents(true);
      }
      if (leAIWindow) {
        leAIWindow.setOpacity(0);
        leAIWindow.setIgnoreMouseEvents(true);
      }
      isHidden = true;
    }
  });

  app.on("activate", () => {
    if (isHidden) {
      if (mainWindow) {
        mainWindow.setOpacity(opacityLevel);
        mainWindow.setIgnoreMouseEvents(false);
      }
      if (leAIWindow) {
        leAIWindow.setOpacity(opacityLevel);
        leAIWindow.setIgnoreMouseEvents(false);
      }
      isHidden = false;
    }
  });

  globalShortcut.register("CommandOrControl+I", () => {
    if (!leAIWindow) {
      createLEAIWindow();
    } else {
      if (isHidden) {
        leAIWindow.setOpacity(opacityLevel);
        leAIWindow.setIgnoreMouseEvents(false);
        isHidden = false;
      }
      leAIWindow.show();
    }
  });

  mainWindow?.on("close", () => {
    mainWindow.webContents.executeJavaScript('document.getElementById("webview")?.remove();');
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
