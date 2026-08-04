
export const isNotEmpty = (value: unknown): boolean =>
    typeof value === "string" && value.trim().length > 0

export const isValidEmail = (email: unknown): boolean => {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return typeof email === "string" && isNotEmpty(email) && emailRegex.test(email);
}

export const isMinLength = (value: unknown, minLength: number): boolean =>
    typeof value === "string" && value.trim().length >= minLength

export const isWithinMaxLength = (value: unknown, maxLength: number): boolean =>
    typeof value === "string" && value.trim().length <= maxLength && value.trim().length > 0

// For auth 
export const isValidDeviceFingerprint = (value: unknown): boolean => {
    if (!isNotEmpty(value)) return false;

    try {
        const parsed = JSON.parse(value as string);
        return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) && Object.keys(parsed).length > 0;
    } catch {
        return false;
    }
};

export const isValidUUID = (value: unknown): boolean => {
    if (typeof value !== "string" || !isNotEmpty(value)) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value.trim());
}