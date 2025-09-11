export const envConfiguration = () => ({
  envFilePath: ['.env', '.env.local', '.env.development'],
  ignoreEnvFile: process.env.NODE_ENV === 'production',
  load: [
    () => ({
      database: {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT, 10),
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      },
      rpc: {
        endpoint: process.env.RPC_ENDPOINT,
      },
      payer: {
        mnemonic: process.env.PAYER_MNEMONIC,
      },
    }),
  ],
});
