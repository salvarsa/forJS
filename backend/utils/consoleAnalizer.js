const walk = require("acorn-walk");

function extractConsoleLogs(ast, code) {
  const consoleCalls = [];

  walk.simple(ast, {
    CallExpression(node) {
      if (
        node.callee.type === "MemberExpression" &&
        node.callee.object.type === "Identifier" &&
        node.callee.object.name === "console" &&
        node.callee.property.type === "Identifier" 
      ) {
        const consoleType = node.callee.property.name;
        const args = node.arguments.map((arg) => {
          if (arg.type === "Literal") {
            return arg.value
          } else {
            return null
          }s
        });

        consoleCalls.push({ type: consoleType, arguments: args })
      }
    },
  });

  return consoleCalls
}

module.exports = {
    extractConsoleLogs
}