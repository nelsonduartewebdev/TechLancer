const fs = require('fs');
const path = require('path');

// Simple script to create placeholder assets
// This creates minimal valid PNG files that Expo can use

const assetsDir = path.join(__dirname, '..', 'assets');

// Ensure assets directory exists
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Create a minimal 1x1 transparent PNG (Base64 encoded)
// This is a valid PNG file that can be used as a placeholder
const minimalPNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// Create placeholder files
const files = [
  { name: 'icon.png', size: 1024 },
  { name: 'splash.png', size: 2048 },
  { name: 'adaptive-icon.png', size: 1024 },
];

console.log('Generating placeholder assets...');

files.forEach((file) => {
  const filePath = path.join(assetsDir, file.name);
  
  // For now, create a minimal PNG
  // In production, you should replace these with actual design assets
  fs.writeFileSync(filePath, minimalPNG);
  console.log(`✓ Created ${file.name}`);
});

console.log('\n✅ Placeholder assets generated!');
console.log('⚠️  Note: These are minimal placeholders. Replace them with your actual app icons and splash screens.');
