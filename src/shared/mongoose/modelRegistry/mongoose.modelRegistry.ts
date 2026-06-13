export const DB_MODEL_REGISTRY = {
    USER:{
        MODEL_TOKEN:'User',
        COLLECTION:'users'
    },
    OTP:{
        MODEL_TOKEN:'Otp',
        COLLECTION:'otps'
    },
    SESSION:{
        MODEL_TOKEN:'Session',
        COLLECTION:'sessions'
    },
    PROFILE:{
        MODEL_TOKEN:'Profile',
        COLLECTION:'profiles'
    }
} as const;

export type DbModelToken = (typeof DB_MODEL_REGISTRY)[keyof typeof DB_MODEL_REGISTRY]['MODEL_TOKEN'];