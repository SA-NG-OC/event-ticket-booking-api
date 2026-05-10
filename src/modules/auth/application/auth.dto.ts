export interface RegisterDto {
    email: string;
    password: string;
    name: string;
}

export interface LoginDto {
    email: string;
    password: string;
}

export interface AuthTokens {
    accessToken: string;
    user: {
        id: string;
        email: string;
        name: string;
        role: string;
    };
}