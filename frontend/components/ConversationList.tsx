import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBackend } from "../hooks/useBackend";
import type { Conversation } from "~backend/chat/types";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface ConversationListProps {
  currentConversationId: string | null;
  onSelectConversation: (id: string | null) => void;
}

export function ConversationList({ currentConversationId, onSelectConversation }: ConversationListProps) {
  const backend = useBackend();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const response = await backend.chat.listConversations();
      setConversations(response.conversations);
    } catch (error) {
      console.error("Failed to load conversations:", error);
      toast({
        title: "Error",
        description: "Failed to load conversations",
        variant: "destructive"
      });
    }
  };

  const handleNewChat = () => {
    onSelectConversation(null);
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    try {
      await backend.chat.deleteConversation({
        id
      });
      setConversations((prev: Conversation[]) => prev.filter((c: Conversation) => c.id !== id));
      if (currentConversationId === id) {
        onSelectConversation(null);
      }
      toast({
        title: "Success",
        description: "Conversation deleted"
      });
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive"
      });
    }
  };

  // Refresh conversations when a new one is created
  useEffect(() => {
    if (currentConversationId && !conversations.find((c: Conversation) => c.id === currentConversationId)) {
      loadConversations();
    }
  }, [currentConversationId]);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-3 border-b border-border">
        <Button
          onClick={handleNewChat}
          className="w-full"
          variant="outline"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {conversations.map((conversation: Conversation) => (
            <div
              key={conversation.id}
              className={cn(
                "group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors hover:bg-accent",
                currentConversationId === conversation.id && "bg-accent"
              )}
              onClick={() => onSelectConversation(conversation.id)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{conversation.title}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(conversation.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => handleDeleteConversation(conversation.id, e)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
