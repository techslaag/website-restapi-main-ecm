import { DeviceType } from "@prisma/client";

/**
 * Detect device type from user agent string
 * @param userAgent - The user agent string from request headers
 * @returns DeviceType enum value
 */
export function detectDeviceType(userAgent: string): DeviceType {
  const ua = userAgent.toLowerCase();

  // TV detection (Smart TVs, set-top boxes, gaming consoles)
  if (
    ua.includes("smarttv") ||
    ua.includes("googletv") ||
    ua.includes("appletv") ||
    ua.includes("roku") ||
    ua.includes("firetv") ||
    ua.includes("webos") ||
    ua.includes("tizen") ||
    ua.includes("xbox") ||
    ua.includes("playstation") ||
    ua.includes("nintendo") ||
    ua.includes("chromecast")
  ) {
    return DeviceType.tv;
  }

  // Mobile phone detection
  if (
    ua.includes("mobile") ||
    ua.includes("android") ||
    ua.includes("iphone") ||
    ua.includes("ipod") ||
    ua.includes("blackberry") ||
    ua.includes("windows phone") ||
    ua.includes("opera mini") ||
    (ua.includes("safari") && ua.includes("mobile"))
  ) {
    return DeviceType.phone;
  }

  // Tablet detection
  if (
    ua.includes("tablet") ||
    ua.includes("ipad") ||
    (ua.includes("android") && !ua.includes("mobile")) ||
    ua.includes("kindle") ||
    ua.includes("playbook") ||
    ua.includes("silk")
  ) {
    return DeviceType.tablet;
  }

  // Default to desktop for everything else
  return DeviceType.desktop;
}

/**
 * Get device type display name for user interface
 * @param deviceType - The DeviceType enum value
 * @returns Human readable device type name
 */
export function getDeviceTypeDisplayName(deviceType: DeviceType): string {
  switch (deviceType) {
    case DeviceType.phone:
      return "Téléphone";
    case DeviceType.tablet:
      return "Tablette";
    case DeviceType.desktop:
      return "Ordinateur";
    case DeviceType.tv:
      return "Télévision";
    default:
      return "Inconnu";
  }
}

/**
 * Session limits per device type
 */
export const DEVICE_SESSION_LIMITS = {
  [DeviceType.phone]: 1,
  [DeviceType.tablet]: 1,
  [DeviceType.desktop]: 1,
  [DeviceType.tv]: 1,
} as const;

/**
 * Maximum total sessions across all device types
 */
export const MAX_TOTAL_SESSIONS = 4;