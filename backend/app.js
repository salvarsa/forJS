const express = require('express');
const cors = require('cors');
const { Worker } = require('worker_threads');
const path = require('path');
const app = express();

app.use(express.json());
app.use(
  cors({
    origin: 'http://localhost:3000',
    methods: ['POST', 'GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  })
);

const PORT = 1312;

function executeCode(code) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.resolve(__dirname, 'executor.js'), {
      workerData: { code },
    });
    
    worker.on('message', (data) => resolve(data));
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker finalizó con código ${code}`));
    });
  });
}

app.post('/execute', async (req, res) => {
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'El código es inválido o está vacío.' });
    }
    try {
      const { result, consoleOutput } = await executeCode(code);


      res.status(200).json({ result, consoleOutput });
      console.log('Respuesta enviada al frontend:', { result, consoleOutput });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  

app.listen(PORT, () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
});