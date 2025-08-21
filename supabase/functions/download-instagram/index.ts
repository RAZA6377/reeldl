// functions/download-instagram/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Extract Instagram post shortcode from URL
function extractShortcode(url: string): string | null {
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/p\/([A-Za-z0-9_-]+)/,
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/reel\/([A-Za-z0-9_-]+)/,
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/tv\/([A-Za-z0-9_-]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

// Get Instagram media info directly from Instagram
async function getInstagramMediaInfo(shortcode: string): Promise<any> {
  try {
    // Method 1: Try Instagram's GraphQL endpoint
    const graphqlUrl = `https://www.instagram.com/graphql/query/`;
    const variables = {
      shortcode: shortcode,
      child_comment_count: 3,
      fetch_comment_count: 40,
      parent_comment_count: 24,
      has_threaded_comments: true
    };
    
    const queryHash = "b3055c01b4b222b8a47dc12b090e4e64"; // This changes periodically
    
    const response = await fetch(`${graphqlUrl}?query_hash=${queryHash}&variables=${JSON.stringify(variables)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.instagram.com/',
        'Authority': 'www.instagram.com'
      }
    });

    if (response.ok) {
      const data = await response.json();
      return data?.data?.shortcode_media;
    }
  } catch (error) {
    console.log("GraphQL method failed:", error.message);
  }

  // Method 2: Try the embed endpoint
  try {
    const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
    const response = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (response.ok) {
      const html = await response.text();
      
      // Extract JSON data from HTML
      const scriptMatch = html.match(/window\.__additionalDataLoaded\([^,]+,({.+})\);/);
      if (scriptMatch) {
        const jsonData = JSON.parse(scriptMatch[1]);
        return jsonData?.graphql?.shortcode_media;
      }

      // Try alternative pattern
      const altMatch = html.match(/window\._sharedData\s*=\s*({.+?});/);
      if (altMatch) {
        const sharedData = JSON.parse(altMatch[1]);
        const media = sharedData?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media;
        return media;
      }
    }
  } catch (error) {
    console.log("Embed method failed:", error.message);
  }

  // Method 3: Try direct post URL scraping
  try {
    const postUrl = `https://www.instagram.com/p/${shortcode}/`;
    const response = await fetch(postUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.google.com/'
      }
    });

    if (response.ok) {
      const html = await response.text();
      
      // Look for JSON data in script tags
      const jsonRegex = /<script type="application\/ld\+json">(.+?)<\/script>/g;
      let match;
      while ((match = jsonRegex.exec(html)) !== null) {
        try {
          const jsonData = JSON.parse(match[1]);
          if (jsonData.video?.contentUrl) {
            return {
              video_url: jsonData.video.contentUrl,
              display_url: jsonData.image || jsonData.video.thumbnailUrl,
              is_video: true
            };
          }
          if (jsonData.image) {
            return {
              display_url: jsonData.image,
              is_video: false
            };
          }
        } catch (e) {
          continue;
        }
      }

      // Extract from meta tags
      const videoMatch = html.match(/<meta property="og:video" content="([^"]+)"/);
      const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
      
      if (videoMatch || imageMatch) {
        return {
          video_url: videoMatch?.[1],
          display_url: imageMatch?.[1] || videoMatch?.[1],
          is_video: !!videoMatch?.[1]
        };
      }
    }
  } catch (error) {
    console.log("Direct scraping failed:", error.message);
  }

  return null;
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

    console.log(`Processing Instagram URL: ${url}`);

    // Extract shortcode from URL
    const shortcode = extractShortcode(url);
    if (!shortcode) {
      return new Response(
        JSON.stringify({ error: "Invalid Instagram URL. Please provide a valid Instagram post, reel, or TV URL." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log(`Extracted shortcode: ${shortcode}`);

    // Get media information from Instagram
    const mediaInfo = await getInstagramMediaInfo(shortcode);
    
    if (!mediaInfo) {
      return new Response(
        JSON.stringify({ error: "Could not extract media information from Instagram. The post might be private or unavailable." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    console.log("Media info extracted:", mediaInfo);

    // Determine download URL based on media type and user preference
    let downloadUrl: string;
    let isVideo = false;

    if (mediaInfo.is_video || mediaInfo.video_url) {
      isVideo = true;
      downloadUrl = mediaInfo.video_url || mediaInfo.display_url;
    } else {
      downloadUrl = mediaInfo.display_url;
    }

    if (!downloadUrl) {
      return new Response(
        JSON.stringify({ error: "No downloadable media found in this Instagram post." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // For audio extraction from video, we'll need to note that client-side processing is required
    if (saveType === "audio" && !isVideo) {
      return new Response(
        JSON.stringify({ error: "This post contains only images. Audio extraction is only available for videos." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Generate filename
    const fileExtension = saveType === "audio" ? "mp4" : (isVideo ? "mp4" : "jpg");
    const fileName = `instagram_${shortcode}.${fileExtension}`;

    console.log(`Successfully extracted media: ${downloadUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        fileName,
        downloadUrl,
        message: saveType === "audio" && isVideo 
          ? "Video download ready! Use a video-to-audio converter for audio extraction."
          : "Download ready!",
        mediaType: isVideo ? "video" : "image",
        shortcode
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Instagram download error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to process Instagram URL",
        details: error.message
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
