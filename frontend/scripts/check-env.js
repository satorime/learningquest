#!/usr/bin/env node

// Environment Variable Checker for LearningQuest
// Run this script to verify your environment variables are properly set

console.log('🔍 Checking LearningQuest Environment Variables...\n');

const requiredEnvVars = [
  'NEXT_PUBLIC_MOODLE_URL',
  'NEXT_PUBLIC_API_URL',
  'MOODLE_SERVICE_NAME'
];

const optionalEnvVars = [
  'NODE_ENV',
  'MOODLE_CLIENT_ID',
  'MOODLE_CLIENT_SECRET',
  'MOODLE_REDIRECT_URI'
];

console.log('📋 Required Environment Variables:');
let allRequiredSet = true;

requiredEnvVars.forEach(envVar => {
  const value = process.env[envVar];
  if (value) {
    console.log(`✅ ${envVar}: ${value}`);
  } else {
    console.log(`❌ ${envVar}: NOT SET`);
    allRequiredSet = false;
  }
});

console.log('\n📋 Optional Environment Variables:');
optionalEnvVars.forEach(envVar => {
  const value = process.env[envVar];
  if (value) {
    console.log(`✅ ${envVar}: ${value}`);
  } else {
    console.log(`⚠️  ${envVar}: NOT SET (optional)`);
  }
});

console.log('\n🔧 Environment Variable Validation:');

// Validate MOODLE_URL format
const moodleUrl = process.env.NEXT_PUBLIC_MOODLE_URL;
if (moodleUrl) {
  try {
    const url = new URL(moodleUrl);
    console.log(`✅ NEXT_PUBLIC_MOODLE_URL is a valid URL: ${moodleUrl}`);
    console.log(`   - Protocol: ${url.protocol}`);
    console.log(`   - Host: ${url.host}`);
    console.log(`   - Port: ${url.port || 'default'}`);
  } catch (error) {
    console.log(`❌ NEXT_PUBLIC_MOODLE_URL is not a valid URL: ${moodleUrl}`);
    console.log(`   Error: ${error.message}`);
  }
} else {
  console.log('❌ NEXT_PUBLIC_MOODLE_URL is not set');
}

// Validate API_URL format
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
if (apiUrl) {
  try {
    const url = new URL(apiUrl);
    console.log(`✅ NEXT_PUBLIC_API_URL is a valid URL: ${apiUrl}`);
  } catch (error) {
    console.log(`❌ NEXT_PUBLIC_API_URL is not a valid URL: ${apiUrl}`);
    console.log(`   Error: ${error.message}`);
  }
} else {
  console.log('❌ NEXT_PUBLIC_API_URL is not set');
}

console.log('\n📝 Summary:');
if (allRequiredSet) {
  console.log('✅ All required environment variables are set!');
} else {
  console.log('❌ Some required environment variables are missing.');
  console.log('\n💡 To fix this, set the missing environment variables in your deployment:');
  console.log('   - For Vercel: Add them in your project settings under Environment Variables');
  console.log('   - For other platforms: Check your deployment documentation');
}

console.log('\n🔗 Expected Moodle URL format:');
console.log('   - Production: https://your-moodle-domain.com');
console.log('   - Development: http://localhost:8080 or https://localhost');
console.log('   - Make sure the URL is accessible from your deployment environment');
