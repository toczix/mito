import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { validatePdfFiles } from '@/lib/pdf-processor';
import { Upload, FileText, X, CheckCircle2, Image } from 'lucide-react';

interface PdfUploaderProps {
  onFilesSelected: (files: File[]) => void;
  onAnalyze: () => void;
  isProcessing?: boolean;
}

export function PdfUploader({ onFilesSelected, onAnalyze, isProcessing = false }: PdfUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setErrors([]);
    
    const validation = validatePdfFiles(acceptedFiles);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    const newFiles = [...files, ...acceptedFiles];
    setFiles(newFiles);
    onFilesSelected(newFiles);
  }, [files, onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg']
    },
    disabled: isProcessing,
    multiple: true,
  });

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    onFilesSelected(newFiles);
  };

  const handleAnalyze = () => {
    setErrors([]);
    
    const validation = validatePdfFiles(files);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    onAnalyze();
  };

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle>Upload Lab Reports</CardTitle>
        <CardDescription>
          Upload PDF, Word (.docx), or image files (PNG/JPG) containing laboratory results
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Upload Area */}
          <div className="space-y-4">
            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                transition-colors duration-200 h-[400px] flex flex-col items-center justify-center
                ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
                ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <input {...getInputProps()} />
              <Upload className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              {isDragActive ? (
                <p className="text-lg font-medium">Drop the files here...</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-lg font-medium">Drag & drop files here</p>
                  <p className="text-sm text-muted-foreground">PDF, DOCX, PNG, or JPG files</p>
                  <p className="text-xs text-muted-foreground">Maximum file size: 50MB per file</p>
                </div>
              )}
            </div>

            {/* Error messages */}
            {errors.length > 0 && (
              <Alert variant="destructive">
                <AlertDescription>
                  <ul className="list-disc list-inside">
                    {errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Right Column - File List & Analyze Button */}
          <div className="flex flex-col h-[400px]">
            {files.length > 0 ? (
              <>
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium">Selected Files ({files.length})</h3>
                  <Badge variant="secondary">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Ready
                  </Badge>
                </div>
                
                {/* Scrollable file list */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-4">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {file.type.startsWith('image/') ? (
                          <Image className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        disabled={isProcessing}
                        className="flex-shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Analyze button - pinned to bottom */}
                <Button
                  className="w-full mt-auto"
                  size="lg"
                  onClick={handleAnalyze}
                  disabled={isProcessing || files.length === 0}
                >
                  {isProcessing ? 'Processing...' : 'Analyze Reports'}
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <FileText className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm">No files selected</p>
                <p className="text-xs">Upload files to begin</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

