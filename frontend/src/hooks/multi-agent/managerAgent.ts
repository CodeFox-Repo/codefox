import { ChatInputType } from '@/graphql/type';
import { startChatStream } from '@/api/ChatStreamAPI';
import { findToolNode } from './toolNodes';
import { confirmationPrompt, AgentContext, TaskType } from './agentPrompt';
import path from 'path';
import { parseXmlToJson } from '@/utils/parser';
import { Message } from '@/const/MessageType';
import { toast } from 'sonner';

/**
 * Normalize file paths.
 */
function normalizePath(filePath: string): string {
  return path.normalize(filePath).replace(/\\/g, '/');
}

/**
 * Validate and normalize file list.
 */
function validateFiles(files: string[]): string[] {
  return files.map((file) => {
    const normalized = normalizePath(file);
    if (!normalized || normalized.includes('..')) {
      throw new Error(`Invalid file path: ${file}`);
    }
    return normalized;
  });
}

/**
 * The Manager Agent is responsible for:
 * 1. Initializing the context.
 * 2. Letting AI determine each step of the process.
 * 3. Executing the tool selected by AI.
 * 4. Repeating until AI determines the task is complete.
 */
export async function managerAgent(
  tempId: string,
  input: ChatInputType,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  projectPath: string,
  saveMessage: any,
  token: string,
  refreshProjects: () => Promise<void>,
  setFilePath: (path: string) => void,
  editorRef: React.MutableRefObject<any>,
  setThinkingProcess: React.Dispatch<React.SetStateAction<Message[]>>,
  setIsTPUpdating: React.Dispatch<React.SetStateAction<boolean>>,
  setLoadingSubmit: React.Dispatch<React.SetStateAction<boolean>>
): Promise<string> {
  try {
    // Initialize context
    const context: AgentContext = {
      tempId,
      task_type: undefined, // Will be set after task analysis
      request: input.message, // Store the original request
      projectPath,
      fileStructure: [],
      fileContents: {},
      modifiedFiles: {},
      requiredFiles: [], // Initialize empty array for required files
      accumulatedThoughts: [], // Initialize empty array for thoughts
      currentStep: {
        tool: undefined,
        status: 'initializing',
        description: 'Starting task analysis',
      },
      setMessages,
      saveMessage,
      token,
      setFilePath,
      editorRef,
      setThinkingProcess,
      setIsTPUpdating,
      setLoadingSubmit,
    };

    // Retrieve project file structure
    const response = await fetch(
      `/api/filestructure?path=${encodeURIComponent(projectPath)}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const data = await response.json();
    context.fileStructure = validateFiles(data.res);

    const MAX_ITERATIONS = 60;
    const TIMEOUT = 30 * 60 * 1000; // 30-minute timeout
    const startTime = Date.now();
    let iteration = 0;

    // Main loop: let AI determine each step
    while (iteration < MAX_ITERATIONS && Date.now() - startTime < TIMEOUT) {
      // Get AI's decision
      const confirmationPromptStr = confirmationPrompt(
        context.task_type,
        context
      );
      const response = await startChatStream(
        {
          chatId: input.chatId,
          message: confirmationPromptStr,
          model: input.model,
          role: `assistant`,
        },
        token
      );

      // Parse AI's response using `parseXmlToJson`
      let decision;
      try {
        decision = parseXmlToJson(response);
      } catch (error) {
        toast.error('Failed to parse AI response');
        throw error;
      }

      // If task is complete, exit loop
      if (decision.completed) {
        break;
      }

      // Update the current step in context
      context.currentStep = {
        tool: decision.next_step.tool,
        status: 'executing',
        description: decision.next_step.description,
      };
      if (decision.next_step.files) {
        context.requiredFiles = [
          ...context.requiredFiles,
          ...decision.next_step.files.filter(
            (file) => !context.requiredFiles.includes(file)
          ),
        ];
      }
      context.requiredFiles = [
        ...context.requiredFiles,
        ...decision.next_step.files.filter(
          (file) => !context.requiredFiles.includes(file)
        ),
      ];
      // Find and execute the tool
      const toolNode = findToolNode(decision.next_step.tool);
      if (!toolNode) {
        throw new Error(`Tool not found: ${decision.next_step.tool}`);
      }

      // Execute the tool
      const toolInput = {
        ...input,
        role: `assistant`,
        message: decision.next_step.description,
      };

      await toolNode.behavior(toolInput, context);

      // Update step status
      context.currentStep.status = 'completed';

      iteration++;
      if (context.task_type == TaskType.UNRELATED) {
        break;
      }
    }

    // Check if task exceeded limits
    if (iteration >= MAX_ITERATIONS) {
      throw new Error('Task exceeded maximum iterations');
    }
    if (Date.now() - startTime >= TIMEOUT) {
      throw new Error('Task timed out');
    }

    // Handle final file modifications
    if (Object.keys(context.modifiedFiles).length > 0) {
      await Promise.all(
        Object.entries(context.modifiedFiles).map(
          async ([filePath, content]) => {
            try {
              await fetch('/api/file', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  filePath: normalizePath(`${context.projectPath}/${filePath}`),
                  newContent: content,
                }),
              });
            } catch (error) {
              toast.error('Failed to save file');
              throw error;
            }
          }
        )
      );

      // Refresh projects to update the code display
      await refreshProjects();
    }

    // Generate summary and save message
    if (context.accumulatedThoughts.length > 0) {
      // Create summary using summaryTool
      const toolNode = findToolNode('summaryTool');
      if (!toolNode) {
        throw new Error('Summary tool not found');
      }

      await toolNode.behavior(input, context);

      // Save the final summary message
      if (context.final_response) {
        context.saveMessage({
          variables: {
            input: {
              chatId: input.chatId,
              message: JSON.stringify({
                final_response: context.final_response,
                thinking_process: context.accumulatedThoughts.join('\n\n'),
              }),
              model: input.model,
              role: 'assistant',
            },
          },
        });
      }
    }

    return context.accumulatedThoughts.join('\n\n');
  } catch (error) {
    toast.error('Failed to complete task');
    throw error;
  }
}
