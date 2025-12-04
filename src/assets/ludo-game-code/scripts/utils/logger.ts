/**
 * Logger Utility
 *
 * Centralized logging utility for better control and consistency
 */

const DEFAULT_DEBUG_MODE = false; // Default debug mode (set to true for always-on debug logging)

/**
 * Logger class for controlled logging
 */
export class Logger {
    /**
     * Check if debug mode is enabled
     * Reads from localStorage first (ludo:debug), falls back to DEFAULT_DEBUG_MODE
     */
    static isDebugEnabled(): boolean {
        try {
            // Check localStorage for debug flag
            const debugFlag = localStorage.getItem("ludo:debug");
            if (debugFlag !== null) {
                // Return true if localStorage value is "true" (case-insensitive)
                return debugFlag.toLowerCase() === "true";
            }
        } catch (error) {
            // localStorage might not be available in some environments (e.g., Node.js)
            // Fall back to default mode
        }
        return DEFAULT_DEBUG_MODE;
    }

    static debug(component: string, message: string, ...args: any[]): void {
        if (this.isDebugEnabled()) {
            //console.log(`[${component}] ${message}`, ...args);
        }
    }

    static warn(component: string, message: string, ...args: any[]): void {
        //console.warn(`[${component}] ${message}`, ...args);
    }

    static error(component: string, message: string, ...args: any[]): void {
        console.error(`[${component}] ${message}`, ...args);
    }

    static info(component: string, message: string, ...args: any[]): void {
        // Use debug method to avoid code duplication
        this.debug(component, message, ...args);
    }
}
