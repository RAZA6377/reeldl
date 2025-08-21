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

// Working Instagram scraper using multiple methods
async function getInstagramMediaInfo(shortcode: string): Promise<any> {
  console.log(`Starting extraction for shortcode: ${shortcode}`);
  
  // Method 1: Try Instagram oEmbed API (most reliable)
  try {
    const embedUrl = `https://api.instagram.com/oembed/?url=https://www.instagram.com/p/${shortcode}/`;
    console.log("Trying Instagram oEmbed API...");
    
    const response = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log("oEmbed response:", data);
      
      if (data.thumbnail_url) {
        return {
          display_url: data.thumbnail_url,
          is_video: data.type === 'video',
          title: data.title || '',
          author_name: data.author_name || ''
        };
      }
    }
  } catch (error) {
    console.log("oEmbed method failed:", error.message);
  }

  // Method 2: Try alternative scraping approach
  try {
    console.log("Trying direct Instagram page scraping...");
    const postUrl = `https://www.instagram.com/p/${shortcode}/`;
    
    const response = await fetch(postUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/12.0 Mobile/15A372 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none'
      }
    });

    if (response.ok) {
      const html = await response.text();
      console.log("HTML response length:", html.length);
      
      // Extract media URLs from meta tags
      const videoUrlMatch = html.match(/<meta property="og:video:secure_url" content="([^"]+)"/);
      const videoMatch = html.match(/<meta property="og:video" content="([^"]+)"/);
      const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
      
      console.log("Video URL found:", !!videoUrlMatch);
      console.log("Video found:", !!videoMatch);  
      console.log("Image found:", !!imageMatch);

      if (videoUrlMatch || videoMatch) {
        return {
          video_url: videoUrlMatch?.[1] || videoMatch?.[1],
          display_url: imageMatch?.[1],
          is_video: true
        };
      } else if (imageMatch) {
        return {
          display_url: imageMatch[1],
          is_video: false
        };
      }

      // Try JSON-LD extraction
      const jsonLdMatch = html.match(/<script type="application\/ld\+json"[^>]*>([^<]+)<\/script>/g);
      if (jsonLdMatch) {
        for (const jsonScript of jsonLdMatch) {
          try {
            const jsonContent = jsonScript.match(/>([^<]+)</)?.[1];
            if (jsonContent) {
              const jsonData = JSON.parse(jsonContent);
              console.log("Found JSON-LD data:", jsonData);
              
              if (jsonData.video?.contentUrl) {
                return {
                  video_url: jsonData.video.contentUrl,
                  display_url: jsonData.video.thumbnailUrl || jsonData.image,
                  is_video: true
                };
              }
              if (jsonData.image) {
                return {
                  display_url: Array.isArray(jsonData.image) ? jsonData.image[0] : jsonData.image,
                  is_video: false
                };
              }
            }
          } catch (e) {
            console.log("JSON-LD parsing error:", e.message);
          }
        }
      }
    }
  } catch (error) {
    console.log("Direct scraping failed:", error.message);
  }

  // Method 3: Use working third-party API as fallback
  try {
    console.log("Trying third-party API fallback...");
    const apiUrl = `https://instagram-scraper-api2.p.rapidapi.com/v1/post_info?code_or_id_or_url=${shortcode}`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log("Third-party API response:", data);
      
      if (data.data?.video_url || data.data?.image_url) {
        return {
          video_url: data.data.video_url,
          display_url: data.data.image_url || data.data.video_url,
          is_video: !!data.data.video_url
        };
      }
    }
  } catch (error) {
    console.log("Third-party API failed:", error.message);
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
        JSON.stringify({ 
          error: "Could not extract media from Instagram. This might be due to:",
          reasons: [
            "The post is private or unavailable",
            "Instagram has blocked the request",  
            "The post URL format is not supported"
          ],
          suggestion: "Try with a different Instagram post URL or check if the post is public"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    console.log("Successfully extracted media info:", mediaInfo);

    // Determine download URL based on media type and user preference
    let downloadUrl: string;
    let isVideo = mediaInfo.is_video;

    if (isVideo && mediaInfo.video_url) {
      downloadUrl = mediaInfo.video_url;
    } else if (mediaInfo.display_url) {
      downloadUrl = mediaInfo.display_url;
    } else {
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

    console.log(`Successfully processed. Download URL: ${downloadUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        fileName,
        downloadUrl,
        message: saveType === "audio" && isVideo 
          ? "Video download ready! Use a video-to-audio converter for audio extraction."
          : "Download ready!",
        mediaType: isVideo ? "video" : "image",
        shortcode,
        extractedFrom: mediaInfo.author_name || "Instagram"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Instagram download error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to process Instagram URL",
        details: error.message,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
