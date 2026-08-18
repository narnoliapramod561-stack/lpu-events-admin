// Cross-platform environment checks for LPU Events
console.log('🔍 Checking development environment...');

const requiredNodeVersion = 18;
const currentNodeVersion = parseInt(process.versions.node.split('.')[0], 10);

if (currentNodeVersion < requiredNodeVersion) {
  console.error(`❌ Node.js version ${requiredNodeVersion} or higher is required. Current version: ${process.version}`);
  process.exit(1);
} else {
  console.log(`✅ Node.js version is compatible: ${process.version}`);
}

console.log('🚀 Development environment foundation is ready!');
