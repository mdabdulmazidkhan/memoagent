import { useState } from "react";
import { ClerkProvider, SignIn, SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import { ChatInterface } from "./components/ChatInterface";
import { ConversationList } from "./components/ConversationList";
import { Menu, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const PUBLISHABLE_KEY = "pk_test_bm90YWJsZS1waXBlZmlzaC01NS5jbGVyay5hY2NvdW50cy5kZXYk";

function AppInner() {
  const [darkMode, setDarkMode] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="flex h-screen bg-background text-foreground">
        <SignedOut>
          <div className="flex items-center justify-center w-full h-full">
            <SignIn />
          </div>
        </SignedOut>

        <SignedIn>
          {/* Sidebar */}
          <div className={`${sidebarOpen ? "w-64" : "w-0"} transition-all duration-300 overflow-hidden border-r border-border`}>
            <ConversationList
              currentConversationId={currentConversationId}
              onSelectConversation={setCurrentConversationId}
            />
          </div>

          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="h-14 border-b border-border flex items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <h1 className="text-lg font-semibold text-foreground">AI Chat</h1>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDarkMode(!darkMode)}
                >
                  {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </Button>
                <UserButton />
              </div>
            </div>

            {/* Chat Interface */}
            <ChatInterface
              conversationId={currentConversationId}
              onConversationCreated={setCurrentConversationId}
            />
          </div>
        </SignedIn>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <AppInner />
    </ClerkProvider>
  );
}
