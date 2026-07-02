// Vision 转录 prompt 模板与下游包装协议
//
// 设计原则（嫁接方案的精度保障）:
//   1. 转录优先于解读 — 视觉模型的输出是 DeepSeek 唯一的"眼睛"，逐字转录而非概括
//   2. 结构化防遗漏 — 固定输出章节，类型/逐字文本/布局/数据/不确定性逐项覆盖
//   3. 不确定必标注 — 看不清标 [illegible]、截断标 [truncated]，禁止编造
//   4. 上下文感知 — 用户提问传给视觉模型，重点转录相关区域；二次识别时换成 DeepSeek 的分析需求

/** 无自定义模板时的最终 fallback（原 openai-compatible.ts DEFAULT_PROMPT） */
export const FALLBACK_PROMPT =
  "Please describe this image in detail. Include all visible text, UI elements, objects, people, colors, layout, and any information useful for understanding the image.";

/** 结构化转录模板；{USER_CONTEXT} 由 buildVisionPrompt 填充 */
export const DEFAULT_TEMPLATE = `You are an image-transcription engine inside an API proxy. Your output is the ONLY
information a downstream text-only model will receive about this image — it cannot
see the image. Be exhaustive and literal. Transcribe; do not interpret.

## Context
{USER_CONTEXT}

## Output structure
1. Type — one of: UI screenshot / terminal or code / document or table /
   chart / diagram or flowchart / photo / handwriting / mixed.
2. Verbatim text — transcribe ALL visible text EXACTLY: original language,
   line breaks, indentation, punctuation, numbers, IDs, file paths, URLs.
   - Code / terminal output / error messages: fenced code blocks,
     character-for-character. Never fix typos or "clean up" code.
   - Tables: reproduce as markdown tables.
   - Text cut off at an edge: mark [truncated].
   - Illegible text: mark [illegible] — NEVER guess or invent characters.
3. Visual & layout — spatial arrangement (top/left/...), UI elements and
   states (dialogs, selected tab, disabled button, red error highlight),
   colors only when meaningful (syntax highlighting, status colors),
   arrows/circles/annotations drawn by the user.
4. Data (charts only) — chart type, axes with units/ranges, series names,
   data point values as a table; visually-estimated values prefixed with ~.
5. Uncertainty — list anything you are unsure about; write "none" if nothing.

Rules: never summarize where transcription is possible; do not answer the
user's message; no opinions or fixes; do not omit content as "irrelevant".
Verbatim content (text in the image) ALWAYS keeps its original language.
If output space runs low, prioritize section 2 (verbatim text) over the rest.`;

/** 用户提问截断上限（控制视觉 API 成本） */
const USER_TEXT_MAX_CHARS = 500;

/**
 * 构建转录 prompt。
 * @param userText 用户消息文字（首遍转录）或 DeepSeek 的分析需求（二次识别）；null 为纯盲描述
 * @param template 自定义模板（config plugins.vision.prompt），需含 {USER_CONTEXT} 占位符
 */
export function buildVisionPrompt(userText: string | null, template?: string): string {
  const t = template || DEFAULT_TEMPLATE;
  const trimmed = userText?.trim();
  const context = trimmed
    ? `The user attached this image with the following message:
"""
${trimmed.length > USER_TEXT_MAX_CHARS ? trimmed.slice(0, USER_TEXT_MAX_CHARS) + " [truncated]" : trimmed}
"""
Describe the whole image, but transcribe regions relevant to this message with
maximum exactness. Write descriptive text in the same language as this message.`
    : `No accompanying message — describe the image fully. Write descriptive text in
the dominant language of the text in the image; default to Chinese (中文).`;
  return t.replace("{USER_CONTEXT}", context);
}

/**
 * 下游包装协议：告知 DeepSeek 这是机器转述及其可靠性边界。
 * 注意：包装文本必须跨轮次稳定（不含总数等会随对话增长变化的字段），
 * 否则历史消息前缀变化会击穿 DeepSeek 的上下文缓存。
 * @param index 图片编号（全对话内按出现顺序，从 1 开始，跨轮次稳定）
 * @param analyzeHint 是否附带 analyze_image 工具提示（按需二次识别启用时）
 */
export function wrapDescription(text: string, index: number, analyzeHint = false): string {
  const hint = analyzeHint ? "\n如需澄清图中细节，可调用 analyze_image 工具追问。" : "";
  return `<image_transcription source="vision-model" image="${index}">
（以下为视觉模型对用户所附图片的自动转录，非原图。逐字文本基本可靠；
布局与估读数值可能有误差；[illegible]/[truncated] 处为转录缺失。${hint}）
${text}
</image_transcription>`;
}

/** 按需二次识别工具定义（注入 providerRequest.tools，由 vision 插件 POST_CALL 拦截执行） */
export const ANALYZE_IMAGE_TOOL = {
  name: "analyze_image",
  description:
    "重新审视用户所附的图片。当图片转录信息不足以回答问题时，提出一个具体的分析需求" +
    "（想确认什么、看哪个区域、读什么数值），由视觉模型重新识别并返回结果。",
  input_schema: {
    type: "object",
    properties: {
      image_index: {
        type: "number",
        description: '图片编号，从 1 开始，对应 <image_transcription image="N"> 中的 N；只有一张图时可省略',
      },
      query: { type: "string", description: "具体的分析需求，用用户提问的语言书写" },
    },
    required: ["query"],
  },
} as const;
