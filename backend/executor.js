const { workerData, parentPort } = require('worker_threads');
const ivm = require('isolated-vm');

// Función para ejecutar código en un entorno aislado
async function executeInIsolate(code) {
  const isolate = new ivm.Isolate({ memoryLimit: 128 });
  const context = await isolate.createContext();
  const jail = context.global;
  await jail.set('global', jail.derefInto());
  
  let consoleOutput = [];

  const logFunction = new ivm.Reference((...args) => {
    consoleOutput.push(args.map((arg) => String(arg)).join(' '));
  });

  await jail.set('log', logFunction);

  const wrappedCode = `
    (function() {
      const results = [];
      const originalLog = console.log;
      console.log = (...args) => {
        log(...args);
        results.push(...args);
      };

      try {
        const result = eval(${JSON.stringify(code)});
        if (result !== undefined) {
          results.push(result);
        }
      } catch (error) {
        results.push('Error: ' + error.message);
      } finally {
        console.log = originalLog;
      }
      return JSON.stringify(results);
    })()
  `;

  const script = await isolate.compileScript(wrappedCode);
  const rawResult = await script.run(context, { timeout: 5000 });
  const result = JSON.parse(rawResult);

  isolate.dispose();
  return result.join('\n');
}

// Ejecutar código recibido y enviar respuesta al proceso principal
executeInIsolate(workerData.code)
  .then((result) => parentPort.postMessage(result))
  .catch((error) => parentPort.postMessage(`Error: ${error.message}`));
