"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { MessageCircle, Instagram, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

interface Thread {
  id: string;
  contact: {
    name: string | null;
    avatarUrl: string | null;
  };
  channelConnection: {
    type: "whatsapp" | "instagram" | "tiktok_shop";
  };
  lastMessageAt: string;
  lastMessagePreview: string | null;
  hasUnreadMessages: boolean;
}

interface PipelineColumnProps {
  title: string;
  threads: Thread[];
  color: string;
  onSelectThread: (threadId: string) => void;
  onMoveThread: (threadId: string, newStage: string) => void;
  stage: string;
}

const channelIcons = {
  whatsapp: MessageCircle,
  instagram: Instagram,
  tiktok_shop: ShoppingBag,
};

const channelColors = {
  whatsapp: "text-green-600",
  instagram: "text-pink-600",
  tiktok_shop: "text-blue-600",
};

export function PipelineColumn({
  title,
  threads,
  color,
  onSelectThread,
  stage,
}: PipelineColumnProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-lg">{title}</h3>
        <Badge variant="secondary">{threads.length}</Badge>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto">
        {threads.map((thread) => {
          const ChannelIcon = channelIcons[thread.channelConnection.type];
          const channelColor = channelColors[thread.channelConnection.type];

          return (
            <Card
              key={thread.id}
              className={cn(
                "cursor-pointer p-4 transition-all hover:shadow-md",
                thread.hasUnreadMessages && "border-l-4",
                color
              )}
              onClick={() => onSelectThread(thread.id)}
            >
              <div className="flex items-start gap-3">
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={thread.contact.avatarUrl || undefined} />
                    <AvatarFallback>
                      {thread.contact.name?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 rounded-full bg-background p-0.5">
                    <ChannelIcon className={cn("h-3 w-3", channelColor)} />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-sm">
                      {thread.contact.name || "Unknown"}
                    </span>
                    {thread.hasUnreadMessages && (
                      <Badge variant="default" className="h-4 text-xs">
                        New
                      </Badge>
                    )}
                  </div>

                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {thread.lastMessagePreview || "No messages"}
                  </p>

                  <span className="mt-2 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(thread.lastMessageAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
            </Card>
          );
        })}

        {threads.length === 0 && (
          <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed">
            <p className="text-sm text-muted-foreground">No threads</p>
          </div>
        )}
      </div>
    </div>
  );
}
