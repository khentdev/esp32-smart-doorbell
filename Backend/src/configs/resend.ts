import { Resend } from "resend";
import logger from "../lib/logger.js";
import { env } from "./env.js";

let resendClient: Resend | null = null;

export const getResendClient = (): Resend => {
    if (!resendClient) {
        try {
            resendClient = new Resend(env.RESEND_API_KEY);
            logger.info("Resend client initialized successfully");
        } catch (error) {
            logger.error({ error }, "Failed to initialize Resend client");
            throw new Error("Resend initialization failed");
        }
    }
    return resendClient;
}

export const sendEmail = async (params: {
    from: string;
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    const isProd = env.NODE_ENV === "production";
    const client = getResendClient();
    
    const result = await client.emails.send({
        from: isProd ? `your-website-name <no-reply@${params.from}>` : params.from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
    });

    if (result.error) {
        logger.error({ error: result.error }, "Failed to send email via Resend");
        return { success: false, error: result.error.message };
    }
    logger.info({ messageId: result.data?.id, to: params.to }, "Email sent successfully");
    return { success: true, messageId: result.data?.id };
}
