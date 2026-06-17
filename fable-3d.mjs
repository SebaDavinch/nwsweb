import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";

const client = new Anthropic();

console.log("Asking Fable 5 to create 3D graphics...\n");

const response = await client.messages.create({
  model: "claude-fable-5",
  max_tokens: 8000,
  thinking: { type: "adaptive" },
  messages: [
    {
      role: "user",
      content: `Create a stunning, self-contained HTML file with interactive 3D graphics using Three.js (load from CDN).
Make it visually impressive — something that showcases what's possible: particles, geometry, lighting, animation.
Respond with ONLY the complete HTML file, no explanation.`,
    },
  ],
});

let html = "";
for (const block of response.content) {
  if (block.type === "thinking") {
    console.log(`[Thinking... ${block.thinking.length} chars]\n`);
  } else if (block.type === "text") {
    html = block.text.trim();
    // strip markdown code fences if present
    html = html.replace(/^```html\n?/, "").replace(/\n?```$/, "").trim();
  }
}

fs.writeFileSync("fable-3d-output.html", html, "utf8");
console.log("Saved to fable-3d-output.html");
console.log(`Usage: input=${response.usage.input_tokens}, output=${response.usage.output_tokens}`);
