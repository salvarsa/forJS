const express = require("express");
const cors = require("cors");
const { MessageChannel } = require("worker_threads");
const { workerPool, pendingRequests } = require('./workers/workerPool.js');
const { analyzeAndSplitCode } = require('./utils/codeAnalizer.js');

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["POST", "GET", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    credentials: true,
  })
);

const PORT = 1312;
let requestIdCounter = 0;

async function executeCode(blocks, globalContext = {}) {
  return new Promise((resolve, reject) => {
    const worker = workerPool.shift();
    if (!worker) {
      return reject(new Error("No hay workers disponibles"));
    }

    const requestId = ++requestIdCounter;
    pendingRequests[requestId] = { resolve, reject };

    const { port1, port2 } = new MessageChannel();
    worker.postMessage({ port: port2, blocks, globalContext, requestId }, [port2]);

    port1.on("message", (message) => {
      if (message.error) {
        reject(message.error);
      } else {
        resolve(message.result);
      }
      workerPool.push(worker);
    });
  });
}

app.post("/execute", async (req, res) => {
  const { code } = req.body;
  
  try {
    const { blocks } = analyzeAndSplitCode(code);
    console.log('Bloques identificados:', blocks);  // ← Agregar logging
    
    const result = await executeCode(blocks, {});
    console.log('Resultado ejecución:', result);    // ← Agregar logging
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error en ejecución:', error);    // ← Mejor logging
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
});