const { Worker } = require("worker_threads");
const path = require("path");

const MAX_WORKERS = 10;
const workerPool = [];
const pendingRequests = {};

function createWorker() {
  const worker = new Worker(path.resolve(__dirname, "../utils/executor.js"));
  
  worker.on("message", (message) => {
    const { port, requestId } = message;
    
    port.on("message", (msg) => {
      const callback = pendingRequests[requestId];
      if (!callback) return;
      
      if (msg.error) {
        console.error('Error en worker:', msg.error);
        callback.reject(new Error(msg.error.message));
      } else {
        callback.resolve(msg.result);
      }
      
      workerPool.push(worker);
      delete pendingRequests[requestId];
    });
  });

  worker.on("error", (error) => {
    console.error('Error de worker:', error);
  });
  
  worker.on("exit", (code) => {
    if (code !== 0) console.error(`Worker finalizado con código ${code}`);
  });

  return worker;
}

// Crear el pool inicial de workers
for (let i = 0; i < MAX_WORKERS; i++) {
  workerPool.push(createWorker())
}

module.exports = {
  createWorker,
  workerPool,
  pendingRequests
}