const os = require('os');
const originalNetworkInterfaces = os.networkInterfaces;
os.networkInterfaces = () => ({});
console.log('Intercepted network interfaces for Termux compatibility');
