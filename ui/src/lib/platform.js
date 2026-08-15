import { Capacitor } from "@capacitor/core";

/**
 * Whether this is running inside the Capacitor (Android) build rather
 * than a browser. The API origin and the hardware back button both need
 * to ask this same question, so it lives in one place rather than each
 * caller sniffing the user agent.
 */
export const isNative = () => Capacitor.isNativePlatform();
