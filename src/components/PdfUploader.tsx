import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { validatePdfFiles } from '@/lib/pdf-processor';
import { Upload, FileText, X, CheckCircle2 } from 'lucide-react';

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
      'application/pdf': ['.pdf']
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
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Upload Lab Reports</CardTitle>
        <CardDescription>
          Upload one or more PDF files containing laboratory results for Adam Winchester
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-colors duration-200
            ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
            ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          {isDragActive ? (
            <p className="text-lg font-medium">Drop the PDFs here...</p>
          ) : (
            <div className="space-y-2">
              <p className="text-lg font-medium">Drag & drop PDF files here</p>
              <p className="text-sm text-muted-foreground">or click to select files</p>
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

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Selected Files ({files.length})</h3>
              <Badge variant="secondary">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Ready
              </Badge>
            </div>
            
            <div className="space-y-2">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
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

            {/* Analyze button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleAnalyze}
              disabled={isProcessing || files.length === 0}
            >
              {isProcessing ? 'Processing...' : 'Analyze Reports'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

