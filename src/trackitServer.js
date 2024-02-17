#!/usr/bin/env node

// TODO:
// [ ] show more info in the widget. e.g current duration and total day duration
// [ ] add a new table for stats; prevent duplicate calculations.
// [X] list activities
// [X] list events of an activity
// [X] list specific activitie details(title, bg, icon, createDate)
// [X] create activity
// [X] remove activity
// [ ] update activity
// [X] start activity
// [X] stop activity
// [ ] get activity summary(duration, datily, weekly..., )
// [X] get widget output
// [ ] gracefull shutdown
// [ ] activities should have IDs
// [X] notifications
// [ ] client should run the server if it's not running
// [ ] save count and reset in-memory counter after midnight.
// [ ] seperate date and time in the events table.

// const sleep = (ms)=>new Promise((r)=>setTimeout(r, ms))

// =================================================  Tools
const crypto = require('crypto');
const fs = require('fs');
const tools = (() => {
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
        title ? title : 'Activities'
      }" "<span color='${color}' font='19px'><b>${message}</b></span>"`,
      (err, out) => {
        if (err) {
          message += '\nerro notifying';
          tools.log('err', `notification failed. message: ${message}`);
        }
      }
    );
  };
  const rand = {
    uuid: () => {
      return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
        (
          c ^
          (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
        ).toString(16)
      );
    },
  };
  // seconds to time format
  const secToTime = (value) => {
    var sec_num = parseInt(value, 10); // don't forget the second param
    var hours = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - hours * 3600) / 60);
    var seconds = sec_num - hours * 3600 - minutes * 60;

    if (hours < 10) {
      hours = '0' + hours;
    }
    if (minutes < 10) {
      minutes = '0' + minutes;
    }
    if (seconds < 10) {
      seconds = '0' + seconds;
    }
    return hours + ':' + minutes + ':' + seconds;
  };

  const getDate = (dateStr) => {
    let date;
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
        dateTimeProps[propKey] = '0' + value.toString();
      }
    });
    return `${dateTimeProps.year}-${dateTimeProps.month}-${dateTimeProps.day} ${dateTimeProps.h}:${dateTimeProps.m}:${dateTimeProps.s}`;
  };

  const log = (type, message) => {
    fs.writeFile('~/home/trackit/logs', `${getDate()} | ${type} | ${message}`);
  };

  return { rand, secToTime, getDate, log, notify };
})();
const path = require('path');

const Vars = {
  storeOutput: path.resolve(require('os').homedir() + '/home/trackit/store.db'),
};

// =================================================  Model
const sqlite = require('sqlite3').verbose();
const Model = (() => {
  fs.access(Vars.storeOutput, fs.F_OK, (err) => {
    if (err) {
      // create the store if it doesn't exist
      fs.open(Vars.storeOutput, 'w');
      return;
    }
  });

  // connect
  const db = new sqlite.Database(
    Vars.storeOutput,
    sqlite.OPEN_READWRITE,
    (err) => {
      if (err) {
        tools.log('err', 'db connection failed');
        console.log(err);
      }
    }
  );

  const dbHandler = (query, param) => {
    return new Promise(function (resolve) {
      db.all(query, param, (err, rows) => {
        if (err) {
          tools.log(
            'err',
            `db query failed - query: ${query}; params: ${param}; err: ${err}.`
          );
          resolve({ err: true, data: err });
        } else {
          resolve({ err: false, data: rows });
        }
      });
    });
  };

  // SQLITE IS STUPIIID
  const queries = {
    dropEvents: `drop table if exists events;`,
    dropActivities: `drop table if exists activities;`,
    createActivitiesTable: `create table activities(
                            title varchar(50) primary key,
                            background varchar(50),
                            icon varchar(50),
                            date datetime default current_timestamp
                          );`,
    createEventsTable: `create table events(
                      id string,
                      activity string ,
                      date datetime default current_timestamp,
                      duration int,
                      unique(activity, date),
                      foreign key(activity) references activities(title) on delete cascade
                    );`,
    insertDefaultActivities: `insert into activities (title, background, icon)
                            values ('reading', '', ''),
                            ('projects', '', ''),
                            ('dev misc', '', ''),
                            ('new tech', '', '')
                           ;`,
  };

  const init = async (socket) => {
    const list = Object.entries(queries);
    for (let i = 0; i < list.length; i++) {
      const resp = await dbHandler(list[i][1], []);
      if (resp.err) {
        console.log(resp);
        socket.write(
          JSON.stringify({
            err: true,
            query: list[i][0],
            data: 'db err - initializing db',
          })
        );
      }
    }

    socket.write(JSON.stringify({ type: '', data: 'database re/initialized' }));
  };

  const getActivities = async (socket, props) => {
    if (!props.filterProperty || props.selectProperty) {
      const resp = await dbHandler('select * from activities;', []);
      if (resp.err) {
        console.log(resp);
        socket.write(
          JSON.stringify({
            err: true,
            data: 'db err - listig activities',
          })
        );
      }

      const onelineEntries = resp.data.map((itemObj) => {
        let onelineItem = [];
        Object.values(itemObj).forEach((val) => {
          onelineItem.push(val);
        });
        return onelineItem.join('|');
      });

      return socket.write(JSON.stringify({ err: false, data: onelineEntries }));
    }

    let query = `select ${
      props?.selectProperty ?? '*'
    } from activities where title=?`;
    // console.log(props)
    const params = [props.filterProperty];

    const resp = await dbHandler(query, params);
    if (resp.err) {
      console.log(resp);
      socket.write(
        JSON.stringify({
          err: true,
          data: 'db err - previewing activity',
        })
      );
    }

    let respData = resp.data;
    if (respData.length == 0) {
      respData = 'activity not found';
    } else if (respData.length == 1) {
      respData = respData[0];
    }

    // console.log(respData);
    respData = props?.selectProperty ? Object.values(respData)[0] : respData;

    let onelineItem = [];
    Object.values(respData).forEach((val) => {
      onelineItem.push(val);
    });
    socket.write(JSON.stringify({ err: false, data: onelineItem.join('|') }));
  };

  const getEvents = async (socket, props) => {
    if (!props.filterProperty || props.selectProperty) {
      const resp = await dbHandler('select * from events;', []);
      if (resp.err) {
        console.log(resp);

        socket.write(
          JSON.stringify({
            err: true,
            data: 'db err - listing events',
          })
        );
      }

      const onelineEntries = resp.data.map((itemObj) => {
        let onelineItem = [];
        Object.values(itemObj).forEach((val) => {
          onelineItem.push(val);
        });
        return onelineItem.join('|');
      });

      return socket.write(JSON.stringify({ err: false, data: onelineEntries }));
    }

    let query = `select ${
      props?.selectProperty ?? '*'
    } from events where activity=?`;
    // console.log(props)
    const params = [props.filterProperty];

    const resp = await dbHandler(query, params);
    if (resp.err) {
      console.log(resp);
      socket.write(
        JSON.stringify({
          err: true,
          data: `db err - previewing event ${props.filterProperty}'`,
        })
      );
    }

    let respData = resp.data;
    if (respData.length == 0) {
      respData = 'event not found';
    } else if (respData.length == 1) {
      respData = respData[0];
    }

    // console.log(respData);
    respData = props?.selectProperty ? Object.values(respData)[0] : respData;

    const onelineEntries = resp.data.map((itemObj) => {
      let onelineItem = [];
      Object.values(itemObj).forEach((val) => {
        onelineItem.push(val);
      });
      return onelineItem.join('|');
    });

    socket.write(JSON.stringify({ err: false, data: onelineEntries }));
  };

  const activityExists = async (activityTitle) => {
    let query = `select * from activities where title=?`;
    const params = [activityTitle];

    const resp = await dbHandler(query, params);
    if (resp.err) {
      console.log(resp);
      socket.write(
        JSON.stringify({
          err: true,
          data: 'db err - checking if activity exists',
        })
      );
    }

    return resp.data.length;
  };

  const eventExists = async (eventID) => {
    let query = `select * from events where id=?`;
    const params = [eventID];

    const resp = await dbHandler(query, params);
    if (resp.err) {
      console.log(resp);
      socket.write(
        JSON.stringify({
          err: true,
          data: 'db err - checking if activity exists',
        })
      );
    }

    return resp.data.length;
  };

  const createActivity = async (socket, props) => {
    const existResp = await activityExists(props.title);
    if (existResp) {
      return socket.write(
        JSON.stringify({
          err: true,
          data: `db err - activity ${props.title} already exists`,
        })
      );
    }

    // console.log(props)
    let query = `insert into
                activities(activitID, title, background, icon)
                values(?, ?, ?, ?);
              `;
    const params = [
      tools.rand.uuid(),
      props.title,
      props.background,
      props.icon,
    ];

    const resp = await dbHandler(query, params);
    if (resp.err) {
      // console.log(resp);
      socket.write(
        JSON.stringify({
          err: true,
          data: 'db err - creating activity',
        })
      );
    }

    socket.write(
      JSON.stringify({
        err: false,
        data: `new activity was created:\n${JSON.stringify(
          props,
          undefined,
          2
        )}`,
      })
    );
  };

  const removeActivity = async (socket, title) => {
    const existResp = await activityExists(title);
    if (!existResp) {
      return socket.write(
        JSON.stringify({
          err: true,
          data: `db err - activity ${title} doesn't exists`,
        })
      );
    }

    let query = `delete from activities where title=?`;
    const params = [title];
    const resp = await dbHandler(query, params);

    if (resp.err) {
      console.log(resp);
      socket.write(
        JSON.stringify({ err: true, data: 'db err - deleting activity' })
      );
    }
    console.log(resp);

    socket.write(
      JSON.stringify({
        err: false,
        data: `activity ${title} successfully deleted`,
      })
    );
  };

  const updateActivity = async (socket, props) => {
    const existResp = await activityExists(props.title);
    if (!existResp) {
      return socket.write(
        JSON.stringify({
          err: true,
          data: `db err - activity ${props.title} doesn't exists`,
        })
      );
    }

    let query = `update from activities where title=? set`;
    const params = [props.title];
    const resp = await dbHandler(query, params);

    if (resp.err) {
      console.log(resp);
      socket.write(
        JSON.stringify({ err: true, data: 'db err - deleting activity' })
      );
    }
    console.log(resp);

    socket.write(
      JSON.stringify({
        err: false,
        data: `activity ${props.title} successfully deleted`,
      })
    );
  };

  const incrementDuration = async (_, activity, eventID, duration) => {
    const existActivityResp = await activityExists(activity);
    // TODO: stop timer after an error
    // TODO: can't show error in the widget, use notifications
    if (!existActivityResp) {
      console.log({
        err: true,
        data: `db err - activity ${activity} doesn't exists`,
      });
      return;
    }

    const existEventResp = await eventExists(eventID);
    if (!existEventResp) {
      // create new event
      let query = `insert into events(id, activity, date, duration)
                values(?, ?, ?, ?)`;
      // js dates are ughhh
      const params = [eventID, activity, tools.getDate(), duration];
      const resp = await dbHandler(query, params);

      if (resp.err) {
        console.log(
          JSON.stringify({ err: true, data: 'db err - creating new event' })
        );
      }

      return;
    }

    let query = `update events set duration=duration+? where id=?;`;
    const params = [duration, eventID];
    const resp = await dbHandler(query, params);

    if (resp.err) {
      console.log(
        JSON.stringify({
          err: true,
          data: 'db err - incrementing event duration',
        })
      );
    }
    // console.log(resp);
  };

  const getDuration = async (activity, duration) => {
    const existActivityResp = await activityExists(activity);
    if (!existActivityResp) {
      return { err: false, data: 'no activity' };
    }

    let query = `select sum(duration) as duration from events where activity=?
              and date >= ?;`;

    const freshDate = new Date();
    const targetDuration = {
      year: freshDate.getFullYear(),
      month: freshDate.getMonth() + 1,
      day: freshDate.getDate(),
    };

    if (duration === 'm') {
      targetDuration.day = 1;
    } else if (duration === 'y') {
      targetDuration.month = 1;
      targetDuration.day = 1;
    }

    let targetDurationString = `${targetDuration.year}-${targetDuration.month}-${targetDuration.day}`;
    const params = [activity, tools.getDate(targetDurationString)];
    // console.log(query)
    // console.log(query);
    // console.log(targetDurationString);
    const resp = await dbHandler(query, params);
    // console.log(resp.data)

    if (resp.err) {
      return resp;
    }

    if (!resp.data.length) {
      return { err: false, data: 'no activity' };
    }

    return {
      err: false,
      data: tools.secToTime(resp.data[0].duration),
    };
  };

  const getDayDuration = async (_, activity) => {
    // was fixing date format in db
    // {
    //   let datesList;
    //   let query = `select date from events;`;
    //   const resp = await dbHandler(query);
    //   datesList = resp.data.map((event) => event.date);
    //   console.log(datesList);
    //
    //   datesList.forEach((dateProp) => {
    //     let query2 = `update events set date=? where date=?;`;
    //     dbHandler(query2, [tools.getDate(dateProp), dateProp]);
    //   });
    // }

    const existActivityResp = await activityExists(activity);
    if (!existActivityResp) {
      return { err: false, data: 'no activity' };
    }

    let query = `select sum(duration) as duration from events where activity=?
              and date >= ?;`;

    const today = ((d) => {
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const date = d.getDate();
      return `${year}-${month}-${date} 00:00:00`;
    })(new Date());
    // const tomorrow = ((d) => {
    //   const year = d.getFullYear();
    //   const month = d.getMonth() + 1;
    //   const date = d.getDate();
    //   return `${year}-${month}-${date + 1} 00:00:00`;
    // })(new Date());
    const params = [activity, tools.getDate(today)];
    // console.log(query)
    // console.log(params)
    const resp = await dbHandler(query, params);
    // console.log(resp.data)
    if (!resp.data.length) {
      return { err: false, data: 'no activity' };
    }

    return {
      err: false,
      data: resp.data[0].duration ?? 0,
    };
  };

  return {
    dbHandler,
    init,
    getActivities,
    getEvents,
    createActivity,
    removeActivity,
    getDayDuration,
    getDuration,
    incrementDuration,
    getDayDuration,
  };
})();

// =================================================  Server
const net = require('net');
const { exec } = require('child_process');

const timerObj = {
  currentActivity: '',
  durationChache: 0,
  running: false,
  intervalID: '',
  startDate: Date.now(),
  eventID: '',
  interval: 120000,
  run: async (socket) => {
    if (!timerObj.currentActivity) {
      return;
    }
    timerObj.eventID = tools.rand.uuid();
    timerObj.running = true;
    timerObj.startDate = Date.now();
    const resp = await Model.getDayDuration(socket, timerObj.currentActivity);
    timerObj.durationChache = resp.data;

    const incrementDuration = () => {
      // interval is passed as seconds
      const duration = Math.floor((Date.now() - timerObj.startDate) / 1000);
      // console.log(duration);
      // NOTE: there is a tiny gap where the client could get a value older by one interval
      timerObj.startDate = Date.now();
      timerObj.durationChache += duration;
      Model.incrementDuration(
        socket,
        timerObj.currentActivity,
        timerObj.eventID,
        duration
      );
    };

    timerObj.intervalID = setInterval(incrementDuration, timerObj.interval);
  },
  stop: (socket) => {
    Model.incrementDuration(
      socket,
      timerObj.currentActivity,
      timerObj.eventID,
      Math.floor((Date.now() - timerObj.startDate) / 1000)
    );
    timerObj.startDate = 0;
    timerObj.durationChache = 0;
    timerObj.running = false;
    clearInterval(timerObj.intervalID);
    timerObj.currentActivity = '';
  },
};

const port = 8989;

// process.on('exit', () => {
//   exec('touch exitting');
// });
process.on('SIGTERM', function onSigterm() {
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
    Model.init(socket);
  },
  k: ()=>{
    process.exit(0);
  },
  la: (socket, request) => {
    if (request.args[0] == 'all' || request.args[0] == 'a') {
      Model.getActivities(socket);
    }
    const args = {
      filterProperty: request.args[0],
      selectProperty: request.args[1],
    };
    Model.getActivities(socket, args);
  },
  le: (socket, request) => {
    if (request.args[0] == 'all' || request.args[0] == 'a') {
      Model.getEvents(socket);
    }
    const args = {
      filterProperty: request.args[0],
      selectProperty: request.args[1],
    };
    Model.getEvents(socket, args);
  },
  c: (socket, request) => {
    const args = {
      title: request?.args[0] ?? '',
      background: request?.args[1] ?? '',
      icon: request?.args[2] ?? '',
    };
    Model.c(socket, args);
  },
  r: (socket, request) => {
    Model.r(socket, request.args[0]);
  },
  w: async (socket, request) => {
    const activity = request?.args[0] || timerObj.currentActivity || undefined;

    let message = '';

    if (activity) {
      // could be undefined or 0
      if (
        !timerObj.running ||
        (request.args[0] && timerObj.currentActivity !== request.args[0])
      ) {
        // console.log('hitting the db', timerObj.durationChache);
        const resp = await Model.getDayDuration(socket, activity);
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
      message = 'no activity\nno activity was specified or currently running';
    }

    socket.write(JSON.stringify({ err: false, data: message }));
  },
  d: async (socket, request) => {
    const resp = await Model.getDuration(request.args[0], request.args[1]);

    socket.write(
      JSON.stringify({
        err: false,
        data: resp.data,
      })
    );
  },
  v: async (socket, request) => {
    let message = timerObj.running
      ? `${timerObj.currentActivity} - running`
      : 'stopped';

    if (request.args[0] == 'n') {
      const notificationColors = {
        false: { color: 'red', text: 'stopped' },
        true: { color: 'green', text: 'running' },
      };
      tools.notify(
        timerObj.currentActivity,
        notificationColors[timerObj.running].text,
        notificationColors[timerObj.running].color
      );

      return socket.write(
        JSON.stringify({
          err: false,
          data: '',
        })
      );
    }

    socket.write(
      JSON.stringify({
        err: false,
        data: message,
      })
    );
  },
  s: (socket, request) => {
    //TODO: store the date after a stop
    const targetActivity = request.args[0];
    if (!targetActivity) {
      return socket.write(
        JSON.stringify({ err: true, data: 'no activity was sepcified' })
      );
    }

    let message = ''; // initialize bcz js sucks

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

    const notificationColors = {
      false: { color: 'red', text: 'stopped' },
      true: { color: 'green', text: 'running' },
    };
    tools.notify(
      targetActivity,
      notificationColors[timerObj.running].text,
      notificationColors[timerObj.running].color
    );

    socket.write(
      JSON.stringify({
        err: false,
        data: message,
      })
    );
  },
};

let cnxCounter = 0;
const server = net.createServer((socket) => {
  cnxCounter++;

  socket.on('data', (data) => {
    const request = JSON.parse(data);

    if (!request.action || !actions?.[request.action]) {
      socket.write(JSON.stringify({ err: true, data: 'command not found' }));
      return;
    }
    actions[request.action](socket, request);
  });

  socket.on('end', () => {
    cnxCounter--;
    if (cnxCounter == 0) {
      // save()
    }
  });
});

server.listen(port, () => {
  // server is running
  // console.log('server is running at port ' + port);
});
