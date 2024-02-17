import path from "path";

export default {
  storeOutput: path.resolve(require("os").homedir() + "/home/trackit/store.db"),
  logsOutput: path.resolve(require("os").homedir() + "/home/trackit/logs"),
};
