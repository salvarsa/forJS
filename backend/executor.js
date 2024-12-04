const { workerData, parentPort } = require('worker_threads');
const ivm = require('isolated-vm');

async function executeInIsolate(code) {
  console.log('Código recibido:', code); // Verifica el código recibido

  const isolate = new ivm.Isolate({ memoryLimit: 128 }); // Limitar memoria a 128 MB
  const context = await isolate.createContext();
  const jail = context.global;

  await jail.set('global', jail.derefInto());

  let consoleOutput = [];
  const logFunction = new ivm.Reference((...args) => {
    consoleOutput.push(args.map(arg => String(arg)).join(' '));
  });
  await jail.set('log', logFunction);

  const redefineConsole = `
    global.console = {
      log: (...args) => log(...args),
    };
  `;
  const redefineScript = await isolate.compileScript(redefineConsole);
  await redefineScript.run(context);

  // Escapar template strings dentro del código
  const wrappedCode = `
    (function() {
      try {
        return eval(${JSON.stringify(code)});
      } catch (error) {
        return 'Error: ' + error.message;
      }
    })()
  `;
  console.log('wrappedCode:', wrappedCode); // Verifica el wrappedCode

  let script;
  try {
    script = await isolate.compileScript(wrappedCode);
    console.log('Script compilado correctamente'); // Confirma compilación
  } catch (error) {
    console.error('Error al compilar el script:', error.message);
    return { result: `Error al compilar: ${error.message}`, consoleOutput: [] };
  }

  let result;
  try {
    result = await script.run(context, { timeout: 5000 });
    console.log('Resultado del script:', result); // Verifica ejecución
  } catch (error) {
    console.error('Error al ejecutar el script:', error.message);
    return { result: `Error al ejecutar: ${error.message}`, consoleOutput: [] };
  }

  isolate.dispose();
  return { result, consoleOutput };
}

executeInIsolate(workerData.code)
  .then(data => parentPort.postMessage(data))
  .catch(error => parentPort.postMessage({ error: error.message }));