const { app, BrowserWindow, session, globalShortcut } = require('electron');
let myWindow;
let opacityLevel = 0.5; // Start at 50% opacity

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
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: true,
      enableWebGL: true,
      backgroundThrottling: false
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

  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ["*://*/*"] },
    (details, callback) => {
      const responseHeaders = details.responseHeaders;
      Object.keys(responseHeaders).forEach(key => {
        if (key.toLowerCase() === 'x-frame-options' ||
            key.toLowerCase() === 'content-security-policy') {
          delete responseHeaders[key];
        }
      });
      callback({ cancel: false, responseHeaders });
    }
  );

  const increaseOpacity = () => {
    opacityLevel = Math.min(opacityLevel + 0.05, 1);
    myWindow.setOpacity(opacityLevel);
    console.log(`Increased opacity: ${opacityLevel}`);
  };

  const decreaseOpacity = () => {
    opacityLevel = Math.max(opacityLevel - 0.05, 0.02);
    myWindow.setOpacity(opacityLevel);
    console.log(`Decreased opacity: ${opacityLevel}`);
  };

  // Register shortcuts for both Command+Option and Control+Alt
  ['CommandOrControl+Option+=', 'Control+Alt+='].forEach(shortcut =>
    globalShortcut.register(shortcut, increaseOpacity)
  );

  ['CommandOrControl+Option+-', 'Control+Alt+-'].forEach(shortcut =>
    globalShortcut.register(shortcut, decreaseOpacity)
  );

  globalShortcut.register('Command+H', () => {
    if (myWindow) {
      myWindow.hide();
      console.log("Window hidden (Cmd+H pressed)");
    }
  });

  console.log("Shortcuts registered.");
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
