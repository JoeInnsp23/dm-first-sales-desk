"use client";

import { useEffect, useState } from "react";
import { ThreadList } from "@/components/inbox/thread-list";
import { MessageView } from "@/components/inbox/message-view";
import { ComposeMessage } from "@/components/inbox/compose-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  MoreVertical,
  Star,
  Archive,
  CheckCheck,
  Clock,
  User,
} from "lucide-react";
import type { Thread, Message } from "@/types/inbox";

export default function InboxPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  // Load threads
  useEffect(() => {
    loadThreads();
  }, []);

  // Load messages when thread is selected
  useEffect(() => {
    if (selectedThreadId) {
      loadMessages(selectedThreadId);
    }
  }, [selectedThreadId]);

  const loadThreads = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/v1/threads?status=open&pageSize=50");
      const data = await response.json();
      setThreads(data.data || []);

      // Auto-select first thread
      if (data.data?.length > 0 && !selectedThreadId) {
        setSelectedThreadId(data.data[0].id);
      }
    } catch (error) {
      console.error("Failed to load threads:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (threadId: string) => {
    try {
      const response = await fetch(`/api/v1/threads/${threadId}/messages`);
      const data = await response.json();
      setMessages(data.data || []);

      // Mark thread as read
      await fetch(`/api/v1/threads/${threadId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read" }),
      });
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedThreadId) return;

    try {
      setIsSending(true);
      await fetch(`/api/v1/threads/${selectedThreadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "text",
          content,
        }),
      });

      // Reload messages after a short delay (to allow worker to process)
      setTimeout(() => loadMessages(selectedThreadId), 1000);
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleRequestSuggestion = async () => {
    if (!selectedThreadId) return;

    try {
      const response = await fetch(`/api/v1/threads/${selectedThreadId}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "suggest_reply" }),
      });

      const data = await response.json();

      if (data.data?.suggestion) {
        alert(`AI Suggestion:\n\n${data.data.suggestion}`);
        // In a real implementation, you'd show this in a better UI
      }
    } catch (error) {
      console.error("Failed to get AI suggestion:", error);
    }
  };

  const handleThreadAction = async (action: string) => {
    if (!selectedThreadId) return;

    try {
      await fetch(`/api/v1/threads/${selectedThreadId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      // Reload threads
      loadThreads();
    } catch (error) {
      console.error("Failed to perform action:", error);
    }
  };

  const selectedThread = threads.find((t) => t.id === selectedThreadId);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Inbox</h1>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {threads.filter((t) => t.hasUnreadMessages).length} unread
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Thread List Sidebar */}
        <div className="w-80 border-r">
          <div className="border-b p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search conversations..." className="pl-9" />
            </div>
          </div>
          <ThreadList
            threads={threads}
            selectedThreadId={selectedThreadId}
            onSelectThread={setSelectedThreadId}
          />
        </div>

        {/* Message View */}
        <div className="flex flex-1 flex-col">
          {selectedThread ? (
            <>
              {/* Thread Header */}
              <div className="flex items-center justify-between border-b bg-background px-6 py-4">
                <div className="flex items-center gap-3">
                  <div>
                    <h2 className="font-semibold">
                      {selectedThread.contact.name ||
                        selectedThread.contact.phone ||
                        "Unknown"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      via {selectedThread.channelConnection.name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleThreadAction("star")}
                  >
                    <Star
                      className={
                        selectedThread.isStarred
                          ? "fill-yellow-400 text-yellow-400"
                          : ""
                      }
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleThreadAction("close")}
                  >
                    <CheckCheck />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleThreadAction("archive")}
                  >
                    <Archive />
                  </Button>
                  <Separator orientation="vertical" className="h-6" />
                  <Button variant="ghost" size="icon">
                    <MoreVertical />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-hidden">
                <MessageView
                  messages={messages}
                  contactName={selectedThread.contact.name || undefined}
                  contactAvatar={selectedThread.contact.avatarUrl}
                />
              </div>

              {/* Compose */}
              <ComposeMessage
                onSend={handleSendMessage}
                onRequestSuggestion={handleRequestSuggestion}
                isLoading={isSending}
              />
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted-foreground">Select a conversation to start</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
