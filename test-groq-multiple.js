import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "http://localhost:3000/v1",
  apiKey: "none",
});

async function testProxy() {
  console.log("Testing FreeFlowAI proxy with Groq (multiple requests)...\n");

  for (let i = 1; i <= 5; i++) {
    console.log(`Request ${i}:`);
    try {
      const stream = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "user", content: `Why is AI fast? (Request ${i})` }
        ],
        stream: true,
      });

      let responseText = "";
      for await (const chunk of stream) {
        responseText += chunk.choices[0]?.delta?.content || "";
      }
      console.log(`✅ Success: ${responseText}`);

    } catch (error) {
      console.error("❌ Proxy test failed:", error.message);
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response body:", await error.response.text());
      }
    }
    console.log();
  }
}

testProxy();
