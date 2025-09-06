{
  "name": "qios-backend",
  "version": "1.0.0",
  "description": "The back office server for the QIOS network",
  "main": "main.js",
  "scripts": {
    "start": "node server.js",
    "electron": "electron .",
    "package": "electron-packager . --platform=win32 --arch=x64 --out=dist/"
  },
  "dependencies": {
    "@google/generative-ai": "^0.11.3",
    "express": "^4.19.2",
    "socket.io": "^4.7.5"
  },
  "devDependencies": {
    "electron": "^31.0.1"
  }
}