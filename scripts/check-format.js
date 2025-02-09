import { runCheck as runResponseFormatCheck } from "../src/utils/responseFormatChecker.js";
import { runCheck as runControllerCommentCheck } from "../src/utils/controllerCommentChecker.js";

// Files to exclude from checking
const excludeFiles = ["responseFormatChecker.js", "app.js"];
const excludeControllers = [];
runResponseFormatCheck(excludeFiles);
runControllerCommentCheck(excludeControllers);
