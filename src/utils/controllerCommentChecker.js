import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const REQUIRED_COMMENT_PARTS = ["@desc", "@route", "@access"];

function checkControllerComments(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const issues = [];

  // Split the file into lines for analysis
  const lines = content.split("\n");

  // Find all function declarations and check their preceding comments
  lines.forEach((line, index) => {
    // Look for function declarations or arrow functions
    if (
      (line.includes("const") && line.includes("=") && line.includes("=>")) ||
      (line.includes("function") && line.includes("("))
    ) {
      // Look back up to 5 lines for comments
      const previousLines = lines
        .slice(Math.max(0, index - 5), index)
        .join("\n");

      // Check if it's a controller function (contains 'req, res' or similar)
      if (line.includes("req") && line.includes("res")) {
        const missingParts = [];

        REQUIRED_COMMENT_PARTS.forEach((part) => {
          if (!previousLines.includes(part)) {
            missingParts.push(part);
          }
        });

        if (missingParts.length > 0) {
          const functionName =
            line.match(/(?:const\s+)?(\w+)\s*=/)?.[1] ||
            line.match(/function\s+(\w+)/)?.[1] ||
            "Unknown function";

          issues.push({
            line: index + 1,
            function: functionName,
            missing: missingParts,
          });
        }
      }
    }
  });

  return issues;
}

function scanControllers(dir, excludeFiles = []) {
  const results = [];
  const excludeDirs = ["node_modules", "build", "dist"];
  const excludePatterns = excludeFiles.map((pattern) => pattern.toLowerCase());

  function shouldSkipFile(fileName) {
    const lowerFileName = fileName.toLowerCase();
    return excludePatterns.some((pattern) => {
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
      } else if (file.includes("Controller.js") && !shouldSkipFile(file)) {
        const issues = checkControllerComments(filePath);
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

function runCheck(excludeFiles = []) {
  console.log("Checking controller comments format...\n");
  const projectRoot = process.cwd();
  const results = scanControllers(projectRoot, excludeFiles);

  if (results.length === 0) {
    console.log("✅ All controllers have proper comments!");
    return;
  }

  console.log("Found missing comments:\n");
  results.forEach(({ file, issues }) => {
    console.log(`📁 ${file}`);
    issues.forEach(({ line, function: funcName, missing }) => {
      console.log(`  Line ${line} (${funcName}):`);
      console.log(`  Missing required comments: ${missing.join(", ")}`);
      console.log(`  Required format:`);
      console.log(`  /**`);
      console.log(`   * @desc Description of the endpoint`);
      console.log(`   * @route HTTP_METHOD /path`);
      console.log(`   * @access Public|Private`);
      console.log(`   */`);
    });
    console.log("");
  });
}

export { runCheck };
