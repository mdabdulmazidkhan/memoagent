import { useState } from "react";
import { Upload, X, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@clerk/clerk-react";

interface FileUploadProps {
  conversationId: string;
  onUploadComplete?: (videoNo: string) => void;
}

interface UploadedFile {
  file: File;
  videoNo?: string;
  status: "uploading" | "success" | "error";
  error?: string;
}

export function FileUpload({ conversationId, onUploadComplete }: FileUploadProps) {
  const [uploading, setUploading] = useState<UploadedFile[]>([]);
  const { getToken } = useAuth();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newUploads: UploadedFile[] = Array.from(files).map(file => ({
      file,
      status: "uploading" as const,
    }));

    setUploading(prev => [...prev, ...newUploads]);

    for (let i = 0; i < newUploads.length; i++) {
      const upload = newUploads[i];
      
      try {
        const formData = new FormData();
        formData.append("file", upload.file);
        formData.append("conversationId", conversationId);

        const token = await getToken();
        
        const response = await fetch(`https://proj-d3v1nkk82vjkdgl3jjc0.api.lp.dev/chat/upload`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Upload failed: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        
        setUploading(prev => prev.map(u => 
          u.file === upload.file 
            ? { ...u, status: "success" as const, videoNo: result.videoNo }
            : u
        ));

        if (onUploadComplete) {
          onUploadComplete(result.videoNo);
        }

      } catch (error) {
        console.error("Upload error:", error);
        setUploading(prev => prev.map(u =>
          u.file === upload.file
            ? { ...u, status: "error" as const, error: error instanceof Error ? error.message : "Upload failed" }
            : u
        ));
      }
    }

    event.target.value = "";
  };

  const removeUpload = (index: number) => {
    setUploading(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept="video/*"
          multiple
          onChange={handleFileSelect}
        />
        <label htmlFor="file-upload">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            asChild
          >
            <span>
              <Upload className="h-4 w-4" />
            </span>
          </Button>
        </label>
      </div>

      {uploading.length > 0 && (
        <div className="flex flex-col gap-2 max-h-32 overflow-y-auto">
          {uploading.map((upload, index) => (
            <div
              key={index}
              className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-sm"
            >
              {upload.status === "uploading" && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {upload.status === "success" && (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              )}
              {upload.status === "error" && (
                <X className="h-4 w-4 text-red-600" />
              )}
              
              <span className="flex-1 truncate text-foreground">
                {upload.file.name}
                {upload.videoNo && (
                  <span className="ml-2 text-muted-foreground text-xs">
                    ({upload.videoNo})
                  </span>
                )}
                {upload.error && (
                  <span className="ml-2 text-red-600 text-xs">
                    {upload.error}
                  </span>
                )}
              </span>

              {upload.status !== "uploading" && (
                <button
                  onClick={() => removeUpload(index)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
