const home = process.env.MINDRIAN_ROOMS_HOME;
const ro = require('/home/jsagi/dev/MindrianOS-Plugin/lib/core/room-open.cjs');
const r = ro.openRoom({ room: 'a', home });
console.log('RETURNED_OBJECT=' + JSON.stringify(r));
console.log('keys=' + Object.keys(r).join(','));
console.log('stderr_present_in_payload=' + /Traceback|AttributeError|datetime/.test(JSON.stringify(r)));
