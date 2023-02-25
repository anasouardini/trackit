const sqlite = require('sqlite3').verbose();
const path = require('path');

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
                            activitID varchar(50) primary key,
                            title varchar(50) not null,
                            background varchar(50),
                            icon varchar(50),
                            createDate datetime default current_timestamp
                          );`,
  createEventsTable: `create table events(
                      activitID string,
                      date datetime,
                      duration int,
                      unique(activitID, date),
                      foreign key(activitID) references activities(activitID)
                    );`,
  insertDefaultActivities: `insert into activities (activitID, title, background, icon)
                            values ('8c198bc6-50b5-43df-bc7c-8210055fc573', 'reading', '', ''),
                            ('67a8890f-08aa-4005-b750-7ec0d7daca70', 'projects', '', ''),
                            ('e044226d-7b6b-4244-ae3a-361de5b15ddc', 'dev misc', '', ''),
                            ('453b302c-88a3-474b-a374-c0be9fbdfe32', 'new tech', '', '')
                           ;`,
};

const init = async (socket) => {
  const list = Object.entries(queries);
  for (let i = 0; i < list.length; i++) {
    const resp = await dbHandler(list[i][1], []);
    if (resp.err) {
      console.log(resp);
      socket.write(
        JSON.stringify({ type: 'err', query: list[i][0], data: 'db err' })
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
      JSON.stringify({ type: 'err', query: list[i][0], data: 'db err' })
    );
  }
  socket.write(JSON.stringify({ type: 'data', data: resp.data }));
};

const previewActivity = async (socket, activity = '', property = '*') => {
  let query = `select ${property} from activities where title=?`;
  const params = [activity];

  const resp = await dbHandler(query, params);
  if (resp.err) {
    console.log(resp);
    socket.write(JSON.stringify({ type: 'err', data: 'db err' }));
  }

  let respData = resp.data;
  if (respData.length == 0) {
    respData = 'activity not found';
  } else if (respData.length == 1) {
    respData = respData[0];
  }

  if (property != '*') {
    respData = respData[property];
  }

  socket.write(JSON.stringify({ type: 'data', data: respData }));
};

module.exports = { dbHandler, init, la: listActivities, l: previewActivity };
