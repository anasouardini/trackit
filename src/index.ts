#!/bin/env node

import net from "net";
import { spawn, fork } from "child_process";
import path from "path";
import utils from "./utils";

const options = {
  server: {
    port: 8989,
    host: "127.0.0.1",
  },
  retries: {
    count: 20,
    // don't go bellow 2 seconds; give the server time to lunch
    interval: 2000, // in ms
  },
};

const client = new net.Socket();

interface Data {
  serverChildProcess: any;
}
const data: Data = {
  serverChildProcess: null,
};

function startServer() {
  const currentDir = path.dirname(__dirname);
  const serverFilePath = path.join(currentDir, "bin", "server.js");
  console.log(`lunching server from ${serverFilePath}`);
  data.serverChildProcess = fork(serverFilePath, [], {
    detached: true,
    stdio: "ignore", // no need for shell IO when I have sockets
  });
  console.log(`server process' ID: ${data.serverChildProcess.pid}`);
  data.serverChildProcess.disconnect(); // closing IPC channel
  data.serverChildProcess.unref();
}

function stopServer() {
  console.log("stopping server...");
  data.serverChildProcess.kill();
  client.end();
}

function enqueueExit(status: number) {
  setTimeout(() => {
    process.exit(status);
  }, 10);
}

function checkConnection() {
  return new Promise((resolve) => {
    const check = new net.Socket();
    check.connect(options.server.port, options.server.host, () => {
      check.destroy();
      resolve(true);
    });
    check.on("error", () => {
      resolve(false);
    });
  });
}

function connectToServer() {
  client.connect(options.server.port, options.server.host, () => {
    console.log("Connected to server");

    client.on("data", (data: string) => {
      const msg = JSON.parse(data);

      if (msg.err) {
        console.log("err:");
        // process.exit(0);
      }

      console.log(msg.data);

      enqueueExit(0);
    });

    const data = {
      type: "cmd",
      action: process.argv[2],
      args: process.argv.slice(3),
    };

    console.log({ data });
    client.write(JSON.stringify(data));
  });
}

(async () => {
  while (1) {
    console.log("checking connection...");
    const isServerUp = await checkConnection();
    options.retries.count--;

    if (isServerUp || options.retries.count === 0) {
      // server is up
      connectToServer();
      break;
    }

    // server is down
    startServer();
    await utils.sleep(options.retries.interval);
  }
})();
