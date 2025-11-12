"use client";

import { formatDistanceToNow } from "date-fns";
import { MessageCircle, Instagram, ShoppingBag, Star, Clock } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Thread } from "@/types/inbox";

interface ThreadListProps {
  threads: Thread[];
  selectedThreadId?: string;
  onSelectThread: (threadId: string) => void;
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

export function ThreadList({ threads, selectedThreadId, onSelectThread }: ThreadListProps) {
  if (threads.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">No conversations yet</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="divide-y">
        {threads.map((thread) => {
          const ChannelIcon = channelIcons[thread.channelConnection.type];
          const channelColor = channelColors[thread.channelConnection.type];
          const isSelected = thread.id === selectedThreadId;

          return (
            <button
              key={thread.id}
              onClick={() => onSelectThread(thread.id)}
              className={cn(
                "w-full p-4 text-left transition-colors hover:bg-accent",
                isSelected && "bg-accent",
                !thread.isRead && "bg-muted/50"
              )}
            >
              <div className="flex gap-3">
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
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "truncate font-medium",
                        !thread.isRead && "font-semibold"
                      )}>
                        {thread.contact.name || thread.contact.phone || "Unknown"}
                      </span>
                      {thread.isStarred && (
                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(thread.lastMessageAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>

                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {thread.lastMessagePreview || "No messages"}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {thread.hasUnreadMessages && (
                      <Badge variant="default" className="h-5 text-xs">
                        New
                      </Badge>
                    )}
                    {thread.isSlaCritical && (
                      <Badge variant="destructive" className="h-5 text-xs">
                        <Clock className="mr-1 h-3 w-3" />
                        SLA Risk
                      </Badge>
                    )}
                    {thread.pipelineStage && (
                      <Badge variant="outline" className="h-5 text-xs">
                        {thread.pipelineStage}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
