const acorn = require("acorn");
const walk = require("acorn-walk");

function analyzeAndSplitCode(code) {
    const ast = acorn.parse(code, {
        ecmaVersion: 2020,
        locations: true,
        sourceType: "script",
    });

    const blocks = [];
    let isComplex = false;
    let currentBlock = "";

    const customWalker = {
        ...walk.base,

        // Handlers que bloquean recursividad
        FunctionDeclaration(node) {
            isComplex = true;
            blocks.push({
                code: code.slice(node.start, node.end).trim(),
                type: "function",
                details: {
                    name: node.id.name,
                    params: node.params.map(p => p.name),
                    body: code.slice(node.body.start, node.body.end)
                }
            });
        },

        ClassDeclaration(node) {
            blocks.push({
                code: code.slice(node.start, node.end).trim(),
                type: "class",
                details: {
                    name: node.id.name,
                    superClass: node.superClass ? code.slice(node.superClass.start, node.superClass.end) : null,
                    methods: node.body.body.map(method => ({
                        name: method.key.name,
                        params: method.value.params.map(param => param.name),
                        body: code.slice(method.value.body.start, method.value.body.end)
                    }))
                }
            });
        },

        // Handlers que permiten recursividad controlada
        IfStatement(node, state, callback) {
            blocks.push({
                code: code.slice(node.start, node.end).trim(),
                type: "if-statement",
                details: {
                    test: code.slice(node.test.start, node.test.end),
                    consequent: code.slice(node.consequent.start, node.consequent.end),
                    alternate: node.alternate ? code.slice(node.alternate.start, node.alternate.end) : null
                }
            });
            this.base.IfStatement(node, state, callback);
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

        WhileStatement(node) {
          blocks.push({
            code: code.slice(node.start, node.end).trim(),
            type: "while-loop",
            details: {
              test: code.slice(node.test.start, node.test.end),
              body: code.slice(node.body.start, node.body.end)
            }
          });
        },

        SwitchStatement(node) {
          const cases = node.cases.map(caseNode => ({
            test: caseNode.test ? code.slice(caseNode.test.start, caseNode.test.end) : null,
            consequent: caseNode.consequent.map(cons => code.slice(cons.start, cons.end))
          }));
          
          blocks.push({
            code: code.slice(node.start, node.end).trim(),
            type: "switch",
            details: {
              discriminant: code.slice(node.discriminant.start, node.discriminant.end),
              cases
            }
          });
        },
  
        DoWhileStatement(node) {
          blocks.push({
            code: code.slice(node.start, node.end).trim(),
            type: "do-while",
            details: {
              test: code.slice(node.test.start, node.test.end),
              body: code.slice(node.body.start, node.body.end)
            }
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

        BlockStatement(node) {
            blocks.push({
                code: code.slice(node.start, node.end).trim(),
                type: "block",
                details: {
                    body: node.body.map(n => code.slice(n.start, n.end))
                }
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

        ExpressionStatement(node) {
          currentBlock += code.slice(node.start, node.end) + "\n";
          blocks.push({
            code: code.slice(node.start, node.end).trim(),
            type: "expression",
            details: { expression: code.slice(node.expression.start, node.expression.end) },
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
  
        BreakStatement(node) {
          blocks.push({
            code: code.slice(node.start, node.end).trim(),
            type: "break",
            details: {
              label: node.label ? code.slice(node.label.start, node.label.end) : null
            }
          });
        },
  
        ContinueStatement(node) {
          blocks.push({
            code: code.slice(node.start, node.end).trim(),
            type: "continue",
            details: {
              label: node.label ? code.slice(node.label.start, node.label.end) : null
            }
          });
        },
  
        ThrowStatement(node) {
          blocks.push({
            code: code.slice(node.start, node.end).trim(),
            type: "throw",
            details: {
              argument: code.slice(node.argument.start, node.argument.end)
            }
          });
        },
  
        TryStatement(node) {
          const handler = node.handler ? {
            param: node.handler.param?.name,
            body: code.slice(node.handler.body.start, node.handler.body.end)
          } : null;
          
          blocks.push({
            code: code.slice(node.start, node.end).trim(),
            type: "try-catch",
            details: {
              block: code.slice(node.block.start, node.block.end),
              handler,
              finalizer: node.finalizer ? code.slice(node.finalizer.start, node.finalizer.end) : null
            }
          });
        },
        
        ImportDeclaration(node) {
          blocks.push({
            code: code.slice(node.start, node.end).trim(),
            type: "import",
            details: {
              source: node.source.value,
              specifiers: node.specifiers.map(spec => ({
                type: spec.type,
                imported: spec.imported?.name,
                local: spec.local.name
              }))
            }
          });
        },
  
        ExportNamedDeclaration(node) {
          blocks.push({
            code: code.slice(node.start, node.end).trim(),
            type: "export",
            details: {
              declaration: node.declaration ? code.slice(node.declaration.start, node.declaration.end) : null,
              source: node.source?.value,
              specifiers: node.specifiers?.map(spec => ({
                local: spec.local.name,
                exported: spec.exported.name
              }))
            }
          });
        },
  
        NewExpression(node) {
          blocks.push({
            code: code.slice(node.start, node.end).trim(),
            type: "new",
            details: {
              callee: code.slice(node.callee.start, node.callee.end),
              arguments: node.arguments.map(arg => code.slice(arg.start, arg.end))
            }
          });
        },
  
        AssignmentExpression(node) {
          blocks.push({
            code: code.slice(node.start, node.end).trim(),
            type: "assignment",
            details: {
              operator: node.operator,
              left: code.slice(node.left.start, node.left.end),
              right: code.slice(node.right.start, node.right.end)
            }
          });
        },
  
        LogicalExpression(node) {
          blocks.push({
            code: code.slice(node.start, node.end).trim(),
            type: "logical",
            details: {
              operator: node.operator,
              left: code.slice(node.left.start, node.left.end),
              right: code.slice(node.right.start, node.right.end)
            }
          });
        },
  
        MemberExpression(node) {
          blocks.push({
            code: code.slice(node.start, node.end).trim(),
            type: "member",
            details: {
              object: code.slice(node.object.start, node.object.end),
              property: code.slice(node.property.start, node.property.end),
              computed: node.computed
            }
          });
        },
  
        ArrayExpression(node) {
          blocks.push({
            code: code.slice(node.start, node.end).trim(),
            type: "array",
            details: {
              elements: node.elements.map(el => el ? code.slice(el.start, el.end) : null)
            }
          });
        },
        
        ObjectExpression(node) {
          blocks.push({
            code: code.slice(node.start, node.end).trim(),
            type: "object",
            details: {
              properties: node.properties.map(prop => ({
                key: code.slice(prop.key.start, prop.key.end),
                value: code.slice(prop.value.start, prop.value.end)
              }))
            }
          });
        },

        TemplateLiteral(node) {
            blocks.push({
                code: code.slice(node.start, node.end).trim(),
                type: "template",
                details: {
                    quasis: node.quasis.map(quasi => code.slice(quasi.start, quasi.end)),
                    expressions: node.expressions.map(exp => code.slice(exp.start, exp.end))
                }
            });
        },

        AwaitExpression(node) {
            blocks.push({
                code: code.slice(node.start, node.end).trim(),
                type: "await",
                details: {
                    argument: code.slice(node.argument.start, node.argument.end)
                }
            });
        }
    };

    walk.recursive(ast, {}, customWalker);

    return { blocks, isComplex };
}

module.exports = { analyzeAndSplitCode };