export type ChannelType = "whatsapp" | "instagram" | "tiktok_shop";
export type ThreadStatus = "open" | "snoozed" | "closed" | "archived";
export type PipelineStage = "lead" | "engaged" | "converted" | "lost";
export type MessageDirection = "inbound" | "outbound";

export interface Contact {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
}

export interface ChannelConnection {
  id: string;
  type: ChannelType;
  name: string;
}

export interface Thread {
  id: string;
  contact: Contact;
  channelConnection: ChannelConnection;
  subject: string | null;
  status: ThreadStatus;
  pipelineStage: PipelineStage | null;
  isRead: boolean;
  isStarred: boolean;
  hasUnreadMessages: boolean;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  isSlaCritical: boolean;
  slaDeadline: string | null;
}

export interface Message {
  id: string;
  content: string | null;
  direction: MessageDirection;
  sentAt: string;
  isRead: boolean;
  senderName: string | null;
  type: string;
  attachments?: Array<{
    type: string;
    url: string;
    filename?: string;
  }>;
}
