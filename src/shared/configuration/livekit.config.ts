import { registerAs } from "@nestjs/config";
import { Configuration } from "./constant/configuration.constant";

export interface ILivekitConfig {
    url:       string | undefined;
    apiKey:    string | undefined;
    apiSecret: string | undefined;
}

export default registerAs(Configuration.LIVEKIT, (): ILivekitConfig => ({
    url:       process.env.LIVEKIT_URL,
    apiKey:    process.env.LIVEKIT_API_KEY,
    apiSecret: process.env.LIVEKIT_API_SECRET,
}))