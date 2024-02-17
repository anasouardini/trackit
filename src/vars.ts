import path from "path";
import os from "os";

let dataPath;

if (process.platform === "win32") {
  // For Windows
  dataPath = path.join(os.homedir(), "AppData", "Local");
} else if (process.platform === "darwin") {
  // For macOS
  dataPath = path.join(os.homedir(), "Library", "Application Support");
} else {
  // For Linux and other Unix-like systems
  dataPath = path.join(os.homedir(), ".local", "share");
}

const appName = "trackit";

export default {
  storeOutput: `${dataPath}/${appName}/store.db`,
  logsOutput: `${dataPath}/${appName}/logs`,
};
