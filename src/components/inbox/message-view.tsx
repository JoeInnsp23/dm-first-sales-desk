"use client";

import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Message } from "@/types/inbox";

interface MessageViewProps {
  messages: Message[];
  contactName?: string;
  contactAvatar?: string | null;
}

export function MessageView({ messages, contactName, contactAvatar }: MessageViewProps) {
  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <p className="text-sm text-muted-foreground">No messages in this conversation</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 p-4">
        {messages.map((message, index) => {
          const isInbound = message.direction === "inbound";
          const showAvatar =
            index === 0 ||
            messages[index - 1]?.direction !== message.direction;

          return (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                !isInbound && "flex-row-reverse"
              )}
            >
              {showAvatar ? (
                <Avatar className="h-8 w-8">
                  {isInbound && (
                    <>
                      <AvatarImage src={contactAvatar || undefined} />
                      <AvatarFallback>
                        {contactName?.[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </>
                  )}
                  {!isInbound && (
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {message.senderName?.[0]?.toUpperCase() || "A"}
                    </AvatarFallback>
                  )}
                </Avatar>
              ) : (
                <div className="w-8" />
              )}

              <div
                className={cn(
                  "flex max-w-[70%] flex-col gap-1",
                  !isInbound && "items-end"
                )}
              >
                <div
                  className={cn(
                    "rounded-2xl px-4 py-2",
                    isInbound
                      ? "bg-muted"
                      : "bg-primary text-primary-foreground"
                  )}
                >
                  {message.type === "text" && message.content && (
                    <p className="whitespace-pre-wrap break-words text-sm">
                      {message.content}
                    </p>
                  )}

                  {message.type === "image" && message.attachments?.[0] && (
                    <div>
                      <img
                        src={message.attachments[0].url}
                        alt="Attachment"
                        className="max-h-64 rounded-lg"
                      />
                      {message.content && (
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                          {message.content}
                        </p>
                      )}
                    </div>
                  )}

                  {(message.type === "video" ||
                    message.type === "document" ||
                    message.type === "audio") &&
                    message.attachments?.[0] && (
                      <div className="flex items-center gap-2">
                        <div className="rounded bg-background/20 px-3 py-2">
                          <span className="text-xs font-medium">
                            {message.type.toUpperCase()}
                          </span>
                        </div>
                        <span className="text-xs">
                          {message.attachments[0].filename || "Attachment"}
                        </span>
                      </div>
                    )}
                </div>

                <span
                  className={cn(
                    "px-2 text-xs text-muted-foreground",
                    !isInbound && "text-right"
                  )}
                >
                  {format(new Date(message.sentAt), "MMM d, h:mm a")}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
