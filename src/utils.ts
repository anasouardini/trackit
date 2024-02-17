import crypto from "crypto";
import fs from "fs";
import { exec } from "child_process";
import vars from "./vars";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const activityNotify = (activity: string, running: boolean) => {
  const notificationColors = {
    false: { color: "red", text: "stopped" },
    true: { color: "green", text: "running" },
  };
  notify(
    activity,
    notificationColors[running.toString()].text,
    notificationColors[running.toString()].color,
  );
};

const notify = (title, message, color) => {
  // exec("export DBUS_SESSION_BUS_ADDRESS=$(dbus-launch --exit-with-session | sed -n 's/^DBUS_SESSION_BUS_ADDRESS=//p')",
  //   (err, out) => {
  //     if (err) {
  //       message += '\nerro exporting vars for dbus session';
  //       tools.log('err', `notification failed. message: ${message}`);
  //     }
  //   }
  // )
  exec(
    // `notify-send -t 3000 '<p style="background:${color}">${message}<p>'`,
    // `notify-send -t 3000 "<span color='#57dafd' font='26px'><i><b>$phrase</b></i></span>" >/dev/null 2>&1`,
    `notify-send -t 4000 "${
      title ? title : "Activities"
    }" "<span color='${color}' font='19px'><b>${message}</b></span>"`,
    (err, out) => {
      if (err) {
        message += "\nerro notifying";
        log("err", `notification failed. message: ${message}`);
      }
    },
  );
};
const rand = {
  uuid: () => {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
      (
        c ^
        (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
      ).toString(16),
    );
  },
};
// seconds to time format
const secToTime = (value: string | number) => {
  var sec_num = parseInt(value.toString(), 10); // don't forget the second param
  const hours = Math.floor(sec_num / 3600);
  const minutes = Math.floor((sec_num - hours * 3600) / 60);
  const seconds = sec_num - hours * 3600 - minutes * 60;

  let hoursStr = hours.toString();
  let minutesStr = minutes.toString();
  let secondsStr = seconds.toString();
  if (hours < 10) {
    hoursStr = "0" + hours;
  }
  if (minutes < 10) {
    minutesStr = "0" + minutes;
  }
  if (seconds < 10) {
    secondsStr = "0" + seconds;
  }
  return `${hoursStr}":"${minutesStr}":"${secondsStr}`;
};

const getDate = (dateStr?: string) => {
  let date: Date;
  if (dateStr) {
    date = new Date(dateStr);
  } else {
    date = new Date();
  }

  const dateTimeProps = {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    h: date.getHours(),
    m: date.getMinutes(),
    s: date.getSeconds(),
  };

  Object.keys(dateTimeProps).forEach((propKey) => {
    let value = dateTimeProps[propKey];
    if (parseInt(value) < 10) {
      dateTimeProps[propKey] = "0" + value.toString();
    }
  });

  return `${dateTimeProps.year}-${dateTimeProps.month}-${dateTimeProps.day} ${dateTimeProps.h}:${dateTimeProps.m}:${dateTimeProps.s}`;
};

const log = (type: "err" | "warn" | "info", message: string) => {
  fs.writeFileSync(vars.logsOutput, `${getDate()} | ${type} | ${message}`);
};

export default { notify, activityNotify, rand, sleep, secToTime, getDate, log };
