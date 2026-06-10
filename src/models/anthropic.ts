// Anthropic Messages API 类型定义

export interface ContentBlockText {
  type: "text";
  text: string;
  citations?: unknown[];
  cache_control?: unknown;
}

export interface ContentBlockImage {
  type: "image";
  source: {
    type: "base64" | "url";
    media_type: string;
    data?: string;
    url?: string;
  };
}

export interface ContentBlockToolUse {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ContentBlockToolResult {
  type: "tool_result";
  tool_use_id: string;
  content: string | ContentBlockText[];
  is_error?: boolean;
}

export interface ContentBlockThinking {
  type: "thinking";
  thinking: string;
  signature: string;
}

export type ContentBlock =
  | ContentBlockText
  | ContentBlockImage
  | ContentBlockToolUse
  | ContentBlockToolResult
  | ContentBlockThinking;

export interface Message {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

export interface Tool {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
  type?: string;
}

export interface ThinkingConfig {
  type: "enabled" | "disabled";
  budget_tokens?: number;
}

export interface MessagesRequest {
  model: string;
  messages: Message[];
  system?: string | Array<{ type: "text"; text: string; cache_control?: unknown }>;
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  stop_sequences?: string[];
  stream?: boolean;
  tools?: Tool[];
  tool_choice?: {
    type: "auto" | "any" | "tool" | "none";
    name?: string;
    disable_parallel_tool_use?: boolean;
  };
  thinking?: ThinkingConfig;
  metadata?: {
    user_id?: string;
  };
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
}

export interface MessagesResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: ContentBlock[];
  model: string;
  stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use" | null;
  stop_sequence?: string | null;
  usage: Usage;
}

export interface StreamEvent {
  type: string;
  index?: number;
  delta?: {
    type?: string;
    text?: string;
    partial_json?: string;
    thinking?: string;
    signature?: string;
  };
  content_block?: { type: string } & Partial<ContentBlock>;
  message?: {
    id: string;
    type?: string;
    role?: string;
    model?: string;
    content?: unknown[];
  };
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}
