"use client";

import { useEffect, useState } from "react";
import { ContactList } from "@/components/contacts/contact-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Filter } from "lucide-react";

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

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/v1/contacts?pageSize=100");
      const data = await response.json();
      setContacts(data.data || []);
    } catch (error) {
      console.error("Failed to load contacts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadContacts();
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/v1/contacts?q=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();
      setContacts(data.data || []);
    } catch (error) {
      console.error("Failed to search contacts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectContact = (contactId: string) => {
    // In a real app, navigate to contact detail page
    console.log("Selected contact:", contactId);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading contacts...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Contacts</h1>
            <p className="text-sm text-muted-foreground">
              {contacts.length} total contacts
            </p>
          </div>

          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="border-b bg-background px-6 py-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or phone..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <Button variant="outline" onClick={handleSearch}>
            Search
          </Button>
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
        </div>
      </div>

      {/* Contact List */}
      <div className="flex-1 overflow-auto p-6">
        <ContactList
          contacts={contacts}
          onSelectContact={handleSelectContact}
        />
      </div>
    </div>
  );
}
