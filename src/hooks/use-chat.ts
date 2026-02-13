/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosRequestConfig } from "axios";
import { nanoid } from "nanoid";
import { useCallback, useRef, useState } from "react";

/**
 * Interface representing a chat message part.
 */
export interface ChatMessagePart {
  type: "text" | "image" | "file";
  text?: string;
  image_url?: string;
  file_url?: string;
}

/**
 * Interface representing a chat message.
 */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  parts: ChatMessagePart[];
  createdAt?: Date;
}

/**
 * Configuration options for the useChat hook.
 */
export interface UseChatOptions {
  /**
   * The API endpoint to send the chat message to.
   * Defaults to '/api/chat'.
   */
  api?: string;

  /**
   * Initial messages to seed the chat with.
   */
  initialMessages?: ChatMessage[];

  /**
   * Callback fired when a response chunk is received.
   */
  onResponse?: (response: string) => void;

  /**
   * Callback fired when the chat stream finishes.
   */
  onFinish?: (message: ChatMessage) => void;

  /**
   * Callback fired when an error occurs.
   */
  onError?: (error: Error) => void;

  /**
   * Custom headers to send with the request.
   */
  headers?: Record<string, string>;

  /**
   * Custom body to merge with the request payload.
   * Can be a function that returns the body based on the message.
   */
  body?: Record<string, any> | ((message: ChatMessage) => Record<string, any>);
}

/**
 * A custom hook to manage chat state and interactions.
 * It handles sending messages, streaming responses, and managing loading states.
 *
 * @param {UseChatOptions} options - Configuration options for the hook.
 * @returns {object} - Chat state and control functions.
 */
export function useChat({
  api = "/api/chat",
  initialMessages = [],
  onResponse,
  onFinish,
  onError,
  headers,
  body,
}: UseChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  // Ref to keep track of the abort controller for the current request
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Updates the input state.
   * @param {React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | string} e - The change event or string value.
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | string) => {
      if (typeof e === "string") {
        setInput(e);
      } else if (e && e.target) {
        setInput(e.target.value);
      }
    },
    [],
  );

  /**
   * Stops the current request if it is loading.
   */
  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, []);

  /**
   * Appends a message to the chat and triggers the API call.
   * @param {ChatMessage | string} message - The message object or string content to send.
   */
  const append = useCallback(
    async (message: ChatMessage | string) => {
      // Create user message object
      const userMessage: ChatMessage =
        typeof message === "string"
          ? {
              id: nanoid(),
              role: "user",
              parts: [{ type: "text", text: message }],
              createdAt: new Date(),
            }
          : message;

      setIsLoading(true);
      setError(undefined);

      // Create a placeholder for the assistant's response
      const assistantMessageId = nanoid();
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        parts: [{ type: "text", text: "" }],
        createdAt: new Date(),
      };

      // Optimistically update UI
      setMessages((prev) => [...prev, userMessage, assistantMessage]);

      // If passing string, clear input automatically
      if (typeof message === "string") {
        setInput("");
      }

      // Create new abort controller
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const config: AxiosRequestConfig = {
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          signal: abortController.signal,
          onDownloadProgress: (progressEvent) => {
            const xhr = progressEvent.event?.target as XMLHttpRequest;
            if (xhr) {
              const response = xhr.responseText || xhr.response;

              // Call onResponse callback if provided
              onResponse?.(response);

              // Update the assistant message with the partial response
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, parts: [{ type: "text", text: response }] }
                    : msg,
                ),
              );
            }
          },
        };

        // Prepare payload
        const requestBody =
          typeof body === "function"
            ? body(userMessage)
            : {
                messages: [...messages, userMessage],
                chatInput: userMessage.parts[0].text, // Default common field
                ...body,
              };

        await axios.post(api, requestBody, config);

        // On success completion
        onFinish?.(assistantMessage);
      } catch (err: any) {
        if (axios.isCancel(err)) {
          console.log("Request canceled");
        } else {
          console.error("Error in useChat:", err);
          setError(err);
          onError?.(err);

          // Optional: Mark the message as error or remove it?
          // For now, we leave it as is, maybe with partial content if any arrived.
        }
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [api, headers, body, messages, onResponse, onFinish, onError],
  );

  /**
   * Wrapper for form submission or simple text sending.
   * @param {React.FormEvent | string} [e] - The form event or string content.
   */
  const handleSubmit = useCallback(
    async (e?: React.FormEvent | string) => {
      if (e && typeof e !== "string") {
        e.preventDefault();
      }

      const content = typeof e === "string" ? e : input;
      if (!content.trim()) return;

      await append(content);
      setInput("");
    },
    [input, append],
  );

  /**
   * Clears the chat history.
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setInput("");
    setError(undefined);
    stop();
  }, [stop]);

  return {
    messages,
    setMessages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    append,
    stop,
    isLoading,
    error,
    clearMessages,
  };
}
