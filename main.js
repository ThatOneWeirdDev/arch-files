const { app, BrowserWindow, session, globalShortcut } = require('electron');

let myWindow;
let opacityLevel = 0.5; // Start at 50% opacity

const parseArchUrl = (archUrl) => {
  try {
    return archUrl.replace(/^arch:\/\//, "https://");
  } catch {
    return "https://thatoneweirddev.github.io/arch/";
  }
};

const createWindow = (targetUrl) => {
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
    }
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
          src="${targetUrl}" 
          allowpopups 
          disablewebsecurity
          webpreferences="javascript=yes, plugins=no">
        </webview>
        <script>
          const webview = document.getElementById('webview');

          webview.addEventListener('dom-ready', () => {
            webview.insertCSS("::-webkit-scrollbar { display: none; }");
            console.log("WebView Loaded.");
          });

          webview.addEventListener('new-window', (event) => {
            event.preventDefault();
            webview.src = event.url;
          });

          webview.addEventListener('will-navigate', (event) => {
            event.preventDefault();
            webview.src = event.url;
          });

          webview.addEventListener('dom-ready', () => {
            webview.executeJavaScript(\`
              window.open = (url) => {
                location.href = url;
              };
            \`);
          });

          require('electron').ipcRenderer.on('navigate', (_, newUrl) => {
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
      Object.keys(responseHeaders).forEach(key => {
        if (key.toLowerCase() === 'x-frame-options' || key.toLowerCase() === 'content-security-policy') {
          delete responseHeaders[key];
        }
      });
      callback({ cancel: false, responseHeaders });
    }
  );
};

// Register `arch://` as a custom protocol
const protocolName = "arch";
if (!app.isDefaultProtocolClient(protocolName)) {
  app.setAsDefaultProtocolClient(protocolName);
}

app.whenReady().then(() => {
  // Check if the app was started with an `arch://` link
  const launchUrl = process.argv.find(arg => arg.startsWith("arch://"));
  createWindow(parseArchUrl(launchUrl) || "https://thatoneweirddev.github.io/arch/");

  app.on("open-url", (event, url) => {
    event.preventDefault();
    const newUrl = parseArchUrl(url);
    if (myWindow) {
      myWindow.webContents.send("navigate", newUrl);
    }
  });

  globalShortcut.register("CommandOrControl+Option+=", () => {
    opacityLevel = Math.min(opacityLevel + 0.05, 1);
    myWindow.setOpacity(opacityLevel);
  });

  globalShortcut.register("CommandOrControl+Option+-", () => {
    opacityLevel = Math.max(opacityLevel - 0.05, 0.02);
    myWindow.setOpacity(opacityLevel);
  });

  globalShortcut.register("Command+H", () => {
    if (myWindow) myWindow.hide();
  });

  myWindow.on("close", () => {
    myWindow.webContents.executeJavaScript('document.getElementById("webview")?.remove();');
  });
});

// Handle second-instance URLs
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, argv) => {
    const url = argv.find(arg => arg.startsWith("arch://"));
    if (url && myWindow) {
      const parsedUrl = parseArchUrl(url);
      myWindow.webContents.send("navigate", parsedUrl);
    }
  });
}

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
