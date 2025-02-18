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
      webSecurity: false, // Allows loading restricted content
      enableWebGL: true,
      backgroundThrottling: false,
      offscreen: false, // Ensures fast rendering on-screen
      enableBlinkFeatures: "WebGL2,Accelerated2dCanvas",
      disableBlinkFeatures: "AutomationControlled",
      webviewTag: true, // Enables WebView support
      spellcheck: false, // Reduces unnecessary processing
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
          src="https://thatoneweirddev.github.io/arch/" 
          allowpopups 
          disablewebsecurity
          webpreferences="javascript=yes, plugins=no">
        </webview>
        <script>
          const webview = document.getElementById('webview');

          webview.addEventListener('dom-ready', () => {
            webview.insertCSS("::-webkit-scrollbar { display: none; }"); // Hide scrollbars
            console.log("WebView Loaded.");
          });

          // Handle new window requests (force links to open in the same webview)
          webview.addEventListener('new-window', (event) => {
            event.preventDefault();
            webview.src = event.url; // Load link inside the same webview
          });

          // Handle navigation within the same webview
          webview.addEventListener('will-navigate', (event) => {
            event.preventDefault();
            webview.src = event.url; // Load link inside the same webview
          });
        </script>
      </body>
    </html>`);

  // Remove CSP and X-Frame-Options
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ["*://*/*"] },
    async (details, callback) => {
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

  // Boost rendering priority
  myWindow.webContents.setBackgroundThrottling(false);
  myWindow.webContents.setFrameRate(120); // High frame rate for smooth rendering

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

  // Register shortcuts for opacity adjustments
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

  myWindow.on('close', () => {
    myWindow.webContents.executeJavaScript('document.getElementById("webview")?.remove();');
    console.log("WebView destroyed to free resources.");
  });

  console.log("Shortcuts registered.");
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
