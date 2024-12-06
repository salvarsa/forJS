const { parentPort } = require("worker_threads");
const ivm = require("isolated-vm");

async function executeCode(blocks, globalContext = {}) {
  const isolate = new ivm.Isolate({ memoryLimit: 256 });
  const context = await isolate.createContext();
  const jail = context.global;
  await jail.set("global", jail.derefInto());
  await jail.set("globalContext", new ivm.ExternalCopy(globalContext).copyInto());

  let consoleOutput = [];
  const logFunction = new ivm.Reference((...args) => {
    consoleOutput.push(args.map(arg => String(arg)).join(" "));
  });
  await jail.set("log", logFunction);

  const setupConsole = `
    global.console = {
      log: (...args) => log(...args),
      error: (...args) => log('[Error]', ...args),
      warn: (...args) => log('[Warning]', ...args),
      info: (...args) => log('[Info]', ...args)
    };
    Object.assign(global, globalContext);
  `;
  const setupScript = await isolate.compileScript(setupConsole);
  await setupScript.run(context);

  let results = [];
  for (const { code } of blocks) {
    try {
      const wrappedCode = `
        (function() {
          try {
            return eval(${JSON.stringify(code)});
          } catch (error) {
            return { error: error.message };
          }
        })()
      `;
      const script = await isolate.compileScript(wrappedCode);
      const result = await script.run(context, { timeout: 5000 });

      results.push(result?.error ? `Error: ${result.error}` : result);

      const updatedContext = await jail.get("globalContext");
      globalContext = new ivm.ExternalCopy(updatedContext).copyInto();
    } catch (error) {
      results.push(`Error: ${error.message}`);
    }
  }

  isolate.dispose();

  // Filtrar los valores undefined del resultado
  const filteredResults = results.filter(result => result !== undefined);

  return { result: filteredResults, consoleOutput };
}


parentPort.on("message", async ({ blocks, globalContext, requestId, port }) => {
  try {
    const result = await executeCode(blocks, globalContext);
    port.postMessage({ requestId, result });
  } catch (error) {
    port.postMessage({ requestId, error: error.message });
  }
});
