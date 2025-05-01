const { app, BrowserWindow, session, globalShortcut, ipcMain } = require("electron");

let mainWindow, leAIWindow;
let opacityLevel = 0.5;
let launchUrl = "https://thatoneweirddev.github.io/arch/";
let isHidden = false;

// URL parser unchanged
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
if (startupUrl) launchUrl = parseArchUrl(startupUrl);

// Fade *in* from 0 → targetOpacity
function fadeToOpacity(win, targetOpacity, step = 0.02, interval = 16) {
  let current = 0;
  win.setOpacity(0);
  const fade = setInterval(() => {
    current = Math.min(current + step, targetOpacity);
    win.setOpacity(current);
    if (current >= targetOpacity) clearInterval(fade);
  }, interval);
}

const createMainWindow = () => {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 400,
    x: 20,
    y: 20,
    opacity: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    show: false,              // start hidden
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      webviewTag: true,
      devTools: false,
    },
  });

  const htmlContent = `
    <html><head><style>
      body{margin:0;overflow:hidden;}
      .drag-bar{width:100%;height:30px;background:rgba(0,0,0,0.2);
        -webkit-app-region:drag;position:absolute;top:0;left:0;z-index:9999;}
      webview{position:absolute;top:30px;width:100%;height:calc(100%-30px);border:none;}
    </style></head>
    <body>
      <div class="drag-bar"></div>
      <webview id="webview" src="${launchUrl}" allowpopups disablewebsecurity>
      </webview>
      <script>
        const { ipcRenderer } = require('electron');
        const webview = document.getElementById('webview');
        ipcRenderer.on('navigate', (_, newUrl) => webview.src = newUrl);
        webview.addEventListener('dom-ready', () => {
          webview.insertCSS("::-webkit-scrollbar { display: none; }");
        });
      </script>
    </body></html>
  `;

  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

  // strip frame-busting headers
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ["*://*/*"] },
    (details, callback) => {
      let headers = details.responseHeaders;
      for (let key of Object.keys(headers)) {
        if (key.toLowerCase() === "x-frame-options" ||
            key.toLowerCase() === "content-security-policy") {
          delete headers[key];
        }
      }
      callback({ cancel: false, responseHeaders: headers });
    }
  );

  // when load completes, show + fade
  mainWindow.webContents.once("did-finish-load", () => {
    mainWindow.show();
    mainWindow.webContents.send("navigate", launchUrl);
    fadeToOpacity(mainWindow, opacityLevel);
  });
};

const createLEAIWindow = () => {
  leAIWindow = new BrowserWindow({
    width: 500,
    height: 500,
    x: 60,
    y: 60,
    opacity: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    show: false,               // start hidden
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      devTools: false,
    },
  });

  const leAIHtml = `
    <html><head><style>
      body{margin:0;overflow:hidden;}
      .drag-bar{width:100%;height:30px;background:rgba(0,0,0,0.2);
        -webkit-app-region:drag;position:absolute;top:0;left:0;z-index:9999;}
      iframe{position:absolute;top:30px;width:100%;height:calc(100%-30px);border:none;}
    </style></head>
    <body>
      <div class="drag-bar"></div>
      <iframe src="https://thatoneweirddev.github.io/LE-AI/"
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-modals">
      </iframe>
    </body></html>
  `;

  leAIWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(leAIHtml)}`);

  leAIWindow.webContents.once("did-finish-load", () => {
    leAIWindow.show();
    fadeToOpacity(leAIWindow, opacityLevel);
  });
};

app.setAsDefaultProtocolClient("arch");

app.on("open-url", (e, url) => {
  e.preventDefault();
  const newUrl = parseArchUrl(url);
  if (mainWindow) {
    mainWindow.webContents.send("navigate", newUrl);
  } else {
    launchUrl = newUrl;
  }
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (e, argv) => {
    const argUrl = argv.find(a => a.startsWith("arch://"));
    if (argUrl) {
      const parsed = parseArchUrl(argUrl);
      if (mainWindow) {
        mainWindow.webContents.send("navigate", parsed);
        mainWindow.show();
      } else {
        launchUrl = parsed;
        createMainWindow();
      }
    }
  });

  app.whenReady().then(() => {
    createMainWindow();

    // opacity shortcuts
    globalShortcut.register("CommandOrControl+Option+=", () => {
      opacityLevel = Math.min(opacityLevel + 0.05, 1);
      if (!isHidden) {
        mainWindow?.setOpacity(opacityLevel);
        leAIWindow?.setOpacity(opacityLevel);
      }
    });
    globalShortcut.register("CommandOrControl+Option+-", () => {
      opacityLevel = Math.max(opacityLevel - 0.05, 0.02);
      if (!isHidden) {
        mainWindow?.setOpacity(opacityLevel);
        leAIWindow?.setOpacity(opacityLevel);
      }
    });
    // hide/show on Cmd+H / activate
    globalShortcut.register("Command+H", () => {
      if (!isHidden) {
        mainWindow?.setOpacity(0);
        mainWindow?.setIgnoreMouseEvents(true);
        leAIWindow?.setOpacity(0);
        leAIWindow?.setIgnoreMouseEvents(true);
        isHidden = true;
      }
    });
    app.on("activate", () => {
      if (isHidden) {
        mainWindow?.setOpacity(opacityLevel);
        mainWindow?.setIgnoreMouseEvents(false);
        leAIWindow?.setOpacity(opacityLevel);
        leAIWindow?.setIgnoreMouseEvents(false);
        isHidden = false;
      }
    });
    // LE-AI window on Demand
    globalShortcut.register("CommandOrControl+I", () => {
      if (!leAIWindow) {
        createLEAIWindow();
      } else {
        leAIWindow.show();
      }
    });
    // clean-up
    mainWindow.on("close", () => {
      mainWindow.webContents.executeJavaScript(
        'document.getElementById("webview")?.remove();'
      );
    });
  });

  app.on("will-quit", () => globalShortcut.unregisterAll());
}
