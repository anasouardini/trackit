const sqlite = require("sqlite3").verbose();
import vars from "./vars";
import utils from "./utils";
import fs from "fs";

fs.access(vars.storeOutput, fs.F_OK, (err) => {
  if (err) {
    // create the store if it doesn't exist
    fs.open(vars.storeOutput, "w");
    return;
  }
});

// connect
const db = new sqlite.Database(
  vars.storeOutput,
  sqlite.OPEN_READWRITE,
  (err) => {
    if (err) {
      utils.log("err", "db connection failed");
      console.log(err);
    }
  },
);

const dbHandler = (
  query,
  param,
): Promise<{ err: boolean; data: string | Record<string, any>[] }> => {
  const promise = new Promise(function (resolve) {
    db.all(query, param, (err, rows) => {
      if (err) {
        utils.log(
          "err",
          `db query failed - query: ${query}; params: ${param}; err: ${err}.`,
        );
        resolve({ err: true, data: err });
      } else {
        resolve({ err: false, data: rows });
      }
    });
  });
  return promise as Promise<{ err: boolean; data: string }>;
};

export default dbHandler;
