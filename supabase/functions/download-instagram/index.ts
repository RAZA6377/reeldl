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

    // Validate Instagram URL
    if (!url.includes('instagram.com') || (!url.includes('/reel/') && !url.includes('/p/'))) {
      throw new Error('Invalid Instagram URL')
    }

    // Use a third-party API to download Instagram content
    // Note: This is a simplified example. In production, you'd want to use a reliable service
    const response = await fetch('https://api.instagram-downloader.com/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        type: saveType
      })
    })

    if (!response.ok) {
      throw new Error('Failed to fetch Instagram content')
    }

    const data = await response.json()
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Download the file from the third-party service
    const fileResponse = await fetch(data.downloadUrl)
    const fileBuffer = await fileResponse.arrayBuffer()
    
    // Upload to Supabase Storage
    const fileExtension = saveType === 'audio' ? 'mp3' : 'mp4'
    const fullFileName = `${fileName}.${fileExtension}`
    const filePath = `downloads/${Date.now()}-${fullFileName}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('instagram-downloads')
      .upload(filePath, fileBuffer, {
        contentType: saveType === 'audio' ? 'audio/mpeg' : 'video/mp4'
      })

    if (uploadError) {
      throw uploadError
    }

    // Get public URL for download
    const { data: urlData } = supabase.storage
      .from('instagram-downloads')
      .getPublicUrl(filePath)

    // Store download record in database
    const { error: dbError } = await supabase
      .from('downloads')
      .insert({
        original_url: url,
        file_name: fullFileName,
        file_path: filePath,
        file_type: saveType,
        download_url: urlData.publicUrl,
        created_at: new Date().toISOString()
      })

    if (dbError) {
      console.error('Database error:', dbError)
      // Don't throw here as the file was successfully uploaded
    }

    return new Response(
      JSON.stringify({
        success: true,
        fileName: fullFileName,
        downloadUrl: urlData.publicUrl,
        message: `${saveType === 'audio' ? 'Audio' : 'Video'} downloaded successfully!`
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