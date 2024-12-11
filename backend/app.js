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
  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Código inválido o vacío" });
  }

  try {
    const { blocks, isComplex } = analyzeAndSplitCode(code);

    const result = await executeCode(blocks, {});
    console.log('el resultado', result);
    
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
});