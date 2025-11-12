"use client";

import { useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ComposeMessageProps {
  onSend: (content: string) => Promise<void>;
  onRequestSuggestion?: () => Promise<void>;
  isLoading?: boolean;
}

export function ComposeMessage({
  onSend,
  onRequestSuggestion,
  isLoading = false,
}: ComposeMessageProps) {
  const [message, setMessage] = useState("");

  const handleSend = async () => {
    if (!message.trim() || isLoading) return;

    await onSend(message);
    setMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t bg-background p-4">
      <div className="flex gap-2">
        {onRequestSuggestion && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onRequestSuggestion}
            disabled={isLoading}
            title="Get AI suggestion"
          >
            <Sparkles className="h-4 w-4" />
          </Button>
        )}

        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          disabled={isLoading}
          className="flex-1"
        />

        <Button
          onClick={handleSend}
          disabled={!message.trim() || isLoading}
          size="icon"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
