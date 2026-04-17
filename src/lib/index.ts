// Re-export all lib modules for convenience.

export {
  fail,
  resolveConnectionId,
  createBlankDoc,
  batchUpdate,
  getDoc,
  createFetchClient,
  createAuthClient,
  printAuthDiagnostics,
  type AuthProvider,
} from "./api-client.ts";

export {
  extractRequestsFromIR,
  remapTabIds,
  filterHeaderFooterFromIR,
} from "./ir-helpers.ts";

export {
  isSvgUri,
  downloadToFile,
  uploadToDrive,
  resolveSvgImages,
  cleanupDriveFiles,
  downloadImage,
} from "./image-pipeline.ts";

export {
  readSpec,
  takeFlag,
  takeOption,
  resolveFilePath,
} from "./cli.ts";
