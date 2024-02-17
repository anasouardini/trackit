import net from "net";
import { spawn } from "child_process";
import path from "path";

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

function startTheServer() {
  const currentDir = path.dirname(__dirname);
  const serverPath = `${currentDir}/bin/server.js`;
  console.log(`lunching server from ${serverPath}`);
  const serverChildProcess = spawn("node", ["./bin/server.js"], {
    detached: true,
    stdio: "ignore", // no need for shell IO when I have sockets
  });
  serverChildProcess.unref();
}

function connectToServer() {
  client.connect(options.server.port, options.server.host, () => {
    console.log("Connected to server");

    client.on("data", (data: string) => {
      const msg = JSON.parse(data);

      if (msg.err) {
        console.log("err:");
      }

      console.log(msg.data);

      process.exit(0);
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

client.on("error", (err) => {
  console.log(
    `Error -> could not connect to server on ${options.server.host}:${options.server.port}`,
  );
  if (options.retries.count !== 0) {
    startTheServer();

    setTimeout(connectToServer, options.retries.interval);
    options.retries.count--;
  }
});

connectToServer();
