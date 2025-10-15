import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Key, Save, Eye, EyeOff, CheckCircle2, ExternalLink, AlertCircle } from 'lucide-react';
import { isSupabaseEnabled, getClaudeApiKey, saveClaudeApiKey } from '@/lib/supabase';

export function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadApiKey();
  }, []);

  async function loadApiKey() {
    if (!isSupabaseEnabled) {
      setIsLoading(false);
      return;
    }

    const supabaseKey = await getClaudeApiKey();
    if (supabaseKey) {
      setApiKey(supabaseKey);
    }
    setIsLoading(false);
  }

  async function handleSave() {
    if (!apiKey.trim()) {
      alert('Please enter an API key');
      return;
    }

    if (!isSupabaseEnabled) {
      alert('Supabase is not configured. Please check your environment variables.');
      return;
    }

    setIsSaving(true);

    const saved = await saveClaudeApiKey(apiKey);
    if (saved) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } else {
      alert('Failed to save API key to Supabase. Please try again.');
    }

    setIsSaving(false);
  }

  async function handleClear() {
    if (confirm('Are you sure you want to clear your API key? You will need to re-enter it to use the analysis feature.')) {
      setApiKey('');

      if (isSupabaseEnabled) {
        await saveClaudeApiKey('');
      }

      setSaveSuccess(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Supabase Warning */}
      {!isSupabaseEnabled && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Supabase not configured.</strong> Please set up your environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) to enable API key storage.
          </AlertDescription>
        </Alert>
      )}

      {/* API Key Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Claude API Key
          </CardTitle>
          <CardDescription>
            Your Anthropic Claude API key is stored securely in Supabase and syncs across all your devices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <>
              {/* API Key Input */}
              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="api-key"
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-ant-..."
                      className="font-mono"
                      disabled={!isSupabaseEnabled}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowApiKey(!showApiKey)}
                    type="button"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  🔒 Securely stored in Supabase database - accessible from any device
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={isSaving || !isSupabaseEnabled} className="gap-2">
                  {saveSuccess ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Saved!
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      {isSaving ? 'Saving...' : 'Save API Key'}
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handleClear} disabled={!isSupabaseEnabled}>
                  Clear Key
                </Button>
              </div>

              <Separator />

              {/* Get API Key Link */}
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <h4 className="font-semibold text-sm">Don't have an API key?</h4>
                <p className="text-sm text-muted-foreground">
                  Get your Claude API key from the Anthropic Console.
                </p>
                <Button variant="outline" size="sm" asChild className="gap-2">
                  <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Get API Key
                  </a>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Cost Information */}
      <Card>
        <CardHeader>
          <CardTitle>API Usage & Costs</CardTitle>
          <CardDescription>
            Understanding Claude API costs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="font-semibold text-blue-900">Model</p>
              <p className="text-sm text-blue-700">Claude 3.5 Haiku</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="font-semibold text-green-900">Typical Cost</p>
              <p className="text-sm text-green-700">~$0.01-0.02 per 8-PDF analysis</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            We use text extraction (not image processing) to minimize costs. 
            Check <a href="https://www.anthropic.com/pricing" target="_blank" rel="noopener noreferrer" className="text-primary underline">Anthropic's pricing</a> for current rates.
          </p>
        </CardContent>
      </Card>

      {/* Supabase Setup Guide */}
      {!isSupabaseEnabled && (
        <Card>
          <CardHeader>
            <CardTitle>Supabase Setup Required</CardTitle>
            <CardDescription>
              This app requires Supabase for secure API key storage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                <p className="mb-2">
                  <strong>Supabase provides:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm ml-2">
                  <li>Secure API key storage (synced across all devices)</li>
                  <li>Client library (manage patient records)</li>
                  <li>Analysis history tracking</li>
                  <li>Custom benchmark sync</li>
                </ul>
                <p className="mt-4 text-sm">
                  See <code className="bg-muted px-1 py-0.5 rounded">HOW_TO_SETUP_SUPABASE.md</code> for setup instructions.
                </p>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
