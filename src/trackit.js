// const {execSync} = require('child_process');
// execSync('sleep 1');

const net = require('net');

const client = net.Socket();

client.connect(8989);

client.on('data', (data) => {
  const msg = JSON.parse(data);

  if (msg.type == 'err') {
    console.log('err:', msg.data);
  } else if (msg.type == 'data'){
    console.log(msg.data);
  }

  process.exit(0);
});

client.write(JSON.stringify({ type: 'cmd', action: process.argv[2], arg2: process.argv?.[3], arg3: process.argv?.[4] }));
