import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Music, Video, Instagram, Sparkles, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const InstagramDownloader = () => {
  const [url, setUrl] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [saveType, setSaveType] = useState("reel");
  const [fileName, setFileName] = useState("");
  const [directory, setDirectory] = useState("Downloads");
  const [isLoading, setIsLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState("");
  const { toast } = useToast();

  const handleDownloadClick = () => {
    if (!url) {
      toast({
        title: "Missing URL",
        description: "Please enter an Instagram reel URL",
        variant: "destructive",
      });
      return;
    }
    
    if (!url.includes("instagram.com") || (!url.includes("/reel/") && !url.includes("/p/"))) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid Instagram reel or post URL",
        variant: "destructive",
      });
      return;
    }

    // Generate default filename from URL
    const reelId = url.split("/").find(part => part.length > 10) || "instagram_content";
    setFileName(`${reelId}_${saveType}`);
    setShowOptions(true);
  };

  const handleConfirmDownload = async () => {
    setIsLoading(true);
    
    try {
      console.log('Attempting to call Supabase function with:', { url, saveType, fileName });
      
      const { data, error } = await supabase.functions.invoke('download-instagram', {
        body: {
          url,
          saveType,
          fileName: fileName || `instagram_${saveType}_${Date.now()}`
        }
      });

      console.log('Supabase function response:', { data, error });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      if (data && data.success) {
        setDownloadUrl(data.downloadUrl);
        toast({
          title: "Download Complete!",
          description: `${data.fileName} is ready for download`,
        });
        
        // Auto-download the file
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = data.fileName;
        link.click();
        
        // Reset form
        setUrl("");
        setFileName("");
        setSaveType("reel");
        setTimeout(() => {
          setDownloadUrl("");
          setShowOptions(false);
        }, 3000);
      } else {
        throw new Error(data.error || 'Download failed');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download Instagram content. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-glow opacity-50" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse delay-1000" />
      
      <div className="relative z-10 container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="p-3 bg-gradient-instagram rounded-2xl shadow-glow">
              <Instagram className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-5xl font-bold bg-gradient-instagram bg-clip-text text-transparent">
              Reely Save It
            </h1>
            <Sparkles className="w-6 h-6 text-primary animate-pulse" />
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Download Instagram reels and extract audio with just a few clicks. 
            Fast, simple, and beautiful.
          </p>
        </div>

        <Card className="max-w-2xl mx-auto bg-gradient-card border-border/50 shadow-card-custom backdrop-blur-sm">
          <div className="p-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="url" className="text-lg font-medium">
                  Instagram Reel URL
                </Label>
                <div className="relative">
                  <Input
                    id="url"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://www.instagram.com/reel/..."
                    className="text-lg h-14 pr-16 bg-input/50 border-border/50 focus:border-primary/50 transition-all duration-300"
                  />
                  <Instagram className="absolute right-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-muted-foreground" />
                </div>
              </div>
              
              <Button
                onClick={handleDownloadClick}
                className="w-full h-14 text-lg font-semibold bg-gradient-instagram hover:bg-gradient-instagram-hover shadow-instagram transition-all duration-300 hover:shadow-glow hover:scale-[1.02]"
              >
                <Download className="w-5 h-5 mr-2" />
                Download Reel
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Download Options Dialog */}
      <Dialog open={showOptions} onOpenChange={setShowOptions}>
        <DialogContent className="sm:max-w-md bg-gradient-card border-border/50 shadow-glow">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">
              Download Options
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label className="text-base font-medium">What would you like to save?</Label>
              <RadioGroup value={saveType} onValueChange={setSaveType} className="space-y-3">
                <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-accent/20 transition-colors">
                  <RadioGroupItem value="reel" id="reel" />
                  <Label htmlFor="reel" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Video className="w-5 h-5 text-primary" />
                    <span className="font-medium">Full Reel (Video)</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-accent/20 transition-colors">
                  <RadioGroupItem value="audio" id="audio" />
                  <Label htmlFor="audio" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Music className="w-5 h-5 text-primary" />
                    <span className="font-medium">Audio Only</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filename">File Name</Label>
              <Input
                id="filename"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="Enter custom filename"
                className="bg-input/50 border-border/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="directory">Save Directory</Label>
              <Select value={directory} onValueChange={setDirectory}>
                <SelectTrigger className="bg-input/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Downloads">Downloads</SelectItem>
                  <SelectItem value="Documents">Documents</SelectItem>
                  <SelectItem value="Desktop">Desktop</SelectItem>
                  <SelectItem value="Music">Music</SelectItem>
                  <SelectItem value="Videos">Videos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {downloadUrl && (
              <div className="p-4 bg-accent/20 rounded-lg border border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">File ready for download</span>
                  <Button
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open(downloadUrl, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open File
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowOptions(false)}
                className="flex-1"
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmDownload}
                disabled={isLoading}
                className="flex-1 bg-gradient-instagram hover:bg-gradient-instagram-hover shadow-instagram"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </div>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Start Download
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};