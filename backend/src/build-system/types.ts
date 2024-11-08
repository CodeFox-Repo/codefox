import { BuilderContext } from './context';

export type BuildNodeType =
  | 'PROJECT_SETUP'
  | 'ANALYSIS'
  | 'DATABASE'
  | 'BACKEND'
  | 'UX'
  | 'WEBAPP';

export type BuildSubType = {
  ANALYSIS: 'PRD' | 'FRD' | 'DRD' | 'BRD' | 'UXSD' | 'UXDD';
  DATABASE: 'SCHEMAS' | 'POSTGRES';
  BACKEND: 'OPENAPI' | 'ASYNCAPI' | 'SERVER';
  UX: 'SITEMAP' | 'DATAMAP' | 'VIEWS';
  WEBAPP: 'STORE' | 'ROOT' | 'VIEW';
  PROJECT_SETUP: never;
};

export interface BuildBase {
  id: string;
  name: string;
  description?: string;
  requires?: string[];
}

export interface BuildNode extends BuildBase {
  type: BuildNodeType;
  subType?: BuildSubType[BuildNodeType];
  config?: Record<string, any>;
}

export interface BuildStep {
  id: string;
  name: string;
  description?: string;
  parallel?: boolean;
  nodes: BuildNode[];
}

export interface BuildSequence {
  id: string;
  version: string;
  name: string;
  description?: string;
  steps: BuildStep[];
}

export interface BuildHandlerContext {
  data: Record<string, any>;
  run: (nodeId: string) => Promise<BuildResult>;
}

export type BuildHandler = (context: BuilderContext) => Promise<BuildResult>;

export interface BuildHandlerRegistry {
  [key: string]: BuildHandler;
}
export interface BuildContext {
  data: Record<string, any>;
  completedNodes: Set<string>;
  pendingNodes: Set<string>;
}

export interface BuildResult {
  success: boolean;
  data?: any;
  error?: Error;
}

export interface BuildExecutionState {
  completed: Set<string>;
  pending: Set<string>;
  failed: Set<string>;
  waiting: Set<string>;
}
