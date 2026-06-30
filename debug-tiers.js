import 'dotenv/config';
import { getEnabledTiers } from './src/router.js';

console.log('Environment variables:');
console.log('GROQ_API_KEY:', process.env.GROQ_API_KEY ? 'Set' : 'Not set');
console.log('GROQ_MODELS:', process.env.GROQ_MODELS);
console.log('OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? 'Set' : 'Not set');
console.log('HF_API_KEY:', process.env.HF_API_KEY ? 'Set' : 'Not set');
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'Set' : 'Not set');

console.log('\nEnabled tiers:');
const tiers = getEnabledTiers();
console.log(tiers.map(t => t.name).join(', '));
