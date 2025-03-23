/* eslint-disable @typescript-eslint/no-unused-expressions */
import {
  BuildExecutionState,
  BuildResult,
  BuildSequence,
  BuildHandlerConstructor,
  ExtractHandlerReturnType,
  BuildHandler,
  ExtractHandlerType,
  BuildNode,
} from './types'; // Importing type definitions related to the build process
import { Logger } from '@nestjs/common'; // Logger class from NestJS for logging
import { VirtualDirectory } from './virtual-dir'; // Virtual directory utility for managing virtual file structures
import { v4 as uuidv4 } from 'uuid'; // UUID generator for unique identifiers
import { BuildMonitor } from './monitor'; // Monitor to track the build process
import { OpenAIModelProvider } from 'src/common/model-provider/openai-model-provider'; // OpenAI model provider for LLM operations
import { RetryHandler } from './retry-handler'; // Retry handler for retrying failed operations
import { BuildHandlerManager } from './hanlder-manager'; // Manager for building handler classes
import path from 'path';
import * as fs from 'fs';
/**
 * Global data keys used throughout the build process.
 * These keys represent different project-related data that can be accessed globally within the build context.
 * @type GlobalDataKeys
 */
export type GlobalDataKeys =
  | 'projectName'
  | 'description'
  | 'platform'
  | 'databaseType'
  | 'projectUUID'
  | 'backendPath'
  | 'frontendPath';

/**
 * A generic context data type that maps keys to any value.
 * It allows storing and retrieving project-specific information in a flexible way.
 * @type ContextData
 */
type ContextData = Record<GlobalDataKeys | string, any>;

/**
 * Core build context class responsible for managing the execution of build sequences.
 * @class BuilderContext
 * @description This class handles:
 * - Managing the execution state of the build (completed, pending, failed, waiting).
 * - Handling the dependencies and execution order of nodes (steps in the build process).
 * - Managing global and node-specific context data.
 * - Coordinating with build handlers, monitors, and virtual directory operations.
 */
export class BuilderContext {
  // Keeps track of the execution state of nodes (completed, pending, failed, waiting)
  private executionState: BuildExecutionState = {
    completed: new Set(),
    pending: new Set(),
    failed: new Set(),
    waiting: new Set(),
  };

  // Logger instance for logging messages during the build process
  private logger: Logger;

  // Global context for storing project-related data
  private globalContext: Map<GlobalDataKeys | string, any> = new Map();

  // Node-specific data storage, keyed by handler constructors
  private nodeData: Map<BuildHandlerConstructor, any> = new Map();

  // Various services and utilities for managing the build process
  private handlerManager: BuildHandlerManager;
  private retryHandler: RetryHandler;
  private monitor: BuildMonitor;
  public model: OpenAIModelProvider;
  public virtualDirectory: VirtualDirectory;

  // Tracks running node executions, keyed by handler name
  private runningNodes: Map<string, Promise<BuildResult<any>>> = new Map();

  // Polling interval for checking dependencies or waiting for node execution
  private readonly POLL_INTERVAL = 500;

  private logFolder: string | null = null;

  public defaultModel: string;
  /**
   * Constructor to initialize the BuilderContext.
   * Sets up the handler manager, retry handler, model provider, logger, and virtual directory.
   * Initializes the global context with default values.
   * @param sequence The build sequence containing nodes to be executed.
   * @param id Unique identifier for the builder context.
   */
  constructor(
    private sequence: BuildSequence,
    id: string,
  ) {
    // Initialize service instances
    this.retryHandler = RetryHandler.getInstance();
    this.handlerManager = BuildHandlerManager.getInstance();
    this.model = OpenAIModelProvider.getInstance();
    this.monitor = BuildMonitor.getInstance();
    this.logger = new Logger(`builder-context-${id ?? sequence.id}`);
    this.virtualDirectory = new VirtualDirectory();
    this.defaultModel = this.sequence.model;

    this.globalContext.set('projectName', sequence.name);
    this.globalContext.set('description', sequence.description || '');
    this.globalContext.set('platform', 'web'); // Default platform is 'web'
    this.globalContext.set('databaseType', sequence.databaseType || 'SQLite');

    if (sequence.projectSize) {
      this.globalContext.set('projectSize', sequence.projectSize);
    } else {
      switch (sequence.model) {
        case 'gpt-4o-mini':
          this.globalContext.set('projectSize', 'small');
          break;
        case 'gpt-4o':
        case 'o3-mini-high':
          this.globalContext.set('projectSize', 'medium');
          break;
        default:
          this.globalContext.set('projectSize', 'small');
          break;
      }
    }
    const now = new Date();
    const projectUUIDPath =
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` +
      `-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}-${String(now.getMilliseconds()).padStart(3, '0')}` +
      '-' +
      uuidv4();
    this.globalContext.set('projectUUID', projectUUIDPath);

    if (process.env.DEBUG) {
      const timestamp =
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` +
        `-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}-${String(now.getMilliseconds()).padStart(3, '0')}`;
      this.logFolder = path.join(
        process.cwd(),
        'logs',
        `${id}-${timestamp}-${uuidv4().slice(0, 8)}`,
      );
      fs.mkdirSync(this.logFolder, { recursive: true });
    }
  }

  // publig write log method to help all handler to write log
  public writeLog(filename: string, content: any): void {
    if (!this.logFolder) return;

    try {
      const filePath = path.join(this.logFolder, filename);
      const contentStr =
        typeof content === 'string'
          ? content
          : JSON.stringify(content, null, 2);
      fs.writeFileSync(filePath, contentStr, 'utf8');
    } catch (error) {
      this.logger.error(`Failed to write log file: ${filename}`, error);
    }
  }

  /**
   * Checks if a node can be executed based on its handler's execution state and dependencies.
   * @param node The node whose execution eligibility needs to be checked.
   * @returns True if the node can be executed, otherwise false.
   */
  private canExecute(node: BuildNode): boolean {
    const handlerName = node.handler.name;

    if (
      this.executionState.completed.has(handlerName) ||
      this.executionState.pending.has(handlerName)
    ) {
      return false;
    }

    const canExecute = this.checkNodeDependencies(node);
    return canExecute;
  }

  /**
   * Invokes a handler for a specific node and returns the result.
   * Handles retries in case of failure.
   * @param node The node whose handler should be invoked.
   * @returns The result of the handler's execution.
   */
  private async invokeNodeHandler<T>(node: BuildNode): Promise<BuildResult<T>> {
    const handlerClass = node.handler;
    const handlerName = handlerClass.name;

    try {
      const handler = this.handlerManager.getHandler(handlerClass);
      const result = await handler.run(this);

      this.writeLog(`${handlerName}.md`, result.data);

      return result;
    } catch (e) {
      this.writeLog(`${handlerName}-error.json`, {
        error: e.message,
        stack: e.stack,
        timestamp: new Date().toISOString(),
      });

      const result = await this.retryHandler.retryMethod(
        e,
        (node) => this.invokeNodeHandler(node),
        [node],
      );
      if (result === undefined) {
        throw e;
      }
      return result as BuildResult<T>;
    }
  }
  // Context management methods for global and node-specific data

  /**
   * Sets a value in the global context for a specific key.
   * @param key The key to identify the context data.
   * @param value The value to store in the context.
   */
  setGlobalContext<Key extends GlobalDataKeys | string>(
    key: Key,
    value: ContextData[Key],
  ): void {
    this.globalContext.set(key, value);
  }

  /**
   * Gets a value from the global context for a specific key.
   * @param key The key of the context data.
   * @returns The value stored in the context, or undefined if not found.
   */
  getGlobalContext<Key extends GlobalDataKeys | string>(
    key: Key,
  ): ContextData[Key] | undefined {
    return this.globalContext.get(key);
  }

  /**
   * Retrieves node-specific data for a given handler class.
   * @param handlerClass The handler constructor whose node data should be retrieved.
   * @returns The node-specific data or undefined if not found.
   */
  getNodeData<T extends BuildHandlerConstructor>(
    handlerClass: T,
  ): ExtractHandlerReturnType<T> | undefined {
    return this.nodeData.get(handlerClass);
  }

  /**
   * Sets node-specific data for a given handler class.
   * @param handlerClass The handler constructor whose node data should be set.
   * @param data The data to store for the node.
   */
  setNodeData<T extends BuildHandlerConstructor>(
    handlerClass: T,
    data: ExtractHandlerReturnType<T>,
  ): void {
    this.nodeData.set(handlerClass, data);
  }

  /**
   * Gets the current execution state of the build process.
   * @returns The current execution state, including completed, pending, failed, and waiting nodes.
   */
  getExecutionState(): BuildExecutionState {
    return { ...this.executionState };
  }

  /**
   * Builds a virtual directory structure from the given JSON content.
   * @param jsonContent The JSON string representing the virtual directory structure.
   * @returns True if the structure was successfully parsed, false otherwise.
   */
  buildVirtualDirectory(jsonContent: string): boolean {
    return this.virtualDirectory.parseJsonStructure(jsonContent);
  }

  /**
   * Starts the execution of a specific node in the build sequence.
   * The node will be executed if it's eligible (i.e., not completed or pending).
   * @param node The node to execute.
   * @returns A promise resolving to the result of the node execution.
   */
  private startNodeExecution<T extends BuildHandler>(
    node: BuildNode,
  ): Promise<BuildResult<ExtractHandlerType<T>>> {
    const handlerName = node.handler.name;

    // If the node is already completed, pending, or failed, skip execution
    if (
      this.executionState.completed.has(handlerName) ||
      this.executionState.pending.has(handlerName) ||
      this.executionState.failed.has(handlerName)
    ) {
      this.logger.debug(`Node ${handlerName} already executed or in progress`);
      return;
    }

    // Mark the node as pending execution
    this.executionState.pending.add(handlerName);

    // Start monitoring node execution
    this.monitor.startNodeExecution(handlerName, this.sequence.id);

    // Execute the node handler and update the execution state accordingly
    const executionPromise = this.invokeNodeHandler<ExtractHandlerType<T>>(node)
      .then((result) => {
        // Mark the node as completed and update the state
        this.executionState.completed.add(handlerName);
        this.executionState.pending.delete(handlerName);
        // Store the result of the node execution
        this.setNodeData(node.handler, result.data);
        // End monitoring for successful execution
        this.monitor.endNodeExecution(handlerName, this.sequence.id, true);
        return result;
      })
      .catch((error) => {
        // Mark the node as failed in case of an error
        this.executionState.failed.add(handlerName);
        this.executionState.pending.delete(handlerName);
        this.logger.error(`[Node Failed] ${handlerName}:`, error);
        // End monitoring for failed execution
        this.monitor.endNodeExecution(
          handlerName,
          this.sequence.id,
          false,
          error,
        );
        throw error;
      });

    // Track the running node execution promise
    this.runningNodes.set(handlerName, executionPromise);
    return executionPromise;
  }

  /**
   * Executes the entire build sequence by iterating over all nodes in the sequence.
   * - The nodes are executed in the given order, respecting dependencies.
   * - Each node will only start execution once its dependencies are met.
   * - The method waits for all nodes to finish before completing.
   * @returns A promise that resolves when the entire build sequence is complete.
   */

  async execute(): Promise<string> {
    try {
      const nodes = this.sequence.nodes;
      let currentIndex = 0;
      const runningPromises = new Set<Promise<any>>();

      while (currentIndex < nodes.length) {
        const currentNode = nodes[currentIndex];
        if (!currentNode?.handler) {
          throw new Error(`Invalid node at index ${currentIndex}`);
        }

        const handlerName = currentNode.handler.name;

        if (!this.canExecute(currentNode)) {
          this.writeLog('execution-state.json', {
            timestamp: new Date().toISOString(),
            waiting: handlerName,
            state: {
              completed: Array.from(this.executionState.completed),
              pending: Array.from(this.executionState.pending),
              failed: Array.from(this.executionState.failed),
            },
          });
          await new Promise((resolve) =>
            setTimeout(resolve, this.POLL_INTERVAL),
          );
          continue;
        }

        const nodePromise = this.startNodeExecution(currentNode)
          .then((result) => {
            this.writeLog(`${handlerName}-complete.json`, {
              timestamp: new Date().toISOString(),
              status: 'complete',
            });
            runningPromises.delete(nodePromise);
            return result;
          })
          .catch((error) => {
            this.writeLog(`${handlerName}-error.json`, {
              timestamp: new Date().toISOString(),
              error: error.message,
              stack: error.stack,
            });
            runningPromises.delete(nodePromise);
            throw error;
          });

        runningPromises.add(nodePromise);
        currentIndex++;
      }

      while (runningPromises.size > 0) {
        await Promise.all(Array.from(runningPromises));
        await new Promise((resolve) => setTimeout(resolve, this.POLL_INTERVAL));
      }

      const projectUUID = this.getGlobalContext('projectUUID');
      await this.monitor.endSequenceExecution(this.sequence.id, projectUUID);

      this.writeLog(
        'summery-matrix.json',
        this.monitor.generateTextReport(this.sequence.id),
      );
      return projectUUID;
    } catch (error) {
      this.writeLog('execution-error.json', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }
  /**
   * Checks if a node's dependencies have been satisfied.
   * Each handler may have a set of dependencies that must be completed before the node can run.
   * @param node The node whose dependencies need to be checked.
   * @returns True if all dependencies are met, otherwise false.
   */
  private checkNodeDependencies(node: BuildNode): boolean {
    const handlerClass = this.handlerManager.getHandler(node.handler);
    const handlerName = handlerClass.name;

    if (!handlerClass.dependencies?.length) {
      this.writeLog('dependencies.json', {
        handler: handlerName,
        dependencies: [],
        message: 'No dependencies',
        timestamp: new Date().toISOString(),
      });
      return true;
    }

    const dependencies = handlerClass.dependencies;
    const dependencyStatus = dependencies.map((dep) => ({
      dependency: dep.name,
      isCompleted: this.executionState.completed.has(dep.name),
    }));

    const allDependenciesMet = dependencies.every((dep) =>
      this.executionState.completed.has(dep.name),
    );

    this.writeLog('dependencies.json', {
      handler: handlerName,
      dependencies: dependencyStatus,
      allDependenciesMet,
      timestamp: new Date().toISOString(),
    });

    return allDependenciesMet;
  }
}
