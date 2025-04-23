const { app, BrowserWindow, session, globalShortcut, ipcMain } = require("electron");

let myWindow;
let leAIWindow = null;
let opacityLevel = 0.5;
let launchUrl = "https://thatoneweirddev.github.io/arch/"; // Default page

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

const createWindow = () => {
  myWindow = new BrowserWindow({
    width: 400,
    height: 400,
    x: 20,
    y: 20,
    opacity: opacityLevel,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      enableWebGL: true,
      backgroundThrottling: false,
      offscreen: false,
      enableBlinkFeatures: "WebGL2,Accelerated2dCanvas",
      disableBlinkFeatures: "AutomationControlled",
      webviewTag: true,
      spellcheck: false,
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

          webview.addEventListener('dom-ready', () => {
            webview.insertCSS("::-webkit-scrollbar { display: none; }");
          });

          ipcRenderer.on('navigate', (_, newUrl) => {
            webview.src = newUrl;
          });
        </script>
      </body>
    </html>
  `;

  myWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ["*://*/*"] },
    async (details, callback) => {
      const responseHeaders = details.responseHeaders;
      Object.keys(responseHeaders).forEach((key) => {
        if (key.toLowerCase() === "x-frame-options" || key.toLowerCase() === "content-security-policy") {
          delete responseHeaders[key];
        }
      });
      callback({ cancel: false, responseHeaders });
    }
  );

  myWindow.webContents.once("did-finish-load", () => {
    myWindow.webContents.send("navigate", launchUrl);
  });
};

app.setAsDefaultProtocolClient("arch");

app.on("open-url", (event, url) => {
  event.preventDefault();
  const newUrl = parseArchUrl(url);
  if (myWindow) {
    myWindow.webContents.send("navigate", newUrl);
  } else {
    launchUrl = newUrl;
  }
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, argv) => {
    const url = argv.find((arg) => arg.startsWith("arch://"));
    if (url) {
      const parsedUrl = parseArchUrl(url);
      if (myWindow) {
        myWindow.webContents.send("navigate", parsedUrl);
        myWindow.show();
      } else {
        launchUrl = parsedUrl;
        createWindow();
      }
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  // Sync opacity for both windows
  globalShortcut.register("CommandOrControl+Option+=", () => {
    opacityLevel = Math.min(opacityLevel + 0.05, 1);
    myWindow.setOpacity(opacityLevel);
    if (leAIWindow) leAIWindow.setOpacity(opacityLevel); // Sync opacity
  });

  globalShortcut.register("CommandOrControl+Option+-", () => {
    opacityLevel = Math.max(opacityLevel - 0.05, 0.02);
    myWindow.setOpacity(opacityLevel);
    if (leAIWindow) leAIWindow.setOpacity(opacityLevel); // Sync opacity
  });

  globalShortcut.register("Command+H", () => {
    if (myWindow) myWindow.hide();
  });

  // LE-AI window
  globalShortcut.register("CommandOrControl+I", () => {
    if (leAIWindow && !leAIWindow.isDestroyed()) {
      leAIWindow.focus();
      return;
    }

    leAIWindow = new BrowserWindow({
      width: 500,
      height: 500,
      x: 60,
      y: 60,
      opacity: opacityLevel, // Start with the same opacity
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      resizable: true,
      webPreferences: {
        nodeIntegration: true,  // Allow JS execution on external websites like `puters.js`
        contextIsolation: false,
        webSecurity: false,
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
          <iframe src="https://thatoneweirddev.github.io/LE-AI/" sandbox="allow-scripts allow-forms allow-same-origin"></iframe>
        </body>
      </html>
    `;

    leAIWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(leAIHtml)}`);
  });

  // LE-AI window opacity control
  globalShortcut.register("CommandOrControl+Shift+Option+=", () => {
    if (leAIWindow && !leAIWindow.isDestroyed()) {
      const curr = leAIWindow.getOpacity();
      leAIWindow.setOpacity(Math.min(curr + 0.05, 1));
    }
  });

  globalShortcut.register("CommandOrControl+Shift+Option+-", () => {
    if (leAIWindow && !leAIWindow.isDestroyed()) {
      const curr = leAIWindow.getOpacity();
      leAIWindow.setOpacity(Math.max(curr - 0.05, 0.02));
    }
  });

  myWindow.on("close", () => {
    myWindow.webContents.executeJavaScript('document.getElementById("webview")?.remove();');
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
