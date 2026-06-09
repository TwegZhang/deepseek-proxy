import type { ContentBlock } from "./anthropic";

export interface InternalMessage {
  role: "user" | "assistant";
  content: ContentBlock[];
}

export interface ProviderRequest {
  model: string;
  messages: InternalMessage[];
  system?: string | Array<{ type: "text"; text: string }>;
  maxTokens: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  stream: boolean;
  tools?: unknown[];
  thinking?: unknown;
  metadata?: Record<string, unknown>;
}

export interface ProviderResponse {
  id: string;
  model: string;
  content: ContentBlock[];
  stopReason: string | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface ProviderStreamChunk {
  type: string;
  index?: number;
  delta?: {
    type?: string;
    text?: string;
    partial_json?: string;
    thinking?: string;
    signature?: string;
  };
  content_block?: {
    type: string;
    [key: string]: unknown;
  };
  message?: {
    id: string;
    model: string;
    [key: string]: unknown;
  };
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}
