import fs from "fs";
import path from "path";
import { cwd, env } from "process";

export function resolveFilePath(filePath: string) {
  let possiblePath;
  if (fs.existsSync(filePath)) {
    return filePath;
  }
  if (filePath.slice(0, 2) === "~/") {
    possiblePath = path.resolve(env.HOME || "/", filePath.slice(2));
    if (fs.existsSync(possiblePath)) {
      return possiblePath;
    } else {
      // for ~/ paths, don't try to resolve further
      return filePath;
    }
  }
  [".", cwd()].forEach(function (base) {
    possiblePath = path.resolve(base, filePath);
    if (fs.existsSync(possiblePath)) {
      return possiblePath;
    }
    return null;
  });
  return null;
}
