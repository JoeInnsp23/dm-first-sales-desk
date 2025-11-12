/**
 * Environment variable validation and configuration
 */

export interface EnvConfig {
  // Database
  DATABASE_URL: string;

  // Auth (Clerk)
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: string;
  CLERK_SECRET_KEY: string;

  // Redis
  REDIS_URL?: string;
  REDIS_HOST?: string;
  REDIS_PORT?: string;
  REDIS_PASSWORD?: string;

  // AI
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;

  // WhatsApp Business API
  WHATSAPP_API_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_WEBHOOK_VERIFY_TOKEN?: string;

  // Instagram Graph API
  INSTAGRAM_APP_ID?: string;
  INSTAGRAM_APP_SECRET?: string;
  INSTAGRAM_ACCESS_TOKEN?: string;

  // TikTok Shop
  TIKTOK_APP_KEY?: string;
  TIKTOK_APP_SECRET?: string;
  TIKTOK_ACCESS_TOKEN?: string;

  // Shopify
  SHOPIFY_STORE_DOMAIN?: string;
  SHOPIFY_ACCESS_TOKEN?: string;
  SHOPIFY_WEBHOOK_SECRET?: string;

  // S3 Storage
  S3_BUCKET?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_REGION?: string;

  // App
  NODE_ENV: string;
  NEXT_PUBLIC_APP_URL: string;
}

/**
 * Required environment variables for the application to run
 */
const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_APP_URL",
] as const;

/**
 * Optional environment variables with warnings if missing
 */
const OPTIONAL_WITH_WARNING = {
  REDIS_URL: "Redis required for background jobs",
  ANTHROPIC_API_KEY: "AI features require Anthropic API key",
  OPENAI_API_KEY: "Alternative AI provider",
} as const;

/**
 * Validate required environment variables
 */
export function validateEnv(): {
  valid: boolean;
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const varName of REQUIRED_ENV_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  // Check optional variables with warnings
  for (const [varName, description] of Object.entries(OPTIONAL_WITH_WARNING)) {
    if (!process.env[varName]) {
      warnings.push(`${varName}: ${description}`);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Get validated environment configuration
 * Throws error if required variables are missing
 */
export function getEnvConfig(): EnvConfig {
  const validation = validateEnv();

  if (!validation.valid) {
    throw new Error(
      `Missing required environment variables:\n${validation.missing.join("\n")}\n\nPlease check your .env file.`
    );
  }

  if (validation.warnings.length > 0 && process.env.NODE_ENV !== "production") {
    console.warn("⚠️  Missing optional environment variables:");
    validation.warnings.forEach((warning) => console.warn(`  - ${warning}`));
  }

  return {
    // Database
    DATABASE_URL: process.env.DATABASE_URL!,

    // Auth
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY!,

    // Redis
    REDIS_URL: process.env.REDIS_URL,
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,

    // AI
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,

    // WhatsApp
    WHATSAPP_API_TOKEN: process.env.WHATSAPP_API_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,

    // Instagram
    INSTAGRAM_APP_ID: process.env.INSTAGRAM_APP_ID,
    INSTAGRAM_APP_SECRET: process.env.INSTAGRAM_APP_SECRET,
    INSTAGRAM_ACCESS_TOKEN: process.env.INSTAGRAM_ACCESS_TOKEN,

    // TikTok
    TIKTOK_APP_KEY: process.env.TIKTOK_APP_KEY,
    TIKTOK_APP_SECRET: process.env.TIKTOK_APP_SECRET,
    TIKTOK_ACCESS_TOKEN: process.env.TIKTOK_ACCESS_TOKEN,

    // Shopify
    SHOPIFY_STORE_DOMAIN: process.env.SHOPIFY_STORE_DOMAIN,
    SHOPIFY_ACCESS_TOKEN: process.env.SHOPIFY_ACCESS_TOKEN,
    SHOPIFY_WEBHOOK_SECRET: process.env.SHOPIFY_WEBHOOK_SECRET,

    // S3
    S3_BUCKET: process.env.S3_BUCKET,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
    S3_REGION: process.env.S3_REGION,

    // App
    NODE_ENV: process.env.NODE_ENV || "development",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL!,
  };
}

/**
 * Check if specific feature is enabled based on env vars
 */
export function isFeatureEnabled(feature: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[feature]();
}

const FEATURE_FLAGS = {
  ai: () => !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY),
  whatsapp: () => !!process.env.WHATSAPP_API_TOKEN,
  instagram: () => !!process.env.INSTAGRAM_ACCESS_TOKEN,
  tiktok: () => !!process.env.TIKTOK_ACCESS_TOKEN,
  shopify: () => !!process.env.SHOPIFY_ACCESS_TOKEN,
  storage: () => !!process.env.S3_BUCKET,
  backgroundJobs: () => !!process.env.REDIS_URL,
} as const;

/**
 * Print environment status (for debugging)
 */
export function printEnvStatus() {
  const validation = validateEnv();

  console.log("\n📋 Environment Status:");
  console.log("━".repeat(50));

  if (validation.valid) {
    console.log("✅ All required variables present");
  } else {
    console.log("❌ Missing required variables:");
    validation.missing.forEach((v) => console.log(`   - ${v}`));
  }

  console.log("\n🔧 Features:");
  Object.entries(FEATURE_FLAGS).forEach(([feature, check]) => {
    const enabled = check();
    console.log(`   ${enabled ? "✅" : "⚠️ "} ${feature}: ${enabled ? "enabled" : "disabled"}`);
  });

  if (validation.warnings.length > 0) {
    console.log("\n⚠️  Warnings:");
    validation.warnings.forEach((w) => console.log(`   - ${w}`));
  }

  console.log("━".repeat(50) + "\n");
}
