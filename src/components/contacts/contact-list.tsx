"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  MessageCircle,
  Instagram,
  ShoppingBag,
  Mail,
  Phone,
  MoreVertical,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Contact {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  whatsappId: string | null;
  instagramId: string | null;
  tiktokUserId: string | null;
  tags: string[] | null;
  lastContactedAt: string | null;
  createdAt: string;
}

interface ContactListProps {
  contacts: Contact[];
  onSelectContact: (contactId: string) => void;
}

export function ContactList({ contacts, onSelectContact }: ContactListProps) {
  if (contacts.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">No contacts found</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {contacts.map((contact) => {
        const channels = [];
        if (contact.whatsappId) channels.push({ icon: MessageCircle, color: "text-green-600" });
        if (contact.instagramId) channels.push({ icon: Instagram, color: "text-pink-600" });
        if (contact.tiktokUserId) channels.push({ icon: ShoppingBag, color: "text-blue-600" });

        return (
          <Card
            key={contact.id}
            className="cursor-pointer p-6 transition-all hover:shadow-md"
            onClick={() => onSelectContact(contact.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={contact.avatarUrl || undefined} />
                  <AvatarFallback>
                    {contact.name?.[0]?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold truncate">
                    {contact.name || "Unnamed Contact"}
                  </h3>

                  <div className="mt-1 space-y-1">
                    {contact.email && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{contact.email}</span>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span>{contact.phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {channels.map((channel, index) => (
                      <div
                        key={index}
                        className={`flex h-6 w-6 items-center justify-center rounded-full bg-muted ${channel.color}`}
                      >
                        <channel.icon className="h-3.5 w-3.5" />
                      </div>
                    ))}
                  </div>

                  {contact.tags && contact.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {contact.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {contact.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{contact.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}

                  {contact.lastContactedAt && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Last contacted{" "}
                      {formatDistanceToNow(new Date(contact.lastContactedAt), {
                        addSuffix: true,
                      })}
                    </p>
                  )}
                </div>
              </div>

              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
