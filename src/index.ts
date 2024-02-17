import net from "net";

const client = new net.Socket();

client.connect(8989);

client.on("data", (data: string) => {
  const msg = JSON.parse(data);

  if (msg.err) {
    // return console.log('err:', msg.data);
    return console.log("err");
  }

  console.log(msg.data);

  process.exit(0);
});
const data = {
  type: "cmd",
  action: process.argv[2],
  args: process.argv.slice(3),
};
client.write(JSON.stringify(data));
