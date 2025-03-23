import { ChatInputType } from '@/graphql/type';
import { AgentContext } from './agentPrompt';
import {
  taskTool,
  readFileTool,
  applyChangesTool,
  codeReviewTool,
  commitChangesTool,
  editFileTool,
  summaryTool,
} from './tools';

export interface ToolUsage {
  useFor: string; // Purpose of the tool
  input: string; // Input description
  output: string; // Output description
  whenToUse: string; // When to use the tool
  nextStep?: string; // Typical next step
}

// Modify the Tool interface to include usage instructions
export interface Tool {
  toolName: string;
  behavior: (input: ChatInputType, context: AgentContext) => Promise<void>;
  description: string;
  usage: ToolUsage;
}

export const managerTools: Tool[] = [
  {
    toolName: 'summaryTool',
    behavior: summaryTool,
    description:
      'Generates a final response summary and thinking process summary of the conversation.',
    usage: {
      useFor: 'Summarizing conversation and generating final response',
      input: 'Accumulated thoughts and conversation history',
      output: 'Final response and thinking process summary',
      whenToUse: 'After all task steps are completed',
      nextStep: 'Task completed',
    },
  },
  {
    toolName: 'taskTool',
    behavior: taskTool,
    description:
      'Analyzes task requirements, identifies relevant files, and generates a processing plan.',
    usage: {
      useFor:
        'Understanding the task requirements and identifying relevant files',
      input: 'Task description and current status',
      output: 'List of files that need to be checked or modified',
      whenToUse: 'At the beginning of a task or when new files are required',
      nextStep: 'readFileTool',
    },
  },
  {
    toolName: 'readFileTool',
    behavior: readFileTool,
    description: 'Reads the content of identified files.',
    usage: {
      useFor: 'Retrieving file content for analysis and modification',
      input: 'List of file paths',
      output: 'File content',
      whenToUse: 'After identifying the files to be processed',
      nextStep: 'editFileTool',
    },
  },
  {
    toolName: 'editFileTool',
    behavior: editFileTool,
    description:
      'Generates editing prompts based on the file content stored in the context.',
    usage: {
      useFor: 'Implementing the required code changes',
      input: 'File content and modification plan',
      output: 'Modified code',
      whenToUse: 'After analysis is complete or when fixes are needed',
      nextStep: 'codeReviewTool',
    },
  },
  {
    toolName: 'codeReviewTool',
    behavior: codeReviewTool,
    description:
      'Generates a code review report based on the modified file content in the context.',
    usage: {
      useFor: 'Ensuring code quality and correctness',
      input: 'Modified file content',
      output: 'Review comments and suggestions',
      whenToUse: 'After code modifications',
      nextStep:
        'If issues exist, return to editFileTool; if passed, proceed to applyChangesTool',
    },
  },
  {
    toolName: 'applyChangesTool',
    behavior: applyChangesTool,
    description:
      'Synchronizes modifications to the file content in the context.',
    usage: {
      useFor: 'Confirming and applying verified changes',
      input: 'Reviewed and approved modifications',
      output: 'Updated file content',
      whenToUse: 'After code review is completed',
      nextStep: 'commitChangesTool',
    },
  },
  {
    toolName: 'commitChangesTool',
    behavior: commitChangesTool,
    description:
      'Generates commit messages based on modifications stored in the context.',
    usage: {
      useFor: 'Generating descriptive commit messages',
      input: 'All applied changes',
      output: 'Commit message',
      whenToUse: 'After changes have been applied',
      nextStep: 'Task completed',
    },
  },
];

export function findToolNode(toolName: string): Tool | undefined {
  return managerTools.find((tool) => tool.toolName === toolName);
}

// Helper function: Retrieve tool usage instructions
export function getToolUsageMap(): Record<string, ToolUsage> {
  const usageMap: Record<string, ToolUsage> = {};
  managerTools.forEach((tool) => {
    usageMap[tool.toolName] = tool.usage;
  });
  return usageMap;
}

// Helper function: Retrieve tool descriptions
export function getToolDescriptionMap(): Record<string, string> {
  const descMap: Record<string, string> = {};
  managerTools.forEach((tool) => {
    descMap[tool.toolName] = tool.description;
  });
  return descMap;
}
