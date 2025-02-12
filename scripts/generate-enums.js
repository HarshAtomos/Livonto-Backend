import fs from "fs";
import path from "path";

const schemaPath = path.join(process.cwd(), "prisma/schema.prisma");
const outputPath = path.join(process.cwd(), "src/constants/enums.js");

function extractEnums(schema) {
  const enumRegex = /enum\s+(\w+)\s*{([^}]*)}/g;
  const enums = {};

  let match;
  while ((match = enumRegex.exec(schema))) {
    const enumName = match[1];
    const enumValues = match[2]
      .trim()
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    enums[enumName] = enumValues;
  }

  return enums;
}

function generateJavaScriptEnums(enums) {
  let output = "// This file is auto-generated. Do not edit directly\n\n";

  for (const [enumName, values] of Object.entries(enums)) {
    output += `const ${enumName} = {\n`;
    values.forEach((value) => {
      output += `  ${value}: "${value}",\n`;
    });
    output += "}\n\n";

    // Freeze the object to make it immutable (enum-like)
    output += `Object.freeze(${enumName})\n\n`;
  }

  // Export all enums
  output += "export const enums = {\n";
  Object.keys(enums).forEach((enumName) => {
    output += `  ${enumName},\n`;
  });
  output += "}\n";

  return output;
}

function main() {
  try {
    const schema = fs.readFileSync(schemaPath, "utf-8");
    const enums = extractEnums(schema);
    const javascriptEnums = generateJavaScriptEnums(enums);

    // Ensure the directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, javascriptEnums);
    console.log("✅ Enums generated successfully!");
  } catch (error) {
    console.error("Error generating enums:", error);
    process.exit(1);
  }
}

main();
