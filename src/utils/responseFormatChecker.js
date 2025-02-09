import { Parser } from "acorn";
import * as walk from "acorn-walk";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

function checkFile(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const issues = [];

  try {
    const ast = Parser.parse(content, {
      sourceType: "module",
      ecmaVersion: "latest",
    });

    walk.simple(ast, {
      CallExpression(node) {
        // Check for res.json() or res.status().json() calls
        if (
          (node.callee.type === "MemberExpression" &&
            node.callee.property.name === "json") ||
          (node.callee.type === "MemberExpression" &&
            node.callee.object.type === "CallExpression" &&
            node.callee.object.callee.property.name === "status")
        ) {
          const args = node.arguments[0];
          if (args && args.type === "ObjectExpression") {
            const properties = args.properties.map((p) => p.key.name);

            // Check if response follows the standard format
            if (!properties.includes("status")) {
              issues.push({
                line: content.slice(0, node.start).split("\n").length,
                message:
                  'Response missing "status" field (should be "success" or "error")',
              });
            }

            if (!properties.includes("message")) {
              issues.push({
                line: content.slice(0, node.start).split("\n").length,
                message: 'Response missing "message" field',
              });
            }

            if (properties.includes("success")) {
              issues.push({
                line: content.slice(0, node.start).split("\n").length,
                message: 'Using deprecated "success" field instead of "status"',
              });
            }
          }
        }
      },
    });
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error);
    return [];
  }

  return issues;
}

function scanDirectory(dir, excludeFiles = []) {
  const results = [];
  // Default directories to skip
  const excludeDirs = ["node_modules", "build", "dist", "prisma"];
  // Convert all exclude patterns to lowercase for case-insensitive matching
  const excludePatterns = excludeFiles.map((pattern) => pattern.toLowerCase());

  function shouldSkipFile(fileName) {
    const lowerFileName = fileName.toLowerCase();
    return excludePatterns.some((pattern) => {
      // Handle glob patterns with wildcards
      if (pattern.includes("*")) {
        const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
        return regex.test(lowerFileName);
      }
      return lowerFileName === pattern;
    });
  }

  function traverse(currentPath) {
    const files = readdirSync(currentPath);

    for (const file of files) {
      const filePath = join(currentPath, file);
      const stat = statSync(filePath);

      if (stat.isDirectory()) {
        if (!excludeDirs.includes(file)) {
          traverse(filePath);
        }
      } else if (
        (file.endsWith(".js") || file.endsWith(".ts")) &&
        !shouldSkipFile(file)
      ) {
        const issues = checkFile(filePath);
        if (issues.length > 0) {
          results.push({
            file: filePath,
            issues,
          });
        }
      }
    }
  }

  traverse(dir);
  return results;
}

// Script execution
function runCheck(excludeFiles = []) {
  console.log("Checking API response formats...\n");
  const projectRoot = process.cwd();
  const results = scanDirectory(projectRoot, excludeFiles);

  if (results.length === 0) {
    console.log("✅ All responses follow the standard format!");
    return;
  }

  console.log("Found format inconsistencies:\n");
  results.forEach(({ file, issues }) => {
    console.log(`📁 ${file}`);
    issues.forEach(({ line, message }) => {
      console.log(`  Line ${line}: ${message}`);
    });
    console.log("");
  });
}

export { runCheck };
