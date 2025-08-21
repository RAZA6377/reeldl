// functions/download-instagram/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Multiple API endpoints for fallback
const INSTAGRAM_APIS = [
  {
    name: "BhawaniGarg API",
    url: (instagramUrl: string) => `https://api.bhawanigarg.com/social/instagram/?url=${encodeURIComponent(instagramUrl)}`,
    parseResponse: (data: any) => data.url || data.video || data.downloadUrl
  },
  {
    name: "Saveinsta API",
    url: (instagramUrl: string) => `https://v3.saveinsta.app/api/ajaxSearch`,
    parseResponse: (data: any) => data?.data?.url || data?.data?.video_url,
    method: "POST",
    body: (instagramUrl: string) => ({ q: instagramUrl, t: "media", lang: "en" })
  },
  {
    name: "Instaloader API",
    url: (instagramUrl: string) => `https://api.instaloader.io/api/v1/media?url=${encodeURIComponent(instagramUrl)}`,
    parseResponse: (data: any) => data?.video_url || data?.display_url
  }
];

async function tryDownloadAPI(instagramUrl: string, saveType: string) {
  for (const api of INSTAGRAM_APIS) {
    try {
      console.log(`Trying ${api.name}...`);
      
      const requestOptions: RequestInit = {
        method: api.method || "GET",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      };

      if (api.body && api.method === "POST") {
        requestOptions.body = JSON.stringify(api.body(instagramUrl));
      }

      const response = await fetch(api.url(instagramUrl), requestOptions);
      
      if (!response.ok) {
        console.log(`${api.name} failed with status: ${response.status}`);
        continue;
      }

      const data = await response.json();
      console.log(`${api.name} response:`, data);

      const mediaUrl = api.parseResponse(data);
      
      if (mediaUrl && mediaUrl !== "undefined" && mediaUrl !== null) {
        return {
          success: true,
          downloadUrl: mediaUrl,
          apiUsed: api.name
        };
      }

      console.log(`${api.name} returned no valid media URL`);
    } catch (error) {
      console.error(`${api.name} error:`, error.message);
    }
  }

  return {
    success: false,
    error: "All download APIs failed"
  };
}

function validateInstagramUrl(url: string): boolean {
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/p\/[A-Za-z0-9_-]+/,
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/reel\/[A-Za-z0-9_-]+/,
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/tv\/[A-Za-z0-9_-]+/
  ];
  
  return patterns.some(pattern => pattern.test(url));
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { url, saveType } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: "No URL provided" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Validate Instagram URL
    if (!validateInstagramUrl(url)) {
      return new Response(
        JSON.stringify({ error: "Invalid Instagram URL. Please provide a valid Instagram post, reel, or TV URL." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log(`Processing Instagram URL: ${url}, Save type: ${saveType}`);

    // Try multiple APIs with fallback
    const result = await tryDownloadAPI(url, saveType);

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error || "Failed to extract media from Instagram" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Generate file name
    const fileName = `instagram_${Date.now()}.${saveType === "audio" ? "mp3" : "mp4"}`;

    console.log(`Successfully extracted media using ${result.apiUsed}`);

    return new Response(
      JSON.stringify({
        success: true,
        fileName,
        downloadUrl: result.downloadUrl,
        message: `Download ready! (via ${result.apiUsed})`,
        apiUsed: result.apiUsed
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Download function error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Internal server error",
        details: "Check function logs for more information"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
