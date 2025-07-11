import crypto from "crypto";
import fs from "fs";
import { exec } from "child_process";
import vars from "./vars";

const sleep = (ms: number = 1000) => new Promise((r) => setTimeout(r, ms));

const activityNotify = (activity: string, running: boolean, socket?: any) => {
  const notificationColors = {
    false: { color: "red", text: `${activity} stopped` },
    true: { color: "green", text: `${activity} running` },
  };
  notify(
    activity,
    notificationColors[running.toString()].text,
    notificationColors[running.toString()].color,
    socket,
  );
};

const debug = (message: string) => {
  notify("debug", message, "white");
};

const notify = (title, message, color, socket?) => {
  exec(
    `notify-send "${title}" "${message}" -t 5000`,
    {
      env: {
        ...process.env, // Keep existing environment variables
        DISPLAY: process.env.DISPLAY || ":0", // Ensure DISPLAY is set
      },
    },
    (err, out) => {
      // console.log("running notify (zenity) command", out, err);
      if (err) {
        message += "\nerro notifying";
        log("err", `notification failed. message: ${message}`);
        socket?.write(
          JSON.stringify({
            err: true,
            data: `notification failed. message: ${message}`,
          }),
        );
      }
    },
  );
  return;

  exec(
    `bash $HOME/home/scripts/notify -t "${title}" -m "<span foreground='${color}'><b>${message}</b></span>" -d 5`,
    {
      env: {
        ...process.env, // Keep existing environment variables
        DISPLAY: process.env.DISPLAY || ":0", // Ensure DISPLAY is set
      },
    },
    (err, out) => {
      // console.log("running notify (zenity) command", out, err);
      if (err) {
        message += "\nerro notifying";
        log("err", `notification failed. message: ${message}`);
        socket?.write(
          JSON.stringify({
            err: true,
            data: `notification failed. message: ${message}`,
          }),
        );
      }
    },
  );
  return;

  // exec("export DBUS_SESSION_BUS_ADDRESS=$(dbus-launch --exit-with-session | sed -n 's/^DBUS_SESSION_BUS_ADDRESS=//p')",
  //   (err, out) => {
  //     if (err) {
  //       message += '\nerro exporting vars for dbus session';
  //       tools.log('err', `notification failed. message: ${message}`);
  //     }
  //   }
  // );
  exec(
    // `notify-send -t 3000 '<p style="background:${color}">${message}<p>'`,
    // `notify-send -t 3000 "<span color='#57dafd' font='26px'><i><b>$phrase</b></i></span>" >/dev/null 2>&1`,
    // sometimes the notifications do not show up wihtout this: "dbus-update-activation-environment XDG_SESSION_TYPE; export $(dbus-launch); "
    `notify-send -t 4000 "${
      title ? title : "Activities"
    }" "<span color='${color}' font='19px'><b>${message}</b></span>"`,
    {
      env: {
        ...process.env, // Keep existing environment variables
        DISPLAY: process.env.DISPLAY || ":0", // Ensure DISPLAY is set
        DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS, // Add if necessary
      },
    },
    (err, out) => {
      console.log("running notify command", out, err);
      if (err) {
        message += "\nerro notifying";
        log("err", `notification failed. message: ${message}`);
        socket?.write(
          JSON.stringify({
            err: true,
            data: `notification failed. message: ${message}`,
          }),
        );
      }
    },
  );
};
const rand = {
  uuid: () => {
    // @ts-ignore
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
      (
        c ^
        (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
      ).toString(16),
    );
  },
};
// seconds to time format
const secToTimeStr = (value: string | number) => {
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
  return `${hoursStr}:${minutesStr}:${secondsStr}`;
};

const timeToSec = (value: string) => {
  const chunks = value.split(":");
  const hours = parseInt(chunks[0], 10);
  const minutes = parseInt(chunks[1], 10);
  const seconds = parseInt(chunks[2], 10);

  return hours * 3600 + minutes * 60 + seconds;
};

const getDateObj = (dateStr?: string) => {
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
    h: date.getUTCHours(),
    m: date.getUTCMinutes(),
    s: date.getUTCSeconds(),
  };

  return dateTimeProps;
};

const getDateStr = (dateStr?: string) => {
  const dateTimeProps = getDateObj(dateStr);

  Object.keys(dateTimeProps).forEach((propKey) => {
    let value = dateTimeProps[propKey];
    if (parseInt(value) < 10) {
      dateTimeProps[propKey] = "0" + value.toString();
    }
  });

  return `${dateTimeProps.year}-${dateTimeProps.month}-${dateTimeProps.day} ${dateTimeProps.h}:${dateTimeProps.m}:${dateTimeProps.s}`;
};

const log = (type: "err" | "warn" | "info", message: string) => {
  if (!fs.existsSync(vars.appPath)) {
    fs.mkdirSync(vars.appPath, { recursive: true });
  }

  fs.writeFileSync(vars.logsOutput, `${getDateStr()} | ${type} | ${message}`);
};

interface GenerateCalendarProps {
  start: {
    year: number;
    month: number;
  };
  end: {
    year: number;
    month: number;
  };
}
function generateCalendar({ start, end }: GenerateCalendarProps) {
  type MonthName =
    | "January"
    | "February"
    | "March"
    | "April"
    | "May"
    | "June"
    | "July"
    | "August"
    | "September"
    | "October"
    | "November"
    | "December";
  interface Month {
    duration: number;
    hoursPerDay: number;
    fullDate: string;
    days: {
      hours: number;
      seconds: number;
    }[];
  }
  type Calendar = Record<number, Record<MonthName, Month>>;
  const calendar: Calendar = {};

  let yearCounter = start.year;
  let bellowLastYear = Number(yearCounter) <= Number(end.year);
  for (; ; yearCounter++) {
    bellowLastYear = Number(yearCounter) <= Number(end.year);
    if (!bellowLastYear) {
      break;
    }
    // @ts-ignore
    calendar[yearCounter] = {};
    console.log({
      yearCounter,
      end: end.year,
      condition: Number(yearCounter) <= Number(end.year),
      condition2: bellowLastYear,
      typeofyearcounter: typeof yearCounter,
      typeofyearend: typeof end.year,
    });
    let monthCounter = start.year == yearCounter ? start.month : 1;
    const lastMonth = bellowLastYear ? 12 : end.month;
    for (; monthCounter <= lastMonth; monthCounter++) {
      console.log({ monthCounter, end: end.month });
      let lastDay = new Date(start.year, monthCounter, 0).getDate();
      const monthName: MonthName = new Date(
        start.year,
        monthCounter - 1,
      ).toLocaleString("default", { month: "long" }) as MonthName;

      const currentMonthNumber = new Date().getMonth() + 1;
      if (currentMonthNumber == monthCounter) {
        lastDay = new Date().getDate();
      }

      calendar[yearCounter][monthName] = {
        duration: 0,
        hoursPerDay: 0,
        fullDate: "",
        days: Array.from({ length: lastDay }, (_, i) => ({
          hours: 0,
          seconds: 0,
        })),
      };

      if (currentMonthNumber == monthCounter) {
        break;
      }
    }
  }

  return calendar as Calendar;
}

function getMonthName(monthNumber: number) {
  // Date takes index
  const name = new Date(2000, monthNumber - 1).toLocaleString("default", {
    month: "long",
  });

  return name;
}

export default {
  notify,
  activityNotify,
  rand,
  sleep,
  secToTimeStr,
  timeToSec,
  getDateStr,
  getDateObj,
  log,
  debug,
  generateCalendar,
  getMonthName,
};
