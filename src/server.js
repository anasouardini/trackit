// BACKGROUND PROCESSES
// update activity duration, each 1min
// timer/counter

// REQUESTS
// [X] list activities
// [X] list specific activitie details(title, bg, icon, createDate)
// [X] create activity
// [X] remove activity
// [ ] update activity
// [X] start activity
// [X] stop activity
// [ ] get activity preview(props, stats)
// [ ] get activity summary(duration, datily, weekly..., )
// [ ] get widget output
// [ ] gracefull shutdown

// (async()=>{((ms)=>new Promise((r)=>setTimeout(r, ms)))(3000);})()
// console.log('sdfklj')

// const {Worker} = require('worker_threads');
const Model = require('./model.js');
const net = require('net');
const {exec} = require('child_process');

const rand = {
  uuidv4: ()=>{
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
  }
}


const timerObj = {
  currentActivity: '',
  running: false,
  intervalID: '',
  run: () => {
    const state = {
      start: Date.now(),
      eventID: rand.uuid(),
      interval: 3000,
    };

    if (!timerObj.currentActivity) {
      return;
    }
    timerObj.running = true;

    const incrementDuration = () => {
      // interval is passed as seconds
      const duration = Math.floor((Date.now() - state.start) / 1000);
      Model.incrementDuration(timerObj.currentActivity, state.eventID, duration);
    };

    timerObj.intervalID = setInterval(incrementDuration, state.interval);
  },
  stop: () => {
    timerObj.running = false;
    clearInterval(timerObj.intervalID)
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
  la: (socket) => {
    Model.la(socket);
  },
  l: (socket, request) => {
    const args = {
      filterProperty: request.args[0],
      selectProperty: request.args[1],
    };
    Model.l(socket, args);
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
  s: (socket, request) => {
    const currentActivity = request.args[0];
    if (!currentActivity) {
      return socket.write(
        JSON.stringify({ type: 'err', data: 'no activity was sepcified' })
      );
    }

    let message = ''; // initialize bcz js sucks
    if (timerObj.running) {
      timerObj.stop();
      timerObj.running = false;
      message += `activity ${timerObj.currentActivity} has stoped`;

      if (timerObj.currentActivity != currentActivity) {
        timerObj.currentActivity = currentActivity;
        timerObj.run();
        message += `\nactivity ${currentActivity} has started`;
      }
    } else {
      timerObj.currentActivity = currentActivity;
      timerObj.run();
      message += `activity ${currentActivity} has started`;
    }

    socket.write(
      JSON.stringify({
        type: 'data',
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
      socket.write(JSON.stringify({ type: 'err', data: 'command not found' }));
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
