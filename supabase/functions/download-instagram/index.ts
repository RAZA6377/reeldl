// functions/download-instagram/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { url, saveType } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: "No URL provided" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    // Call free Instagram downloader API
    const targetUrl = `https://api.bhawanigarg.com/social/instagram/?url=${encodeURIComponent(url)}`;
    const resp = await fetch(targetUrl);

    if (!resp.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch from Instagram API" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
      );
    }

    const data = await resp.json();
    console.log("API response:", data);

    // Attempt to find a valid media URL
    const videoUrl = data.url || data.video || data.downloadUrl;
    if (!videoUrl) {
      return new Response(
        JSON.stringify({ error: "No downloadable media found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 },
      );
    }

    // Generate file name
    const fileName = `reel_${Date.now()}.${saveType === "audio" ? "mp3" : "mp4"}`;

    return new Response(
      JSON.stringify({
        success: true,
        fileName,
        downloadUrl: videoUrl,
        message: "Download ready!",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
