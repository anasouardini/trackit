import tools from "./utils";
import model from "./model";
import net from "net";

const timerObj = {
  currentActivity: "",
  durationChache: 0,
  running: false,
  intervalID: setTimeout(() => {}, 0), // for TS's sake
  startDate: Date.now(),
  eventID: "",
  interval: 120000,
  run: async (socket) => {
    if (!timerObj.currentActivity) {
      return;
    }
    timerObj.eventID = tools.rand.uuid();
    timerObj.running = true;
    timerObj.startDate = Date.now();
    const resp = await model.getDayDuration(socket, timerObj.currentActivity);
    timerObj.durationChache = resp.data;

    const incrementDuration = () => {
      // interval is passed as seconds
      const duration = Math.floor((Date.now() - timerObj.startDate) / 1000);
      // console.log(duration);
      // NOTE: there is a tiny gap where the client could get a value older by one interval
      timerObj.startDate = Date.now();
      timerObj.durationChache += duration;
      model.incrementDuration(
        socket,
        timerObj.currentActivity,
        timerObj.eventID,
        duration,
      );
    };

    timerObj.intervalID = setInterval(incrementDuration, timerObj.interval);
  },
  stop: (socket) => {
    model.incrementDuration(
      socket,
      timerObj.currentActivity,
      timerObj.eventID,
      Math.floor((Date.now() - timerObj.startDate) / 1000),
    );
    timerObj.startDate = 0;
    timerObj.durationChache = 0;
    timerObj.running = false;
    clearInterval(timerObj.intervalID);
    timerObj.currentActivity = "";
  },
};

const port = 8989;

// process.on('exit', () => {
//   exec('touch exitting');
// });
process.on("SIGTERM", function onSigterm() {
  // TODO: save timer
  process.exit(0);
});

// process.on('SIGINT', () => {
//   exec('touch siginting');
// });
// process.on('SIGKILL', () => {
//   exec('touch sigkilling');
// });
// process.on('SIGTERM', () => {
//   exec('touch sigterming');
// });

let serverSocket: null | net.Socket = null;

const help = {
  help: "help - list available commands",
  init: "init - initialize database",
  k: "k - kill server",
  la: "la - list activities",
  le: "le - list events",
  ca: "ca - create activity",
  // ra: "ra - remove activity"
  d: [
    "d - get duration of an activity",
    "    d [d, w, m] [activity]",
    "    if no activity provided, running activity will be shown",
  ],
  da: ["d - get duration of all activities", "    d [d, w, m]"],
  v: "v - get status",
  s: "s - toggle timer",
};

const actions = {
  help: () => {
    // console.log(Object.keys(actions).join(' - '))
    if (serverSocket) {
      serverSocket.write(
        JSON.stringify({
          err: false,
          data: Object.values(help).flat().join("\n"),
        }),
      );
    }
  },
  init: (socket) => {
    // todo: init on server startup
    model.init(socket);
  },
  k: () => {
    process.exit(0);
  },
  // list activities
  la: async (socket, request) => {
    if (request.args[0] == "all" || request.args[0] == "a") {
      const resp = await model.getActivities(socket);
      return socket.write(
        JSON.stringify({
          err: false,
          data: resp.data,
        }),
      );
    }

    const resp = await model.getActivities({
      socket,
      filterProperty: request.args[0],
      selectProperty: request.args[1],
    });
    return socket.write(JSON.stringify({ err: false, data: resp.data }));
  },
  // list events
  le: (socket, request) => {
    if (request.args[0] == "all" || request.args[0] == "a") {
      model.getEvents(socket);
    }
    const args = {
      filterProperty: request.args[0],
      selectProperty: request.args[1],
    };
    model.getEvents(socket, args);
  },
  // create activity
  c: (socket, request) => {
    const args = {
      title: request?.args[0] ?? "",
      background: request?.args[1] ?? "",
      icon: request?.args[2] ?? "",
    };
    // todo
    model.createActivity(socket, args);
  },
  // remove activity
  r: (socket, request) => {
    // todo
    // model.r(socket, request.args[0]);
  },
  // get day duration
  w: async (socket, request) => {
    const activity = request?.args[0] || timerObj.currentActivity || undefined;

    let message = "";

    if (activity) {
      // could be undefined or 0
      if (
        !timerObj.running ||
        (request.args[0] && timerObj.currentActivity !== request.args[0])
      ) {
        // console.log('hitting the db', timerObj.durationChache);
        const resp = await model.getDuration({
          socket,
          activity,
          duration: "w",
        });
        // console.log(resp.data)

        message = `${activity}: ${tools.secToTime(resp.data)}`;
      } else if (
        !request.args[0] ||
        timerObj.currentActivity == request.args[0]
      ) {
        // console.log('hitting the cache', timerObj.durationChache);
        const unstoredDuration = timerObj.running
          ? Math.floor((Date.now() - timerObj.startDate) / 1000)
          : 0;
        const duration = unstoredDuration + timerObj.durationChache;
        // console.log(timerObj.durationChache);
        // console.log(duration);
        message = `${activity}: ${tools.secToTime(duration)}`;
      }
    } else {
      message = "no activity was specified or currently running";
    }

    socket.write(JSON.stringify({ err: false, data: message }));
    tools.notify("activity duration", message, "green");
  },
  da: async (socket, request) => {
    // todo: get activities list
    const resp = await model.getActivities({
      socket,
      selectProperty: "title",
    });
    if (resp.err) {
      socket.write(
        JSON.stringify({
          err: true,
          data: "db err - listing activities durations",
        }),
      );
      return;
    }
    const activities = resp.data as Record<string, any>[];

    let message = "";
    for (const activity of activities) {
      const durationResp = await model.getDuration({
        socket,
        activity: activity.title,
        duration: request.args[0] ?? "d",
      });
      console.log({ durationResp });
      message += `${activity.title}: ${durationResp.data}\n`;
    }

    socket.write(JSON.stringify({ err: false, data: message }));
    tools.notify("activities duration", message, "green");
  },
  // get duration of activity
  d: async (socket, request) => {
    const activity = request?.args[0] || timerObj.currentActivity || undefined;

    let message = "";

    if (activity) {
      // could be undefined or 0
      if (
        !timerObj.running ||
        (request.args[0] && timerObj.currentActivity !== request.args[0])
      ) {
        // console.log('hitting the db', timerObj.durationChache);
        const resp = await model.getDuration({
          socket,
          activity: request.args[1],
          duration: request.args[0],
        });
        // console.log(resp.data)

        message = `${activity}: ${tools.secToTime(resp.data)}`;
      } else if (
        !request.args[0] ||
        timerObj.currentActivity == request.args[0]
      ) {
        // console.log('hitting the cache', timerObj.durationChache);
        const unstoredDuration = timerObj.running
          ? Math.floor((Date.now() - timerObj.startDate) / 1000)
          : 0;
        const duration = unstoredDuration + timerObj.durationChache;
        // console.log(timerObj.durationChache);
        // console.log(duration);
        message = `${activity}: ${tools.secToTime(duration)}`;
      }
    } else {
      actions.da(socket, request);
      return;
    }

    socket.write(JSON.stringify({ err: false, data: message }));
    tools.notify("activity duration", message, "green");
  },
  // status of the timer
  v: async (socket, request) => {
    let message = timerObj.running
      ? `${timerObj.currentActivity} - running`
      : "stopped";

    if (request.args[0] == "n") {
      tools.activityNotify(timerObj.currentActivity, timerObj.running);
    }

    socket.write(
      JSON.stringify({
        err: false,
        data: message,
      }),
    );
  },
  // start/stop toggle
  s: (socket, request) => {
    //TODO: store the date after a stop
    const targetActivity = request.args[0];
    if (!targetActivity) {
      return socket.write(
        JSON.stringify({ err: true, data: "no activity was sepcified" }),
      );
    }

    let message = ""; // initialize bcz js sucks

    if (timerObj.running) {
      if (timerObj.currentActivity !== targetActivity) {
        message += `activity ${timerObj.currentActivity} has stoped`;
        // timerObj.currentActivity is set to undefined after timerObj.stop()
        timerObj.stop(socket);

        timerObj.currentActivity = targetActivity;
        timerObj.run(socket);
        message += `\nactivity ${targetActivity} has started`;
      } else {
        message += `activity ${timerObj.currentActivity} has stoped`;
        timerObj.stop(socket);
      }
    } else {
      timerObj.currentActivity = targetActivity;
      timerObj.run(socket);
      message += `activity ${targetActivity} has started`;
    }

    tools.activityNotify(targetActivity, timerObj.running);

    socket.write(
      JSON.stringify({
        err: false,
        data: message,
      }),
    );
  },
};

const server = net.createServer((socket) => {
  serverSocket = socket;

  socket.on("data", (data: string) => {
    console.log("got data");
    const request = JSON.parse(data);

    if (!request.action || !actions?.[request.action]) {
      socket.write(JSON.stringify({ err: true, data: "command not found" }));
      return;
    }
    actions[request.action](socket, request);
  });

  socket.on("end", () => {
    // todo: save();
    // todo: quit();
  });
});

server.listen(port, () => {
  console.log("server is running at port " + port);
  tools.notify("initial msg", "server started", "green");
  // server is running
  // console.log('server is running at port ' + port);
});
