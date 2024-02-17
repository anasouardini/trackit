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

const actions = {
  init: (socket) => {
    model.init(socket);
  },
  k: () => {
    process.exit(0);
  },
  la: (socket, request) => {
    if (request.args[0] == "all" || request.args[0] == "a") {
      model.getActivities(socket);
    }
    const args = {
      filterProperty: request.args[0],
      selectProperty: request.args[1],
    };
    model.getActivities(socket, args);
  },
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
  c: (socket, request) => {
    const args = {
      title: request?.args[0] ?? "",
      background: request?.args[1] ?? "",
      icon: request?.args[2] ?? "",
    };
    // todo
    // model.c(socket, args);
  },
  r: (socket, request) => {
    // todo
    // model.r(socket, request.args[0]);
  },
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
        const resp = await model.getDayDuration(socket, activity);
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
      message = "no activity\nno activity was specified or currently running";
    }

    socket.write(JSON.stringify({ err: false, data: message }));
  },
  d: async (socket, request) => {
    const resp = await model.getDuration(request.args[0], request.args[1]);

    socket.write(
      JSON.stringify({
        err: false,
        data: resp.data,
      }),
    );
  },
  v: async (socket, request) => {
    let message = timerObj.running
      ? `${timerObj.currentActivity} - running`
      : "stopped";

    if (request.args[0] == "n") {
      tools.activityNotify(timerObj.currentActivity, timerObj.running);

      return socket.write(
        JSON.stringify({
          err: false,
          data: "",
        }),
      );
    }

    socket.write(
      JSON.stringify({
        err: false,
        data: message,
      }),
    );
  },
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
  socket.on("data", (data: string) => {
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
  // server is running
  // console.log('server is running at port ' + port);
});
