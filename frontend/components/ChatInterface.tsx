import { useState, useEffect, useRef } from "react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { useBackend } from "../hooks/useBackend";
import type { Message, ConversationWithMessages } from "~backend/chat/types";
import { useToast } from "@/components/ui/use-toast";

interface ChatInterfaceProps {
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
}

export function ChatInterface({ conversationId, onConversationCreated }: ChatInterfaceProps) {
  const backend = useBackend();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (conversationId) {
      loadConversation();
    } else {
      setMessages([]);
    }
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadConversation = async () => {
    if (!conversationId) return;

    try {
      const conversation: ConversationWithMessages = await backend.chat.getConversation({
        id: conversationId
      });
      setMessages(conversation.messages);
    } catch (error) {
      console.error("Failed to load conversation:", error);
      toast({
        title: "Error",
        description: "Failed to load conversation",
        variant: "destructive"
      });
    }
  };

  const handleSendMessage = async (content: string) => {
    let currentConversationId = conversationId;

    try {
      // Create new conversation if needed
      if (!currentConversationId) {
        const conversation = await backend.chat.createConversation({});
        currentConversationId = conversation.id;
        onConversationCreated(conversation.id);
      }

      // Add user message optimistically
      const userMessage: Message = {
        id: Date.now().toString(),
        conversationId: currentConversationId,
        role: "user",
        content,
        createdAt: new Date()
      };
      setMessages((prev: Message[]) => [...prev, userMessage]);
      setIsLoading(true);
      setStreamingContent("");

      // Stream response
      const stream = await backend.chat.sendMessage({
        conversationId: currentConversationId,
        content
      });

      for await (const chunk of stream) {
        if (chunk && chunk.type === "chunk" && chunk.content) {
          setStreamingContent((prev: string) => prev + chunk.content);
        } else if (chunk && chunk.type === "done") {
          if (streamingContent) {
            const assistantMessage: Message = {
              id: chunk.messageId || Date.now().toString(),
              conversationId: currentConversationId,
              role: "assistant",
              content: streamingContent,
              createdAt: new Date()
            };
            setMessages((prev: Message[]) => [...prev, assistantMessage]);
          }
          setStreamingContent("");
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
      setIsLoading(false);
      setStreamingContent("");
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && !streamingContent && (
            <div className="text-center text-muted-foreground py-12">
              <h2 className="text-2xl font-semibold mb-2">Start a conversation</h2>
              <p>Ask me anything!</p>
            </div>
          )}
          {messages.map((message: Message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {streamingContent && (
            <ChatMessage
              message={{
                id: "streaming",
                conversationId: conversationId || "",
                role: "assistant",
                content: streamingContent,
                createdAt: new Date()
              }}
              isStreaming
            />
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <ChatInput onSend={handleSendMessage} disabled={isLoading} />
    </div>
  );
}
