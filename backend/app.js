const express = require('express');
const cors = require('cors');
const ivm = require('isolated-vm');

const app = express();
app.use(express.json())
app.use(cors({
    origin: 'http://localhost:3000',
    methods: ['POST', 'GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: true
}));

const PORT = 1312;

app.post('/execute', async (req, res) => {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'El código es inválido o está vacío.' });
    }

    try {
        const isolate = new ivm.Isolate({ memoryLimit: 128 });
        const context = await isolate.createContext();
        let consoleOutput = [];

        const logFunction = new ivm.Reference((...args) => {
            consoleOutput.push(args.map(arg => String(arg)).join(' '));
        });

        await context.global.set('log', logFunction);

        const wrappedCode =  `
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

        res.status(200).json({ result: result.join('\n') });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor activo en http://localhost:${PORT}`);
});