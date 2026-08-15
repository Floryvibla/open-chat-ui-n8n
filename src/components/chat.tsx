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
import { useChat } from "@/hooks/use-chat";
import { extractItemContents, hasStreamEvents } from "@/lib/n8n-stream-parser";
import type { UIMessage } from "ai";

export function Chat() {
  const { messages, append, isLoading } = useChat({
    api: "https://n8n.biuma.com.br/webhook/open-chat-n8n",
    body: (message) => ({
      chatInput: message.parts[0].text,
      sessionId: "124",
    }),
  });

  const handleSubmit = (message: PromptInputMessage) => {
    append(message.text);
  };

  const parseMessages = messages.map((message) => {
    if (message.role === "user") {
      return message;
    }
    return {
      ...message,
      parts: message.parts
        .map((part) => {
          const extracted = extractItemContents(part?.text);
          if (extracted) {
            return { ...part, text: extracted };
          }
          if (hasStreamEvents(part?.text)) {
            return { ...part, text: "" };
          }
          return part;
        })
        .filter((part) => !(part.type === "text" && !part.text?.trim())),
    };
  });

  return (
    <div className="h-screen flex flex-col">
      <Conversation className="flex-1">
        <ConversationContent>
          {parseMessages.map((message) => (
            <Message key={message.id} from={message.role as UIMessage["role"]}>
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
            <PromptInputSubmit disabled={isLoading} />
          </PromptInputFooter>
        </PromptInput>
      </PromptInputProvider>
    </div>
  );
}
