"use client";

import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputMessage,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import axios from "axios";
import { nanoid } from "nanoid";
import { useState } from "react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  parts: { type: "text"; text: string }[];
}

export interface MetadataChatResponseN8N {
  nodeId: string;
  nodeName: string;
  itemIndex: number;
  runIndex: number;
  timestamp: number;
}

type ChatResponseN8N = {
  type: "item" | "begin" | "end" | "error";
  content: string;
  metadata: MetadataChatResponseN8N;
};

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const handleSubmit = async (message: PromptInputMessage) => {
    const userMessage: ChatMessage = {
      id: nanoid(),
      role: "user",
      parts: [{ type: "text", text: message.text }],
    };

    const assistantMessageId = nanoid();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      parts: [{ type: "text", text: "" }],
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    try {
      await axios.post(
        "https://n8n.biuma.com.br/webhook/open-chat-n8n",
        {
          chatInput: message.text,
          sessionId: nanoid(),
        },
        {
          onDownloadProgress: (progressEvent) => {
            const xhr = progressEvent.event?.target as XMLHttpRequest;
            if (xhr) {
              const response = xhr.response;
              const lines = response.split("\n").filter(Boolean);
              const parsed: ChatResponseN8N[] = lines.map((line: string) =>
                JSON.parse(line),
              );
              const lastResponse = parsed.at(-1);

              console.log("parsed: ", parsed);
              console.log("response: ", response);
              //   console.log("parsed: ", parsed[parsed.length - 2]);

              if (lastResponse?.type === "item") {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? {
                          ...msg,
                          parts: [
                            {
                              type: "text",
                              text:
                                msg.parts[0].text + lastResponse?.content || "",
                            },
                          ],
                        }
                      : msg,
                  ),
                );
              }
              if (lastResponse?.type === "error") {
                throw new Error(JSON.stringify(lastResponse));
              }
            }
          },
        },
      );
    } catch (error) {
      console.error("Error fetching chat response:", error);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages &&
            messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  {message.parts.map((part, i) =>
                    part.type === "text" ? (
                      <MessageResponse key={i}>{part.text}</MessageResponse>
                    ) : null,
                  )}
                </MessageContent>
              </Message>
            ))}
        </ConversationContent>
      </Conversation>

      <PromptInputProvider>
        <PromptInput onSubmit={handleSubmit} className="p-4">
          <PromptInputBody>
            <PromptInputTextarea placeholder="Type a message..." />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputSubmit />
          </PromptInputFooter>
        </PromptInput>
      </PromptInputProvider>
    </div>
  );
}
