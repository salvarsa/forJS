from flask import Flask, request, jsonify
import subprocess

app = Flask(__name__)

@app.route('/')
def sisas():
    return 'Hello, World!'

@app.route('/execute', methods=['POST'])
def execute_code():
    data = request.get_json()
    code = data.get('code', '')

    if not code or not isinstance(code, str):
        return jsonify({"error": "Código inválido o vacío"}), 400
    
    try:
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
    
if __name__ == '__main__':
    app.run(port=1312, debug=True)
        