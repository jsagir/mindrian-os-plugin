const bc = require('/home/jsagi/dev/MindrianOS-Plugin/lib/core/brain-client.cjs');
const fs = require('fs'), os = require('os'), path = require('path');
(async () => {
  console.log('HOME=' + os.homedir() + ' ~/.mindrian.env exists=' + fs.existsSync(path.join(os.homedir(), '.mindrian.env')) + ' MINDRIAN_BRAIN_KEY set=' + !!process.env.MINDRIAN_BRAIN_KEY + ' brainUrl=' + bc.getBrainUrl());
  console.log('getApiKey()=' + JSON.stringify(bc.getApiKey()));
  console.log('isAvailable()=' + bc.isAvailable());
  const t0 = Date.now();
  const s = await bc.search('jobs to be done');
  console.log('search("jobs to be done") RETURNED=' + JSON.stringify(s) + ' ms=' + (Date.now() - t0));
  const st = await bc.stats();
  console.log('stats() RETURNED=' + JSON.stringify(st).slice(0, 600));
  console.log('getAutoRegisterFailureReason()=' + JSON.stringify(bc.getAutoRegisterFailureReason()));
  console.log('install token file exists=' + fs.existsSync(path.join(os.homedir(), '.mindrian-install.json')));
})().catch(e => { console.log('THROW ' + e.message); });
