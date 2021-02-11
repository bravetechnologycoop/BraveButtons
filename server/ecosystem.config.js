module.exports = {
  apps: [
    {
      name: 'BraveServer',
      script: './server.js',
      log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS',
      autorestart: true,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
}
