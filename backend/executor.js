const { parentPort } = require("worker_threads");
const ivm = require("isolated-vm");
const acorn = require("acorn");
const walk = require("acorn-walk");

function extractConsoleLogs(ast, code) {
  const consoleCalls = [];

  walk.simple(ast, {
    CallExpression(node) {
      if (
        node.callee.type === "MemberExpression" &&
        node.callee.object.type === "Identifier" &&
        node.callee.object.name === "console" &&
        node.callee.property.type === "Identifier" 
      ) {
        const consoleType = node.callee.property.name; // Tipo de consola (log, warn, error, etc.)
        const args = node.arguments.map((arg) => {
          if (arg.type === "Literal") {
            return arg.value;
          } else {
            return null;
          }s
        });

        consoleCalls.push({ type: consoleType, arguments: args });
      }
    },
  });

  return consoleCalls;
}

async function executeCode(blocks, globalContext = {}) {
  const isolate = new ivm.Isolate({ memoryLimit: 256 });
  const context = await isolate.createContext();
  const jail = context.global;
  await jail.set("global", jail.derefInto());
  await jail.set("globalContext", new ivm.ExternalCopy(globalContext).copyInto());

  // let consoleOutput = [];
  // const logFunction = new ivm.Reference((type, ...args) => {
  //   const processedArgs = args.map(arg => {
  //     try {
  //       return JSON.parse(arg);
  //     } catch {
  //       return arg;
  //     }
  //   });
  //   console.info('El propio bochin',processedArgs);
    
  //   consoleOutput.push({ type, arguments: processedArgs }); // Almacena los argumentos procesados
  // });

  let consoleOutput = [];
  const logFunction = new ivm.Reference((type, ...args) => {
    const message = args.map(arg => String(arg)).join(" ");
    consoleOutput.push({ type, message }); // Acumula cada mensaje de consola en lugar de sobrescribir
  const logFunction = new ivm.Reference((type, ...args) => {
    const message = args.map(arg => String(arg)).join(" ");
    consoleOutput.push({ type, message }); // Acumula cada mensaje de consola en lugar de sobrescribir
  });
  
  await jail.set("log", logFunction);

  const setupConsole = `
  
  await jail.set("log", logFunction);

  const setupConsole = `
    global.console = {
      log: (...args) => log('log', ...args),
      error: (...args) => log('error', ...args),
      warn: (...args) => log('warn', ...args),
      info: (...args) => log('info', ...args),
      debug: (...args) => log('debug', ...args),
      trace: (...args) => log('trace', ...args),
      group: (...args) => log('group', ...args),
      groupEnd: () => log('groupEnd'),
      assert: (condition, ...args) => {
        if (!condition) log('assert', ...args);
      }
    };
    Object.assign(global, globalContext);
  `;

  const setupScript = await isolate.compileScript(setupConsole);
  await setupScript.run(context);

  let results = [];
  for (const { code } of blocks) {
    const ast = acorn.parse(code, { ecmaVersion: 2020, sourceType: "module" });
    const logs = extractConsoleLogs(ast, code);
    consoleOutput.push(...logs);

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

  consoleOutput = consoleOutput.filter(
    (log, index, self) =>
      index === self.findIndex((t) => t.type === log.type && t.message === log.message)
  );

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