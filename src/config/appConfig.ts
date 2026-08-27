/**
 * Static application configuration
 * Non-environment-specific settings
 */

export interface AppConfig {
    app: {
        name: string;
        version: string;
    };
    features: {
        enableBlog: boolean;
        enableTestimonials: boolean;
        enableLiveChat: boolean;
    };
    ui: {
        animationDuration: number;
        toastDuration: number;
        defaultLocale: string;
    };
    form: {
        maxMessageLength: number;
        maxFileSize: number; // in MB
    };
}

export const appConfig: AppConfig = {
    app: {
        name: 'DreamWebApp 2.0',
        version: '1.0.0',
    },
    features: {
        enableBlog: false, // Placeholder for future blog
        enableTestimonials: true,
        enableLiveChat: false,
    },
    ui: {
        animationDuration: 300, // ms
        toastDuration: 5000, // ms
        defaultLocale: 'en-US',
    },
    form: {
        maxMessageLength: 1000,
        maxFileSize: 5, // MB
    },
};
