module.exports.getEnvVar = function getEnvVar(name) {
    return process.env.NODE_ENV === 'test' ? process.env[name + '_TEST'] : process.env[name];
}
