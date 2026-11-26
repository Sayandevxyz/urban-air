import { z } from "zod";
import {
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_CITY_QUERY_LENGTH,
  MIN_CITY_QUERY_LENGTH,
  SUPPORTED_LOCALES,
} from "@/lib/constants";

const CITY_NAME_PATTERN = /^[\p{L}\p{N}\s,.'-]+$/u;

const localeSchema = z.enum(SUPPORTED_LOCALES);

const personaSchema = z.enum([
  "general",
  "children",
  "elderly",
  "asthma",
  "pregnant",
  "athlete",
  "worker",
]);

const commuteModeSchema = z.enum(["car", "transit", "two_wheeler", "walk_cycle"]);
const homeEnergyModeSchema = z.enum(["gas_biomass", "electric_induction"]);
const filtrationModeSchema = z.enum(["none", "hepa", "diy_box_fan"]);

const residentProfileSchema = z.object({
  persona: personaSchema,
  commuteMode: commuteModeSchema,
  homeEnergyMode: homeEnergyModeSchema,
  filtrationMode: filtrationModeSchema,
});

export const geocodeQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(MIN_CITY_QUERY_LENGTH, {
      error: `City query must be at least ${MIN_CITY_QUERY_LENGTH} characters.`,
    })
    .max(MAX_CITY_QUERY_LENGTH, {
      error: `City query must not exceed ${MAX_CITY_QUERY_LENGTH} characters.`,
    })
    .regex(CITY_NAME_PATTERN, {
      error: "City query contains unsupported characters.",
    }),
  demo: z.enum(["true", "false"]).default("false"),
});

export const airQualityQuerySchema = z
  .object({
    cityKey: z
      .string()
      .trim()
      .min(2)
      .max(64)
      .regex(/^[a-z0-9-]+$/i)
      .optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lon: z.coerce.number().min(-180).max(180).optional(),
    name: z.string().trim().min(1).max(80).regex(CITY_NAME_PATTERN).optional(),
    region: z.string().trim().max(80).optional(),
    country: z.string().trim().max(80).optional(),
    timezone: z.string().trim().max(64).optional(),
    demo: z.enum(["true", "false"]).default("false"),
  })
  .refine((data) => Boolean(data.cityKey) || (data.lat !== undefined && data.lon !== undefined), {
    error: "Provide either cityKey or both lat and lon coordinates.",
  });

const groundedReadingsSchema = z.object({
  pm25: z.number().min(0).max(2000),
  pm10: z.number().min(0).max(3000),
  no2: z.number().min(0).max(3000),
  o3: z.number().min(0).max(2000),
  so2: z.number().min(0).max(3000),
  co: z.number().min(0).max(100000),
});

export const chatRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, { error: "Message cannot be empty." })
    .max(MAX_CHAT_MESSAGE_LENGTH, {
      error: `Message must not exceed ${MAX_CHAT_MESSAGE_LENGTH} characters.`,
    }),
  locale: localeSchema.default("en"),
  profile: residentProfileSchema,
  airQualityContext: z.object({
    cityName: z.string().trim().min(1).max(80),
    country: z.string().trim().min(1).max(80),
    source: z.enum(["open-meteo", "demo", "cached"]),
    updatedAtIso: z.string().trim().min(10).max(40),
    usAqi: z.number().min(0).max(500),
    europeanAqi: z.number().min(0).max(500),
    readings: groundedReadingsSchema,
    bestWindowIso: z.string().trim().max(40).optional(),
    bestWindowUsAqi: z.number().min(0).max(500).optional(),
  }),
});

/**
 * Validated request body shape accepted by POST /api/chat.
 */
export type ChatRequestPayload = z.infer<typeof chatRequestSchema>;
