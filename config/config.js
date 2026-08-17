import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });

export const config = {
    port: process.env.PORT || 3000,
};


