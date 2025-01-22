import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { VirtualDirectory } from '../virtual-dir';
import { extractJsonFromMarkdown } from 'src/build-system/utils/strings';
import toposort from 'toposort';
import { readFile } from 'fs-extra';

interface FileDependencyInfo {
  filePath: string;
  dependsOn: string[];
}

interface GenerateFilesDependencyResult {
  sortedFiles: string[];
  fileInfos: Record<string, FileDependencyInfo>;
}

interface GenerateFilesDependencyLayerResult {
  concurrencyLayers: string[][];
  fileInfos: Record<string, FileDependencyInfo>;
}

const logger = new Logger('FileGeneratorUtil');

export async function generateFilesDependencyWithLayers(
  jsonString: string,
  virtualDirectory: VirtualDirectory,
): Promise<GenerateFilesDependencyLayerResult> {
  // 1. Parse for JSON
  const jsonData = JSON.parse(jsonString);

  // 2. Build a "fileInfos" object with .dependsOn
  const { fileInfos, nodes } = buildDependencyLayerGraph(jsonData);

  // 3. Validate the files actually exist in VirtualDirectory
  validateAgainstVirtualDirectory(nodes, virtualDirectory);

  // 4. Build concurrency layers with Kahn’s Algorithm
  const concurrencyLayers = buildConcurrencyLayers(nodes, fileInfos);

  // Optionally check for cycles (if you didn’t do it inside buildConcurrencyLayers)
  // detectCycles(...) or similar

  logger.log('All files dependency layers generated successfully.');

  return {
    concurrencyLayers,
    fileInfos,
  };
}

function buildDependencyLayerGraph(jsonData: {
  files: Record<string, { dependsOn: string[] }>;
}): {
  fileInfos: Record<string, FileDependencyInfo>;
  nodes: Set<string>;
} {
  const fileInfos: Record<string, FileDependencyInfo> = {};
  const nodes = new Set<string>();

  Object.entries(jsonData.files).forEach(([fileName, details]) => {
    nodes.add(fileName);

    // Initialize the record
    fileInfos[fileName] = {
      filePath: fileName,
      dependsOn: [],
    };

    // In the JSON, "dependsOn" is an array of file paths
    details.dependsOn.forEach((dep) => {
      const resolvedDep = resolveDependency(fileName, dep);
      nodes.add(resolvedDep);

      fileInfos[fileName].dependsOn.push(resolvedDep);
    });
  });

  return { fileInfos, nodes };
}

/**
 * Generates files based on JSON extracted from a Markdown document.
 * Ensures dependency order is maintained during file creation.
 */
export async function generateFilesDependency(
  markdownContent: string,
  virtualDirectory: VirtualDirectory,
): Promise<GenerateFilesDependencyResult> {
  const jsonData = extractJsonFromMarkdown(markdownContent);

  const { graph, nodes, fileInfos } = buildDependencyGraph(jsonData);
  detectCycles(graph);
  validateAgainstVirtualDirectory(nodes, virtualDirectory);

  const sortedFiles = getSortedFiles(graph, nodes);

  logger.log('All files dependency generated successfully.');

  return {
    sortedFiles,
    fileInfos,
  };
}

/**
 * Attempts to read a file's content, retrying up to `maxRetries` times
 * if a read error occurs (e.g., file not found or locked).
 *
 * @param filePath - The absolute path to the file you want to read
 * @param maxRetries - The number of retry attempts
 * @param delayMs - Delay (in ms) between retry attempts
 */
export async function readFileWithRetries(
  filePath: string,
  maxRetries = 3,
  delayMs = 200,
): Promise<string> {
  let attempt = 0;
  let lastError: any;

  while (attempt < maxRetries) {
    try {
      const content = await readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      lastError = error;
      attempt++;

      // Optionally log a warning or debug
      // console.warn(`Failed to read file: ${filePath}, attempt #${attempt}`);

      // Wait a short delay before retrying
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  // If we exhausted all retries, re-throw the last error
  throw lastError;
}

/**
 * Constructs a dependency graph from the provided JSON structure.
 * Each file entry includes dependencies that must be resolved first.
 */
export function buildDependencyGraph(jsonData: {
  files: Record<string, { dependsOn: string[] }>;
}): {
  graph: [string, string][];
  nodes: Set<string>;
  fileInfos: Record<string, { filePath: string; dependsOn: string[] }>;
} {
  const graph: [string, string][] = [];
  const nodes = new Set<string>();
  const fileInfos: Record<string, { filePath: string; dependsOn: string[] }> =
    {};

  logger.log('Parsing JSON data to build dependency graph');

  Object.entries(jsonData.files).forEach(([fileName, details]) => {
    nodes.add(fileName);

    // store file info
    fileInfos[fileName] = {
      filePath: fileName,
      dependsOn: [],
    };

    details.dependsOn.forEach((dep) => {
      const resolvedDep = resolveDependency(fileName, dep);
      graph.push([resolvedDep, fileName]); // [dependency, dependent]
      nodes.add(resolvedDep);

      // store dependsOn
      fileInfos[fileName].dependsOn.push(resolvedDep);
    });
  });

  return { graph, nodes, fileInfos };
}

/**
 * Detects cycles in the dependency graph to prevent infinite loops.
 */
export function detectCycles(graph: [string, string][]): void {
  try {
    toposort(graph);
  } catch (error) {
    if (error.message.includes('cycle')) {
      throw new Error(
        `Circular dependency detected in the file structure: ${error.message}`,
      );
    }
    throw error;
  }
}

/**
 * Performs a topological sort on the dependency graph and ensures all files are ordered correctly.
 */
export function getSortedFiles(
  graph: [string, string][],
  nodes: Set<string>,
): string[] {
  const sortedFiles = toposort(graph);

  Array.from(nodes).forEach((node) => {
    if (!sortedFiles.includes(node)) {
      sortedFiles.unshift(node);
    }
  });

  return sortedFiles;
}

/**
 * Resolves dependency paths relative to the current file.
 * Adds an index file extension if missing.
 */
export function resolveDependency(
  currentFile: string,
  dependency: string,
): string {
  const currentDir = path.dirname(currentFile);
  const hasExtension = path.extname(dependency).length > 0;

  if (!hasExtension) {
    dependency = path.join(dependency, 'index.ts');
  }

  const resolvedPath = path.join(currentDir, dependency).replace(/\\/g, '/');
  logger.log(`Resolved dependency: ${resolvedPath}`);
  return resolvedPath;
}

/**
 * Validates that all dependencies exist within the virtual directory structure before file generation.
 */
export function validateAgainstVirtualDirectory(
  nodes: Set<string>,
  virtualDir: VirtualDirectory,
): string {
  const invalidFiles: string[] = [];

  nodes.forEach((filePath) => {
    if (!virtualDir.isValidFile(filePath)) {
      invalidFiles.push(filePath);
    }
  });

  if (invalidFiles.length > 0) {
    logger.log(virtualDir.getAllFiles());
    logger.error(
      `The following files do not exist in the project structure:\n${invalidFiles.join('\n')}`,
    );
    return invalidFiles.join('\n');
  }
  return null;
}

/**
 * Creates a file at the specified path, ensuring required directories exist first.
 * The file is created with a simple placeholder comment.
 */
export async function createFile(
  filePath: string,
  generatedCode: string,
): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(filePath, generatedCode, 'utf8');

  logger.log(`File created: ${filePath}`);
}

/**
 * Creates concurrency layers (or "waves") of files so that
 * files with no remaining dependencies can be processed in parallel.
 *
 * @param nodes - The set of all files in your project.
 * @param fileInfos - A record of each file and its direct dependencies.
 * @returns An array of arrays, where each sub-array is a concurrency layer.
 */
function buildConcurrencyLayers(
  nodes: Set<string>,
  fileInfos: Record<string, { dependsOn: string[] }>,
): string[][] {
  // 1. Compute in-degrees: how many dependencies each file has
  const inDegree: Record<string, number> = {};
  for (const file of nodes) {
    inDegree[file] = 0;
  }

  // For each file, increment the in-degree of the file that depends on it
  // In fileInfos, "fileInfos[child].dependsOn = [dep1, dep2...]"
  // means edges: dep1 -> child, dep2 -> child, etc.
  // So the child’s in-degree = # of dependencies
  for (const child of nodes) {
    const deps = fileInfos[child]?.dependsOn || [];
    for (const dep of deps) {
      inDegree[child] = (inDegree[child] ?? 0) + 1;
    }
  }

  // 2. Collect the initial layer: all files with in-degree == 0
  let layer = Object.entries(inDegree)
    .filter(([_, deg]) => deg === 0)
    .map(([file]) => file);

  const resultLayers: string[][] = [];

  // 3. Build each layer until no more zero in-degree nodes remain
  while (layer.length > 0) {
    resultLayers.push(layer);

    // We'll build the next layer by removing all the current layer’s
    // edges from the graph.
    const nextLayer: string[] = [];

    // For each file in the current layer
    for (const file of layer) {
      // Find "children" (which are the files that depend on `file`)
      for (const possibleChild of nodes) {
        if (fileInfos[possibleChild]?.dependsOn?.includes(file)) {
          // Decrement the child's in-degree
          inDegree[possibleChild]--;
          if (inDegree[possibleChild] === 0) {
            nextLayer.push(possibleChild);
          }
        }
      }
    }

    layer = nextLayer;
  }

  // 4. If there are any files left with in-degree > 0, there's a cycle
  const unprocessed = Object.entries(inDegree).filter(([_, deg]) => deg > 0);
  if (unprocessed.length > 0) {
    throw new Error(
      `Cycle or leftover dependencies detected for: ${unprocessed
        .map(([f]) => f)
        .join(', ')}`,
    );
  }

  return resultLayers;
}
