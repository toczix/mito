import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { validateApiKey } from '@/lib/claude-service';
import { Eye, EyeOff, Key } from 'lucide-react';

interface ApiKeyInputProps {
  onApiKeySubmit: (apiKey: string) => void;
  isProcessing?: boolean;
}

export function ApiKeyInput({ onApiKeySubmit, isProcessing = false }: ApiKeyInputProps) {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    setError(null);

    const validation = validateApiKey(apiKey);
    if (!validation.valid) {
      setError(validation.error || 'Invalid API key');
      return;
    }

    onApiKeySubmit(apiKey);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Claude API Key
        </CardTitle>
        <CardDescription>
          Enter your Claude API key to analyze clinical pathology reports.{' '}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Get your API key here
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              type={showApiKey ? 'text' : 'password'}
              placeholder="sk-ant-api03-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isProcessing}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              disabled={isProcessing}
              aria-label="Toggle API key visibility"
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button onClick={handleSubmit} disabled={isProcessing || !apiKey}>
            Continue
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="text-sm text-muted-foreground space-y-1">
          <p className="font-medium">Privacy Notice:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Your API key is never stored and only used in your browser</li>
            <li>PDF data is sent directly to Google's Gemini API</li>
            <li>No data is stored on our servers</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

