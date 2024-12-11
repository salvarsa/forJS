const { Worker } = require("worker_threads");
const path = require("path");

const MAX_WORKERS = 10;
const workerPool = [];
const pendingRequests = {};

function createWorker() {
  const worker = new Worker(path.resolve(__dirname, "../utils/executor.js"))
  worker.on("message", (message) => {
    const { port } = message;
    port.on("message", ({ requestId, result, error }) => {
      const callback = pendingRequests[requestId]
      if (callback) {
        if (error) callback.reject(error)
        else callback.resolve(result)
        delete pendingRequests[requestId]
      }
      workerPool.push(worker)
    });
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