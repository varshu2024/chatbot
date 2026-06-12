import { useEffect, useRef, useState } from "react";
import { skipToken } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Streamdown } from "streamdown";
import { Send, Plus, Trash2, RotateCcw, Menu, X } from "lucide-react";
import { useLocation } from "wouter";
import { useIsMobile } from "@/hooks/useMobile";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";

export default function Chat() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Array<{ id: number; role: string; content: string }>>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversations, setConversations] = useState<Array<{ id: number; title: string }>>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<number | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const streamingContentRef = useRef("");
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations
  const listConversations = trpc.chat.listConversations.useQuery();
  const createConversationMutation = trpc.chat.createConversation.useMutation();
  const deleteConversationMutation = trpc.chat.deleteConversation.useMutation();
  const getMessagesMutation = trpc.chat.getMessages.useQuery(
    currentConversationId ? { conversationId: currentConversationId } : skipToken
  );
  const [streamInput, setStreamInput] = useState<{
    conversationId: number;
    message: string;
  } | null>(null);
  const streamMessageMutation = trpc.chat.streamMessage.useSubscription(
    streamInput || skipToken,
    {
      onData: (data) => {
        streamingContentRef.current += data.token;
        setStreamingContent(streamingContentRef.current);
      },
      onError: (error) => {
        console.error("Streaming error:", error);
        streamingContentRef.current = "";
        setStreamingContent("");
        setIsStreaming(false);
        setStreamInput(null);
      },
      onComplete: () => {
        // Add the complete streamed message to messages
        const finalContent = streamingContentRef.current.trim();
        if (finalContent) {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now(),
              role: "assistant",
              content: finalContent,
            },
          ]);
        }
        streamingContentRef.current = "";
        setStreamingContent("");
        setIsStreaming(false);
        setStreamInput(null);
      },
    }
  );
  const utils = trpc.useUtils();

  // Update conversations list
  useEffect(() => {
    if (listConversations.data) {
      setConversations(listConversations.data);
      if (!currentConversationId && listConversations.data.length > 0) {
        setCurrentConversationId(listConversations.data[0].id);
      }
    }
  }, [listConversations.data, currentConversationId]);

  // Update messages when conversation changes
  useEffect(() => {
    if (getMessagesMutation.data) {
      setMessages(getMessagesMutation.data);
    }
  }, [getMessagesMutation.data]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming, streamingContent]);

  // Handle new conversation
  const handleNewConversation = async () => {
    try {
      const result = await createConversationMutation.mutateAsync({});
      setCurrentConversationId(result.id);
      setMessages([]);
      setInputValue("");
      await utils.chat.listConversations.invalidate();
      toast.success("New conversation created");
      if (isMobile) setSidebarOpen(false);
    } catch (error) {
      console.error("Failed to create conversation:", error);
      toast.error("Failed to create conversation. Please try again.");
    }
  };

  // Handle clear conversation
  const handleClearConversation = async () => {
    if (!currentConversationId) return;
    try {
      // Delete and recreate the conversation
      await deleteConversationMutation.mutateAsync({
        conversationId: currentConversationId,
      });
      const result = await createConversationMutation.mutateAsync({});
      setCurrentConversationId(result.id);
      setMessages([]);
      setInputValue("");
      await utils.chat.listConversations.invalidate();
      toast.success("Conversation cleared");
    } catch (error) {
      console.error("Failed to clear conversation:", error);
      toast.error("Failed to clear conversation. Please try again.");
    }
  };

  // Handle delete conversation
  const handleDeleteConversation = async () => {
    if (!conversationToDelete) return;
    try {
      await deleteConversationMutation.mutateAsync({
        conversationId: conversationToDelete,
      });
      setShowDeleteDialog(false);
      setConversationToDelete(null);
      setCurrentConversationId(null);
      setMessages([]);
      await utils.chat.listConversations.invalidate();
      toast.success("Conversation deleted");
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      toast.error("Failed to delete conversation. Please try again.");
    }
  };

  // Handle send message with streaming
  const handleSendMessage = async () => {
    if (!inputValue.trim() || !currentConversationId || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue("");

    // Add user message to UI immediately
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        role: "user",
        content: userMessage,
      },
    ]);

    setIsLoading(true);
    setIsStreaming(true);
    setStreamingContent("");

    try {
      // Start streaming
      setStreamInput({
        conversationId: currentConversationId,
        message: userMessage,
      });
    } catch (error) {
      console.error("Failed to send message:", error);
      // Remove the user message if sending failed
      setMessages((prev) => prev.slice(0, -1));
      setIsStreaming(false);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border space-y-2">
        <Button
          onClick={handleNewConversation}
          className="w-full"
          size="sm"
          variant="default"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
        {currentConversationId && (
          <Button
            onClick={handleClearConversation}
            className="w-full"
            size="sm"
            variant="outline"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Clear Chat
          </Button>
        )}
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto">
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={`p-3 border-b border-border cursor-pointer hover:bg-muted transition-colors ${
              currentConversationId === conv.id ? "bg-muted" : ""
            }`}
            onClick={() => {
              setCurrentConversationId(conv.id);
              if (isMobile) setSidebarOpen(false);
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{conv.title}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setConversationToDelete(conv.id);
                  setShowDeleteDialog(true);
                }}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg text-muted-foreground mb-4">Please log in to use the chat</p>
          <Button onClick={() => setLocation("/")}>Back to Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <div className="w-64 border-r border-border bg-card flex flex-col hidden md:flex">
          <SidebarContent />
        </div>
      )}

      {/* Mobile Sidebar Drawer */}
      {isMobile && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="border-b border-border p-4">
              <SheetTitle>Conversations</SheetTitle>
            </SheetHeader>
            <div className="h-[calc(100vh-60px)]">
              <SidebarContent />
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Mobile Header */}
        {isMobile && (
          <div className="border-b border-border p-4 flex items-center justify-between bg-card">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <h1 className="text-sm font-semibold">AI Chat</h1>
            <div className="w-10" />
          </div>
        )}

        {currentConversationId ? (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              {messages.length === 0 && !isStreaming ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-muted-foreground">
                    <p>Start a conversation by typing a message below</p>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`message-bubble max-w-xs md:max-w-2xl px-4 py-3 rounded-lg ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-br-none"
                            : "bg-muted text-foreground rounded-bl-none border border-border"
                        }`}
                      >
                        {msg.role === "assistant" ? (
                          <Streamdown>{msg.content}</Streamdown>
                        ) : (
                          <p className="text-sm">{msg.content}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {isStreaming && streamingContent && (
                    <div className="flex justify-start">
                      <div className="message-bubble max-w-xs md:max-w-2xl px-4 py-3 rounded-lg bg-muted text-foreground rounded-bl-none border border-border">
                        <Streamdown>{streamingContent}</Streamdown>
                      </div>
                    </div>
                  )}
                  {isStreaming && !streamingContent && (
                    <div className="flex justify-start">
                      <div className="typing-indicator bg-muted text-foreground px-4 py-3 rounded-lg rounded-bl-none border border-border flex items-center gap-2">
                        <Spinner className="w-4 h-4" />
                        <span className="text-sm text-muted-foreground">AI is thinking...</span>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border p-4 bg-background">
              <div className="flex gap-2 max-w-4xl mx-auto">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type your message..."
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={isLoading || !inputValue.trim()}
                  size="icon"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <p>Create a new conversation to get started</p>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this conversation? This action cannot be undone.
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConversation}>
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
