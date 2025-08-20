import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DownloadRequest {
  url: string
  saveType: 'reel' | 'audio'
  fileName: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url, saveType, fileName }: DownloadRequest = await req.json()
    
    console.log('Received request:', { url, saveType, fileName })

    // Validate Instagram URL
    if (!url.includes('instagram.com') || (!url.includes('/reel/') && !url.includes('/p/'))) {
      throw new Error('Invalid Instagram URL')
    }

    // For now, return a mock response since we don't have a real Instagram downloader
    // In production, you'd integrate with a real Instagram download service
    const mockDownloadUrl = `https://example.com/mock-${saveType}-${Date.now()}.${saveType === 'audio' ? 'mp3' : 'mp4'}`
    
    return new Response(
      JSON.stringify({
        success: true,
        fileName: `${fileName}.${saveType === 'audio' ? 'mp3' : 'mp4'}`,
        downloadUrl: mockDownloadUrl,
        message: `${saveType === 'audio' ? 'Audio' : 'Video'} processing started! (Mock response)`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Download error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to download Instagram content'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})