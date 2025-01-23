from flask import Flask, request, jsonify
import subprocess
import esprima

app = Flask(__name__)

# Endpoint simple para probar que el servidor está activo
@app.route('/')
def sisas():
    return 'Hello, World!'

# Función para analizar el código JavaScript
def analyze_and_split_code(code):
    """
    Analiza el código JavaScript y genera bloques para procesar.
    """
    try:
        # Parsear el código y generar el AST
        ast = esprima.parseScript(code, {'loc': True})
        blocks = []
        is_complex = False

        # Recorrer los nodos del AST
        for node in ast.body:
            if node.type == 'VariableDeclaration':
                # Extraer información de declaraciones de variables
                declarations = [
                    {
                        "name": decl.id.name,
                        "value": code[decl.init.range[0]:decl.init.range[1]] if decl.init else None
                    }
                    for decl in node.declarations
                ]
                blocks.append({
                    "code": code[node.range[0]:node.range[1]],
                    "type": "variable",
                    "details": declarations
                })
            elif node.type == 'FunctionDeclaration':
                # Identificar funciones declaradas
                is_complex = True
                blocks.append({
                    "code": code[node.range[0]:node.range[1]],
                    "type": "function",
                    "details": {
                        "name": node.id.name,
                        "params": [param.name for param in node.params]
                    }
                })
            elif node.type == 'ExpressionStatement':
                # Identificar expresiones
                expression = code[node.expression.range[0]:node.expression.range[1]]
                blocks.append({
                    "code": code[node.range[0]:node.range[1]],
                    "type": "expression",
                    "details": {
                        "expression": expression
                    }
                })
            elif node.type == 'ReturnStatement':
                # Identificar return statements
                blocks.append({
                    "code": code[node.range[0]:node.range[1]],
                    "type": "return",
                    "details": {
                        "value": code[node.argument.range[0]:node.argument.range[1]] if node.argument else None
                    }
                })

        return {"blocks": blocks, "isComplex": is_complex}
    except Exception as e:
        raise ValueError(f"Error al analizar el código: {str(e)}")

# Endpoint para ejecutar código JavaScript
@app.route('/execute', methods=['POST'])
def execute_code():
    data = request.get_json()
    code = data.get('code', '')

    if not code or not isinstance(code, str):
        return jsonify({"error": "Código inválido o vacío"}), 400

    try:
        # Ejecutar el código JavaScript directamente con Node.js
        process = subprocess.run(
            ["node", "-e", code],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=5  # Limitar el tiempo de ejecución
        )

        if process.returncode == 0:
            return jsonify({"output": process.stdout.strip()}), 200
        else:
            return jsonify({"error": process.stderr.strip()}), 400
    except subprocess.TimeoutExpired:
        return jsonify({"error": "La ejecución excedió el tiempo límite"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Nuevo endpoint para analizar el código
@app.route('/analyze', methods=['POST'])
def analyze_code():
    data = request.get_json()
    code = data.get('code', '')

    if not code or not isinstance(code, str):
        return jsonify({"error": "Código inválido o vacío"}), 400

    try:
        # Llamar a la función de análisis
        analysis = analyze_and_split_code(code)
        return jsonify(analysis), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": "Error interno del servidor"}), 500


if __name__ == '__main__':
    app.run(port=1312, debug=True)
