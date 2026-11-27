// ============================================================================
// src/services/schemas.ts
// Defines strict Zod validation schemas for all public API route payloads.
// ============================================================================

import { z } from "zod";
import {
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_CITY_QUERY_LENGTH,
  MAX_US_AQI,
  MIN_CITY_QUERY_LENGTH,
  SUPPORTED_LOCALES,
} from "@/lib/constants";

const CITY_NAME_PATTERN = /^[\p{L}\p{N}\s,.'-]+$/u;
const MAX_CITY_KEY_LENGTH = 64;
const MAX_LABEL_LENGTH = 80;
const MAX_TIMEZONE_LENGTH = 64;
const MAX_ISO_LENGTH = 40;
const MIN_ISO_LENGTH = 10;
const LATITUDE_BOUND = 90;
const LONGITUDE_BOUND = 180;
const MAX_PARTICULATE_UG_M3 = 2_000;
const MAX_COARSE_OR_GAS_UG_M3 = 3_000;
const MAX_CO_UG_M3 = 100_000;

const localeSchema = z.enum(SUPPORTED_LOCALES);

const residentProfileSchema = z.object({
  persona: z.enum(["general", "children", "elderly", "asthma", "pregnant", "athlete", "worker"]),
  commuteMode: z.enum(["car", "transit", "two_wheeler", "walk_cycle"]),
  homeEnergyMode: z.enum(["gas_biomass", "electric_induction"]),
  filtrationMode: z.enum(["none", "hepa", "diy_box_fan"]),
});

/** Validates GET /api/geocode query parameters including demo toggle. */
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

/** Validates GET /api/air-quality cityKey or bounded geographic coordinates. */
export const airQualityQuerySchema = z
  .object({
    cityKey: z
      .string()
      .trim()
      .min(MIN_CITY_QUERY_LENGTH)
      .max(MAX_CITY_KEY_LENGTH)
      .regex(/^[a-z0-9-]+$/i)
      .optional(),
    lat: z.coerce.number().min(-LATITUDE_BOUND).max(LATITUDE_BOUND).optional(),
    lon: z.coerce.number().min(-LONGITUDE_BOUND).max(LONGITUDE_BOUND).optional(),
    name: z.string().trim().min(1).max(MAX_LABEL_LENGTH).regex(CITY_NAME_PATTERN).optional(),
    region: z.string().trim().max(MAX_LABEL_LENGTH).optional(),
    country: z.string().trim().max(MAX_LABEL_LENGTH).optional(),
    timezone: z.string().trim().max(MAX_TIMEZONE_LENGTH).optional(),
    demo: z.enum(["true", "false"]).default("false"),
  })
  .refine((data) => Boolean(data.cityKey) || (data.lat !== undefined && data.lon !== undefined), {
    error: "Provide either cityKey or both lat and lon coordinates.",
  });

const groundedReadingsSchema = z.object({
  pm25: z.number().min(0).max(MAX_PARTICULATE_UG_M3),
  pm10: z.number().min(0).max(MAX_COARSE_OR_GAS_UG_M3),
  no2: z.number().min(0).max(MAX_COARSE_OR_GAS_UG_M3),
  o3: z.number().min(0).max(MAX_PARTICULATE_UG_M3),
  so2: z.number().min(0).max(MAX_COARSE_OR_GAS_UG_M3),
  co: z.number().min(0).max(MAX_CO_UG_M3),
});

/** Validates POST /api/chat JSON body keeping assistant replies grounded in metrics. */
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
    cityName: z.string().trim().min(1).max(MAX_LABEL_LENGTH),
    country: z.string().trim().min(1).max(MAX_LABEL_LENGTH),
    source: z.enum(["open-meteo", "demo", "cached"]),
    updatedAtIso: z.string().trim().min(MIN_ISO_LENGTH).max(MAX_ISO_LENGTH),
    usAqi: z.number().min(0).max(MAX_US_AQI),
    europeanAqi: z.number().min(0).max(MAX_US_AQI),
    readings: groundedReadingsSchema,
    bestWindowIso: z.string().trim().max(MAX_ISO_LENGTH).optional(),
    bestWindowUsAqi: z.number().min(0).max(MAX_US_AQI).optional(),
  }),
});

/** Validated request body shape accepted by POST /api/chat. */
export type ChatRequestPayload = z.infer<typeof chatRequestSchema>;
