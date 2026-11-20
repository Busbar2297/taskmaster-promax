// Capture explicit launcher opt-in before any project dotenv files are loaded.
export const PRIVATE_CLOUD_ENABLED = process.env.TASKMASTER_ENABLE_CLOUD === '1';
