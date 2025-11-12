"use client";

import { useEffect, useState } from "react";
import { PipelineColumn } from "@/components/pipeline/pipeline-column";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter } from "lucide-react";

interface Thread {
  id: string;
  contact: {
    name: string | null;
    avatarUrl: string | null;
  };
  channelConnection: {
    type: "whatsapp" | "instagram" | "tiktok_shop";
  };
  pipelineStage: "lead" | "engaged" | "converted" | "lost";
  lastMessageAt: string;
  lastMessagePreview: string | null;
  hasUnreadMessages: boolean;
}

const stages = [
  {
    id: "lead",
    title: "Lead",
    color: "border-l-blue-500",
    description: "New potential customers",
  },
  {
    id: "engaged",
    title: "Engaged",
    color: "border-l-yellow-500",
    description: "Active conversations",
  },
  {
    id: "converted",
    title: "Converted",
    color: "border-l-green-500",
    description: "Successful sales",
  },
  {
    id: "lost",
    title: "Lost",
    color: "border-l-red-500",
    description: "Closed without sale",
  },
];

export default function PipelinePage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadThreads();
  }, []);

  const loadThreads = async () => {
    try {
      setIsLoading(true);
      // Load threads for all pipeline stages
      const response = await fetch("/api/v1/threads?pageSize=100");
      const data = await response.json();
      setThreads(data.data || []);
    } catch (error) {
      console.error("Failed to load threads:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectThread = (threadId: string) => {
    // Navigate to inbox with selected thread
    window.location.href = `/inbox?thread=${threadId}`;
  };

  const handleMoveThread = async (threadId: string, newStage: string) => {
    try {
      await fetch(`/api/v1/threads/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineStage: newStage }),
      });

      // Reload threads
      loadThreads();
    } catch (error) {
      console.error("Failed to move thread:", error);
    }
  };

  const getThreadsByStage = (stage: string) => {
    return threads.filter((thread) => thread.pipelineStage === stage);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading pipeline...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sales Pipeline</h1>
            <p className="text-sm text-muted-foreground">
              Track and manage your sales opportunities
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="w-64 pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex h-full gap-6 min-w-max">
          {stages.map((stage) => (
            <div key={stage.id} className="w-80 shrink-0">
              <PipelineColumn
                title={stage.title}
                threads={getThreadsByStage(stage.id)}
                color={stage.color}
                stage={stage.id}
                onSelectThread={handleSelectThread}
                onMoveThread={handleMoveThread}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Summary Bar */}
      <div className="border-t bg-muted/50 px-6 py-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex gap-6">
            {stages.map((stage) => (
              <div key={stage.id} className="flex items-center gap-2">
                <div
                  className={`h-3 w-3 rounded-full ${stage.color.replace(
                    "border-l-",
                    "bg-"
                  )}`}
                />
                <span className="text-muted-foreground">
                  {stage.title}:{" "}
                  <strong className="text-foreground">
                    {getThreadsByStage(stage.id).length}
                  </strong>
                </span>
              </div>
            ))}
          </div>
          <span className="text-muted-foreground">
            Total: <strong className="text-foreground">{threads.length}</strong>{" "}
            opportunities
          </span>
        </div>
      </div>
    </div>
  );
}
