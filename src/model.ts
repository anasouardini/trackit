import utils from "./utils";
import dbHandler from "./db";
import { Socket } from "dgram";

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
          data: "db err - initializing db",
        }),
      );
    }
  }

  socket.write(JSON.stringify({ type: "", data: "database re/initialized" }));
};

const getActivities = async (socket, props?) => {
  if (!props.filterProperty || props.selectProperty) {
    const resp = await dbHandler("select * from activities;", []);
    if (resp.err) {
      console.log(resp);
      socket.write(
        JSON.stringify({
          err: true,
          data: "db err - listing activities",
        }),
      );
    }
    if (typeof resp.data == "string") {
      console.log(
        "Err [model.getActivities] -> expected rows/array from db, got a string instead",
      );
      socket.write(
        JSON.stringify({
          err: true,
          data: "server err - listing activities",
        }),
      );
      return;
    }

    const onelineEntries = resp.data.map((itemObj) => {
      let onelineItem: any[] = [];
      Object.values(itemObj).forEach((val) => {
        onelineItem.push(val);
      });
      return onelineItem.join(" | ");
    });

    return socket.write(JSON.stringify({ err: false, data: onelineEntries }));
  }

  let query = `select ${
    props?.selectProperty ?? "*"
  } from activities where title=?`;
  // console.log(props)
  const params = [props.filterProperty];

  const resp = await dbHandler(query, params);
  if (resp.err) {
    console.log(resp);
    socket.write(
      JSON.stringify({
        err: true,
        data: "db err - previewing activity",
      }),
    );
  }

  let respData = resp.data;
  if (respData.length == 0) {
    respData = "activity not found";
  } else if (respData.length == 1) {
    // @ts-ignore
    respData = respData[0];
  }

  // console.log(respData);
  respData = props?.selectProperty ? Object.values(respData)[0] : respData;

  let onelineItem: any[] = [];
  Object.values(respData).forEach((val) => {
    onelineItem.push(val);
  });
  socket.write(JSON.stringify({ err: false, data: onelineItem.join(" | ") }));
};

const getEvents = async (socket, props?) => {
  if (!props.filterProperty || props.selectProperty) {
    const resp = await dbHandler("select * from events;", []);
    if (resp.err) {
      console.log(resp);

      socket.write(
        JSON.stringify({
          err: true,
          data: "db err - listing events",
        }),
      );
      return;
    }

    // @ts-ignore
    const onelineEntries = resp.data.map((itemObj) => {
      let onelineItem: any[] = [];
      Object.values(itemObj).forEach((val) => {
        onelineItem.push(val);
      });
      return onelineItem.join(" | ");
    });

    return socket.write(JSON.stringify({ err: false, data: onelineEntries }));
  }

  let query = `select ${
    props?.selectProperty ?? "*"
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
      }),
    );
  }

  let respData;
  if (resp.data.length == 0) {
    respData = "event not found";
  } else if (resp.data.length == 1) {
    respData = respData[0];
  }

  // console.log(respData);
  respData = props?.selectProperty ? Object.values(respData)[0] : respData;

  // @ts-ignore
  const onelineEntries = resp.data.map((itemObj) => {
    let onelineItem: any[] = [];
    Object.values(itemObj).forEach((val) => {
      onelineItem.push(val);
    });
    return onelineItem.join(" | ");
  });

  socket.write(JSON.stringify({ err: false, data: onelineEntries }));
};

const activityExists = async (activityTitle) => {
  let query = `select * from activities where title=?`;
  const params = [activityTitle];

  const resp = await dbHandler(query, params);
  if (resp.err) {
    console.log(resp);
    // socket.write(
    //   JSON.stringify({
    //     err: true,
    //     data: "db err - checking if activity exists",
    //   })
    // );
  }

  return resp.data.length;
};

const eventExists = async (eventID) => {
  let query = `select * from events where id=?`;
  const params = [eventID];

  const resp = await dbHandler(query, params);
  if (resp.err) {
    console.log(resp);
    // socket.write(
    //   JSON.stringify({
    //     err: true,
    //     data: "db err - checking if activity exists",
    //   })
    // );
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
      }),
    );
  }

  // console.log(props)
  let query = `insert into
                activities(activitID, title, background, icon)
                values(?, ?, ?, ?);
              `;
  const params = [utils.rand.uuid(), props.title, props.background, props.icon];

  const resp = await dbHandler(query, params);
  if (resp.err) {
    // console.log(resp);
    socket.write(
      JSON.stringify({
        err: true,
        data: "db err - creating activity",
      }),
    );
  }

  socket.write(
    JSON.stringify({
      err: false,
      data: `new activity was created:\n${JSON.stringify(props, undefined, 2)}`,
    }),
  );
};

const removeActivity = async (socket, title) => {
  const existResp = await activityExists(title);
  if (!existResp) {
    return socket.write(
      JSON.stringify({
        err: true,
        data: `db err - activity ${title} doesn't exists`,
      }),
    );
  }

  let query = `delete from activities where title=?`;
  const params = [title];
  const resp = await dbHandler(query, params);

  if (resp.err) {
    console.log(resp);
    socket.write(
      JSON.stringify({ err: true, data: "db err - deleting activity" }),
    );
  }
  console.log(resp);

  socket.write(
    JSON.stringify({
      err: false,
      data: `activity ${title} successfully deleted`,
    }),
  );
};

const updateActivity = async (socket, props) => {
  const existResp = await activityExists(props.title);
  if (!existResp) {
    return socket.write(
      JSON.stringify({
        err: true,
        data: `db err - activity ${props.title} doesn't exists`,
      }),
    );
  }

  let query = `update from activities where title=? set`;
  const params = [props.title];
  const resp = await dbHandler(query, params);

  if (resp.err) {
    console.log(resp);
    socket.write(
      JSON.stringify({ err: true, data: "db err - deleting activity" }),
    );
  }
  console.log(resp);

  socket.write(
    JSON.stringify({
      err: false,
      data: `activity ${props.title} successfully deleted`,
    }),
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
    const params = [eventID, activity, utils.getDate(), duration];
    const resp = await dbHandler(query, params);

    if (resp.err) {
      console.log(
        JSON.stringify({ err: true, data: "db err - creating new event" }),
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
        data: "db err - incrementing event duration",
      }),
    );
  }
  // console.log(resp);
};

const getDuration = async (
  activity,
  duration,
): Promise<{ err: boolean; data: string | Record<string, any>[] }> => {
  const existActivityResp = await activityExists(activity);
  if (!existActivityResp) {
    return { err: false, data: "no activity" };
  }

  let query = `select sum(duration) as duration from events where activity=?
              and date >= ?;`;

  const freshDate = new Date();
  const targetDuration = {
    year: freshDate.getFullYear(),
    month: freshDate.getMonth() + 1,
    day: freshDate.getDate(),
  };

  if (duration === "m") {
    targetDuration.day = 1;
  } else if (duration === "y") {
    targetDuration.month = 1;
    targetDuration.day = 1;
  }

  let targetDurationString = `${targetDuration.year}-${targetDuration.month}-${targetDuration.day}`;
  const params = [activity, utils.getDate(targetDurationString)];
  // console.log(query)
  // console.log(query);
  // console.log(targetDurationString);
  const resp = await dbHandler(query, params);
  // console.log(resp.data)

  if (resp.err) {
    return resp;
  }

  if (!resp.data.length) {
    return { err: false, data: "no activity" };
  }

  return {
    err: false,
    // @ts-ignore
    data: utils.secToTime(resp.data[0].duration),
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
    return { err: false, data: "no activity" };
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
  const params = [activity, utils.getDate(today)];
  // console.log(query)
  // console.log(params)
  const resp = await dbHandler(query, params);
  // console.log(resp.data)
  if (!resp.data.length) {
    return { err: false, data: "no activity" };
  }

  return {
    err: false,
    // @ts-ignore
    data: resp.data[0].duration ?? 0,
  };
};

export default {
  dbHandler,
  init,
  getActivities,
  getEvents,
  createActivity,
  removeActivity,
  getDayDuration,
  getDuration,
  incrementDuration,
};
