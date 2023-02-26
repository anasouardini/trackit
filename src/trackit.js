#!/usr/bin/env node

// const {execSync} = require('child_process');
// execSync('sleep 1');

const net = require('net');

const client = net.Socket();

client.connect(8989);

client.on('data', (data) => {
  const msg = JSON.parse(data);

  if (msg.type == 'err') {
    console.log('err:', msg.data);
  } else if (msg.type == 'data') {
    console.log(msg.data);
  }

  process.exit(0);
});
const data = {
  type: 'cmd',
  action: process.argv[2],
  args: process.argv.slice(3),
};
client.write(JSON.stringify(data));
