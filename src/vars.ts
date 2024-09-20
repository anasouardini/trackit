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

interface Vars {
  appPath: string;
  storeOutput: string;
  logsOutput: string;
}
//@ts-ignore
const vars: Vars = {
  appPath: `${dataPath}/${appName}`,
};
vars.storeOutput = `${vars.appPath}/store.db`;
vars.logsOutput = `${vars.appPath}/logs`;

export default vars;
