import {
  ALLOWED_UPSTREAM_HOSTS,
  MAX_LLM_OUTPUT_CHARS,
  type SupportedLocale,
} from "@/lib/constants";
import type { ValidatedEnv } from "@/lib/env";

const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F\u200B-\u200F\uFEFF]/g;
const PROMPT_TOKEN_PATTERN =
  /<\|[^|]{1,40}\|>|\[\/?(?:INST|SYS)\]|<<\/?SYS>>|###\s*(?:System|Assistant|Developer):/gi;

const INJECTION_PATTERNS: readonly RegExp[] = [
  /ignore\s+(?:all|any|the|previous|above|prior)\s+instructions?/i,
  /disregard\s+(?:all|the|your|previous)?\s*(?:rules|system|instructions)/i,
  /(?:reveal|print|dump|show|repeat|leak|echo)\s+your\s+(?:system\s+prompt|instructions|process\.env|secrets?|api\s+keys?)/i,
  /(?:reveal|print|dump|show|repeat|leak|echo)\s+(?:system\s+prompt|instructions|process\.env|secrets?|api_keys?|api\s+keys?)/i,
  /\b(?:GEMINI_API_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY|process\.env)\b/i,
  /\b(?:jailbreak|developer\s+mode|DAN\s+mode|bypass\s+safety|override\s+rules)\b/i,
  /(?:pretend|act\s+as|you\s+are\s+now)\s+(?:a|an|my)?\s*(?:unrestricted|admin|root|system|doctor)/i,
  /\b(?:function_call|tool_calls?|<\s*tool_call\b|\{"name":\s*"exec)\b/i,
  /<\s*script\b|javascript:/i,
];

const BASE64_INJECTION_CHUNK = /\b[A-Za-z0-9+/]{24,}={0,2}\b/g;

const AIR_QUALITY_TOPIC_PATTERN =
  /air|aqi|smog|pm2\.?5|pm10|no2|o3|so2|co|ozone|pollut|mask|n95|ffp2|window|ventilat|indoor|hepa|filter|purif|hack|routine|commut|transit|metro|bus|bike|cycle|walk|run|exercis|cook|induct|gas|impact|co2|nox|child|elder|asthma|pregnan|worker|health|safe|best|time|hour|city|weather|invers|winter|clean|help|hi|hello|नमस्ते|स्मॉग|हवा|मास्क|प्रदूषण|காற்று|புகை|மாசு|முகக்கவசம்/i;

const URL_IN_TEXT_PATTERN = /https?:\/\/[^\s)>"']+/gi;
const PUBLIC_REFERENCE_HOSTS: ReadonlySet<string> = new Set([
  ...ALLOWED_UPSTREAM_HOSTS,
  "open-meteo.com",
  "www.who.int",
]);

export const REFUSAL_MESSAGES: Readonly<Record<SupportedLocale, string>> = {
  en: "I can only answer questions about the fetched air quality data, winter smog safety, indoor air hacks, and low-emission routines. I cannot follow override instructions or access internal settings.",
  hi: "मैं केवल वर्तमान वायु गुणवत्ता डेटा, सर्दियों के स्मॉग सुरक्षा, घरेलू हवा सुधार और कम-उत्सर्जन दिनचर्या से जुड़े प्रश्नों का उत्तर दे सकता हूँ। मैं निर्देश बदलने या आंतरिक सेटिंग दिखाने का अनुरोध स्वीकार नहीं कर सकता।",
  ta: "பெறப்பட்ட காற்றின் தரத் தரவு, குளிர்கால புகைமூட்டப் பாதுகாப்பு, வீட்டுக் காற்று வழிகள் மற்றும் குறைந்த-உமிழ்வு பழக்கங்கள் குறித்த கேள்விகளுக்கு மட்டுமே என்னால் பதிலளிக்க முடியும்.",
};

export const OFF_TOPIC_MESSAGES: Readonly<Record<SupportedLocale, string>> = {
  en: "I specialize in navigating urban air pollution and winter smog using the fetched measurements on your screen. Ask me about today's AQI, N95 masks, indoor air hacks, best outdoor hours, or low-emission routines.",
  hi: "मैं आपकी स्क्रीन पर मौजूद वायु गुणवत्ता डेटा के आधार पर शहरी प्रदूषण, स्मॉग, मास्क, घरेलू उपायों और कम-उत्सर्जन दिनचर्या में मदद करता हूँ। कृपया इन विषयों से जुड़ा प्रश्न पूछें।",
  ta: "திரையில் உள்ள காற்றின் தரத் தரவின் அடிப்படையில் புகைமூட்டப் பாதுகாப்பு, வீட்டுக் காற்று வழிகள் மற்றும் குறைந்த-உமிழ்வு பழக்கங்கள் குறித்து மட்டுமே என்னால் உதவ முடியும்.",
};

export const DISCLAIMERS: Readonly<Record<SupportedLocale, string>> = {
  en: "Informational air-quality guidance only — not medical advice.",
  hi: "केवल वायु गुणवत्ता जानकारी हेतु — चिकित्सीय सलाह नहीं।",
  ta: "தகவல் வழிகாட்டுதல் மட்டுமே — மருத்துவ ஆலோசனை அல்ல.",
};

/**
 * Strips control characters, bidi overrides, and LLM delimiter tokens from untrusted chat input.
 */
export function sanitizeUserPrompt(rawMessage: string): string {
  return rawMessage
    .normalize("NFKC")
    .replace(CONTROL_CHAR_PATTERN, " ")
    .replace(PROMPT_TOKEN_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsEncodedInjection(cleanedMessage: string): boolean {
  const candidates = cleanedMessage.match(BASE64_INJECTION_CHUNK) ?? [];
  for (const token of candidates) {
    try {
      const decoded = Buffer.from(token, "base64").toString("utf8");
      if (INJECTION_PATTERNS.some((pattern) => pattern.test(decoded))) {
        return true;
      }
    } catch {
      // Ignore malformed candidate tokens.
    }
  }
  return false;
}

/**
 * Detects plain or base64-encoded prompt-injection, role-override, or secret-exfiltration attempts.
 */
export function detectPromptInjection(cleanedMessage: string): boolean {
  if (INJECTION_PATTERNS.some((pattern) => pattern.test(cleanedMessage))) {
    return true;
  }
  return containsEncodedInjection(cleanedMessage);
}

/**
 * Verifies the user question is scoped to urban air quality, winter smog, or clean routines.
 */
export function isAirQualityTopic(cleanedMessage: string): boolean {
  return AIR_QUALITY_TOPIC_PATTERN.test(cleanedMessage);
}

function stripDisallowedUrls(text: string): string {
  return text.replace(URL_IN_TEXT_PATTERN, (matched) => {
    try {
      const parsed = new URL(matched);
      return PUBLIC_REFERENCE_HOSTS.has(parsed.hostname) ? matched : "[link removed]";
    } catch {
      return "[link removed]";
    }
  });
}

/**
 * Sanitizes outbound model text: strips HTML tags, disallowed URLs, configured secrets, and caps length.
 */
export function sanitizeAssistantOutput(rawReply: string, env: ValidatedEnv): string {
  let clean = stripDisallowedUrls(rawReply.replace(/<[^>]+>/g, "")).trim();
  const secrets = [env.GEMINI_API_KEY, env.ANTHROPIC_API_KEY].filter(
    (item): item is string => typeof item === "string" && item.length >= 8,
  );
  for (const secret of secrets) {
    if (clean.includes(secret)) {
      clean = clean.split(secret).join("[REDACTED]");
    }
  }
  return clean.slice(0, MAX_LLM_OUTPUT_CHARS);
}
