module.exports = {
  apps: [{
    name: 'Brave Heartbeat Server',
    script: './server.js',
    autorestart: true,
    max_memory_restart: '200M',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    }
  }]
}
