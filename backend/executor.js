const { workerData, parentPort } = require('worker_threads');
const ivm = require('isolated-vm');

async function executeInIsolate(code) {
  console.log('Código recibido:', code);

  const isolate = new ivm.Isolate({ memoryLimit: 128 }); // Limitar memoria a 128 MB
  const context = await isolate.createContext();
  const jail = context.global;

  await jail.set('global', jail.derefInto());

  // Capturar salidas de `console.log`
  let consoleOutput = [];
  const logFunction = new ivm.Reference((...args) => {
    consoleOutput.push(args.map(arg => String(arg)).join(' '));
  });
  await jail.set('log', logFunction);

  // Inyectar una versión personalizada de `console`
  const redefineConsole = `
    global.console = {
      log: (...args) => log(...args),
    };
  `;
  const redefineScript = await isolate.compileScript(redefineConsole);
  await redefineScript.run(context);

  let results = [];

  // Dividir el código en bloques separados por '\n\n'
  const blocks = code.split('\n\n').map(block => block.trim()).filter(Boolean);

  for (const block of blocks) {
    const wrappedCode = `
      (function() {
        try {
          return eval(${JSON.stringify(block)});
        } catch (error) {
          return 'Error: ' + error.message;
        }
      })()
    `;
    try {
      const script = await isolate.compileScript(wrappedCode);
      const result = await script.run(context, { timeout: 5000 });
      results.push(result);
    } catch (error) {
      results.push('Error: ' + error.message);
    }
  }

  isolate.dispose();
  return { result: results, consoleOutput };
}

executeInIsolate(workerData.code)
  .then(data => parentPort.postMessage(data))
  .catch(error => parentPort.postMessage({ error: error.message }));
