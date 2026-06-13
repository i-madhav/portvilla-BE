import { registerAs } from "@nestjs/config";
import { Configuration } from "./constant/configuration.constant";

export interface IGithubConfig {
    token:string | undefined;
}

export default registerAs(Configuration.GITHUB,():IGithubConfig => ({
    token: process.env.GITHUB_TOKEN?.trim() ?? undefined
}));