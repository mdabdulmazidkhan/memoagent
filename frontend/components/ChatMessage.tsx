import type { Message } from "~backend/chat/types";
import { User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

function renderContent(content: string) {
  const parts = [];
  let lastIndex = 0;
  
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  
  while ((match = imageRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {content.substring(lastIndex, match.index)}
        </span>
      );
    }
    
    const altText = match[1];
    const url = match[2];
    
    if (url.includes("mp4") || url.includes("video") || altText.toLowerCase().includes("video")) {
      parts.push(
        <video 
          key={`video-${match.index}`}
          src={url} 
          controls 
          className="max-w-full rounded-lg my-2"
          style={{ maxHeight: "500px" }}
        >
          Your browser does not support the video tag.
        </video>
      );
    } else {
      parts.push(
        <img 
          key={`img-${match.index}`}
          src={url} 
          alt={altText} 
          className="max-w-full rounded-lg my-2"
          style={{ maxHeight: "500px" }}
        />
      );
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < content.length) {
    parts.push(
      <span key={`text-${lastIndex}`}>
        {content.substring(lastIndex)}
      </span>
    );
  }
  
  return parts.length > 0 ? parts : content;
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isAssistant = message.role === "assistant";

  return (
    <div
      className={cn(
        "flex gap-4 p-4 rounded-lg transition-all",
        isAssistant ? "bg-muted/50" : "bg-background"
      )}
    >
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isAssistant ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
        )}
      >
        {isAssistant ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-foreground whitespace-pre-wrap leading-relaxed">
          {renderContent(message.content)}
          {isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-foreground animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}
