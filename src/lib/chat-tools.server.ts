import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

type SearchResult = { title: string; url: string; snippet: string };

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(value: string) {
  return decodeEntities(value.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

async function duckDuckGoSearch(query: string, limit: number): Promise<SearchResult[]> {
  const response = await fetch("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
    },
    body: new URLSearchParams({ q: query }).toString(),
  });

  if (!response.ok) throw new Error(`Search failed with status ${response.status}`);
  const html = await response.text();

  const results: SearchResult[] = [];
  const blockRegex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRegex = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  const snippets: string[] = [];
  for (let m = snippetRegex.exec(html); m; m = snippetRegex.exec(html)) {
    snippets.push(stripTags(m[1] ?? ""));
  }

  let index = 0;
  for (let m = blockRegex.exec(html); m && results.length < limit; m = blockRegex.exec(html)) {
    let url = decodeEntities(m[1] ?? "");
    const uddg = /[?&]uddg=([^&]+)/.exec(url);
    if (uddg?.[1]) url = decodeURIComponent(uddg[1]);
    if (url.startsWith("//")) url = `https:${url}`;
    results.push({
      title: stripTags(m[2] ?? "") || url,
      url,
      snippet: snippets[index] ?? "",
    });
    index += 1;
  }

  return results;
}

export const webSearchTool = tool({
  description:
    "Search the live web for current information, news, prices, or anything after your training cutoff. Always cite the URLs you used.",
  inputSchema: z.object({
    query: z.string().describe("The search query"),
  }),
  execute: async ({ query }) => {
    try {
      const results = await duckDuckGoSearch(query, 6);
      if (results.length === 0) return { query, results: [], note: "No results found." };
      return { query, results };
    } catch (error) {
      return { query, results: [], error: (error as Error).message };
    }
  },
});

export const fetchUrlTool = tool({
  description:
    "Fetch and read the readable text content of a web page URL. Use after web_search when a page needs to be read in detail.",
  inputSchema: z.object({ url: z.string().describe("Absolute http(s) URL to read") }),
  execute: async ({ url }) => {
    try {
      if (!/^https?:\/\//i.test(url)) return { url, error: "Only http(s) URLs are supported." };
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; MightyChat/1.0)" },
      });
      if (!response.ok) return { url, error: `Request failed with status ${response.status}` };
      const html = await response.text();
      const body = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ");
      const text = stripTags(body).slice(0, 12000);
      return { url, text };
    } catch (error) {
      return { url, error: (error as Error).message };
    }
  },
});

const IMAGE_MODEL = "google/gemini-3.1-flash-image";

export function createImageTool(options: {
  lovableApiKey: string;
  supabase: SupabaseClient;
  userId: string;
}) {
  return tool({
    description:
      "Generate an original image from a text prompt. Use whenever the user asks for a picture, illustration, logo, diagram art, or any visual to be created.",
    inputSchema: z.object({
      prompt: z.string().describe("Detailed description of the image to generate"),
    }),
    execute: async ({ prompt }) => {
      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${options.lovableApiKey}`,
          },
          body: JSON.stringify({
            model: IMAGE_MODEL,
            messages: [{ role: "user", content: prompt }],
            modalities: ["image", "text"],
          }),
        });

        if (!response.ok) {
          return { prompt, error: `Image generation failed: ${await response.text()}` };
        }

        const payload = (await response.json()) as {
          data?: { b64_json?: string; url?: string }[];
          choices?: {
            message?: { images?: { image_url?: { url?: string } }[] };
          }[];
        };

        const raw =
          payload.data?.[0]?.b64_json ??
          payload.data?.[0]?.url ??
          payload.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (!raw) return { prompt, error: "No image was returned by the model." };

        const base64 = raw.startsWith("data:") ? (raw.split(",")[1] ?? "") : raw;
        const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
        const path = `${options.userId}/generated/${crypto.randomUUID()}.png`;

        const { error } = await options.supabase.storage
          .from("chat-uploads")
          .upload(path, bytes, { contentType: "image/png" });
        if (error) return { prompt, error: `Could not store image: ${error.message}` };

        return { prompt, storagePath: path };
      } catch (error) {
        return { prompt, error: (error as Error).message };
      }
    },
  });
}
