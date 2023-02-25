// BACKGROUND PROCESSES
// update activity duration, each 1min
// timer/counter

// REQUESTS
// [X] list activities
// [X] list specific activitie details(title, bg, icon, createDate)
// [ ] create activity
// [ ] remove activity
// [ ] update activity
// [ ] start activity
// [ ] stop activity
// [ ] switch activity
// [ ] get activity duration
// [ ] get activity summary(duration, datily, weekly..., )
// [ ] gracefull shutdown

const Model = require('./model.js');

const net = require('net');
const port = 8989;

process.on('SIGTERM', () => {
  // save()
  process.exit(0);
});

let cnxCounter = 0;
const server = net.createServer((socket) => {
  cnxCounter++;

  socket.on('data', (data) => {
    const request = JSON.parse(data);

    if (Model?.[request.action]) {
      Model[request.action](socket, request.arg2, request.arg3);
      return;
    }

    socket.write(JSON.stringify({ type: 'err', data: 'command not found' }));
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
