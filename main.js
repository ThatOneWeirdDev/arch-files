const { app, BrowserWindow, session, globalShortcut } = require('electron');

let myWindow;
let opacityLevel = 0.5; // Start at 50% opacity

// Fix transparency issues on Windows (MUST be before app is ready)
app.disableHardwareAcceleration();

app.whenReady().then(() => {
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
    backgroundColor: '#00000000', // Ensures transparency works properly
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: true,
      enableWebGL: true,
      backgroundThrottling: false,
      offscreen: false,
      enableBlinkFeatures: "WebGL2,Accelerated2dCanvas",
      disableBlinkFeatures: "AutomationControlled",
      webviewTag: true,
      spellcheck: false,
    }
  });

  myWindow.loadURL(`data:text/html;charset=utf-8,
    <html>
      <head>
        <style>
          body { margin: 0; overflow: hidden; }
          .drag-bar {
            width: 100%;
            height: 30px;
            background: rgba(0, 0, 0, 0.2);
            -webkit-app-region: drag;
            -webkit-user-select: none; /* Fix for Windows drag */
            position: absolute;
            top: 0;
            left: 0;
            z-index: 9999;
          }
          .web-content {
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
        <iframe class="web-content" src="https://thatoneweirddev.github.io/arch/" frameborder="0"></iframe>
      </body>
    </html>`);

  // Optimize session handling
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    for (const key of Object.keys(responseHeaders)) {
      if (key.toLowerCase() === 'x-frame-options' || key.toLowerCase() === 'content-security-policy') {
        delete responseHeaders[key];
      }
    }
    callback({ cancel: false, responseHeaders });
  });

  // Boost rendering priority
  myWindow.webContents.setBackgroundThrottling(false);
  myWindow.webContents.setFrameRate(120);

  const adjustOpacity = (increase) => {
    opacityLevel = increase
      ? Math.min(opacityLevel + 0.05, 1)
      : Math.max(opacityLevel - 0.05, 0.02);
    myWindow.setOpacity(opacityLevel);
    console.log(`Opacity: ${opacityLevel}`);
  };

  // Register shortcuts
  globalShortcut.register('CommandOrControl+Option+=', () => adjustOpacity(true));
  globalShortcut.register('Control+Alt+=', () => adjustOpacity(true));
  globalShortcut.register('CommandOrControl+Option+-', () => adjustOpacity(false));
  globalShortcut.register('Control+Alt+-', () => adjustOpacity(false));

  globalShortcut.register('Command+H', () => {
    myWindow.hide();
    console.log("Window hidden (Cmd+H pressed)");
  });

  console.log("Shortcuts registered.");
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
