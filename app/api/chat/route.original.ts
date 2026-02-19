import { SystemPrompts } from "@/lib/prompts/system-prompts";
import { getCurrentTemporalInfo, createDetailedTemporalContext, formatDateForSearchResults, getDateStringForMockResults } from "@/lib/date-utils";
import { getAllModels } from "@/lib/models";
import type { ModelConfig } from "@/lib/models/types";
import { getProviderForModel } from "@/lib/openproviders/provider-map";
import type { Provider } from "@/lib/user-keys";
import { Attachment } from "@ai-sdk/ui-utils";
import { Message as MessageAISDK, streamText, generateText, tool } from "ai";
import { z } from "zod";
import {
  incrementMessageCount,
  logUserMessage,
  storeAssistantMessage,
  validateAndTrackUsage,
} from "./api";
import { createErrorResponse, extractErrorMessage } from "./utils";
import { googleSearch } from "@/lib/server/google-search";
import { getSearchResultsCount, type ResearchDepth } from "@/lib/research-depth";
import type { VMContext } from "@/types/vm-context.types";

export const maxDuration = 60;

type ChatRequest = {
  messages: MessageAISDK[];
  chatId: string;
  userId: string;
  model: string;
  isAuthenticated: boolean;
  systemPrompt: string;
  enableSearch: boolean;
  forceSearch?: boolean;
  researchDepth?: ResearchDepth;
  message_group_id?: string;
  machineId?: string;
  vmContext?: VMContext;
};

/**
 * Generate an enhanced search query based on conversation context
 * Uses the AI model to analyze the entire conversation and create a more targeted search query
 */
async function generateEnhancedSearchQuery(
  messages: MessageAISDK[],
  modelConfig: ModelConfig,
  apiKey: string | undefined
): Promise<{ success: boolean; query?: string; error?: string }> {
  try {
    const temporal = getCurrentTemporalInfo();
    
    // Create a context summary from the conversation
    const conversationContext = messages
      .slice(-5) // Last 5 messages for context
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const searchQueryPrompt = SystemPrompts.searchQuery(
      conversationContext,
      messages[messages.length - 1]?.content || ''
    );

    // Check if apiSdk exists before calling it
    if (!modelConfig.apiSdk) {
      return { success: false, error: "Model does not have API SDK configured" };
    }

    const result = await generateText({
      model: modelConfig.apiSdk(apiKey, { enableSearch: false }),
      prompt: searchQueryPrompt,
      maxTokens: 50,
      temperature: 0.3, // Lower temperature for more focused results
    });

    const enhancedQuery = result.text.trim()
      .replace(/^["']|["']$/g, '') // Remove quotes if present
      .slice(0, 100); // Ensure reasonable length

    if (enhancedQuery && enhancedQuery.length > 3) {
      return { success: true, query: enhancedQuery };
    } else {
      return { success: false, error: "Generated query too short or empty" };
    }
  } catch (error) {
    console.error("[API] Error generating enhanced search query:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error generating search query" 
    };
  }
}

export async function POST(req: Request) {
  const request = req; // Store request for use in tool contexts
  
  try {
    /* ------------------------------------------------------------------ */
    /* 0. Parse body & minimal validation                                 */
    /* ------------------------------------------------------------------ */
    const {
      messages,
      chatId,
      userId,
      model,
      isAuthenticated,
      systemPrompt,
      enableSearch,
      forceSearch = false,
      researchDepth = "moderate",
      message_group_id,
      machineId,
      vmContext,
    } = (await req.json()) as ChatRequest;

    if (!messages?.length || !chatId || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing messages, chatId or userId" }),
        { status: 400 }
      );
    }

    // Early validation: Remove any incomplete tool invocations from incoming messages
    const sanitizedMessages = messages.map(message => {
      if (message.role === "assistant" && Array.isArray(message.content)) {
        const sanitizedContent = message.content.filter(part => {
          if (part.type === "tool-invocation") {
            const toolInvocation = part.toolInvocation
            // Only keep complete tool invocations (those with results)
            const isComplete = toolInvocation?.state === "result" && 
                               'result' in toolInvocation &&
                               toolInvocation.result !== undefined
            if (!isComplete) {
              console.log(`[API] Early validation removing incomplete tool invocation:`, {
                toolCallId: toolInvocation?.toolCallId,
                state: toolInvocation?.state,
                toolName: toolInvocation?.toolName
              })
            }
            return isComplete
          }
          return true // Keep all non-tool content
        })
        return { ...message, content: sanitizedContent }
      }
      return message
    })

    const supabase = await validateAndTrackUsage({ userId, model, isAuthenticated });
    if (supabase) await incrementMessageCount({ supabase, userId });

    const userMessage = sanitizedMessages[sanitizedMessages.length - 1];
    if (supabase && userMessage?.role === "user") {
      await logUserMessage({
        supabase,
        userId,
        chatId,
        content: typeof userMessage.content === 'string' 
          ? userMessage.content 
          : userMessage.content
            .filter(part => part.type === 'text')
            .map(part => part.text)
            .join(''),
        attachments: userMessage.experimental_attachments as Attachment[],
        model,
        isAuthenticated,
        message_group_id,
      });
    }

    const modelConfig = (await getAllModels()).find((m) => m.id === model);
    if (!modelConfig || !modelConfig.apiSdk) {
      throw new Error(`Model ${model} not found`);
    }

    let apiKey: string | undefined;
    if (isAuthenticated) {
      const { getEffectiveApiKey } = await import("@/lib/user-keys");
      apiKey =
        (await getEffectiveApiKey(userId, getProviderForModel(model) as Provider)) ??
        undefined;
    }

    /* ------------------------------------------------------------------ */
    /* Define the Tools                                                   */
    /* ------------------------------------------------------------------ */
    // Get the number of search results based on research depth
    const searchResultsCount = getSearchResultsCount(researchDepth);
    
    // Track search calls for debugging (no longer prevents multiple searches)
    let searchCallCount = 0;
    
    const googleSearchTool = tool({
      description: 'MANDATORY TOOL: You MUST use this to search the web for EVERY user query. Search for current information, verify facts, and gather comprehensive data. Always search first before answering. You can and should call this tool multiple times with different queries to ensure thorough research.',
      parameters: z.object({
        query: z.string().describe('The search query to use. Make it specific and relevant. You can search multiple times: start broad for overview, then search for specific details, different perspectives, or verification. IMPORTANT: After all searches are complete, you MUST provide a comprehensive text response synthesizing all findings.'),
      }),
      execute: async ({ query }) => {
        // Track search call count for debugging
        searchCallCount++;
        console.log(`[API] Search call #${searchCallCount} for: "${query}"`);
        
        try {
          console.log(`[API] Executing Google search for: "${query}" with ${searchResultsCount} results (${researchDepth} depth)`);
          
          // Perform the Google search with depth-based result count
          const results = await googleSearch(query, searchResultsCount);
          
          console.log(`[API] Google search returned ${results.length} results`);
          
          if (results.length === 0) {
            console.warn("[API] Google search returned 0 results, trying fallback");
            
            // Try a simplified version of the query
            const simplifiedQuery = query
              .replace(/[^\w\s]/gi, '') // Remove special characters
              .split(' ')
              .slice(0, 5) // Take only first 5 words
              .join(' ');
              
            if (simplifiedQuery !== query) {
              const fallbackResults = await googleSearch(simplifiedQuery, searchResultsCount);
              console.log(`[API] Fallback search returned ${fallbackResults.length} results`);
              return fallbackResults.length > 0 ? fallbackResults : [];
            }
            
            return [];
          }
          
          return results;
        } catch (error) {
          console.error("[API] Google search failed:", error);
          return [];
        }
      },
    });

    // VM Action Tool - for executing actions on the VM
    const vmActionTool = vmContext && vmContext.connectionDetails ? tool({
      description: 'Execute actions on the virtual machine like clicking, typing, opening applications, etc.',
      parameters: z.object({
        action: z.enum(['click', 'double_click', 'right_click', 'type', 'key_press', 'key_combo', 'open_application', 'close_window', 'execute_command']).describe('The action to perform'),
        parameters: z.object({
          x: z.number().optional().describe('X coordinate for mouse actions'),
          y: z.number().optional().describe('Y coordinate for mouse actions'),
          text: z.string().optional().describe('Text to type'),
          keys: z.array(z.string()).optional().describe('Keys to press or key combination'),
          application: z.string().optional().describe('Application name to open'),
          command: z.string().optional().describe('Command to execute in terminal'),
          capture_screenshot: z.boolean().default(true).describe('Capture before/after screenshots'),
        }).describe('Parameters for the action'),
      }),
      execute: async ({ action, parameters }) => {
        if (!machineId || !vmContext.connectionDetails) {
          return {
            success: false,
            error: "VM connection details not available"
          };
        }
        
        try {
          // Connect to the AI agent WebSocket (always on port 8080)
          const ws = new (await import('ws')).WebSocket(
            `ws://${vmContext.connectionDetails.publicIp}:8080`
          );
          
          return new Promise((resolve) => {
            const timeout = setTimeout(() => {
              ws.close();
              resolve({
                success: false,
                error: "Action execution timeout"
              });
            }, 15000);
            
            ws.on('open', () => {
              // Send action command
              ws.send(JSON.stringify({
                type: 'command',
                data: {
                  command: action,
                  parameters: parameters
                }
              }));
            });
            
            ws.on('message', (data: Buffer) => {
              try {
                const response = JSON.parse(data.toString());
                if (response.type === 'result') {
                  clearTimeout(timeout);
                  ws.close();
                  resolve(response.data);
                }
              } catch (error) {
                console.error('Failed to parse VM action response:', error);
              }
            });
            
            ws.on('error', (error) => {
              clearTimeout(timeout);
              resolve({
                success: false,
                error: error.message
              });
            });
          });
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error executing VM action'
          };
        }
      }
    }) : undefined;

    // VM Screenshot Tool
    const vmScreenshotTool = vmContext ? tool({
      description: 'Take a screenshot of the virtual machine desktop to see the current state',
      parameters: z.object({
        captureNew: z.boolean().describe('Whether to capture a new screenshot (true) or use the existing one (false)').default(false),
      }),
      execute: async ({ captureNew }) => {
        if (!captureNew && vmContext.screenshot) {
          // Return the existing screenshot
          return {
            success: true,
            screenshot: vmContext.screenshot.imageData,
            timestamp: vmContext.screenshot.capturedAt,
            resolution: `${vmContext.screenshot.width}x${vmContext.screenshot.height}`,
            message: "Using existing screenshot from context"
          };
        }
        
        // Capture a new screenshot if requested
        if (machineId && captureNew) {
          try {
            // In server context, we need to construct the full URL
            // Use environment variable if available, otherwise construct from request
            let baseUrl = process.env.NEXT_PUBLIC_URL || process.env.NEXTAUTH_URL || '';
            
            if (!baseUrl && request && request.headers) {
              const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
              const host = request.headers.get('host') || 'localhost:3000';
              baseUrl = `${protocol}://${host}`;
            }
            
            // Fallback to localhost if nothing else works
            if (!baseUrl) {
              baseUrl = 'http://localhost:3000';
            }
            
            const response = await fetch(`${baseUrl}/api/machines/${machineId}/screenshot`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                // Forward cookies for authentication if available
                ...(request && request.headers ? { 'Cookie': request.headers.get('cookie') || '' } : {}),
              },
              body: JSON.stringify({ sessionId: vmContext.sessionId }),
            });
            
            if (response.ok) {
              const data = await response.json();
              return {
                success: true,
                screenshot: data.screenshot.imageData,
                timestamp: data.screenshot.capturedAt,
                resolution: `${data.screenshot.width}x${data.screenshot.height}`,
                message: "New screenshot captured successfully"
              };
            } else {
              return {
                success: false,
                error: "Failed to capture new screenshot",
                message: "Using existing screenshot instead",
                screenshot: vmContext.screenshot?.imageData
              };
            }
          } catch (error) {
            console.error('Error capturing new screenshot:', error);
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              message: "Failed to capture screenshot",
              screenshot: vmContext.screenshot?.imageData
            };
          }
        }
        
        return {
          success: false,
          error: "No screenshot available",
          message: "VM context does not include a screenshot"
        };
      }
    }) : undefined;

    /* ------------------------------------------------------------------ */
    /* Prepare tools and system prompt                                    */
    /* ------------------------------------------------------------------ */
    const tools = {
      ...(enableSearch && { googleSearch: googleSearchTool }),
      ...(vmContext && vmScreenshotTool && { vmScreenshot: vmScreenshotTool }),
      ...(vmContext && vmActionTool && { vmAction: vmActionTool }),
    };
    
    // Build VM context information for system prompt
    let vmContextPrompt = "";
    if (vmContext) {
      vmContextPrompt = `\n\n## Virtual Machine Context\n`;
      vmContextPrompt += `You are helping the user with a virtual machine (${vmContext.machineName}).\n`;
      vmContextPrompt += `Machine Status: ${vmContext.status}\n`;
      
      if (vmContext.screenshot) {
        vmContextPrompt += `\nA screenshot of the current VM desktop has been captured and is included with this message. `;
        vmContextPrompt += `You can see what's currently on the screen and provide assistance based on the visual context.\n`;
        vmContextPrompt += `Screenshot captured at: ${vmContext.screenshot.capturedAt}\n`;
        vmContextPrompt += `Resolution: ${vmContext.screenshot.width}x${vmContext.screenshot.height}\n`;
        vmContextPrompt += `\nYou have access to the vmScreenshot tool to view the current desktop or capture new screenshots if needed.\n`;
      }
      
      if (vmContext.connectionDetails) {
        vmContextPrompt += `\nThe VM is accessible at ${vmContext.connectionDetails.publicIp} and you can provide guidance for actions the user can take.`;
        vmContextPrompt += `\nThe user can interact with the VM through the VNC connection on port ${vmContext.connectionDetails.vncPort}.`;
        vmContextPrompt += `\nYou have access to the vmAction tool to perform actions on the VM like clicking, typing, opening applications, etc.`;
      }
    }

    // Enhanced system prompt with tool capabilities and VM context
    const enhancedSystemPrompt = SystemPrompts.enhanced(
      systemPrompt || SystemPrompts.main(),
      enableSearch,
      forceSearch
    ) + vmContextPrompt;

    /* ------------------------------------------------------------------ */
    /* 5. Ask the model with tools                                        */
    /* ------------------------------------------------------------------ */
    console.log(`[API] Sending request to ${model} with search ${enableSearch ? 'enabled' : 'disabled'}${forceSearch ? ' (forced)' : ''}`);
    
    // Clean messages for AI library - ensure tool invocations are complete pairs
    const cleanedMessages = sanitizedMessages.map(message => {
      if (message.role === "assistant" && Array.isArray(message.content)) {
        // Group tool invocations by toolCallId to ensure we have complete pairs
        const toolInvocations = message.content.filter(part => part.type === "tool-invocation")
        const toolGroups = new Map<string, any[]>()
        
        // Group by toolCallId
        toolInvocations.forEach(part => {
          if (part.type === "tool-invocation" && part.toolInvocation?.toolCallId) {
            const toolCallId = part.toolInvocation.toolCallId
            if (!toolGroups.has(toolCallId)) {
              toolGroups.set(toolCallId, [])
            }
            toolGroups.get(toolCallId)!.push(part)
          }
        })
        
        // Only keep tool invocations that have both call and result states
        const completeToolInvocations: any[] = []
        toolGroups.forEach(group => {
          const hasCall = group.some(item => item.toolInvocation?.state === "call")
          const hasResult = group.some(item => item.toolInvocation?.state === "result")
          
          // Only include this tool group if it has both call and result
          if (hasCall && hasResult) {
            completeToolInvocations.push(...group)
          } else {
            // Log incomplete tool invocations for debugging
            console.log(`[API] Filtering out incomplete tool invocation group:`, group.map(item => ({
              toolCallId: item.toolInvocation?.toolCallId,
              state: item.toolInvocation?.state,
              toolName: item.toolInvocation?.toolName
            })))
          }
        })
        
        // Filter content to only include non-tool parts + complete tool invocations
        const cleanedContent = message.content.filter(part => {
          if (part.type === "tool-invocation") {
            return completeToolInvocations.includes(part)
          }
          return true // Keep all non-tool content
        })
        
        return { ...message, content: cleanedContent }
      }
      return message
    }) as typeof sanitizedMessages
    
    // Debug logging to verify tool invocation cleaning
    console.log(`[API] Original messages: ${sanitizedMessages.length}, Cleaned messages: ${cleanedMessages.length}`)
    console.log(`[API] BEFORE CLEANING:`)
    sanitizedMessages.forEach((msg, index) => {
      if (msg.role === "assistant" && Array.isArray(msg.content)) {
        const toolInvocations = msg.content.filter(part => part.type === "tool-invocation")
        if (toolInvocations.length > 0) {
          console.log(`[API] Original Message ${index} tool invocations:`, toolInvocations.map(t => ({
            toolCallId: t.toolInvocation?.toolCallId,
            state: t.toolInvocation?.state,
            toolName: t.toolInvocation?.toolName,
            hasResult: t.toolInvocation?.state === "result" && !!t.toolInvocation?.result
          })))
        }
      }
    })
    
    console.log(`[API] AFTER CLEANING:`)
    cleanedMessages.forEach((msg, index) => {
      if (msg.role === "assistant" && Array.isArray(msg.content)) {
        const toolInvocations = msg.content.filter(part => part.type === "tool-invocation")
        if (toolInvocations.length > 0) {
          console.log(`[API] Cleaned Message ${index} tool invocations:`, toolInvocations.map(t => ({
            toolCallId: t.toolInvocation?.toolCallId,
            state: t.toolInvocation?.state,
            toolName: t.toolInvocation?.toolName,
            hasResult: t.toolInvocation?.state === "result" && !!t.toolInvocation?.result
          })))
        }
      }
    })
    
    // Final safety check - remove any remaining incomplete tool invocations
    const finalCleanedMessages = cleanedMessages.map(message => {
      if (message.role === "assistant" && Array.isArray(message.content)) {
        const safeContent = message.content.filter(part => {
          if (part.type === "tool-invocation") {
            const toolInvocation = part.toolInvocation
            // Only keep tool invocations that have state "result" AND have a result property
            const hasValidResult = toolInvocation?.state === "result" && 
                                   'result' in toolInvocation &&
                                   toolInvocation.result !== undefined
            
            if (!hasValidResult) {
              console.log(`[API] Final safety check removing incomplete tool invocation:`, {
                toolCallId: toolInvocation?.toolCallId,
                state: toolInvocation?.state,
                toolName: toolInvocation?.toolName,
                hasResult: 'result' in (toolInvocation || {})
              })
            }
            
            return hasValidResult
          }
          return true // Keep all non-tool content
        })
        return { ...message, content: safeContent }
      }
      return message
    }) as typeof sanitizedMessages

    console.log(`[API] Final safety check completed. Messages with tool invocations:`)
    finalCleanedMessages.forEach((msg, index) => {
      if (msg.role === "assistant" && Array.isArray(msg.content)) {
        const toolInvocations = msg.content.filter(part => part.type === "tool-invocation")
        if (toolInvocations.length > 0) {
          console.log(`[API] Final Message ${index} tool invocations:`, toolInvocations.map(t => ({
            toolCallId: t.toolInvocation?.toolCallId,
            state: t.toolInvocation?.state,
            toolName: t.toolInvocation?.toolName,
            hasResult: !!t.toolInvocation?.result
          })))
        }
      }
    })

    const result = streamText({
      model: modelConfig.apiSdk(apiKey, { enableSearch: false }),
      system: enhancedSystemPrompt,
      messages: finalCleanedMessages as any,
      tools,
      toolChoice: 'auto' as const, // Let the model decide when to use tools (but system prompt mandates it)
      maxSteps: 15, // Allow multiple tool calls AND ensure space for final response
      onError: (err) => console.error("[API] Streaming error:", err),
      onFinish: async ({ text, toolCalls, toolResults, reasoning, steps }) => {
        if (!supabase) return;

        console.log('[API] onFinish called with:', { 
          hasText: !!text, 
          textLength: text?.length || 0,
          toolCallsCount: toolCalls?.length || 0, 
          toolResultsCount: toolResults?.length || 0,
          hasReasoning: !!reasoning,
          stepsCount: steps?.length || 0
        });

        // Extract tool calls and results from steps if not available directly
        const allToolCalls: any[] = [];
        const allToolResults: any[] = [];

        if (steps && steps.length > 0) {
          for (const step of steps) {
            if (step.toolCalls) {
              allToolCalls.push(...step.toolCalls);
            }
            if (step.toolResults) {
              allToolResults.push(...step.toolResults);
            }
          }
        }

        // Fallback to direct parameters if available
        if (toolCalls && toolCalls.length > 0) {
          allToolCalls.push(...toolCalls);
        }
        if (toolResults && toolResults.length > 0) {
          allToolResults.push(...toolResults);
        }

        console.log('[API] Extracted tools:', { 
          toolCallsCount: allToolCalls.length, 
          toolResultsCount: allToolResults.length 
        });

        // Create messages array to match the expected format
        const messages = [];

        // Create assistant message with text content and tool invocations
        const assistantContent = [];
        
        if (reasoning) {
          assistantContent.push({ type: "reasoning" as const, text: reasoning });
        }
        
        // Always add text content, even if empty (this is critical for saving)
        assistantContent.push({ type: "text" as const, text: text || "" });

        // Add tool invocations to assistant message
        for (const toolCall of allToolCalls) {
          if (toolCall) {
            assistantContent.push({
              type: "tool-invocation" as const,
              toolInvocation: {
                state: "call" as const,
                step: 0,
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
                args: toolCall.args,
              }
            });
          }
        }

        // Add tool results to assistant message
        for (const toolResult of allToolResults) {
          assistantContent.push({
            type: "tool-invocation" as const,
            toolInvocation: {
              state: "result" as const,
              step: 0,
              toolCallId: toolResult.toolCallId,
              toolName: toolResult.toolName,
              result: toolResult.result,
            }
          });
        }

        // Always create assistant message (even if content is empty)
          const assistantMessage = {
            role: "assistant" as const,
            content: assistantContent
          };
          messages.push(assistantMessage);

        console.log('[API] Storing messages:', messages.length, 'with content parts:', assistantContent.length);
        console.log('[API] Assistant message content:', JSON.stringify(assistantMessage, null, 2));

        try {
        // Store assistant message with tool calls
        await storeAssistantMessage({
          supabase,
          chatId,
          messages,
          message_group_id,
          model,
        });
          
          console.log('[API] Assistant message stored successfully');
        } catch (storeError) {
          console.error('[API] Error storing assistant message:', storeError);
          throw storeError; // Re-throw to ensure we know about storage failures
        }

        // Collaborative rooms will automatically sync via messages table subscription
      },
    });

    /* ------------------------------------------------------------------ */
    /* 6. Stream back to client                                           */
    /* ------------------------------------------------------------------ */
    return result.toDataStreamResponse({
      sendReasoning: true,
      getErrorMessage: extractErrorMessage,
    });
  } catch (err: unknown) {
    console.error("[API] Fatal error in /api/chat:", err);
    
    // Log detailed error information for debugging
    if (err instanceof Error) {
      console.error("[API] Error details:", {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
    } else if (typeof err === 'string') {
      console.error("[API] String error:", err);
    } else {
      console.error("[API] Unknown error type:", err);
    }
    
    // Always return generic error message to user
    return createErrorResponse({ message: "Server error occurred" });
  }
}
