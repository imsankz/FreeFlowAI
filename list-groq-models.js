import 'dotenv/config';

async function listGroqModels() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error('Please set GROQ_API_KEY in .env');
    return;
  }

  try {
    console.log('Fetching Groq models...');
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    const data = await response.json();
    console.log('Total models:', data.data.length);

    if (data.data.length > 0) {
      console.log('\nModel List:');
      data.data.forEach(model => {
        console.log(`- ${model.id}`);
      });
    } else {
      console.log('\nNo models found.');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

listGroqModels();
