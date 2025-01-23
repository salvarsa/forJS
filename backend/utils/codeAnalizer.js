const acorn = require("acorn");
const walk = require("acorn-walk");

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
        }))
  
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
      ForStatement(node) {
        blocks.push({
          code: code.slice(node.start, node.end).trim(),
          type: "for-loop",
          details: {
            init: code.slice(node.init.start, node.init.end),
            test: code.slice(node.test.start, node.test.end),
            update: code.slice(node.update.start, node.update.end),
            body: code.slice(node.body.start, node.body.end)
          }
        });
      },
      
      IfStatement(node) {
        const ifBlock = {
          code: code.slice(node.start, node.end).trim(),
          type: "if-statement",
          details: {
            test: code.slice(node.test.start, node.test.end),
            consequent: code.slice(node.consequent.start, node.consequent.end),
            alternate: node.alternate ? code.slice(node.alternate.start, node.alternate.end) : null
          }
        };
        blocks.push(ifBlock);
      },
  
      BlockStatement(node) {
        blocks.push({
          code: code.slice(node.start, node.end).trim(),
          type: "block",
          details: {
            body: node.body.map(n => code.slice(n.start, n.end))
          }
        });
      },
  
      WhileStatement(node) {
        blocks.push({
          code: code.slice(node.start, node.end).trim(),
          type: "while-loop",
          details: {
            test: code.slice(node.test.start, node.test.end),
            body: code.slice(node.body.start, node.body.end)
          }
        });
      }
    });
    
    if (currentBlock.trim()) {
      blocks.push({ code: currentBlock.trim(), type: "mixed" });
    }
  
    return { blocks, isComplex };
  }

  module.exports = {
    analyzeAndSplitCode,
  }