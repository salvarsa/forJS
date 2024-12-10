const express = require("express");
const cors = require("cors");
const { Worker, MessageChannel } = require("worker_threads");
const path = require("path");
const acorn = require("acorn");
const walk = require("acorn-walk");

const express = require("express");
const cors = require("cors");
const { Worker, MessageChannel } = require("worker_threads");
const path = require("path");
const acorn = require("acorn");
const walk = require("acorn-walk");

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
const MAX_WORKERS = 10;
const workerPool = [];
const pendingRequests = {};
let requestIdCounter = 0;

// Crear el pool inicial de workers
for (let i = 0; i < MAX_WORKERS; i++) {
  workerPool.push(createWorker());
}

function createWorker() {
  const worker = new Worker(path.resolve(__dirname, "executor.js"));
  worker.on("message", (message) => {
    const { port } = message;
    port.on("message", ({ requestId, result, error }) => {
      const callback = pendingRequests[requestId];
      if (callback) {
        if (error) callback.reject(error);
        else callback.resolve(result);
        delete pendingRequests[requestId];
      }
      workerPool.push(worker);
    });
  });
  return worker;
}

function analyzeAndSplitCode(code) {
  const ast = acorn.parse(code, {
    ecmaVersion: 2020,
    locations: true,
    sourceType: "module",
  });

  const blocks = [];
  let currentBlock = "";
  let isComplex = false;

  walk.recursive(ast, {}, {
    VariableDeclaration(node) {
      const declarations = node.declarations.map((decl) => ({
        name: decl.id.name,
        value: decl.init ? code.slice(decl.init.start, decl.init.end) : null,
      }));
      currentBlock += code.slice(node.start, node.end) + "\n";
      blocks.push({
        code: code.slice(node.start, node.end).trim(),
        type: "variable",
        details: declarations,
      });
    },
    FunctionDeclaration(node) {
      isComplex = true;
      const funcName = node.id.name;
      currentBlock += code.slice(node.start, node.end) + "\n";
      blocks.push({
        code: code.slice(node.start, node.end).trim(),
        type: "function",
        details: { name: funcName, params: node.params.map((p) => p.name) },
      });
    },
    ExpressionStatement(node) {
      currentBlock += code.slice(node.start, node.end) + "\n";
      blocks.push({
        code: code.slice(node.start, node.end).trim(),
        type: "expression",
        details: { expression: code.slice(node.expression.start, node.expression.end) },
      });
    },
    CallExpression(node) {
      blocks.push({
        code: code.slice(node.start, node.end).trim(),
        type: "call",
        details: {
          callee: code.slice(node.callee.start, node.callee.end),
          arguments: node.arguments.map((arg) => code.slice(arg.start, arg.end)),
        },
      });
    },
    ArrowFunctionExpression(node) {
      blocks.push({
        code: code.slice(node.start, node.end).trim(),
        type: "arrow-function",
        details: {
          params: node.params.map((param) => code.slice(param.start, param.end)),
          body: code.slice(node.body.start, node.body.end),
        },
      });
    },
    BinaryExpression(node) {
      blocks.push({
        code: code.slice(node.start, node.end).trim(),
        type: "binary-expression",
        details: {
          left: code.slice(node.left.start, node.left.end),
          operator: node.operator,
          right: code.slice(node.right.start, node.right.end),
        },
      });
    },
    ReturnStatement(node) {
      blocks.push({
        code: code.slice(node.start, node.end).trim(),
        type: "return",
        details: {
          value: node.argument ? code.slice(node.argument.start, node.argument.end) : null,
        },
      });
    },
  });

  // Agregar cualquier bloque pendiente
  if (currentBlock.trim()) {
    blocks.push({ code: currentBlock.trim(), type: "mixed" });
  }

  return { blocks, isComplex };
}


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
