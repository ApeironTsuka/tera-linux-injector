const { snapshot } = require('process-list'), { execSync } = require('child_process');

let initialized = false, listedProcesses = {};

// Mostly the same as tera-client-interface/process-listener.js's ProcessListener
function watch(name, onAdd, onRemove, interval = 500) {
  let ucName = name.toUpperCase(), regex = new RegExp(`\\b${name}\\b`, 'i');
  snapshot('pid', 'name', 'cmdline').then(processes => {
    let newProcesses = {};
    for (let process of processes) {
      if (process.name.toLowerCase() != 'wine-preloader') { continue; }
      if ((regex.test(process.cmdline))) {
        process.name = name;
        if (!listedProcesses[process.pid]) { if (onAdd) { onAdd(process); } }
        newProcesses[process.pid] = true;
      }
    }
    for (let pid in listedProcesses) {
      if (!newProcesses[pid]) {
        if (onRemove) { onRemove(pid); }
      }
    }
    listedProcesses = newProcesses;
  })
  .catch((e) => { return true; }) // process-list will occasionally throw a harmless error to ignore
  .then(() => setTimeout(() => watch(name, onAdd, onRemove, interval), interval));
}

function processAdded(proc) {
  let wineProcList = execSync('winedbg --command "info process"').toString(),
      lines = wineProcList.split(/\n/),
      injectorPath = `${process.cwd()}/node_modules/tera-client-interface`,
      regex = new RegExp(proc.name),
      pid;
  for (line of lines) {
    if (!regex.test(line)) { continue; }
    pid = parseInt(line.replace(/^\s*([0-9a-f]*) .*/, '$1').replace(/^0x/, ''), 16);
    break;
  }
  try {
    execSync(`wine "${injectorPath}/injector.exe" "${pid}" "${injectorPath}/tera-client-interface.dll"`);
  } catch (e) {
    console.log(`[proxy] ERROR: Unable to connect to game client (PID ${process.pid}, Wine PID ${pid})!`);
    switch (e.code) {
      case 'ENOENT':
        console.log("[proxy] injector.exe does not exist.");
        break;
      default:
        switch (e.status) {
          case 1:
            console.log("[proxy] Connection to game client unsuccessful.");
            break;
          default:
            console.log("[proxy] Full error message:");
            console.log(e);
            break;
        }
        break;
    }
  }
}

module.exports = function LinuxInjector() {
  if (initialized) { return; }
  initialized = true; // Just in case it tries to load multiple times for some reason
  watch('TERA.exe', processAdded, undefined, 1000);
};

