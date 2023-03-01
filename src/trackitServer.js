#!/usr/bin/env node
//
// BACKGROUND PROCESSES
// update activity duration, each 1min
// timer/counter

// REQUESTS
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

// (async()=>{((ms)=>new Promise((r)=>setTimeout(r, ms)))(3000);})()
// console.log('sdfklj')

// const {Worker} = require('worker_threads');

// =================================================  Tools
const crypto = require('crypto');
const tools = (() => {
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

  return { rand, secToTime };
})();
const path = require('path');

const Vars = {
  storeOutput: path.resolve(require('os').homedir() + '/home/trackit/store.db'),
};

// =================================================  Model
const fs = require('fs');
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
        console.log(err);
      }
    }
  );

  const dbHandler = (query, param) => {
    return new Promise(function (resolve) {
      db.all(query, param, (err, rows) => {
        if (err) resolve({ err: true, data: err });
        else resolve({ err: false, data: rows });
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
    // TODO: errors need to be signaled to the timer to stop
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
      const accDate = ((d) => {
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const date = d.getDate();
        const h = d.getHours();
        const m = d.getMinutes();
        const s = d.getSeconds();
        return `${year}-${month}-${date} ${h}:${m}:${s}`;
      })(new Date());

      // console.log(accDate);
      const params = [eventID, activity, accDate, duration];
      const resp = await dbHandler(query, params);

      if (resp.err) {
        console.log(
          JSON.stringify({ err: true, data: 'db err - creating new event' })
        );
      }

      return;
    }

    let query = `update events set duration=? where id=?;`;
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

  const getDayDuration = async (socket, activity) => {
    const existActivityResp = await activityExists(activity);
    if (!existActivityResp) {
      return { err: false, data: 'no activity' };
    }

    let query = `select sum(duration) as duration from events where activity=?
              and date >= ? and date < ?;`;
    const today = ((d) => {
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const date = d.getDate();
      return `${year}-${month}-${date} 00:00:00`;
    })(new Date());
    const tomorrow = ((d) => {
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const date = d.getDate();
      return `${year}-${month}-${date + 1} 00:00:00`;
    })(new Date());
    const params = [activity, today, tomorrow];
    // console.log(params)
    const resp = await dbHandler(query, params);
    if (!resp.data.length) {
      return { err: false, data: 'no activity' };
    }

    // console.log(resp.data)
    return {
      err: false,
      data: `${activity} : ${tools.secToTime(resp.data[0].duration)}`,
    };
  };

  return {
    dbHandler,
    init,
    getActivities,
    getEvents,
    c: createActivity,
    r: removeActivity,
    getDayDuration,
    incrementDuration,
    getDayDuration,
  };
})();

// =================================================  Server
const net = require('net');
const { exec } = require('child_process');

const timerObj = {
  currentActivity: '',
  running: false,
  intervalID: '',
  run: (socket) => {
    const state = {
      start: Date.now(),
      eventID: tools.rand.uuid(),
      interval: 3000,
    };

    if (!timerObj.currentActivity) {
      return;
    }
    timerObj.running = true;

    const incrementDuration = () => {
      // interval is passed as seconds
      const duration = Math.floor((Date.now() - state.start) / 1000);
      // console.log(duration);
      Model.incrementDuration(
        socket,
        timerObj.currentActivity,
        state.eventID,
        duration
      );
    };

    timerObj.intervalID = setInterval(incrementDuration, state.interval);
  },
  stop: () => {
    timerObj.running = false;
    clearInterval(timerObj.intervalID);
  },
};

const port = 8989;

process.on('SIGTERM', () => {
  exec('touch shuttingdowwwww');
  // save()
  process.exit(0);
});

const actions = {
  init: (socket) => {
    Model.init(socket);
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
    if (timerObj.currentActivity || request?.args[0]) {
      const resp = await Model.getDayDuration(
        socket,
        request?.args[0] ?? timerObj.currentActivity
      );
      return socket.write(JSON.stringify(resp));
    }
    socket.write(JSON.stringify({ err: false, data: 'no activity\nno activity was specified or currently running' }));
  },
  c: async (socket) => {
    // console.log(timerObj.running)
    socket.write(
      JSON.stringify({
        err: false,
        data: timerObj.running
          ? `${timerObj.currentActivity} - running`
          : 'stoped',
      })
    );
  },
  s: (socket, request) => {
    const currentActivity = request.args[0];
    if (!currentActivity) {
      return socket.write(
        JSON.stringify({ err: true, data: 'no activity was sepcified' })
      );
    }

    let message = ''; // initialize bcz js sucks
    if (timerObj.running) {
      timerObj.stop();
      timerObj.running = false;
      message += `activity ${timerObj.currentActivity} has stoped`;

      if (timerObj.currentActivity != currentActivity) {
        timerObj.currentActivity = currentActivity;
        timerObj.run(socket);
        message += `\nactivity ${currentActivity} has started`;
      } else {
        timerObj.currentActivity = '';
      }
    } else {
      timerObj.currentActivity = currentActivity;
      timerObj.run(socket);
      message += `activity ${currentActivity} has started`;
    }

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

    if (!actions?.[request.action]) {
      socket.write(JSON.stringify({ err: true, data: 'command not found' }));
    }
    // console.log('action: ',request.action)
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
