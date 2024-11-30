const express = require('express');
const cors = require('cors');
const ivm = require('isolated-vm');
const app = express();

app.use(cors());
app.use(express.json())
const PORT = 1312;

app.post('/execute', async (req, res) => {
    const { code } = req.body;
    
    if(!code || typeof code !== 'string'){
        return res.status(400).json({ error: 'El código es inválido o está vacío.' })
    }

    try {
        const isolate = new ivm.Isolate({ memoryLimit: 128 });
        const context = await isolate.createContext();
        let consoleOutput = [];
        
        const logFunction = new ivm.Reference((...args) => {
            const log = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ');
            consoleOutput.push(log);
        });

        await context.global.set('log', logFunction);
        
        const wrappedCode = `
            (function() {
                try {
                    const results = [];
                    console = { 
                        log: (...args) => {
                            log(...args);
                            results.push(...args);
                        }
                    };

                    // Ejecutar el código línea por línea
                    const lines = \`${code}\`.split('\\n').filter(line => line.trim());
                    
                    for(const line of lines) {
                        const result = eval(line);
                        results.push(result);
                    }
                    
                    return JSON.stringify({
                        success: true,
                        results: results.map(result => {
                            if (result === undefined) return 'undefined';
                            if (result === null) return 'null';
                            if (typeof result === 'symbol') return result.toString();
                            if (Number.isNaN(result)) return 'NaN';
                            if (typeof result === 'object') {
                                try {
                                    return JSON.stringify(result);
                                } catch {
                                    return String(result);
                                }
                            }
                            return String(result);
                        })
                    });
                } catch (error) {
                    return JSON.stringify({ 
                        success: false, 
                        error: error.message 
                    });
                }
            })()
        `;

        const script = await isolate.compileScript(wrappedCode);
        const rawResult = await script.run(context, { timeout: 5000 });
        const result = JSON.parse(rawResult);

        if (!result.success) {
            res.status(400).json({ 
                error: result.error,
                consoleOutput: consoleOutput.join('\n')
            });
        } else {
            // Combinar resultados y salida de consola
            const output = result.results.join('\n');
            res.status(200).json({ 
                result: output,
                consoleOutput: consoleOutput.join('\n')
            });
        }
    } catch (error) {
        res.status(400).json({ 
            error: error.message,
            consoleOutput: consoleOutput.join('\n')
        });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor activo en http://localhost:${PORT}`);
});