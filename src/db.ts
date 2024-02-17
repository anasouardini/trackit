const sqlite = require("sqlite3").verbose();
import vars from "./vars";
import utils from "./utils";
import fs from "fs";

fs.access(vars.storeOutput, fs.constants.F_OK, (err) => {
  if (err) {
    // File doesn't exist, so create it
    fs.writeFile(vars.storeOutput, "Hello, world!", (err) => {
      if (err) {
        console.error("Error creating file:", err);
      } else {
        console.log("File created successfully.");
      }
    });
  } else {
    console.log("File already exists.");
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
