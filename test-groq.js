import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "http://localhost:3000/v1",
  apiKey: "none",
});

async function testProxy() {
  console.log("Testing FreeFlowAI proxy with Groq...");

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "user", content: "Hello! Tell me a short joke about AI speed." }
      ],
      stream: true,
    });

    console.log("Response:");
    for await (const chunk of stream) {
      process.stdout.write(chunk.choices[0]?.delta?.content || "");
    }
    console.log("\n✅ Proxy test successful!");

  } catch (error) {
    console.error("❌ Proxy test failed:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response body:", await error.response.text());
    }
  }
}

testProxy();
