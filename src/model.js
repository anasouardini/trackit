const sqlite = require('sqlite3').verbose();
const path = require('path');
const { v4: uuid } = require('uuid');

// connect
const db = new sqlite.Database(
  path.resolve(__dirname, 'store.db'),
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
                      id string unique,
                      activit string,
                      date datetime default current_timestamp,
                      duration int,
                      foreign key(activit) references activities(title) on delete cascade
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
          type: 'err',
          query: list[i][0],
          data: 'db err - initializing db',
        })
      );
    }
  }

  socket.write(JSON.stringify({ type: '' }));
};

const listActivities = async (socket) => {
  const resp = await dbHandler('select * from activities;', []);
  if (resp.err) {
    console.log(resp);
    socket.write(
      JSON.stringify({ type: 'err', data: 'db err - listig activities' })
    );
  }

  socket.write(JSON.stringify({ type: 'data', data: resp.data }));
};

const previewActivity = async (socket, props) => {
  let query = `select ${
    props?.selectProperty ?? '*'
  } from activities where title=?`;
  // console.log(props)
  const params = [props.filterProperty];

  const resp = await dbHandler(query, params);
  if (resp.err) {
    console.log(resp);
    socket.write(
      JSON.stringify({ type: 'err', data: 'db err - previewing activity' })
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

  socket.write(JSON.stringify({ type: 'data', data: respData }));
};

const activityExists = async (activityTitle) => {
  let query = `select * from activities where title=?`;
  const params = [activityTitle];

  const resp = await dbHandler(query, params);
  if (resp.err) {
    console.log(resp);
    socket.write(
      JSON.stringify({
        type: 'err',
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
        type: 'err',
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
        type: 'err',
        data: `db err - activity ${props.title} already exists`,
      })
    );
  }

  // console.log(props)
  let query = `insert into
                activities(activitID, title, background, icon)
                values(?, ?, ?, ?);
              `;
  const params = [uuid(), props.title, props.background, props.icon];

  const resp = await dbHandler(query, params);
  if (resp.err) {
    // console.log(resp);
    socket.write(
      JSON.stringify({ type: 'err', data: 'db err - creating activity' })
    );
  }

  socket.write(
    JSON.stringify({
      type: 'data',
      data: `new activity was created:\n${JSON.stringify(props, undefined, 2)}`,
    })
  );
};

const removeActivity = async (socket, title) => {
  const existResp = await activityExists(title);
  if (!existResp) {
    return socket.write(
      JSON.stringify({
        type: 'err',
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
      JSON.stringify({ type: 'err', data: 'db err - deleting activity' })
    );
  }
  console.log(resp);

  socket.write(
    JSON.stringify({
      type: 'data',
      data: `activity ${title} successfully deleted`,
    })
  );
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
sleep(33);

const updateActivity = async (socket, props) => {
  const existResp = await activityExists(props.title);
  if (!existResp) {
    return socket.write(
      JSON.stringify({
        type: 'err',
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
      JSON.stringify({ type: 'err', data: 'db err - deleting activity' })
    );
  }
  console.log(resp);

  socket.write(
    JSON.stringify({
      type: 'data',
      data: `activity ${props.title} successfully deleted`,
    })
  );
};

const incrementDuration = async (activity, eventID, duration) => {
  // TODO: communicate with the parent
  const existActivityResp = await activityExists(activity);
  if (!existActivityResp) {
    // socket.write(
    //   JSON.stringify({
    //     type: 'err',
    //     data: `db err - activity ${activity} doesn't exists`,
    //   })
    // );
    return;
  }

  const existEventResp = await eventExists(eventID);
  if (!existEventResp) {
    // create new event
    let query = `insert into events(id, activit, duration)
                values(?, ?, ?)`;
    const params = [eventID, activity, duration];
    const resp = await dbHandler(query, params);

    if (resp.err) {
      // console.log(resp);
      // socket.write(
      //   JSON.stringify({ type: 'err', data: 'db err - creating new event' })
      // );
    }

    return;
  }

  let query = `update events set duration=? where id=?;`;
  const params = [duration, eventID];
  const resp = await dbHandler(query, params);

  // if (resp.err) {
  //   console.log(resp);
  //   socket.write(
  //     JSON.stringify({ type: 'err', data: 'db err - incrementing event duration' })
  //   );
  // }
  // // console.log(resp);
  //
  // socket.write(
  //   JSON.stringify({
  //     type: 'data',
  //     data: `activity ${activity} successfully deleted`,
  //   })
  // );
};

module.exports = {
  dbHandler,
  init,
  la: listActivities,
  l: previewActivity,
  c: createActivity,
  r: removeActivity,
  incrementDuration,
};
